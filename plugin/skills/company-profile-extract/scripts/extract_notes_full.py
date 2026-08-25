#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""주석 계정 추출 — 39종 확장(파일럿 3종 포함) → financial_facts.

2026-08-25. `extract_notes_pilot.py`(3종: 이자비용·감가상각비·무형자산상각비)를 일반화한다.
파일럿이 검증한 표 구조 3종(기능별 배분·다단 범주 반복·3개년 나열)에 더해, 이번에 실측한
4번째 구조("합계 → 세부" 다단 라벨 반복형이되 표 하나가 여러 상위 개념을 담는다: 판관비 세부,
기타수익/기타비용, 금융수익/금융비용 확장, CF 조정+운전자본 통합표)와 5번째 구조(지분법
평가내역 — 회사별 행 + '계' 합계 행)를 추가로 처리한다.

핵심 설계 결정 (근거는 스크래치패드 주석확장-채점표.md 에 상세, 여기서는 요약만):

1. **account_nm 은 원문 그대로 — FnGuide 라벨을 지어내지 않는다.** FnGuide 화면의 판관비
   5종(인건비및복리후생비·일반관리비·판매비·기타원가성비용·기타)이나 CF 조정의 '기타' 같은
   버킷은 DART 주석 원문에 그 문자열 그대로 존재하지 않는다 — 여러 개의 원문 세부 항목을
   합산해야 나온다(예: 인건비및복리후생비 = 급여+퇴직급여, 실측 오차 0). 이 스크립트는
   **원문 세부 항목만** financial_facts 에 적재하고, FnGuide 버킷과의 합산 대응관계는
   스코어카드(주석확장-채점표.md)에 파생식으로만 기록한다 — DB에는 없는 라벨을 만들지 않는다.

2. **감가상각비/무형자산상각비 라벨 재사용 — 안전성 논증.** '판매비와관리비에 대한 공시'
   표의 세부 항목 중에도 리터럴 '감가상각비'/'무형자산상각비'가 있다(판관비 배분분만,
   전사 합계보다 작다). fin_periods_rebuild() 의 개념 매칭은 account_nm 하나로 그룹화해
   max(amount) 를 취한다 — '판관비 배분분 ⊆ 전사 합계'가 항상 성립하므로(부분집합은
   전체를 넘을 수 없다) 두 값을 같은 라벨로 적재해도 max() 는 항상 전사 합계(옳은 값)를
   고른다. 이 스크립트는 이 성질에 기대어 두 표 모두 리터럴 라벨 그대로 적재하고,
   fin_periods_refresh 이후 회귀값을 실측으로 재확인한다(감독 지시 §fin_periods 회귀).

3. **'기타' 라벨 중복.** 판관비·기타수익·기타비용·CF조정·CF운전자본 다섯 표 모두 세부
   항목에 '기타'가 있고 표마다 값이 다르다. account_detail 은 감독 지시로 'NOTE:rule'
   고정이라 표 출처를 못 담는다 — account_nm='기타' 인 행이 같은 (연도,보고서) 스코프에
   여러 개 남는다(자연키는 amount 가 달라 충돌하지 않는다). 알려진 한계로 보고한다.

사용법:
    python3 extract_notes_full.py --corp 00126380 --rcept 20260310002820 [--dry-run]
