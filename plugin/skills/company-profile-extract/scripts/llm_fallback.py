#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""규칙 파서(`extract_profile.py`)가 0행으로 남긴 3블록의 **에이전트 실행형** 폴백.

## 설계가 바뀐 이유 (2026-08-25)
예전 버전은 이 스크립트가 Anthropic API 를 호출했다(ANTHROPIC_API_KEY 필요). 그런데 실제
운영은 **Claude Code 스케줄러가 이 스킬(`company-profile-extract`)을 매일 부르는 방식**이다
— 즉 이 스킬을 실행하는 에이전트 자신이 이미 LLM 이다. API 로 다시 감쌀 이유가 없다: 키
관리·요금·HTTP 재시도·응답 파싱이 전부 불필요해진다.

그래서 이 스크립트는 더 이상 어떤 모델도 호출하지 않는다(`ANTHROPIC_API_KEY`를 읽지도
않는다). 대신 2단계로 쪼갠다:

1. **`prepare`** — 규칙 파서가 0행으로 남긴 블록의 **원문 절단분 + 지시문**을 파일로
   써낸다(예전 `--dry-run` 덤프가 하던 일과 형태는 같지만, 이번엔 "확인용"이 아니라
   "에이전트가 읽고 채울 입력물"이 목적이다).
2. **`ingest`** — 에이전트가 그 파일을 읽고 원문을 그대로 옮겨 적어 채운 JSON을 받아
   적재한다. **단위 환산·기간 라벨→연도 매핑은 에이전트가 계산하지 않는다** — 규칙
   파서와 정확히 같은 결정론적 함수(`extract_profile.num`/`parse_period_col`/
   `infer_period_labels`)로 이 스크립트가 계산한다. 게이트(`apply_gates`)도 규칙 산출물과
   동일하게 적용한다. `extracted_by='agent'`로 규칙 산출물(`'rule'`)과 구분한다.

대상은 여전히 2026-08-25 3사 재현시험(`references/재현성-시험-3사.md`)이 "개념 축 자체가
회사마다 다르다"로 확정한 세 블록뿐이다 — **연혁(`corp_history`) · 부문별 매출 절대금액
(`segment_revenue`) · 시장점유율(`market_share`)**. 주주현황·R&D·`segment_revenue_pct`/
`segment_operating_income`/`segment_total_assets`(★화이트리스트 표)는 이 폴백 범위 밖이다
— 규칙이 통과하는 블록을 에이전트로 대체하지 않는다.

## 규칙(★ 절대 어기지 말 것 — 감독 지시 그대로, API 방식과 동일하게 유지)
1. 원문에 있는 숫자·문구만 옮긴다. 생성·보간·추정 금지. 특히 **단위 환산(억원→원 등)도
   에이전트가 하지 않는다** — `raw_amount`(원문 표기 그대로)와 `unit_label`(원문에 적힌
   단위 문구 그대로)만 JSON에 적고, 환산은 이 파일의 순수 함수(`build_numeric_facts`가
   호출하는 `extract_profile.num()`/`UNIT_SCALE`)가 결정론적으로 한다. 부문 합계도
   에이전트가 계산하지 않는다 — 원문에 합계 행이 있으면 그 행 값을 그대로 옮긴다.
2. 출처 3단(source_rcept_no는 파일명·JSON 최상위 필드로 이미 고정, source_section/
   source_table을 에이전트가 채운다) — source_table이 없는 항목은 `ingest`가 적재를
   거부한다.
3. `extracted_by='agent'`로 규칙 산출물(`'rule'`)과 구분한다.
4. `value_basis`를 채운다 — 특히 segment_revenue는 회사마다 분류축이 달라서(업종별/
   공사종류별/제품계층별) 이 필드가 없으면 나중에 서로 다른 축의 숫자를 같은 개념으로
   착각한다.
5. 게이트는 규칙 산출물과 동일하게 적용한다 — `ingest`가 `extract_profile.apply_gates()`를
   그대로 호출한다(부문합 vs `fin_periods.revenue` ±1% 게이트와 자릿수 sanity 게이트가
   에이전트 facts에도 걸린다, 별도 구현 불필요).
6. 원문 섹션 전체(수만 자)를 통째로 넣지 않는다 — 표 주변만 잘라 넣는다(아래
   `cut_heading_block`/`cut_keyword_windows`). 어떻게 잘랐는지(스팬·매칭 키워드)를 prepare
   파일 헤더와 notes에 남겨 재현 가능하게 한다.

## 에이전트 방식의 이점과 대가
이점: 애매한 표를 만나면 원문을 더 넓게 다시 읽을 수 있고(API 방식은 절단 폭이 고정),
판단이 안 서면 즉시 "확인 불가"로 남길 수 있다(리트라이·프롬프트 재설계 없이). 대가:
**결정성이 API 방식보다 약하다** — 같은 원문도 에이전트마다(또는 같은 에이전트의 다른
실행마다) 다르게 옮길 수 있다. 그래서 게이트와 출처 3단이 API 방식보다 **더** 중요하다 —
`ingest`는 게이트를 우회하는 경로를 두지 않는다(항상 `apply_gates()`를 통과해야 적재).

