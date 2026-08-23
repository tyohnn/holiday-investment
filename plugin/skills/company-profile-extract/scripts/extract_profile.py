#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""공시 원문(Storage의 사업보고서 섹션) → fin_details / corp_history 규칙 기반 추출·적재.

삼성전자 파일럿(리서치 스크래치패드 pilot-samsung-report.md)이 검증한 파서를 기반으로
정리·강화했다 — 재작성이 아니라 일반화(회차마다 바뀌는 표 모양을 규칙으로 흡수)와
게이트·적재 계층을 얹은 것. 5블록: 연혁·연구개발비·부문별매출·시장점유율·주주현황.

입력: Storage `docs/<corp_code>/<rcept_no>.sections.json.gz` (Phase 3 백필로 이미 존재).
출력: fin_details / corp_history (PostgREST, ingest.py의 rest()/upsert()/replace_scope() 재사용).
DART API 호출 없음. LLM 호출 없음(extracted_by='rule' 고정 — 이번 단계는 규칙 기반만).

사용법:
    python3 extract_profile.py extract --corps 00126380 \
        --rcepts 20260310002820,20250311001085
    python3 extract_profile.py extract --corps 00126380   # --rcepts 생략 시 최신 사업보고서 1건
    python3 extract_profile.py verify  --corps 00126380 --rcepts 20260310002820   # 적재 없이 게이트만
"""
import argparse
import datetime as dt
import gzip
import json
import os
import re
import sys
import urllib.parse

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO = os.path.abspath(os.path.join(_HERE, "..", "..", "..", ".."))
sys.path.insert(0, os.path.join(_REPO, "platform", "ingest"))
import ingest  # noqa: E402  — rest()/upsert()/replace_scope()/storage_download() 재사용, 재발명 금지

EXTRACTED_BY = "rule"

# fin_details 에 이 스킬이 쓰는 concept 전체 — SKILL.md §매핑표와 반드시 일치시킨다.
# extract 는 재실행마다 이 목록 전부에 replace_scope 를 걸어, 파서가 고쳐져서 이전에
# 실렸던 사실이 이번엔 안 나오는 경우도 스코프가 비워지게 한다(스테일 행 방지).
ALL_CONCEPTS = [
    "rnd_total", "rnd_revenue_ratio",
    "segment_revenue", "segment_revenue_pct",
    "segment_operating_income", "segment_operating_income_pct",
    "segment_total_assets", "segment_total_assets_pct",
    "market_share",
    "shareholding_pct",
]


# ══════════════════════════════════════════════════════════ 공용 유틸

def norm(s):
    """공백만 제거한 비교용 정규화 — 헤더 라벨이 회사·회차마다 '부 문'/'부문'처럼
    공백만 다르게 나오는 것을 흡수한다. 저장용 라벨(item_name)에는 쓰지 않는다."""
    return re.sub(r"\s+", "", s or "")


def num(s):
    """'1,879,673' / '△301,146' / '11.3%' → 숫자. 파싱 불가·공란('-','—')이면 None."""
    if s is None:
        return None
    t = s.strip().replace(",", "").replace("%", "")
    neg = t.startswith("△") or t.startswith("-")
    t = t.lstrip("△-")
    if t in ("", "-", "—", ""):
        return None
    try:
        v = float(t)
    except ValueError:
        return None
    return -v if neg else v


def parse_md_tables(md_text):
    """`| a | b |` 연속 라인 블록을 표 하나로 묶는다. 구분선(|---|---|)은 건너뛴다.
    반환: [{"header":[...], "rows":[[...],...], "_pos": <표 시작 문자 오프셋>}]
    병합 셀(rowspan/colspan)로 인한 열 수 불일치는 그대로 남긴다 — 호출부가 처리한다.
    _pos 는 기수(제N기) → 연도 추론에 쓴다(infer_period_labels)."""
    lines = md_text.split("\n")
    offsets = []
    pos = 0
    for line in lines:
        offsets.append(pos)
        pos += len(line) + 1

    blocks = []
    cur, cur_start = [], None
    for i, line in enumerate(lines):
        s = line.strip()
        if s.startswith("|") and s.endswith("|"):
            if not cur:
                cur_start = i
            cur.append(s)
        else:
            if cur:
                blocks.append((cur, cur_start))
                cur = []
    if cur:
        blocks.append((cur, cur_start))

    out = []
    for block, start_line in blocks:
        rows = []
        for line in block:
            cells = [c.strip() for c in line.strip("|").split("|")]
            if all(re.fullmatch(r":?-{1,}:?", c) for c in cells if c):
                continue  # 구분선(---, :--- 등)
            rows.append(cells)
        if rows:
            out.append({"header": rows[0], "rows": rows[1:], "_pos": offsets[start_line]})
    return out


def infer_period_labels(md_text, table_pos, periods):
    """'제N기' 헤더 라벨을 실제 연도로 매핑한다.

    사업보고서 본문은 표 앞뒤 서술 문단에 'YYYY년(제N기) 당사의 …' 형태의 앵커 문장을
    반복적으로 남긴다(회사·항목과 무관하게 같은 회계연도를 계속 재언급하기 때문 — 삼성전자
    두 사업보고서 모두에서 실측: 2025 보고서는 '2025년(제57기)'가 문서 전체에 9회, 2024
    보고서는 '2024년(제56기)'가 등장). 표보다 앞에 나온 가장 가까운 앵커를 기준 삼아
    나머지 '제N기' 컬럼의 연도를 산술로 역산한다 — 하드코딩된 기수→연도 표 없이도
    회사·회차가 바뀌어도 동작한다."""
    anchor = None
    for m in re.finditer(r"(\d{4})년\s*\(제\s*(\d+)\s*기\)", md_text[:table_pos]):
        anchor = (int(m.group(1)), int(m.group(2)))
    if anchor is None:
        return {}
    anchor_year, anchor_gi = anchor
    out = {}
    for p in periods:
        gm = re.fullmatch(r"제\s*(\d+)\s*기", p.strip())
        if not gm:
            continue
        gi = int(gm.group(1))
        out[p] = str(anchor_year - (anchor_gi - gi))
    return out


def fact(concept, item_name, period_key, amount, unit=None, value_basis=None,
         status="ok", section=None, table=None):
    return {"concept": concept, "item_name": item_name, "period_key": period_key,
            "amount": amount, "unit": unit, "value_basis": value_basis, "status": status,
            "source_section": section, "source_table": table}


# ══════════════════════════════════════════════════════════ 1. 회사의 연혁 → corp_history

def parse_history(md_text):
    """'I. 회사의 개요 > 2. 회사의 연혁' 표. 원표는 (연도,내용) 2열이 표준이나 (연도,구분,
    내용) 3열 변형도 허용한다(파일럿 대상 밖 — 방어적으로만 처리).

    함정(파일럿 실측, §0-2): rowspan(연도 병합)이 마크다운 변환에서 풀리면서 같은 해의
    2번째 이후 항목이 '연도' 칸으로 밀려 들어간다 — 첫 칸이 4자리 연도가 아니면 '직전 연도의
    연속 항목'으로 재해석해야 한다."""
    items = []
    for t in parse_md_tables(md_text):
        h = [norm(c) for c in t["header"]]
        if h[:2] == ["연도", "내용"]:
            two_col = True
        elif h[:3] == ["연도", "구분", "내용"]:
            two_col = False
        else:
            continue
        cur_year = None
        for row in t["rows"]:
            col0 = row[0] if row else ""
            if re.fullmatch(r"20\d\d", col0):
                cur_year = col0
                category = None if two_col else (row[1] if len(row) > 1 else None)
                content = (row[1] if two_col else row[2]) if len(row) > (1 if two_col else 2) else ""
            else:
                # rowspan 붕괴: col0 자체가 내용(또는 구분+내용), 마지막 칸은 대개 '—'
                category = None
                content = col0
            if content and content != "—":
                items.append({"event_ym": cur_year, "category": category, "content": content,
                               "source_section": "I. 회사의 개요 > 2. 회사의 연혁"})
        break  # 연혁 표는 섹션당 하나
    return items


