#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""주석 계정 추출 파일럿 — ★4종(설계상 3종 실제 추출, 아래 참고) → financial_facts.

2026-08-25. 목적은 파서 완성도가 아니라 "경로가 뚫리는가"의 증명이다: 주석에서 값을
뽑아 financial_facts(sj_div='NOTE')에 넣고 internal.fin_periods_refresh() 를 돌렸을 때
이자보상배율의 원자재(이자비용)와 EBITDA(감가상각비·무형자산상각비)가 실제로 채워지는지.

왜 별도 스크립트인가 (extract_profile.py 에 붙이지 않은 이유):
  1. 타깃 테이블이 다르다 — extract_profile.py 는 fin_details/corp_history 로 가고
     (스코프 교체: corp_code×concept×source_rcept_no 단위 delete→insert), 이 스크립트는
     financial_facts 로 간다(자연키 upsert: on_conflict=natural_key, 전 컬럼 해시).
     두 표는 자연키·멱등 규약이 아예 다르다.
  2. 이 스크립트는 계정 4종(실제 3종, 아래) 만을 겨냥한 파일럿이다 — extract_profile.py
     의 5블록 일반화 파이프라인(게이트4종·pending 스캔·일일 진입점)에 끼워넣으면 파일럿
     범위가 그 파이프라인의 일반 규약(ALL_CONCEPTS, apply_gates 등)에 묶여 커진다.
  3. 재사용은 하되(parse_md_tables/num/norm 을 extract_profile 에서 import) 새로 발명하지
     않는다 — 표 파싱 원시함수는 이미 검증된 것을 쓴다.

실행 순서 함정(감독 지시 §금지): internal.fin_periods_refresh() 는 PostgREST 비노출
스키마 함수라 REST 로 못 부른다 — `supabase db query --linked` (SQL 직결)로만 가능하다.
이 스크립트는 INSERT 까지만 한다(PostgREST). refresh 호출은 별도로 CLI에서 실행한다.

사용법:
    python3 extract_notes_pilot.py --corp 00126380 --rcept 20260310002820 \
        [--dry-run]   # 파싱만, DB에 쓰지 않음
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
import ingest  # noqa: E402 — rest()/upsert()/storage_download() 재사용
import extract_profile as ep  # noqa: E402 — parse_md_tables()/num()/norm() 재사용

ACCOUNT_ID_SENTINEL = "-표준계정코드 미사용-"
# 왜 이 값인가(account_id 를 출처 센티널로 쓰지 않은 이유): 20260806000001_fin_periods.sql
# 의 internal.fin_periods_rebuild() 조인이 "계정명으로 매칭"하는 조건은
#   (account_id is null or account_id = '-표준계정코드 미사용-') and account_nm = any(name_alts)
# 딱 이 리터럴 문자열일 때만 열린다. 감독 지시가 예시로 든 'NOTE:rule' 을 account_id 에
# 넣으면 이 조건이 항상 거짓이 되어 depreciation/amortisation 매칭이 원천 차단된다 —
# 파일럿의 성공 기준(EBITDA 가 채워지는가) 자체가 깨진다. 그래서 이 센티널은 기존 관례
# (README §2, "XBRL 미적용 계정")를 그대로 따르고, 출처 태그는 account_detail 로 옮겼다
# (아래 SOURCE_TAG). account_detail 은 fin_periods_rebuild 의 조인 조건에 전혀 등장하지
# 않는 자유 텍스트 컬럼이라 이 선택이 매칭을 방해하지 않는다.
SOURCE_TAG = "NOTE:rule"

CORP_CODE = "00126380"  # 삼성전자 — 이 파일럿의 유일한 대상(과제 범위)


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


_CAPTION_RE = re.compile(r"^\| *([^|]+?) *\| *— *\|\s*$", re.MULTILINE)


def _split_당기_전기(md_text, caption):
    """캡션(예: '비용의 성격별 분류 공시') 뒤에 '당기'/'전기' 두 블록이 나란히 오는
    구조(블록확장-설계.md §실측 "당기·전기가 나란한 두 표")를 캡션 위치 → **다음 같은
    레벨 캡션 직전**까지로 정확히 잘라 돌려준다.

    함정(실측, 첫 시도가 깨진 이유): 캡션 자체도 '| 제목 | — |' 2열 표라서 순진하게
    고정 길이(6,000자)로 윈도우를 자르면 바로 다음 캡션(예: '판매비와관리비에 대한
    공시')까지 윈도우 안에 들어와, 그 표의 '감가상각비' 행이 우리 표의 결과를 덮어쓴다
    (실측: '비용의 성격별 분류 공시'의 감가상각비 43,605,740 대신 판관비 세부표의
    1,689,079 이 잡혔다). 그래서 전체 문서에서 같은 정규식으로 캡션 위치를 **전부**
    찾아 우리 캡션의 다음 캡션 시작 위치를 정확한 끝점으로 쓴다."""
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
    """행(또는 헤더) 한 줄이 '당기 (단위 : 백만원)' 류의 기간 마커인지 판정한다.
    함정(실측): 캡션과 마커가 공백줄 없이 붙어 있으면(성격별비용·금융비용 표 둘 다
    이 모양이다) parse_md_tables 가 캡션 행을 header 로, 마커 행을 그 표의 **rows[0]**
    으로 묶어버린다 — 그래서 header 뿐 아니라 매 표의 rows 도 마커인지 검사해야 한다
    (안 그러면 '당기' 마커를 영영 못 보고 cur_period 가 None 인 채로 첫 데이터 표를
    건너뛴다 — 실측: 이 확인 없이 돌렸더니 '당기' 블록이 통째로 빈 채로 나왔다)."""
    n = [ep.norm(c) for c in cells]
    return len(n) >= 2 and n[0] in ("당기", "전기") and "단위" in cells[1]