"""
import argparse
import gzip
import json
import os
import re
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO = os.path.abspath(os.path.join(_HERE, "..", "..", "..", ".."))
sys.path.insert(0, os.path.join(_REPO, "platform", "ingest"))
sys.path.insert(0, _HERE)
import ingest  # noqa: E402
import extract_profile as ep  # noqa: E402

ACCOUNT_ID_SENTINEL = "-표준계정코드 미사용-"
SOURCE_TAG = "NOTE:rule"
CORP_CODE = "00126380"

_CAPTION_RE = re.compile(r"^\| *([^|]+?) *\| *— *\|\s*$", re.MULTILINE)


# ══════════════════════════════════════════════════════════ 원시 유틸 (파일럿 재사용 + 확장)

def num_signed(s):
    """ep.num() 을 감싸 괄호 음수 표기 '(4,550,796)' 를 처리한다. ep.num() 은 '△'/'-' 접두
    부호만 인식하고 괄호는 파싱 실패(None)로 떨어뜨린다(실측 확인) — 주석 표는 괄호로
    음수를 표기하는 관행이라(CF 조정·운전자본 세부) 이 래퍼가 반드시 필요하다."""
    if s is None:
        return None
    t = s.strip()
    if t in ("", "-", "—"):
        return None
    if t.startswith("(") and t.endswith(")"):
        inner = ep.num(t[1:-1])
        return None if inner is None else -inner
    return ep.num(t)


def load_note_section(corp_code, rcept_no, title="3. 연결재무제표 주석"):
    path = "%s/%s/%s.sections.json.gz" % (ingest.DOCS_PREFIX, corp_code, rcept_no)
    status, data = ingest.storage_download(path)
    if status != 200:
        raise RuntimeError("Storage에 섹션 없음: %s (status=%s)" % (path, status))
    sections = json.loads(gzip.decompress(data).decode("utf-8"))
    d = {s["title"]: s["content"] for s in sections}
    if title not in d:
        raise RuntimeError("섹션 없음: %r (있는 제목: %s)" % (title, list(d.keys())))
    return d[title]


def _split_당기_전기(md_text, caption):
    """캡션 뒤 '당기'/'전기' 두 블록을 다음 같은 레벨 캡션 직전까지 정확히 자른다
    (extract_notes_pilot.py 의 동명 함수와 동일 — 그대로 복제, 새 파일에서도 독립적으로
    동작하게 하기 위함이다)."""
    caps = [(m.start(), m.group(1).strip()) for m in _CAPTION_RE.finditer(md_text)]
    idx = next((i for i, (_, label) in enumerate(caps) if label == caption), None)
    if idx is None:
        raise RuntimeError("캡션을 찾지 못함: %r" % caption)
    start = caps[idx][0]
    end = caps[idx + 1][0] if idx + 1 < len(caps) else len(md_text)
    window = md_text[start:end]
    tables = ep.parse_md_tables(window)
    return window, tables


def _period_marker(cells):
    n = [ep.norm(c) for c in cells]
    return len(n) >= 2 and n[0] in ("당기", "전기") and "단위" in cells[1]


def _row_label_amount(row):
    """FLAT/NESTED 두 형태를 모두 흡수하는 일반 행 파서.

    실측(3개 표 공통 패턴): 표가 '합계 → 세부' 다단 구조일 때 마크다운 변환이 rowspan 을
    깨뜨려, 세부 항목이 상위 라벨을 뭉개고 '부모라벨(반복) | 자기라벨 | 금액 | -' 4열로
    나온다(NESTED) — 그런데 그 다음 형제 행부터는 다시 '자기라벨 | 금액 | - | -' 로
    돌아온다(FLAT). 판별 규칙: row[1] 이 숫자로 파싱되면 FLAT(label=row[0], amount=row[1]),
    안 되고 row[2] 가 숫자면 NESTED(label=row[1], amount=row[2]). 파일럿의
    parse_financial_costs() 가 이 패턴을 '금융비용합계'/'이자비용(금융원가)' 리터럴로
    하드코딩했던 것을 일반화한 것 — 여기서는 특정 라벨을 몰라도 판별된다."""
    if len(row) >= 2 and num_signed(row[1]) is not None:
        return row[0].strip(), row[1].strip()
    if len(row) >= 3 and num_signed(row[2]) is not None:
        return row[1].strip(), row[2].strip()
    return None, None


def parse_block_items(md_text, caption, notes):
    """캡션 블록 전체를 당기/전기로 갈라 **모든** (라벨→금액) 쌍을 뽑는다. 호출부가
    필요한 라벨만 골라 쓴다 — 총계·소계 행도 여기 다 들어있으니 걸러내는 건 호출부 책임
    (SKIP 리스트를 여기 두지 않는 이유: 표마다 스킵할 라벨이 다르고, 원시 파서는 최대한
    무판단으로 두는 편이 재사용성이 높다)."""
    window, tables = _split_당기_전기(md_text, caption)
    out = {"당기": {}, "전기": {}}
    cur_period = None
    for t in tables:
        if _period_marker(t["header"]):
            cur_period = ep.norm(t["header"][0])
            continue
        for row in t["rows"]:
            if not row:
                continue
            if _period_marker(row):
                cur_period = ep.norm(row[0])
                continue
            if cur_period not in ("당기", "전기"):
                continue
            label, amt_s = _row_label_amount(row)
            if label is None or label in ("", "—"):
                continue
            v = num_signed(amt_s)
            if v is None:
                continue
            # 같은 라벨이 한 기간 블록에 두 번 나오면(관측 안 됨, 방어적으로만) 나중 값을
            # 덮어쓰지 않고 첫 값을 지킨다 — 조용한 덮어쓰기보다 노트에 남기는 편이 안전.
            if label in out[cur_period] and out[cur_period][label] != v:
                notes.append("parse_block_items(%r): 라벨 '%s' 이 %s 블록에 두 값(%s, %s) — 첫 값 유지" %
                             (caption, label, cur_period, out[cur_period][label], v))
                continue
            out[cur_period][label] = v
    return out


def parse_equity_method(md_text, notes):
    """'라. 당기 및 전기 중 지분법평가 내역' — 회사별 지분법평가 행 + '계' 합계 행.
    _CAPTION_RE 에 안 걸린다(2열 '| 라벨 | — |' 형태가 아니라 서술문 안에 있다) — 그래서
    별도 앵커(문자열 검색)로 구간을 자른다. 반환: {'당기': 682700.0, '전기': 751044.0}
    (단위 백만원, '계' 행의 지분법손익 컬럼 = row[2])."""
    start_tag = "라. 당기 및 전기 중 지분법평가 내역"
    end_tag = "마. 주요 관계기업"
    i = md_text.find(start_tag)
    j = md_text.find(end_tag)
    if i < 0 or j < 0 or j <= i:
        notes.append("지분법평가내역: 구간 앵커를 찾지 못함 — 확인불가")
        return {}
    window = md_text[i:j]
    tables = ep.parse_md_tables(window)
    # 표 순서: (1)당기 표, (주석), (단위), (2)전기 표, (주석) — '계' 행을 가진 표를
    # 등장 순서대로 당기/전기에 배정한다(원문 자체가 '(1) 당기' 다음 '(2) 전기' 순서를
    # 보장한다 — 실측 확인).
    found = []
    for t in tables:
        for row in t["rows"]:
            if row and ep.norm(row[0]) == "계" and len(row) >= 3:
                v = num_signed(row[2])
                if v is not None:
                    found.append(v)
    out = {}
    if len(found) >= 1:
        out["당기"] = found[0]
    if len(found) >= 2:
        out["전기"] = found[1]
    if len(found) != 2:
        notes.append("지분법평가내역: '계' 행 %d개 발견(2개 기대) — %s" % (len(found), found))
    return out


# ══════════════════════════════════════════════════════════ 그룹별 추출

# 각 표에서 스킵할 라벨(총계·소계·너무 세부한 하위분해) — 호출부 판단.
SKIP_SGA = {"판매비와관리비 합계", "경상연구개발비를 제외한 판매비와관리비 소계"}
SKIP_FIN = {"금융수익 합계", "금융비용 합계",
            "상각후원가로 측정하는 금융자산의 이자수익",
            "상각후원가 측정 금융부채 이자비용", "기타 금융부채 이자비용"}
SKIP_OTHER = {"기타수익", "기타비용"}
# CF 표는 감가상각비·무형자산상각비를 '비용의 성격별 분류 공시' 표(parse_nature_of_expense)
# 에서만 적재한다 — 같은 리터럴 값이라 여기서 또 뽑으면 자연키가 같아 upsert 로 합쳐지긴
# 하지만(위험 없음) 중복 파싱이라 걷어낸다. 조정내역계/운전자본계 총계도 스킵(둘 다 본표에
# 이미 있는 라인).
SKIP_CF = {"조정내역 계", "영업활동으로 인한 자산 부채의 변동", "감가상각비", "무형자산상각비"}


def parse_nature_of_expense(md_text, notes):
    """'비용의 성격별 분류 공시' — 감가상각비·무형자산상각비 (파일럿과 동일 소스,
    parse_block_items 로 재구현). 파일럿의 하드코딩 버전을 그대로 두지 않고 여기서
    일반 파서로 다시 구현하는 이유: 이 스크립트 하나로 전체 39종을 재현 가능해야
    스코프 교체(전체 재생성)가 자기완결적이다."""
    items = parse_block_items(md_text, "비용의 성격별 분류 공시", notes)
    out = {}
    for p in ("당기", "전기"):
        want = {k: v for k, v in items.get(p, {}).items() if k in ("감가상각비", "무형자산상각비")}
        out[p] = want
        if "감가상각비" not in want or "무형자산상각비" not in want:
            notes.append("성격별비용: %s 블록에서 감가상각비/무형자산상각비 둘 다 못 찾음 — %s" % (p, want))
    return out


def build_facts(corp_code, rcept_no, bsns_year, md_text, notes):
    """모든 그룹을 파싱해 (당기,전기) 쌍 facts 리스트로 만든다. 반환: [(account_nm, cur, prev), ...]"""
    facts = []  # (label, cur_mm, prev_mm)

    def add(label, items_dict):
        cur = items_dict.get("당기", {}).get(label)
        prev = items_dict.get("전기", {}).get(label)
        if cur is None and prev is None:
            return
        facts.append((label, cur, prev))

    # 1) 비용의 성격별 분류 공시 — 감가상각비·무형자산상각비 (파일럿 소스, ★)
    noe = parse_nature_of_expense(md_text, notes)
    add("감가상각비", noe)
    add("무형자산상각비", noe)

    # 2) 판매비와관리비에 대한 공시 — 급여·퇴직급여·지급수수료·감가상각비·무형자산상각비·
    #    광고선전비·판매촉진비·운반비·서비스비·기타판매비와관리비·경상연구개발비
    #    (감가상각비/무형자산상각비 재등장 — ★안전성 근거는 모듈 docstring 2번 참고)
    sga = parse_block_items(md_text, "판매비와관리비에 대한 공시", notes)
    for p in ("당기", "전기"):
        for k in list(sga[p].keys()):
            if k in SKIP_SGA:
                del sga[p][k]
    for label in ("급여", "퇴직급여", "지급수수료", "감가상각비", "무형자산상각비",
                  "광고선전비", "판매촉진비", "운반비", "서비스비", "기타판매비와관리비",
                  "경상연구개발비-연구개발 총지출액"):
        add(label, sga)
    # SG&A 세부 게이트(공짜 검증) — 여기서 즉시 계산해 notes 에 남긴다(그룹 게이트는
    # main() 이 다시 총계 대조로 한번 더 한다).
    for p, label_yr in (("당기", "2025"), ("전기", "2024")):
        total = sum(v for k, v in sga[p].items() if k not in SKIP_SGA)
        notes.append("게이트(판관비 세부합, %s=%s): %.0f백만원 = %.2f억원" % (p, label_yr, total, total / 100))

    # 3) 금융수익 및 금융비용 — 이자수익·외환차이(수익측)·파생상품관련이익·
    #    이자비용(금융원가)·외환차이(비용측)·파생상품관련손실
    #    ★ '외환차이' 라벨이 수익측·비용측에 동시 등장(값 다름) — parse_block_items 는
    #    한 (period,label) 에 값이 다르면 첫 값을 지키므로, 비용측 외환차이가 조용히
    #    버려진다. 그래서 이 표만은 수익 섹션/비용 섹션을 별도로 잘라 처리한다.
    fin_rev, fin_cost = _parse_financial_income_cost(md_text, notes)
    add("이자수익(금융수익)", fin_rev)
    add("외환차이(금융수익)", fin_rev)
    add("파생상품관련이익", fin_rev)
    add("이자비용(금융원가)", fin_cost)
    add("외환차이(금융비용)", fin_cost)
    add("파생상품관련손실", fin_cost)

    # 4) 기타수익 및 기타비용 — 배당금수익·임대료수익·유형자산처분이익·기타(수익) /
    #    유형자산처분손실·기부금·기타(비용)
    #    ★ '기타'가 수익측·비용측 둘 다 있다(값 다름) — 같은 이유로 섹션 분리 파싱.
    oth_rev, oth_cost = _parse_other_income_cost(md_text, notes)
    add("배당금수익", oth_rev)
    add("임대료수익", oth_rev)
    add("유형자산처분이익", oth_rev)
    add("기타(기타수익)", oth_rev)
    add("유형자산처분손실", oth_cost)
    add("기부금", oth_cost)
    add("기타(기타비용)", oth_cost)

    # 5) 지분법평가내역 — '계' 행의 지분법손익 컬럼
    eq = parse_equity_method(md_text, notes)
    if eq:
        facts.append(("지분법손익", eq.get("당기"), eq.get("전기")))

    # 6) 영업활동현금흐름 — 조정내역(가산/차감 통합) + 운전자본 세부
    #    ★ '기타'가 조정내역·운전자본 두 섹션에 각각 있다(값 다름, 실측: 433,159 vs
    #    -1,110,778) — parse_block_items 로는 첫 값만 남고 두번째가 버려진다(dry-run
    #    으로 실제 관측). 이자수익/기타수익 표와 같은 이유로 섹션 분리 파서를 쓴다.
    cf_adj, cf_wc = _parse_operating_cf(md_text, notes)
    for label in ("법인세비용", "금융수익", "금융비용", "퇴직급여", "대손상각비(환입)",
                  "배당금수익", "지분법이익", "유형자산처분이익", "유형자산처분손실",
                  "재고자산평가손실", "재고자산평가손실환입", "기타"):
        add(label, cf_adj)
    for label in ("매출채권의 감소(증가)", "미수금의 감소(증가)", "장단기선급비용의 감소(증가)",
                  "재고자산의 감소(증가)", "매입채무의 증가(감소)", "장단기미지급금의 증가(감소)",
                  "선수금의 증가(감소)", "예수금의 증가(감소)", "미지급비용의 증가(감소)",
                  "장단기충당부채의 증가(감소)", "퇴직금의 지급", "사외적립자산의 감소(증가)",
                  "기타"):
        add(label, cf_wc)

    # natural_key 는 (corp,year,reprt,fs_div,sj_div,account_id,account_nm,account_detail,
    # ord,amount,amount_prev,...) 전 컬럼 해시다 — 같은 (label,cur,prev) 가 두 번 나오면
    # (실측: '유형자산처분손실'이 기타비용표·CF조정표 양쪽에서 같은 값 57,404/124,018로
    # 나온다) INSERT 배치 안에서 같은 natural_key 행이 두 번 생겨 PostgREST 가 21000
    # ("ON CONFLICT DO UPDATE command cannot affect row a second time")으로 배치 전체를
    # 실패시킨다(실측 확인). 여기서 (label,cur,prev) 완전 동일 건만 하나로 접는다 — 값이
    # 다르면(예: '기타', '외환차이' 등 표마다 다른 값) 그대로 둔다.
    seen = set()
    deduped = []
    for label, cur, prev in facts:
        key = (label, cur, prev)
        if key in seen:
            notes.append("build_facts: '%s'(당기=%s,전기=%s) 중복 — 한 행으로 접음" % (label, cur, prev))
            continue
        seen.add(key)
        deduped.append((label, cur, prev))

    return deduped, notes


def _parse_operating_cf(md_text, notes):
    """'영업활동현금흐름' 표 — '기타' 라벨이 조정내역(가산/차감 통합) 섹션과 운전자본
    섹션 양쪽에 나온다(값 다름). '영업활동으로 인한 자산 부채의 변동' 라벨(총계 행)이
    등장하는 시점을 섹션 전환점으로 쓴다 — 다른 두 커스텀 파서(_parse_financial_income_cost/
    _parse_other_income_cost)와 동일한 전략."""
    window, tables = _split_당기_전기(md_text, "영업활동현금흐름")
    adj = {"당기": {}, "전기": {}}
    wc = {"당기": {}, "전기": {}}
    cur_period = None
    section = None  # 'adj' | 'wc'
    for t in tables:
        if _period_marker(t["header"]):
            cur_period = ep.norm(t["header"][0])
            section = "adj"
            continue
        for row in t["rows"]:
            if not row:
                continue
            if _period_marker(row):
                cur_period = ep.norm(row[0])
                section = "adj"
                continue
            if cur_period not in ("당기", "전기"):
                continue
            label, amt_s = _row_label_amount(row)
            if label is None:
                continue
            if label == "영업활동으로 인한 자산 부채의 변동":
                section = "wc"
                continue
            if label == "조정내역 계":
                continue  # 총계 행 — 본표에 대응 없음, 파생으로만 검산(main() 게이트)
            if label in ("감가상각비", "무형자산상각비"):
                continue  # 비용의 성격별 분류 공시 표에서만 적재(중복 파싱 방지)
            v = num_signed(amt_s)
            if v is None:
                continue
            bucket = adj if section == "adj" else wc
            bucket[cur_period][label] = v
    return adj, wc


def _parse_financial_income_cost(md_text, notes):
    """'금융수익 및 금융비용' 표 — '외환차이' 라벨이 수익/비용 양쪽에 같은 이름으로
    나와 parse_block_items 의 '한 라벨 한 값' 가정이 깨진다. 그래서 이 표만은 각 기간
    블록을 '금융비용 합계' 행 위치로 다시 수익/비용 두 구간으로 쪼갠다."""
    window, tables = _split_당기_전기(md_text, "금융수익 및 금융비용")
    rev = {"당기": {}, "전기": {}}
    cost = {"당기": {}, "전기": {}}
    cur_period = None
    section = None  # 'rev' | 'cost'
    for t in tables:
        if _period_marker(t["header"]):
            cur_period = ep.norm(t["header"][0])
            section = "rev"
            continue
        for row in t["rows"]:
            if not row:
                continue
            if _period_marker(row):
                cur_period = ep.norm(row[0])
                section = "rev"
                continue
            if cur_period not in ("당기", "전기"):
                continue
            label, amt_s = _row_label_amount(row)
            if label is None:
                continue
            if label == "금융비용 합계":
                section = "cost"
            if label in ("금융수익 합계", "금융비용 합계"):
                continue
            v = num_signed(amt_s)
            if v is None:
                continue
            bucket = rev if section == "rev" else cost
            bucket[cur_period][label] = v
    return rev, cost


def _parse_other_income_cost(md_text, notes):
    """'기타수익 및 기타비용' 표 — '기타' 라벨이 수익/비용 양쪽에 나와 같은 이유로
    섹션을 나눠 파싱한다. 반환 라벨은 '기타(기타수익)'/'기타(기타비용)' 로 자체
    구분한다(add() 호출부가 이 접미로 골라 쓴다) — account_nm 저장값 자체는 원문
    '기타' 그대로 쓴다(build_facts 의 add 호출에서 저장용 라벨을 별도로 넘긴다)."""
    window, tables = _split_당기_전기(md_text, "기타수익 및 기타비용")
    rev = {"당기": {}, "전기": {}}
    cost = {"당기": {}, "전기": {}}
    cur_period = None
    section = None
    for t in tables:
        if _period_marker(t["header"]):
            cur_period = ep.norm(t["header"][0])
            section = "rev"
            continue
        for row in t["rows"]:
            if not row:
                continue
            if _period_marker(row):
                cur_period = ep.norm(row[0])
                section = "rev"
                continue
            if cur_period not in ("당기", "전기"):
                continue
            label, amt_s = _row_label_amount(row)
            if label is None:
                continue
            if label == "기타비용":
                section = "cost"
            if label in ("기타수익", "기타비용"):
                continue
            v = num_signed(amt_s)
            if v is None:
                continue
            store_label = (label + "(기타수익)") if section == "rev" and label == "기타" else \
                          (label + "(기타비용)") if section == "cost" and label == "기타" else label
            bucket = rev if section == "rev" else cost
            bucket[cur_period][store_label] = v
    return rev, cost


def fact_row(corp_code, bsns_year, rcept_no, account_nm, amount_mm, amount_prev_mm):
    def to_krw(mm):
        return None if mm is None else int(round(mm * 1_000_000))
    return {
        "corp_code": corp_code, "bsns_year": bsns_year, "reprt_code": "11011",
        "fs_div": "CFS", "sj_div": "NOTE",
        "account_id": ACCOUNT_ID_SENTINEL, "account_nm": account_nm,
        "amount": to_krw(amount_mm), "amount_prev": to_krw(amount_prev_mm),
        "amount_prev2": None, "ord": None, "currency": "KRW",
        "rcept_no": rcept_no, "account_detail": SOURCE_TAG,
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--corp", default=CORP_CODE)
    p.add_argument("--rcept", required=True)
    p.add_argument("--bsns-year", type=int, default=2025)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    ingest.print_target()
    md_text = load_note_section(args.corp, args.rcept)
    notes = []
    facts, notes = build_facts(args.corp, args.rcept, args.bsns_year, md_text, notes)

    rows = [fact_row(args.corp, args.bsns_year, args.rcept, label, cur, prev)
            for (label, cur, prev) in facts]

    print("--- 적재 대상 행 (%d) ---" % len(rows))
    for r in rows:
        print(" %-28s 당기=%s 전기=%s" % (r["account_nm"], r["amount"], r["amount_prev"]))
    print("--- notes (%d) ---" % len(notes))
    for n in notes:
        print(" ·", n)

    if args.dry_run:
        print("[dry-run] DB 에 쓰지 않음")
        return

    # 스코프 교체 — sj_div='NOTE' 만, 본표(BS/IS/CF/…) 행은 절대 건드리지 않는다.
    import urllib.parse
    filters = {"corp_code": "eq.%s" % args.corp, "bsns_year": "eq.%s" % args.bsns_year,
               "reprt_code": "eq.11011", "fs_div": "eq.CFS", "sj_div": "eq.NOTE"}
    q = urllib.parse.urlencode(filters)
    ingest.rest("DELETE", "financial_facts?%s" % q)
    result = ingest.rest(
        "POST", "financial_facts?on_conflict=natural_key", rows,
        prefer="resolution=merge-duplicates,return=representation")
    print("--- INSERT 결과 (%d행) ---" % (len(result) if result else 0))


if __name__ == "__main__":
    main()