# ══════════════════════════════════════════════════════════ 2. 연구개발비 지출 → fin_details

# 함정(파일럿 §0-1, §1 findings): '연구개발비(비용)' 행의 모양이 보고서 회차마다 다르다 —
# 최신 보고서는 '회계 처리'(그룹 라벨) + '연구개발비(비용)'(실라벨)이 한 행에 합쳐져 값이
# 한 칸 밀리고, 직전 보고서는 그룹 라벨 행('개발비 자산화(무형자산)')과 '연구개발비(비용)'
# 행이 분리돼 있다. 라벨 문자열 하나로 열 위치를 고정하면 회차가 바뀔 때 조용히 깨진다 —
# 그래서 "라벨이 0번 칸에 곧바로 있는 경우(shift=0)"와 "그룹 라벨 뒤 1번 칸에 있는 경우
# (shift=1)"를 둘 다 허용하고, 실제 라벨 문자열로 매칭한다(열 인덱스 고정 매핑 금지).
RD_LABEL_RULES = [
    (lambda s: s == "연구개발비용총계", "연구개발비용_총계(세전)", "세전"),
    (lambda s: s == "(정부보조금)", "정부보조금", None),
    (lambda s: s == "연구개발비용계", "연구개발비용_계(세후)", "세후"),
    (lambda s: s == "연구개발비(비용)", "연구개발비(비용)_회계처리", "세후"),
    (lambda s: "개발비자산화" in s, "개발비_자산화(무형자산)", None),
    (lambda s: "매출액비율" in s, "매출액비중_필자게재", "원문게재_반올림1자리"),
]