def parse_nature_of_expense(md_text, notes):
    """'비용의 성격별 분류 공시' — 성격별 비용 표. 행 라벨이 그대로 '감가상각비'/
    '무형자산상각비'다(account_concepts.name_alts 와 리터럴 일치 — 3사 실측:
    '감가상각비의 기능별 배분' 표의 라벨은 '감가상각비, 유형자산'이라 이 표를 쓰면
    concept 매칭이 안 된다. 이 표를 골라야 fin_periods 가 실제로 채워진다).

    반환: {'당기': {'감가상각비': int|None, '무형자산상각비': int|None}, '전기': {...}}
    (단위 백만원, 원문 그대로 — 호출부가 ×1,000,000 한다)"""
    window, tables = _split_당기_전기(md_text, "비용의 성격별 분류 공시")
    out = {}
    cur_period = None
    for t in tables:
        if _period_marker(t["header"]):
            cur_period = ep.norm(t["header"][0])
            continue
        want = {}
        for row in t["rows"]:
            if not row:
                continue
            if _period_marker(row):
                cur_period = ep.norm(row[0])
                continue
            if cur_period is None:
                continue
            label = ep.norm(row[0])
            if label in ("감가상각비", "무형자산상각비"):
                # 이 표는 3열(라벨/부모라벨반복/공시금액) 또는 2열이 섞인다 — 실측 원문:
                # '| 감가상각비 | 43,605,740 | — |' 처럼 라벨 바로 뒤 칸이 금액이다.
                v = ep.num(row[1]) if len(row) > 1 else None
                want[label] = v
        if want:
            out[cur_period] = out.get(cur_period, {})
            out[cur_period].update(want)
    for p in ("당기", "전기"):
        if p not in out or "감가상각비" not in out[p] or "무형자산상각비" not in out[p]:
            notes.append("성격별비용: %s 블록에서 감가상각비/무형자산상각비 둘 다 못 찾음 "
                         "— 확인불가로 남김 (찾은 것: %s)" % (p, out.get(p)))
    return out


def parse_financial_costs(md_text, notes):
    """'금융수익 및 금융비용' — '금융비용 합계' 아래 '이자비용(금융원가)' 행의 값(계정
    합계, 세부분해가 아님)만 뽑는다. 실측 원문 행:
        '금융비용 합계 | 이자비용(금융원가) | 605,783 | —'   ← 이게 타깃(개념 합계)
        '이자비용(금융원가) | 상각후원가 측정 금융부채 이자비용 | 43,052 | —'  ← 세부, 스킵
        '기타 금융부채 이자비용 | 562,731 | — | —'                          ← 세부, 스킵
    43,052+562,731=605,783 (세부합=합계, 표 자체 검산 — apply_gates 몫이 아니라 여기서
    바로 확인해 notes 에 남긴다)."""
    window, tables = _split_당기_전기(md_text, "금융수익 및 금융비용")
    out = {}
    cur_period = None
    for t in tables:
        if _period_marker(t["header"]):
            cur_period = ep.norm(t["header"][0])
            continue
        total = interest = sub1 = sub2 = None
        for row in t["rows"]:
            if not row:
                continue
            if _period_marker(row):
                cur_period = ep.norm(row[0])
                continue
            if cur_period is None:
                continue
            r = [ep.norm(c) for c in row]
            if r[0] == "금융비용합계" and len(r) > 1 and r[1] == "이자비용(금융원가)":
                interest = ep.num(row[2]) if len(row) > 2 else None
            elif r[0] == "금융비용합계" and len(r) > 1:
                total = ep.num(row[1])
            elif r[0] == "이자비용(금융원가)" and len(r) > 1:
                sub1 = ep.num(row[2]) if len(row) > 2 else None
            elif r[0] == "기타금융부채이자비용":
                sub2 = ep.num(row[1]) if len(row) > 1 else None
        if cur_period is not None and (total is not None or interest is not None):
            out[cur_period] = {"금융비용_합계": total, "이자비용(금융원가)": interest}
            if interest is not None and sub1 is not None and sub2 is not None:
                recompute = sub1 + sub2
                if abs(recompute - interest) > 0.5:
                    notes.append("금융비용: %s 세부합(%.0f)≠합계(%.0f) — 불일치, 크게 보고 대상" %
                                 (cur_period, recompute, interest))
                else:
                    notes.append("금융비용: %s 세부합 검산 통과 (상각후원가 %.0f + 기타금융부채 %.0f "
                                 "= %.0f = 이자비용(금융원가))" % (cur_period, sub1, sub2, recompute))
    for p in ("당기", "전기"):
        if p not in out or out[p].get("이자비용(금융원가)") is None:
            notes.append("금융비용: %s 블록에서 이자비용(금융원가) 못 찾음 — 확인불가" % p)
    return out