## 기간 라벨을 에이전트에게 계산시키지 않는 이유
segment_revenue·market_share 표의 열 헤더는 '제65기'·'당기/전기/전전기'·'2025.12' 등
제각각이다. "이게 몇 년도냐"는 계산이 아니라 문서 규약을 아는 문제이므로, 에이전트에게는
헤더 문자열을 원문 그대로 옮기게만 하고(`period_header`), 연도 매핑은 규칙 파서가 이미
쓰는 `parse_period_col()`/`infer_period_labels()`를 **그대로 재사용**한다(`ingest`가 직접
호출한다 — 재발명·이중 유지보수 금지). '당기/전기/전전기'류 상대 표현만 이 파일이 추가로
처리한다(규칙 파서가 다루지 않던 표현).

## 윈도우 절단 방식 (3사 실측 원문으로 보정, 2026-08-25, API 시절과 동일)
- **연혁**: `## N. 회사의 연혁` 헤딩부터 다음 `##` 헤딩 전까지(세 회사 다 동일 구조로
  확인: 부국 147~186행, 삼양 123~242행, 동신 62~77행 — 헤딩 경계가 깨끗해 키워드
  윈도우보다 이 방식이 더 정확하다).
- **부문별 매출**: 키워드(`SEGMENT_KEYWORDS`) 주변 윈도우. 헤딩 레벨이 회사마다
  달라(부국은 `##` 밖 부제목, 삼양·동신은 `##`) 헤딩 기준 절단이 안 통한다.
- **시장점유율**: 키워드(`MARKET_SHARE_KEYWORDS`) 주변 윈도우. 부국은 "9) 시장점유율
  등"(꺾쇠 아님, 규칙 파서가 못 찾는 바로 그 패턴)이라 키워드 매칭만 신뢰할 수 있다.
- 키워드가 원문에 0건이면(예: 동신건설 "시장점유율" 0건 — 3사 재현시험이 이미 grep으로
  실측) **prepare 파일 자체를 생성하지 않는다** — 이 판정 자체가 이미 결정론적이라(정규식
  매칭 유무), 에이전트에게 "찾아봤는데 없다"를 다시 확인시키는 건 시간 낭비다. 확인불가로
  남긴다.