def parse_rd(md_text):
    facts = []
    for t in parse_md_tables(md_text):
        if norm(t["header"][0] if t["header"] else "") != "과목":
            continue
        header = t["header"]
        period_idx = [i for i, h in enumerate(header) if i > 0 and re.fullmatch(r"제\s*\d+\s*기", h.strip())]
        periods = [header[i] for i in period_idx]
        labels = infer_period_labels(md_text, t["_pos"], periods)
        if not labels:
            continue  # 앵커('YYYY년(제N기)') 문장을 못 찾으면 연도를 확정할 수 없다 — 스킵

        matched = {}  # canonical_label -> (row, shift)
        for row in t["rows"]:
            if not row:
                continue
            n0 = norm(row[0])
            hit = None
            for match_fn, canon, basis in RD_LABEL_RULES:
                if match_fn(n0):
                    hit = (canon, 0, basis)
                    break
            if hit is None and len(row) > 1:
                n1 = norm(row[1])
                for match_fn, canon, basis in RD_LABEL_RULES:
                    if match_fn(n1):
                        hit = (canon, 1, basis)
                        break
            if hit:
                canon, shift, basis = hit
                matched[canon] = (row, shift, basis)

        unit_scale = 1_000_000  # 표 단위: 백만원 → KRW
        for i, pidx in enumerate(period_idx):
            p = periods[i]
            year = labels.get(p)
            if not year:
                continue
            period_key = "%sA" % year
            for canon, (row, shift, basis) in matched.items():
                idx = pidx + shift
                raw = row[idx] if idx < len(row) else None
                v = num(raw)
                is_ratio = canon == "매출액비중_필자게재"
                concept = "rnd_revenue_ratio" if is_ratio else "rnd_total"
                unit = "pct" if is_ratio else "KRW"
                amount = v if is_ratio or v is None else v * unit_scale
                status = "ok" if amount is not None else "확인불가:원문값없음(공란)"
                facts.append(fact(concept, canon, period_key, amount, unit, basis, status,
                                   "II.6.나 연구개발활동의 개요 및 연구개발비용", "[연구개발비용]"))
        break
    return facts


# ══════════════════════════════════════════════════════════ 3. 부문별 매출 → fin_details

# 함정(파일럿 §1, findings): 6열 헤더(부문/매출유형/품목/제N기...) 중 '기타'·'합계' 행은
# 원본 병합 셀 때문에 실제 칸 수가 줄어 있다 — 헤더 열 수 기준 고정 인덱싱은 이 두 행에서
# 조용히 틀린 값을 읽는다. 라벨(row[0])로 행 종류를 가려 각자의 오프셋을 쓴다.
def parse_segment_revenue(md_text):
    facts = []
    for t in parse_md_tables(md_text):
        h = [norm(c) for c in t["header"]]
        if h[:3] != ["부문", "매출유형", "품목"]:
            continue
        period_idx = [i for i, c in enumerate(t["header"]) if i >= 3 and re.fullmatch(r"제\s*\d+\s*기", c.strip())]
        periods = [t["header"][i] for i in period_idx]
        labels = infer_period_labels(md_text, t["_pos"], periods)
        if not labels:
            continue
        scale = 100_000_000  # 억원 → KRW
        for row in t["rows"]:
            if not row:
                continue
            n0 = norm(row[0])
            if "기타" in n0:
                item, vals = "기타(부문간내부거래제거등)", row[2:2 + len(period_idx)]
            elif "합계" in n0:
                item, vals = "합계", row[1:1 + len(period_idx)]
            elif len(row) >= 3 + len(period_idx):
                item, vals = row[0], row[3:3 + len(period_idx)]
            else:
                continue  # 열이 밀린 미분류 행 — 규칙 밖, 스킵(사업부문 라벨이 모호)
            for i, p in enumerate(periods):
                year = labels.get(p)
                if not year or i >= len(vals):
                    continue
                v = num(vals[i])
                facts.append(fact("segment_revenue", item, "%sA" % year,
                                   v * scale if v is not None else None, "KRW", None,
                                   "ok" if v is not None else "확인불가:원문값없음(공란)",
                                   "II.4.가 매출실적", "부문별 매출실적(억원)"))
        break
    return facts


# '라. 사업부문별 요약 재무 현황' — 2단 헤더(제N기 아래 금액/비중) + 부문명 rowspan 이 겹쳐
# 있어 화이트리스트 없이는 풀리지 않는다(파일럿 §4-6: "이런 표는 애초에 LLM 추출 후보로
# 분류하는 게 나을 수 있다"). 회사별 화이트리스트가 없으면 확인불가로 남기고 스킵한다 —
# 다음 단계(LLM 폴백)의 후보로 명시적으로 남겨두는 것이지, 억지로 규칙화하지 않는다.
SEGMENT_SUMMARY_WHITELIST = {
    "00126380": {"segments": {"DX 부문", "DS 부문", "SDC", "Harman"},
                 "metrics": {"매출액", "영업이익", "총자산"}},
}
_METRIC_CONCEPT = {"매출액": "segment_revenue", "영업이익": "segment_operating_income",
                    "총자산": "segment_total_assets"}