def fact_row(corp_code, bsns_year, rcept_no, account_nm, amount_mm, amount_prev_mm):
    """amount_mm/amount_prev_mm 은 원문 단위(백만원) — 여기서 ×1,000,000 해서 원으로
    환산한다(financial_facts.amount 규약: 원 단위, financial_facts DDL 주석 'amount 당기(원)'
    그대로 확인함)."""
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


def build_facts(corp_code, rcept_no, bsns_year, md_text, notes):
    noe = parse_nature_of_expense(md_text, notes)
    fc = parse_financial_costs(md_text, notes)

    rows = []
    dep_cur = noe.get("당기", {}).get("감가상각비")
    dep_prev = noe.get("전기", {}).get("감가상각비")
    if dep_cur is not None:
        rows.append(fact_row(corp_code, bsns_year, rcept_no, "감가상각비", dep_cur, dep_prev))

    amo_cur = noe.get("당기", {}).get("무형자산상각비")
    amo_prev = noe.get("전기", {}).get("무형자산상각비")
    if amo_cur is not None:
        rows.append(fact_row(corp_code, bsns_year, rcept_no, "무형자산상각비", amo_cur, amo_prev))

    int_cur = fc.get("당기", {}).get("이자비용(금융원가)")
    int_prev = fc.get("전기", {}).get("이자비용(금융원가)")
    if int_cur is not None:
        rows.append(fact_row(corp_code, bsns_year, rcept_no, "이자비용(금융원가)", int_cur, int_prev))

    return rows, noe, fc


def gate_report(rows, notes):
    """★게이트 — 계정체계 문서 기준. CAPEX 게이트는 여기 없다: 유형자산의 취득은
    financial_facts 에 이미 sj_div='CF' 로 적재돼 있음을 확인했다(아래 스크래치패드
    문서 참고) — 주석 추출 대상에서 뺐다(감독 재확인 필요, notes 에 남긴다)."""
    by_nm = {r["account_nm"]: r for r in rows}
    if "감가상각비" in by_nm:
        notes.append("게이트(FnGuide 대조): 감가상각비 %.0f백만원 vs FnGuide 436,057억원 → %.0f억원" %
                     (by_nm["감가상각비"]["amount"] / 1_000_000, by_nm["감가상각비"]["amount"] / 100_000_000))
    if "무형자산상각비" in by_nm:
        notes.append("게이트(FnGuide 대조): 무형자산상각비 %.0f백만원 vs FnGuide 33,209억원 → %.0f억원" %
                     (by_nm["무형자산상각비"]["amount"] / 1_000_000, by_nm["무형자산상각비"]["amount"] / 100_000_000))
    if "이자비용(금융원가)" in by_nm:
        v = by_nm["이자비용(금융원가)"]["amount"]
        notes.append("게이트(FnGuide 대조): 이자비용 %.0f백만원 → %.0f억원 vs FnGuide 6,058억원" %
                     (v / 1_000_000, v / 100_000_000))


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
    rows, noe, fc = build_facts(args.corp, args.rcept, args.bsns_year, md_text, notes)
    gate_report(rows, notes)

    print("--- 파싱 결과 (당기/전기, 백만원) ---")
    print("성격별비용:", json.dumps(noe, ensure_ascii=False))
    print("금융비용:", json.dumps(fc, ensure_ascii=False))
    print("--- 적재 대상 행 (%d) ---" % len(rows))
    for r in rows:
        print(" ", json.dumps(r, ensure_ascii=False))
    print("--- notes ---")
    for n in notes:
        print(" ·", n)

    if args.dry_run:
        print("[dry-run] DB 에 쓰지 않음")
        return

    result = ingest.rest(
        "POST", "financial_facts?on_conflict=natural_key", rows,
        prefer="resolution=merge-duplicates,return=representation")
    print("--- INSERT 결과 (%d행) ---" % (len(result) if result else 0))
    for r in (result or []):
        print(" id=%s natural_key=%s account_nm=%s amount=%s" %
              (r["id"], r["natural_key"], r["account_nm"], r["amount"]))


if __name__ == "__main__":
    main()