"""
import argparse
import datetime as dt
import glob
import json
import os
import re
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
import extract_profile as ep  # noqa: E402  — num()/parse_period_col()/infer_period_labels()/
# fact()/apply_gates()/load_sections()/report_fiscal_year()/db_rows_pg()/to_db_row()/
# to_history_row() 를 그대로 재사용한다. extract_profile.py 는 이 모듈을 더 이상 import
# 하지 않으므로(2026-08-25 이전엔 순환 없이 단방향으로 llm_fallback 을 불렀으나, 이제
# `prepare`/`ingest` 는 extract_profile.py 의 extract/verify 와 별개로 에이전트가 직접
# 실행하는 2단계 명령이라 방향이 뒤집혔다) 순환 import가 없다.
import ingest  # noqa: E402  — rest()/replace_scope()/dedupe_by() (extract_profile.py 가 이미
# sys.path 에 platform/ingest 를 꽂아 뒀다)

EXTRACTED_BY_AGENT = "agent"

# 표에 적힌 단위 문구 → KRW 배수. 이 사전에 없는 단위 문구가 오면(오탈자·새 단위)
# **추측해서 배수를 고르지 않는다** — 확인불가로 남긴다(회사마다 단위가 다를 수 있어
# 화이트리스트로 막는다).
UNIT_SCALE = {"억원": 100_000_000, "백만원": 1_000_000, "천원": 1_000, "원": 1}


def _normalize_unit_label(s):
    """에이전트가 지시를 정확히 안 따르고 캡션을 통째로 베껴도(예: '단위:천원, %',
    '(백만원)') UNIT_SCALE 조회가 실패하지 않도록 방어적으로 정리한다."""
    if not s:
        return None
    s = s.strip().strip("()（）")
    s = re.sub(r"^단위\s*[:：]\s*", "", s)
    s = re.split(r"[,，%]", s)[0].strip()
    return s or None


# 사업보고서 관용구 — 표 헤더가 '제N기' 대신 상대 표현을 쓰는 경우(부국증권 부문별
# 정보 표 실측: '<당기>'/'<전기>'/'<전전기>' 마커, 표 헤더 자체엔 기간 라벨이 없다).
# fallback_year(=report_fiscal_year, filings.report_nm에서 결정론적으로 구한 값)를
# 기준으로 오프셋만 더한다 — 에이전트에게 연도 계산을 맡기지 않는다.
RELATIVE_PERIOD_MAP = {"당기": 0, "전기": -1, "전전기": -2, "전전전기": -3}

HISTORY_HEADING_RE = re.compile(r"^##\s*\d+\.\s*회사의\s*연혁")

SEGMENT_KEYWORDS = ["매출실적", "영업실적", "영업 실적", "매출 및 수주상황", "공사종류",
                     "부문별 매출", "사업부문별 현황", "사업부문별 요약"]
MARKET_SHARE_KEYWORDS = ["시장점유율", "시장 점유율", "점유율 추이", "점유율 등"]

# prepare 가 만드는 파일 하나당 대응하는 fin_details.concept (corp_history 는 별도 테이블).
BLOCK_CONCEPT = {"market_share": "market_share", "segment_revenue": "segment_revenue"}


# ══════════════════════════════════════════════════════════ 원문 절단 (API 시절과 동일 — 순수 텍스트 처리)

def cut_heading_block(md_text, heading_re):
    """`heading_re`에 매치하는 `##` 헤딩부터 그 다음 `##` 헤딩 직전까지 잘라낸다.
    반환: (잘린 텍스트, (start_line, end_line)) | (None, None) — 못 찾으면 None."""
    lines = md_text.split("\n")
    start = None
    for i, line in enumerate(lines):
        if start is None and heading_re.match(line.strip()):
            start = i
            continue
        if start is not None and re.match(r"^##\s", line.strip()):
            return "\n".join(lines[start:i]), (start, i)
    if start is not None:
        return "\n".join(lines[start:]), (start, len(lines))
    return None, None


def cut_keyword_windows(md_text, keywords, before=300, after=5000, max_total=16000):
    """키워드가 나오는 위치마다 [start-before, start+after] 구간을 만들고, 겹치거나
    가까운(<300자) 구간은 하나로 합친다. 총 길이가 max_total을 넘으면 뒤 구간을 자른다
    (앞 구간부터 순서대로 채운다 — 원문 등장 순서를 그대로 보존).
    반환: (잘린 텍스트|None, 병합된 스팬 목록, 실제 매칭된 키워드 목록)."""
    spans, hit_kw = [], []
    for kw in keywords:
        for m in re.finditer(re.escape(kw), md_text):
            spans.append((max(0, m.start() - before), min(len(md_text), m.start() + after)))
            hit_kw.append(kw)
    if not spans:
        return None, [], []
    spans.sort()
    merged = [list(spans[0])]
    for s, e in spans[1:]:
        if s <= merged[-1][1] + 300:
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])
    pieces, total = [], 0
    for s, e in merged:
        piece = md_text[s:e]
        if total + len(piece) > max_total:
            piece = piece[: max(0, max_total - total)]
        if piece:
            pieces.append((s, s + len(piece), piece))
            total += len(piece)
        if total >= max_total:
            break
    text = "\n\n...(중략—구간 사이 생략)...\n\n".join(p for _, _, p in pieces)
    return text, [(s, e) for s, e, _ in pieces], sorted(set(hit_kw))


# ══════════════════════════════════════════════════════════ 에이전트 지시문 (prepare 파일에 그대로 박힌다)

AGENT_RULES_COMMON = """당신(이 스킬을 실행하는 에이전트)은 한국 상장기업 DART 사업보고서 원문에서
구조화된 사실만 옮겨 적는 추출기 역할이다. 아래 규칙을 절대 어기지 마라 — 이건 재무
데이터이고, 잘못 만들어낸 값은 실제 투자 판단에 쓰일 수 있다.

1. 아래 <원문> 안에 실제로 적힌 숫자·문구만 옮긴다. <원문>에 없는 값을 생성·추정·
   보간하지 마라. 계산도 하지 마라 — 합계가 필요하면 <원문>에 합계/계 행이 있는지
   찾아 그 행의 값을 그대로 옮겨라. 네가 직접 더하거나 나누지 마라.