def parse_segment_summary(md_text, corp_code):
    wl = SEGMENT_SUMMARY_WHITELIST.get(corp_code)
    if not wl:
        return [], "확인불가:부문화이트리스트미등록(회사별전용파서필요,LLM폴백후보)"
    facts = []
    for t in parse_md_tables(md_text):
        h = [norm(c) for c in t["header"]]
        if h[:2] != ["부문", "구분"]:
            continue
        period_idx = [i for i, c in enumerate(t["header"]) if i >= 2 and re.fullmatch(r"제\s*\d+\s*기", c.strip())]
        periods = [t["header"][i] for i in period_idx]
        labels = infer_period_labels(md_text, t["_pos"], periods)
        if not labels:
            return [], "확인불가:기수연도앵커없음"
        scale = 100_000_000  # 억원 → KRW
        cur_seg = None
        for row in t["rows"]:
            if not row:
                continue
            if row[0] == "금액" or (len(row) > 1 and row[0] == "금액" and row[1] == "비중"):
                continue  # 2단 헤더의 서브헤더 행(금액/비중 반복) — 스킵
            if row[0] in wl["segments"]:
                cur_seg, metric, rest = row[0], row[1] if len(row) > 1 else None, row[2:]
            elif row[0] in wl["metrics"]:
                metric, rest = row[0], row[1:]
            else:
                continue
            if metric not in wl["metrics"] or cur_seg is None:
                continue
            concept = _METRIC_CONCEPT[metric]
            # 컬럼 배열: [금액,비중] × len(period_idx)
            for i, p in enumerate(periods):
                year = labels.get(p)
                if not year:
                    continue
                amt_s = rest[2 * i] if 2 * i < len(rest) else None
                pct_s = rest[2 * i + 1] if 2 * i + 1 < len(rest) else None
                amt, pct = num(amt_s), num(pct_s)
                pk = "%sA" % year
                # metric=='매출액' 의 절대금액은 여기서 적재하지 않는다 — parse_segment_revenue
                # 가 '가. 매출실적' 표에서 이미 같은 (corp_code,period_key,concept='segment_revenue',
                # item_name,source_rcept_no) 자연키로 뽑는다(실측: 두 표의 DX 부문 금액이 소수점까지
                # 동일). 여기서도 concept='segment_revenue' 로 다시 적재하면 같은 rcept 안에서
                # 자연키가 충돌해 INSERT 배치가 깨지거나(같은 요청 안 중복 키) dedupe_by 가 조용히
                # 한쪽을 버린다 — 이 표는 '비중'(_pct)만 이 표에서만 나오는 새 정보이므로 그것만 쓴다.
                # 영업이익·총자산은 다른 표에 없는 정보라 금액·비중 둘 다 적재한다.
                if metric != "매출액":
                    facts.append(fact(concept, cur_seg, pk, amt * scale if amt is not None else None,
                                       "KRW", None, "ok" if amt is not None else "확인불가:원문값없음(공란)",
                                       "II.7.라 사업부문별 요약 재무 현황", "요약재무현황"))
                facts.append(fact(concept + "_pct", cur_seg, pk, pct, "pct", None,
                                   "ok" if pct is not None else "확인불가:원문값없음(공란)",
                                   "II.7.라 사업부문별 요약 재무 현황", "요약재무현황"))
        break
    return facts, None


# ══════════════════════════════════════════════════════════ 4. 시장점유율 → fin_details

# 파일럿 §1: 이번 5항목 중 유일하게 병합 셀 없이 100% 규칙 기반으로 완결된 표.
def parse_market_share(md_text):
    facts = []
    lines = md_text.split("\n")
    for i, line in enumerate(lines):
        m = re.search(r"<\s*(.+?)\s*시장점유율\s*추이\s*>", line)
        if not m:
            continue
        product = m.group(1)
        j = i + 1
        table_lines = []
        while j < len(lines) and not lines[j].strip().startswith("|"):
            j += 1
        while j < len(lines) and lines[j].strip().startswith("|"):
            table_lines.append(lines[j].strip())
            j += 1
        tbl = parse_md_tables("\n".join(table_lines))
        if not tbl:
            continue
        t = tbl[0]
        header = t["header"]
        for row in t["rows"]:
            item = row[0]
            for c in range(1, min(len(header), len(row))):
                ym = header[c].strip()
                mm = re.fullmatch(r"(\d{4})년?", ym)
                if not mm:
                    continue
                v = num(row[c])
                facts.append(fact("market_share", "%s|%s" % (product, item), "%sA" % mm.group(1),
                                   v, "pct", None, "ok" if v is not None else "확인불가:원문값없음(공란)",
                                   "II.2 주요 제품 및 서비스", "<%s 시장점유율 추이>" % product))
    return facts


# ══════════════════════════════════════════════════════════ 5. 주주 구분별 지분 → fin_details

def parse_shareholders(md_text):
    facts = []
    tables = parse_md_tables(md_text)

    # (a) 최대주주 등 — '성명/관계/…' 표의 '계'/보통주/기말 행.
    for t in tables:
        h = [norm(c) for c in t["header"]]
        if h[:1] == ["성명"] or "관계" in h:
            for row in t["rows"]:
                if row and row[0] == "계" and len(row) >= 6 and row[1] == "보통주":
                    v = num(row[5])
                    facts.append(fact("shareholding_pct", "최대주주등_계_보통주", None, v, "pct", "기말",
                                       "ok" if v is not None else "확인불가:원문값없음(공란)",
                                       "VII.1 최대주주 및 그 특수관계인의 주식소유 현황",
                                       "성명/관계/주식의종류/소유주식수및지분율(기초·기말)"))
            break

    # (b) 5% 이상 주주 — 개별 보유자 라인만 존재(합계 카테고리 자체가 원문에 없다, 파일럿 §2-4).
    for t in tables:
        h = [norm(c) for c in t["header"]]
        if h[:2] == ["구분", "주주명"]:
            header_w = len(t["header"])
            for row in t["rows"]:
                trimmed = list(row)
                while trimmed and trimmed[-1] == "—":
                    trimmed.pop()
                if len(trimmed) >= header_w:
                    data = trimmed[1:1 + 3]
                elif len(trimmed) == header_w - 1:
                    data = trimmed[0:3]
                else:
                    continue
                if len(data) >= 2 and num(data[1]) is not None:
                    v = num(data[2]) if len(data) > 2 else None
                    facts.append(fact("shareholding_pct", "5%%이상_%s" % data[0], None, v, "pct",
                                       "개별_원문", "ok" if v is not None else "확인불가:원문값없음(공란)",
                                       "VII.4.가 주식 소유 현황", "5% 이상 주주"))
            facts.append(fact("shareholding_pct", "5%이상_합계", None, None, None, None,
                               "확인불가:원문에합계카테고리없음(개별보유자만존재,rule은개별값만적재)",
                               "VII.4.가 주식 소유 현황", "5% 이상 주주"))
            break

    # (c) 임원 — 사업보고서에 FnGuide식 합계 항목 자체가 없다(파일럿 §2-4). 지어내지 않고
    # 확인불가 1급 레코드로 남긴다 — 원천 추정(AGENTS.md·파일럿 결론)도 함께 적는다.
    facts.append(fact("shareholding_pct", "임원", None, None, None, None,
                       "확인불가:원문에없음(추정출처:임원ㆍ주요주주소유상황보고서,별도report_nm계열)",
                       "VII. 주주에 관한 사항", None))
    return facts


def parse_treasury(md_text):
    """자기주식 보유비율 — 'I. 회사의 개요 > 4. 주식의 총수 등'에 있다(섹션이 다르다,
    파일럿 §2-4 함정). 원문 반올림(1자리)과 발행주식총수÷자기주식수 정밀계산 두 값을
    별도 item_name 으로 남긴다(같은 자연키에 value_basis 만 다른 두 행은 유니크 제약을
    위반한다 — 마이그레이션 주석 그대로)."""
    facts = []
    tables = parse_md_tables(md_text)
    for t in tables:
        h = [norm(c) for c in t["header"]]
        row0s = [r[0] for r in t["rows"] if r]
        if h[:1] != ["구분"]:
            continue
        if "Ⅶ.자기주식보유비율" in [norm(r) for r in row0s]:
            for row in t["rows"]:
                if row and norm(row[0]) == "Ⅶ.자기주식보유비율" and len(row) >= 4:
                    v = num(row[3])
                    facts.append(fact("shareholding_pct", "자사주_원문반올림", None, v, "pct",
                                       "원문반올림1자리", "ok" if v is not None else "확인불가:원문값없음(공란)",
                                       "I.4.가 주식의 총수", "주식의 총수 등 (자기주식 보유비율)"))
        if "Ⅳ.발행주식의총수(Ⅱ-Ⅲ)" in [norm(r) for r in row0s]:
            rows_by_label = {norm(r[0]): r for r in t["rows"] if r}
            v4 = rows_by_label.get("Ⅳ.발행주식의총수(Ⅱ-Ⅲ)")
            v5 = rows_by_label.get("Ⅴ.자기주식수")
            if v4 and v5 and len(v4) >= 4 and len(v5) >= 4:
                issued, treasury = num(v4[3]), num(v5[3])
                if issued:
                    facts.append(fact("shareholding_pct", "자사주_정밀계산", None,
                                       round(treasury / issued * 100, 4), "pct", "정밀계산", "ok",
                                       "I.4.가 주식의 총수",
                                       "자기주식수(Ⅴ)/발행주식총수(Ⅳ)×100"))
    return facts


# ══════════════════════════════════════════════════════════ 게이트

def db_rows_pg(path, params):
    qs = urllib.parse.urlencode(params)
    return ingest.rest("GET", "%s?%s" % (path, qs))


def db_revenue(corp_code, period_key):
    for fs in ("CFS", "OFS"):
        rows = db_rows_pg("fin_periods", {
            "select": "revenue", "corp_code": "eq.%s" % corp_code, "period_type": "eq.A",
            "period_key": "eq.%s" % period_key, "fs_div": "eq.%s" % fs})
        if rows and rows[0].get("revenue") is not None:
            return rows[0]["revenue"], fs
    return None, None


def report_fiscal_year(rcept_no):
    """이 rcept_no 가 다루는 회계연도. filings.report_nm 이 '사업보고서 (YYYY.MM)' 꼴이라
    거기서 뽑는다 — 주주현황·자사주처럼 표 자체에 연도 라벨이 없는 '시점형' 개념의
    period_key 를 채우는 데 쓴다(사업보고서는 그 회계연도 말 기준 스냅숏이므로 rcept_no
    당 회계연도 하나가 자연스럽게 대응된다)."""
    rows = db_rows_pg("filings", {"select": "report_nm", "rcept_no": "eq.%s" % rcept_no})
    if not rows:
        return None
    m = re.search(r"\((\d{4})\.\d{2}\)", rows[0].get("report_nm") or "")
    return m.group(1) if m else None