2. <원문>에서 찾을 수 없으면 그 항목을 JSON에 아예 넣지 마라(빈 배열로 두거나 키
   자체를 생략). 억지로 만들어내지 마라. 왜 없는지는 이 파일과 짝이 되는 ingest
   JSON의 "agent_notes" 배열에 한 줄로 적어라(예: "정성 서술만 있고 정량 수치 자체가
   없음", "이 회사엔 해당 개념이 없음(업종상 무관)", "표가 아예 없고 산문뿐").
3. 숫자는 <원문> 표기 그대로 raw_amount에 옮긴다 — 콤마·마이너스·△ 부호를 그대로
   유지한다("12,345", "△301,146", "-" 등). **단위 환산(억원→원 등)은 네가 하지 않는다**
   — 표/캡션에 적힌 단위 문구를, "단위:"·괄호·쉼표·퍼센트 기호 같은 장식은 다 떼고
   순수 단위 단어만 unit_label에 옮겨라. 예: 캡션이 "(단위:천원, %)"이면 금액 칸에는
   "천원"만 적는다. 단위 문구를 못 찾으면 null로 둬라(추측하지 마라).
4. 표 헤더의 기간 라벨(period_header)도 원문 그대로 옮긴다 — "제65기", "2025.12",
   "2025년", "당기", "전기", "전전기" 등. 네가 실제 연도로 계산하지 마라(ingest 가
   별도 규칙 함수로 변환한다 — 계산은 코드가 한다).
5. 각 항목마다 어느 표/문단에서 나왔는지 source_table에 적어라(예: 표 바로 위 소제목,
   또는 "II.4.가 매출실적 표"). 어느 표인지 특정할 수 없으면 그 항목은 아예 넣지 마라
   — source_table 없는 항목은 ingest가 적재를 거부한다.
6. 결과는 이 스킬(SKILL.md)이 정한 JSON 파일 하나(corp_code·rcept_no당 하나, 여러
   블록을 같은 파일에 담는다)에 아래 "출력 계약"대로 써라. ingest 실행 전 사람이
   읽지 않아도 되게, 필드명·자료형을 정확히 지켜라(자유 서술 금지)."""

BLOCK_INSTRUCTIONS = {
    "corp_history": (
        "아래는 'I. 회사의 개요 > 2. 회사의 연혁' 섹션 발췌다. 연도(또는 연월)별 주요\n"
        "사건을 항목으로 옮겨라. 원표에 '구분' 칸이 있으면 category에, 없으면 category는\n"
        "null로 둬라(지어내지 마라)."
    ),
    "market_share": (
        "아래 표에는 '시장점유율'(퍼센트, 대개 '점유율'이라는 이름의 행)과 그 점유율을\n"
        "계산하는 데 쓰인 절대 실적치(예: '영업수익'·'수탁고'·'회사 신기술금융투자실적' 같은\n"
        "원 단위 숫자 행)가 함께 나올 수 있다. **오직 점유율(퍼센트) 값만 추출하라 — 절대\n"
        "실적치·산업 전체 수치 행은 추출하지 마라.** 정성적 서술(숫자 없는 경쟁 구도 설명)만\n"
        "있고 실제 퍼센트 수치가 없으면 이 블록을 아예 비워라(빈 배열)."
    ),
    "segment_revenue": (
        "아래에는 매출(또는 영업수익) 표 말고도 영업이익·순이익·비용 등 다른 지표를 담은\n"
        "행이 같은 표 안에 섞여 있을 수 있고, 매출과 무관한 다른 표(예: 수주현황)가 함께\n"
        "잘려 들어와 있을 수도 있다. **매출/영업수익을 나타내는 행만 추출하라.** 그 표에\n"
        "합계·계 행이 있으면 그 행도 item_name='합계'로 반드시 포함해라(적재 후 fin_periods\n"
        "매출액과 대조하는 데 쓰인다 — 이 대조가 게이트다, 네가 직접 맞춰보려 하지 마라).\n"
        "item_name은 매출/영업수익 행의 부문·사업축 이름을 원문 라벨 그대로 적는다. 표가\n"
        "없거나 매출을 이 분류축으로 쪼갠 정보가 없으면 이 블록을 아예 비워라(빈 배열)."
    ),
}

# ingest JSON 최상위 계약 — prepare 파일 끝에 그대로 박아 에이전트가 참고하게 한다.
OUTPUT_CONTRACT = """
## 출력 계약 (ingest 가 그대로 읽는다 — 필드명을 정확히 지켜라)

corp_code·rcept_no 당 JSON 파일 하나에 아래 형태로 쓴다. 파일명 관례:
  <out_dir>/<corp_code>_<rcept_no>.ingest.json
(여러 블록을 준비했다면 같은 파일에 키를 더한다 — 블록마다 새 파일을 만들지 않는다.)

{
  "corp_code": "%(corp_code)s",
  "rcept_no": "%(rcept_no)s",
  "agent_notes": ["이 블록/항목을 왜 비웠는지, 애매했던 판단 등 자유 기록(선택)"],

  "corp_history": [
    {"event_ym": "2021.03", "category": null, "content": "...", "source_table": "..."}
  ],

  "market_share": [
    {"item_name": "<제품명>|<세부항목>", "period_header": "2025", "raw_amount": "12.3",
     "unit_label": null, "value_basis": null, "source_table": "..."}
  ],

  "segment_revenue": [
    {"item_name": "위탁매매부문", "period_header": "제65기", "raw_amount": "12,345",
     "unit_label": "백만원", "value_basis": "업종별_영업수익", "source_table": "..."}
  ]
}

- 준비되지 않은(또는 원문에서 못 찾은) 블록은 키 자체를 생략하거나 빈 배열로 둬라.
- corp_history 각 항목의 필수 필드: event_ym, content, source_table (하나라도 없으면
  ingest가 그 항목을 버린다).
- market_share/segment_revenue 각 항목의 필수 필드: item_name, period_header,
  raw_amount, source_table (하나라도 없으면 ingest가 그 항목을 버린다). unit_label·
  value_basis는 없으면 null.
- raw_amount는 원문 표기 그대로(콤마·부호 유지, 공란이면 "-"). 계산·환산 금지.
"""


# ══════════════════════════════════════════════════════════ prepare (원문 절단 + 지시문 → 파일)

def existing_block_counts(corp_code, rcept_no):
    """이 (corp_code, rcept_no)에 이미 적재된 행이 있는 블록을 표시한다 — 규칙 파서
    (`extract`)가 이미 채운 블록을 prepare 가 다시 준비하지 않게 한다(SKILL.md 순서:
    ①규칙 실행 ②0행 블록 확인 ③그 블록만 prepare)."""
    hist = ep.db_rows_pg("corp_history", {
        "select": "id", "corp_code": "eq.%s" % corp_code,
        "source_rcept_no": "eq.%s" % rcept_no, "limit": "1"})
    ms = ep.db_rows_pg("fin_details", {
        "select": "id", "corp_code": "eq.%s" % corp_code, "concept": "eq.market_share",
        "source_rcept_no": "eq.%s" % rcept_no, "limit": "1"})
    sr = ep.db_rows_pg("fin_details", {
        "select": "id", "corp_code": "eq.%s" % corp_code, "concept": "eq.segment_revenue",
        "source_rcept_no": "eq.%s" % rcept_no, "limit": "1"})
    return {"corp_history": bool(hist), "market_share": bool(ms), "segment_revenue": bool(sr)}


def _write_prepare_file(out_dir, corp_code, rcept_no, block, cut_text, spans, cut_method):
    os.makedirs(out_dir, exist_ok=True)
    fn = os.path.join(out_dir, "%s_%s_%s.txt" % (corp_code, rcept_no, block))
    with open(fn, "w", encoding="utf-8") as f:
        f.write("corp_code=%s rcept_no=%s block=%s\n" % (corp_code, rcept_no, block))
        f.write("generated_at=%s\n" % dt.datetime.now().isoformat())
        f.write("cut_spans(char offset)=%s\n" % spans)
        f.write("cut_method=%s\n" % cut_method)
        f.write("=" * 70 + " 규칙(이 스킬을 실행하는 에이전트 준수사항) " + "=" * 70 + "\n")
        f.write(AGENT_RULES_COMMON + "\n\n")
        f.write(BLOCK_INSTRUCTIONS[block] + "\n")
        f.write("=" * 70 + " 원문 절단분 " + "=" * 70 + "\n")
        f.write("<원문>\n" + cut_text + "\n</원문>\n")
        f.write("=" * 70 + " 출력 계약 " + "=" * 70 + "\n")
        f.write(OUTPUT_CONTRACT % {"corp_code": corp_code, "rcept_no": rcept_no})
    return fn


def _find_section(sections, *needles):
    """정확 키 우선, 없으면 공백을 지운 제목에 needle 이 들어 있는 첫 섹션.
    2005년식 'I.회사의 개황'·'II.사업의 내용(제조업)' 을 현행 목차명과 같은 칸으로
    본다(2026-08-26 배치17 SP삼화: 정확 매칭만 해서 prepare 0파일)."""
    for n in needles:
        if n in sections:
            return n, sections[n]
    compact_needles = [n.replace(" ", "") for n in needles]
    for title, body in sections.items():
        compact = title.replace(" ", "")
        if any(n in compact for n in compact_needles):
            return title, body
    return None, None


def prepare_one(corp_code, rcept_no, out_dir, force=False):
    """규칙 파서가 0행으로 남긴 블록의 prepare 파일을 쓴다. 반환: (쓴 파일 경로 목록, notes)."""
    notes = []
    sections, err = ep.load_sections(corp_code, rcept_no)
    if err:
        notes.append(err)
        return [], notes

    existing = {} if force else existing_block_counts(corp_code, rcept_no)
    written = []

    def _need(block):
        return force or not existing.get(block)

    overview_title, overview_md = _find_section(
        sections, "I. 회사의 개요", "회사의 개요", "회사의 개황")
    if _need("corp_history"):
        if overview_md is not None:
            cut, span = cut_heading_block(overview_md, HISTORY_HEADING_RE)
            if cut:
                fn = _write_prepare_file(out_dir, corp_code, rcept_no, "corp_history", cut,
                                          [span], "heading:%s" % HISTORY_HEADING_RE.pattern)
                written.append(fn)
                notes.append("연혁: prepare 파일=%s (원문 %d~%d행, 섹션=%s)" %
                             (fn, span[0], span[1], overview_title))
            else:
                notes.append("연혁: '## N. 회사의 연혁' 헤딩을 못 찾음 — prepare 생략(확인불가 후보)")
        else:
            notes.append("연혁: 'I. 회사의 개요/개황' 섹션 없음 — prepare 생략")
    else:
        notes.append("연혁: 이미 corp_history 에 적재된 행 있음 — prepare 스킵(--force 로 재생성)")

    biz_title, biz_md = _find_section(sections, "II. 사업의 내용", "사업의 내용")
    if biz_md is not None:
        md = biz_md
        if _need("market_share"):
            cut, spans, hit_kw = cut_keyword_windows(md, MARKET_SHARE_KEYWORDS)
            if cut:
                fn = _write_prepare_file(out_dir, corp_code, rcept_no, "market_share", cut,
                                          spans, "keywords_matched=%s" % hit_kw)
                written.append(fn)
                notes.append("시장점유율: prepare 파일=%s (매칭키워드=%s)" % (fn, hit_kw))
            else:
                notes.append("시장점유율: 키워드 %s 원문 0건 — prepare 생략(확인불가 후보)"
                              % MARKET_SHARE_KEYWORDS)
        else:
            notes.append("시장점유율: 이미 적재된 행 있음 — prepare 스킵(--force 로 재생성)")

        if _need("segment_revenue"):
            cut, spans, hit_kw = cut_keyword_windows(md, SEGMENT_KEYWORDS)
            if cut:
                fn = _write_prepare_file(out_dir, corp_code, rcept_no, "segment_revenue", cut,
                                          spans, "keywords_matched=%s" % hit_kw)
                written.append(fn)
                notes.append("부문별매출: prepare 파일=%s (매칭키워드=%s)" % (fn, hit_kw))
            else:
                notes.append("부문별매출: 키워드 %s 원문 0건 — prepare 생략(확인불가 후보)"
                              % SEGMENT_KEYWORDS)
        else:
            notes.append("부문별매출: 이미 적재된 행 있음 — prepare 스킵(--force 로 재생성)")
    else:
        notes.append("시장점유율·부문별매출: 'II. 사업의 내용' 섹션 없음 — prepare 생략")

    return written, notes


def cmd_prepare(args):
    ep.ingest.print_target()
    corps = [c.strip() for c in args.corps.split(",") if c.strip()]
    rcepts_arg = [r.strip() for r in args.rcepts.split(",")] if args.rcepts else None
    if rcepts_arg and len(rcepts_arg) != len(corps):
        print("prepare: --rcepts 개수(%d)와 --corps 개수(%d)가 다르다. "
              "1:1로 짝을 맞춰라 (카티전곱은 무효 쌍을 만든다)."
              % (len(rcepts_arg), len(corps)))
        return 2
    pairs = []
    if rcepts_arg:
        pairs = list(zip(corps, rcepts_arg))
    else:
        for corp_code in corps:
            r = ep.latest_annual_rcept(corp_code)
            if not r:
                print("[%s] 사업보고서 filings 행을 찾지 못함 — 스킵" % corp_code)
                continue
            pairs.append((corp_code, r))
    total_written = 0
    for corp_code, rcept_no in pairs:
        print("\n=== prepare corp=%s rcept=%s ===" % (corp_code, rcept_no))
        written, notes = prepare_one(corp_code, rcept_no, args.out_dir, force=args.force)
        for n in notes:
            print("  · %s" % n)
        total_written += len(written)
    print("\n총 %d개 prepare 파일 생성 (out_dir=%s)" % (total_written, args.out_dir))
    print("에이전트는 이 파일들을 읽고, corp_code·rcept_no당 JSON 하나로 채운 뒤")
    print("`llm_fallback.py ingest --json <path>` 를 실행한다 (출력 계약은 각 파일 끝에 있다).")


# ══════════════════════════════════════════════════════════ ingest (에이전트 JSON → 게이트 → 적재)

def resolve_periods(period_headers, fallback_year, full_section_text):
    """에이전트가 돌려준 period_header 문자열 집합 → {header: 'YYYY'} 매핑.

    '당기/전기/전전기'는 이 파일이 직접(fallback_year 기준 오프셋으로) 처리하고,
    '제N기'/'20XX' 류는 규칙 파서의 `extract_profile.infer_period_labels`를 그대로
    재사용한다 — 재발명하지 않는다."""
    out = {}
    remaining = []
    used_relative = False
    for ph in period_headers:
        p = (ph or "").strip()
        if p in RELATIVE_PERIOD_MAP:
            used_relative = True
            if fallback_year:
                out[ph] = ep.make_period_key(fallback_year + RELATIVE_PERIOD_MAP[p])
            continue
        remaining.append(ph)

    def sort_key(p):
        parsed = ep.parse_period_col((p or "").strip())
        return -parsed[1] if parsed and parsed[0] == "gi" else 0

    remaining_sorted = sorted(set(remaining), key=sort_key)
    label_source = None
    if remaining_sorted:
        labels, label_source = ep.infer_period_labels(
            full_section_text, len(full_section_text), remaining_sorted, fallback_year)
        out.update(labels)
    # notes 가독성: '당기/전기/전전기'만 있으면 infer_period_labels 는 아예 호출되지 않아
    # label_source 가 None으로 남는다 — 그게 "실패"가 아니라 "이 경로를 쓸 필요가 없었다"
    # 라는 뜻임을 notes에서 구분할 수 있게 명시적으로 채운다.
    if used_relative:
        label_source = ("상대표현(당기/전기/전전기)" if label_source is None
                         else "상대표현(당기/전기/전전기)+%s" % label_source)
    return out, label_source


def build_history_facts(items, notes):
    hist = []
    dropped = 0
    for it in items or []:
        if not it.get("event_ym") or not it.get("content") or not it.get("source_table"):
            dropped += 1
            continue  # 출처 없는 항목은 적재 거부(규칙 ②)
        hist.append({
            "event_ym": it["event_ym"], "category": it.get("category"),
            "content": it["content"],
            "source_section": "I. 회사의 개요 > 2. 회사의 연혁",
            "extracted_by": EXTRACTED_BY_AGENT,
        })
    notes.append("연혁: %d건 채택 (필수필드 결측으로 버림=%d)" % (len(hist), dropped))
    return hist


def build_numeric_facts(concept, block_label, items, fy_int, full_section_text,
                         unit_scale_required, notes):
    items = items or []
    period_headers = [it.get("period_header") for it in items if it.get("period_header")]
    year_map, label_source = resolve_periods(period_headers, fy_int, full_section_text)
    facts = []
    dropped_no_source = skipped_no_year = 0
    for it in items:
        if not it.get("item_name") or not it.get("source_table"):
            dropped_no_source += 1
            continue  # 출처 없는 항목은 적재 거부
        if concept == "segment_revenue" and ep.norm(it.get("item_name") or "") in (
                "합계", "계", "소계", "총계"):
            continue
        hdr = it.get("period_header") or ""
        if any(tok in hdr for tok in ("예상", "전망", "계획")):
            continue  # 실적이 아닌 전망 열 (2026-08-26 이구산업 2026A 24% 실측)
        # year_map 값은 이미 ep.make_period_key()로 조립된 완성 period_key다
        # ('2025A'/'2025Q1' 등) — infer_period_labels()도 resolve_periods()의
        # RELATIVE_PERIOD_MAP 분기도 둘 다 완성형을 낸다. 여기서 다시 '%sA'를
        # 덧붙이면 '2025AA'처럼 이중 접미사가 붙는다(2026-08-26 batch03 적재 중
        # 실측 — period_key 불변식 위반으로 fin_periods 대조 게이트가 전부 스킵됐다).
        period_key = year_map.get(it.get("period_header"))
        if not period_key:
            skipped_no_year += 1
            continue
        raw = it.get("raw_amount")
        v = ep.num(raw)
        raw_s = "" if raw is None else str(raw)
        # '1%미만'·'해당없음'은 숫자가 아니다. num()은 None을 내지만, 예전엔
        # 확인불가 행을 12건씩 남겼다(2026-08-26 이스타코 00134565 실측).
        if v is None and any(tok in raw_s for tok in ("미만", "이상", "해당없", "산정곤란", "기재생략")):
            continue
        unit_label = _normalize_unit_label(it.get("unit_label"))
        amount, unit_out, status = None, None, "확인불가:원문값없음(공란)"
        if v is not None:
            if unit_scale_required:
                scale = UNIT_SCALE.get(unit_label)
                if scale is None:
                    status = "확인불가:에이전트단위불명(unit_label=%r)" % unit_label
                else:
                    amount, unit_out, status = v * scale, "KRW", "ok"
            else:
                amount, unit_out, status = v, "pct", "ok"
        facts.append(ep.fact(concept, it["item_name"], period_key, amount, unit_out,
                              it.get("value_basis"), status,
                              "II. 사업의 내용(에이전트 폴백, %s)" % block_label, it["source_table"],
                              extracted_by=EXTRACTED_BY_AGENT))
    notes.append("%s: %d건 채택(기간라벨경로=%s, 출처결측버림=%d, 연도미확인스킵=%d)" %
                 (block_label, len(facts), label_source, dropped_no_source, skipped_no_year))
    return facts


def load_scope_agent(corp_code, rcept_no, facts, hist, concepts_present):
    """스코프 교체 — **payload 에 실제로 등장한 concept/블록만** 건드린다.
    extract_profile.load_scope()와 달리 ALL_CONCEPTS 전체를 훑지 않는다: 이 스크립트는
    규칙 파서(`extract`)가 이미 적재해 둔 다른 concept 옆에서 부분적으로만 실행되므로,
    payload에 없는 concept까지 빈 리스트로 스코프 교체하면 규칙이 이미 채운 데이터를
    지워버린다(치명적 회귀) — 그래서 여기서는 명시적으로 등장한 것만 delete→insert 한다."""
    by_concept = {}
    for f in facts:
        by_concept.setdefault(f["concept"], []).append(ep.to_db_row(corp_code, rcept_no, f))
    for concept in sorted(concepts_present & set(BLOCK_CONCEPT.values())):
        rows = by_concept.get(concept, [])
        rows = ingest.dedupe_by(rows, ["corp_code", "period_key", "concept", "item_name",
                                        "source_rcept_no"], "fin_details:%s" % concept)
        ingest.replace_scope(
            "fin_details",
            {"corp_code": "eq.%s" % corp_code, "concept": "eq.%s" % concept,
             "source_rcept_no": "eq.%s" % rcept_no},
            rows, on_conflict="corp_code,period_key,concept,item_name,source_rcept_no")
        print("  fin_details[%s]: %d행" % (concept, len(rows)))

    if "corp_history" in concepts_present:
        hist_rows = [ep.to_history_row(corp_code, rcept_no, h) for h in hist]
        hist_rows = ingest.dedupe_by(hist_rows, ["corp_code", "source_rcept_no", "event_ym", "content"],
                                      "corp_history")
        ingest.replace_scope(
            "corp_history", {"corp_code": "eq.%s" % corp_code, "source_rcept_no": "eq.%s" % rcept_no},
            hist_rows, on_conflict="corp_code,source_rcept_no,event_ym,content")
        print("  corp_history: %d행" % len(hist_rows))


def ingest_one(payload, do_load, notes):
    corp_code = payload.get("corp_code")
    rcept_no = payload.get("rcept_no")
    if not corp_code or not rcept_no:
        raise ValueError("JSON에 corp_code/rcept_no가 없다 — 어느 회사·회차인지 특정 불가")

    for n in payload.get("agent_notes") or []:
        notes.append("에이전트 기록: %s" % n)

    facts, hist = [], []
    concepts_present = set()

    if "corp_history" in payload:
        concepts_present.add("corp_history")
        hist = build_history_facts(payload["corp_history"], notes)

    need_section_text = "market_share" in payload or "segment_revenue" in payload
    full_section_text = ""
    if need_section_text:
        sections, err = ep.load_sections(corp_code, rcept_no)
        if err:
            # prepare 단계에서 이미 이 섹션을 읽어야 절단분을 냈을 것이므로, ingest 시점에
            # 없다면 그 사이 뭔가 바뀐 것 — 조용히 넘어가지 않고 명확히 실패시킨다.
            raise RuntimeError("기간 라벨 해석에 필요한 원문 섹션을 다시 읽지 못함: %s" % err)
        _biz_title, biz_md = _find_section(sections, "II. 사업의 내용", "사업의 내용")
        full_section_text = biz_md or ""

    fy_int, _fy_period_key, _fy_report_nm = ep.report_fiscal_year(rcept_no)

    if "market_share" in payload:
        concepts_present.add("market_share")
        facts += build_numeric_facts("market_share", "시장점유율", payload["market_share"],
                                      fy_int, full_section_text, unit_scale_required=False,
                                      notes=notes)
    if "segment_revenue" in payload:
        concepts_present.add("segment_revenue")
        facts += build_numeric_facts("segment_revenue", "부문별매출", payload["segment_revenue"],
                                      fy_int, full_section_text, unit_scale_required=True,
                                      notes=notes)

    facts, held = ep.apply_gates(corp_code, facts, notes)

    print("─" * 70)
    print("ingest 결과: corp=%s rcept=%s" % (corp_code, rcept_no))
    for concept in sorted(concepts_present):
        if concept == "corp_history":
            print("  corp_history: 채택 %d건" % len(hist))
        else:
            n_ok = sum(1 for f in facts if f["concept"] == concept)
            n_held = sum(1 for h in held if h["concept"] == concept)
            print("  fin_details[%s]: 게이트통과=%d 게이트보류=%d" % (concept, n_ok, n_held))
    if notes:
        print("  --- notes ---")
        for n in notes:
            print("  · %s" % n)
    print("─" * 70)

    if do_load:
        load_scope_agent(corp_code, rcept_no, facts, hist, concepts_present)
    else:
        print("  (dry-run — 적재 생략)")

    return facts, hist, held


def cmd_ingest(args):
    ep.ingest.print_target()
    with open(args.json, encoding="utf-8") as f:
        payload = json.load(f)
    notes = []
    ingest_one(payload, do_load=not args.dry_run, notes=notes)


# ══════════════════════════════════════════════════════════ CLI

def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    sp_prepare = sub.add_parser("prepare", help="규칙이 0행으로 남긴 블록의 원문 절단분+지시문을 파일로 낸다")
    sp_prepare.add_argument("--corps", required=True, help="쉼표구분 corp_code 목록")
    sp_prepare.add_argument("--rcepts", default=None,
                             help="쉼표구분 rcept_no 목록 — 생략 시 회사별 최신 사업보고서 1건 자동 선택")
    sp_prepare.add_argument("--out-dir", required=True, dest="out_dir",
                             help="prepare 파일을 쓸 디렉터리(세션마다 다르므로 하드코딩하지 않는다)")
    sp_prepare.add_argument("--force", action="store_true",
                             help="이미 fin_details/corp_history에 행이 있는 블록도 다시 prepare한다")
    sp_prepare.set_defaults(func=cmd_prepare)

    sp_ingest = sub.add_parser("ingest", help="에이전트가 채운 JSON을 게이트 통과분만 적재한다")
    sp_ingest.add_argument("--json", required=True, help="에이전트가 출력 계약대로 채운 JSON 파일 경로")
    sp_ingest.add_argument("--dry-run", action="store_true", dest="dry_run",
                            help="게이트까지만 실행하고 적재는 하지 않는다(확인용)")
    sp_ingest.set_defaults(func=cmd_ingest)

    args = p.parse_args()
    sys.exit(args.func(args) or 0)


if __name__ == "__main__":
    main()