def apply_gates(corp_code, facts, notes):
    """게이트를 통과 못 하면 해당 행을 적재 대상에서 뺀다(적재 중단·보고, 계획 문서 §3).
    facts 를 in-place 로 걸러 (통과분, 보류분) 을 돌려준다."""
    ok, held = [], []

    # 게이트 1: pct 단위 값은 [0,100] 범위여야 한다 — 단, 이 불변식이 실제로 성립하는
    # concept 에만 건다. segment_operating_income_pct 는 제외한다: 한 부문이 적자면
    # 다른 부문의 영업이익 비중이 100%를 넘거나 음수가 될 수 있다(실측: 삼성전자 2023년
    # DX 부문 영업이익 비중 219.0%, DS 부문 △226.6% — 둘 다 원문 그대로의 실제 값이지
    # 파싱 오류가 아니다). 이 concept 에까지 [0,100] 게이트를 걸면 진짜 사실을 오탐으로
    # 확인불가 처리하게 된다.
    PCT_RANGE_GATED = {"market_share", "shareholding_pct", "rnd_revenue_ratio",
                        "segment_revenue_pct", "segment_total_assets_pct"}
    for f in facts:
        if (f["unit"] == "pct" and f["concept"] in PCT_RANGE_GATED and f["amount"] is not None
                and not (0 <= f["amount"] <= 100)):
            f["status"] = "확인불가:게이트실패(비율범위이탈:%.4f)" % f["amount"]
            f["amount"] = None
            held.append(f)
            notes.append("게이트 실패(범위): %s/%s = 원값 범위 밖 → 확인불가로 강등" %
                         (f["concept"], f["item_name"]))
        else:
            ok.append(f)

    # 게이트 2: 부문 매출 합 vs fin_periods.revenue (±1%) — period_key 별로.
    by_period = {}
    for f in ok:
        if f["concept"] == "segment_revenue" and f["item_name"] == "합계" and f["amount"] is not None:
            by_period[f["period_key"]] = f["amount"]
    for pk, total in by_period.items():
        db_rev, fs = db_revenue(corp_code, pk)
        if db_rev is None:
            notes.append("게이트 스킵(부문합 대조, %s): fin_periods 값 없음" % pk)
            continue
        diff_pct = abs(total - db_rev) / db_rev * 100 if db_rev else None
        if diff_pct is None or diff_pct > 1:
            notes.append("게이트 실패(부문합 대조, %s, %s): 부문합=%s vs DB=%s, 차이=%.4f%% → "
                         "해당 period_key 의 segment_revenue* 적재 보류" % (pk, fs, total, db_rev, diff_pct or -1))
            kept = []
            for f in ok:
                if f["period_key"] == pk and f["concept"].startswith("segment_"):
                    f["status"] = "확인불가:게이트실패(부문합불일치)"
                    held.append(f)
                else:
                    kept.append(f)
            ok = kept
        else:
            notes.append("게이트 통과(부문합 대조, %s, %s): 차이=%.6f%%" % (pk, fs, diff_pct))

    # 게이트 3: R&D 매출비중 재계산 대조 — 세전총계÷DB매출×100 이 필자게재 비율과 ±0.5pt 이내.
    rnd_pretax = {f["period_key"]: f["amount"] for f in ok
                  if f["concept"] == "rnd_total" and f["item_name"] == "연구개발비용_총계(세전)"}
    rnd_ratio = {f["period_key"]: f for f in ok
                 if f["concept"] == "rnd_revenue_ratio" and f["item_name"] == "매출액비중_필자게재"}
    for pk, ratio_fact in rnd_ratio.items():
        pretax = rnd_pretax.get(pk)
        db_rev, fs = db_revenue(corp_code, pk)
        if pretax is None or db_rev is None or ratio_fact["amount"] is None:
            notes.append("게이트 스킵(R&D비중 재계산, %s): 입력값 부족" % pk)
            continue
        recomputed = pretax / db_rev * 100
        diff = abs(recomputed - ratio_fact["amount"])
        if diff > 0.5:
            notes.append("게이트 실패(R&D비중 재계산, %s): 재계산=%.4f%% vs 필자게재=%.4f%% "
                         "(차이 %.4fpt > 0.5pt) → rnd_revenue_ratio 적재 보류" % (pk, recomputed, ratio_fact["amount"], diff))
            ratio_fact["status"] = "확인불가:게이트실패(비중재계산불일치)"
            ratio_fact["amount"] = None
            held.append(ratio_fact)
            ok = [f for f in ok if f is not ratio_fact]
        else:
            notes.append("게이트 통과(R&D비중 재계산, %s): 재계산=%.4f%% vs 필자게재=%.4f%% (차이 %.4fpt)" %
                         (pk, recomputed, ratio_fact["amount"], diff))

    # 게이트 4: 자릿수 sanity — 같은 concept·item_name 의 연속 기간 값이 10배 이상 튀면 보류.
    by_key = {}
    for f in ok:
        if f["amount"] is None or f["period_key"] is None:
            continue
        by_key.setdefault((f["concept"], f["item_name"]), []).append(f)
    kept2 = []
    dropped_ids = set()
    for key, flist in by_key.items():
        flist_sorted = sorted(flist, key=lambda f: f["period_key"])
        for a, b in zip(flist_sorted, flist_sorted[1:]):
            if a["amount"] and b["amount"] and a["amount"] != 0:
                # 절대값 비율을 쓴다 — 부호만 다른 것(흑자↔적자 전환)은 자릿수 오류가
                # 아니라 실제 실적 변동이다(실측: DS 부문 영업이익이 2023 적자→2024 흑자로
                # 전환됐는데, 부호 있는 비율로 비교하면 이런 정상적인 전환마다 항상
                # ratio<=0.1 이 성립해 오탐이 난다).
                ratio = abs(b["amount"]) / abs(a["amount"])
                if ratio >= 10 or ratio <= 0.1:
                    notes.append("게이트 실패(자릿수 sanity): %s/%s %s→%s 값이 %.1f배 튐 → %s 적재 보류" %
                                 (key[0], key[1], a["period_key"], b["period_key"], ratio, b["period_key"]))
                    b["status"] = "확인불가:게이트실패(전기대비10배이상변동)"
                    b["amount"] = None
                    dropped_ids.add(id(b))
    for f in ok:
        if id(f) in dropped_ids:
            held.append(f)
        else:
            kept2.append(f)
    return kept2, held


# ══════════════════════════════════════════════════════════ 추출 파이프라인

def load_sections(corp_code, rcept_no):
    path = "%s/%s/%s.sections.json.gz" % (ingest.DOCS_PREFIX, corp_code, rcept_no)
    status, data = ingest.storage_download(path)
    if status != 200:
        return None, "확인불가:Storage에섹션없음(path=%s,status=%s)" % (path, status)
    try:
        sections = json.loads(gzip.decompress(data).decode("utf-8"))
    except Exception as e:  # noqa: BLE001 — 원문 손상은 스킵 사유로만 쓴다
        return None, "확인불가:섹션디코드실패(%s)" % e
    return {s["title"]: s["content"] for s in sections}, None


def extract_one(corp_code, rcept_no):
    """한 (corp_code, rcept_no) 에서 5블록을 전부 추출한다.
    반환: (fin_details 후보 facts, corp_history 후보 items, notes)"""
    notes = []
    sections, err = load_sections(corp_code, rcept_no)
    if err:
        notes.append(err)
        return [], [], notes

    facts, hist = [], []

    if "I. 회사의 개요" in sections:
        hist += parse_history(sections["I. 회사의 개요"])
        facts += parse_treasury(sections["I. 회사의 개요"])
    else:
        notes.append("확인불가: 'I. 회사의 개요' 섹션 없음 — 연혁·자사주 스킵")

    if "II. 사업의 내용" in sections:
        md = sections["II. 사업의 내용"]
        facts += parse_rd(md)
        facts += parse_segment_revenue(md)
        seg_summary_facts, seg_err = parse_segment_summary(md, corp_code)
        if seg_err:
            notes.append("부문 요약재무현황(비중/영업이익/총자산): %s" % seg_err)
        facts += seg_summary_facts
        facts += parse_market_share(md)
    else:
        notes.append("확인불가: 'II. 사업의 내용' 섹션 없음 — R&D·부문매출·시장점유율 스킵")

    if "VII. 주주에 관한 사항" in sections:
        facts += parse_shareholders(sections["VII. 주주에 관한 사항"])
    else:
        notes.append("확인불가: 'VII. 주주에 관한 사항' 섹션 없음 — 주주현황 스킵")

    # 주주·자사주는 표 자체에 연도 라벨이 없는 '시점형' 개념이라 period_key 를 못 채운 채
    # 반환됐다(parse_shareholders/parse_treasury) — 이 rcept_no 의 회계연도로 채운다.
    # fin_details.period_key 는 NOT NULL 이라, 회계연도를 못 구하면 적재 대신 스킵하고 보고한다.
    missing_pk = [f for f in facts if f["period_key"] is None]
    if missing_pk:
        fy = report_fiscal_year(rcept_no)
        if fy:
            for f in missing_pk:
                f["period_key"] = "%sA" % fy
        else:
            notes.append("확인불가: rcept_no=%s 의 회계연도를 filings.report_nm 에서 못 구함 — "
                         "주주·자사주 %d행 스킵(period_key NOT NULL)" % (rcept_no, len(missing_pk)))
            facts = [f for f in facts if f["period_key"] is not None]

    return facts, hist, notes


# ══════════════════════════════════════════════════════════ 적재

def to_db_row(corp_code, rcept_no, f):
    return {
        "corp_code": corp_code, "period_key": f["period_key"], "concept": f["concept"],
        "item_name": f["item_name"], "amount": f["amount"], "unit": f["unit"],
        "value_basis": f["value_basis"], "status": f["status"], "source_rcept_no": rcept_no,
        "source_section": f["source_section"], "source_table": f["source_table"],
        "extracted_by": EXTRACTED_BY,
    }


def to_history_row(corp_code, rcept_no, h):
    return {
        "corp_code": corp_code, "event_ym": h["event_ym"], "category": h["category"],
        "content": h["content"], "source_rcept_no": rcept_no,
        "source_section": h["source_section"], "extracted_by": EXTRACTED_BY,
    }


def load_scope(corp_code, rcept_no, facts, hist):
    """스코프 교체: (corp_code × concept × source_rcept_no) 단위로 delete→insert.
    ALL_CONCEPTS 전체를 매번 훑어, 이번 파싱에서 안 나온 concept 은 빈 리스트로
    replace_scope 를 걸어 스테일 행(이전엔 파싱됐다가 이번엔 안 나오는 사실)을 지운다."""
    by_concept = {}
    for f in facts:
        by_concept.setdefault(f["concept"], []).append(to_db_row(corp_code, rcept_no, f))
    for concept in ALL_CONCEPTS:
        rows = by_concept.get(concept, [])
        # 자연키 중복 방어(같은 표에서 같은 item_name 이 두 번 잡히는 회귀 방지)
        rows = ingest.dedupe_by(rows, ["corp_code", "period_key", "concept", "item_name",
                                        "source_rcept_no"], "fin_details:%s" % concept)
        ingest.replace_scope(
            "fin_details",
            {"corp_code": "eq.%s" % corp_code, "concept": "eq.%s" % concept,
             "source_rcept_no": "eq.%s" % rcept_no},
            rows, on_conflict="corp_code,period_key,concept,item_name,source_rcept_no")
        print("  fin_details[%s]: %d행" % (concept, len(rows)))

    hist_rows = [to_history_row(corp_code, rcept_no, h) for h in hist]
    hist_rows = ingest.dedupe_by(hist_rows, ["corp_code", "source_rcept_no", "event_ym", "content"],
                                  "corp_history")
    ingest.replace_scope(
        "corp_history", {"corp_code": "eq.%s" % corp_code, "source_rcept_no": "eq.%s" % rcept_no},
        hist_rows, on_conflict="corp_code,source_rcept_no,event_ym,content")
    print("  corp_history: %d행" % len(hist_rows))


# ══════════════════════════════════════════════════════════ 대상 회차 결정

def latest_annual_rcept(corp_code):
    rows = db_rows_pg("filings", {
        "select": "rcept_no,rcept_dt,report_nm", "corp_code": "eq.%s" % corp_code,
        "report_nm": "like.사업보고서*", "order": "rcept_dt.desc", "limit": "1"})
    return rows[0]["rcept_no"] if rows else None


# ══════════════════════════════════════════════════════════ 커버리지 보고

BLOCK_LABELS = [
    ("corp_history", "최근연혁"),
    ("rnd_total", "연구개발비 지출(금액)"),
    ("rnd_revenue_ratio", "연구개발비 지출(매출비중)"),
    ("segment_revenue", "부문별 매출"),
    ("segment_revenue_pct", "부문별 매출비중"),
    ("segment_operating_income", "부문별 영업이익"),
    ("segment_total_assets", "부문별 총자산"),
    ("market_share", "주요제품 시장점유율"),
    ("shareholding_pct", "주주 구분별 지분현황"),
]


def print_coverage(corp_code, rcept_no, facts, hist, held, notes):
    print("─" * 70)
    print("커버리지 보고: corp=%s rcept=%s" % (corp_code, rcept_no))
    counts = {}
    for f in facts:
        counts.setdefault(f["concept"], [0, 0])[0] += 1
        if f["status"] != "ok":
            counts[f["concept"]][1] += 1
    counts["corp_history"] = [len(hist), 0]
    for concept, label in BLOCK_LABELS:
        n_ok, n_unk = counts.get(concept, [0, 0])
        held_n = sum(1 for h in held if h["concept"] == concept)
        print("  %-28s %-24s 적재=%d (확인불가=%d, 게이트보류=%d)" % (concept, label, n_ok, n_unk, held_n))
    if notes:
        print("  --- notes ---")
        for n in notes:
            print("  · %s" % n)
    print("─" * 70)


# ══════════════════════════════════════════════════════════ CLI

def run(corps, rcepts_arg, do_load):
    ingest.print_target()
    for corp_code in corps:
        rcepts = rcepts_arg
        if not rcepts:
            r = latest_annual_rcept(corp_code)
            if not r:
                print("[%s] 사업보고서 filings 행을 찾지 못함 — 스킵" % corp_code)
                continue
            rcepts = [r]
        for rcept_no in rcepts:
            print("\n=== corp=%s rcept=%s (%s) ===" % (
                corp_code, rcept_no, "적재" if do_load else "검증만(dry-run)"))
            facts, hist, notes = extract_one(corp_code, rcept_no)
            facts, held = apply_gates(corp_code, facts, notes)
            if do_load:
                load_scope(corp_code, rcept_no, facts, hist)
            print_coverage(corp_code, rcept_no, facts, hist, held, notes)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    def add_common(sp):
        sp.add_argument("--corps", required=True, help="쉼표구분 corp_code 목록 (예: 00126380)")
        sp.add_argument("--rcepts", default=None,
                         help="쉼표구분 rcept_no 목록 — 생략 시 회사별 최신 사업보고서 1건 자동 선택")

    sp_extract = sub.add_parser("extract", help="5블록 추출 → 게이트 → fin_details/corp_history 적재")
    add_common(sp_extract)
    sp_verify = sub.add_parser("verify", help="적재 없이 파싱+게이트만 재실행(dry-run)")
    add_common(sp_verify)

    args = p.parse_args()
    corps = [c.strip() for c in args.corps.split(",") if c.strip()]
    rcepts = [r.strip() for r in args.rcepts.split(",")] if args.rcepts else None
    run(corps, rcepts, do_load=(args.cmd == "extract"))


if __name__ == "__main__":
    main()
