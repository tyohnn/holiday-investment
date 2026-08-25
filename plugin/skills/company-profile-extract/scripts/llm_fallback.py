#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""규칙 파서(`extract_profile.py`)가 0행/실패로 남긴 3블록의 LLM 폴백.

대상은 2026-08-25 3사 재현시험(`references/재현성-시험-3사.md`)이 "개념 축 자체가
회사마다 다르다"로 확정한 세 블록뿐이다 — **`corp_history`(연혁) · `segment_revenue`
(부문별 매출, 절대금액만) · `market_share`(시장점유율)**. 주주현황·R&D는 규칙으로 전
회사 통과했거나(주주) 이미 고쳐졌다(R&D) — 손대지 않는다. `segment_revenue_pct`·
`segment_operating_income`·`segment_total_assets`(★화이트리스트 표)도 이번 폴백
범위 밖이다(감독 지시 범위 그대로).

## 규칙(★ 절대 어기지 말 것 — 감독 지시 그대로)
1. LLM은 원문에 있는 숫자를 구조로 옮기는 것만 한다. 생성·보간·추정 금지. 특히
   **단위 환산(억원→원 등)도 LLM이 하지 않는다** — `raw_amount`(원문 표기 그대로)와
   `unit_label`(원문에 적힌 단위 문구 그대로)만 받고, 환산은 이 파일의 순수 함수
   (`num()`/`UNIT_SCALE`)가 결정론적으로 한다. 부문 합계도 LLM이 계산하지 않는다 —
   원문에 합계 행이 있으면 그 행 값을 그대로 옮기게 한다.
2. 출처 3단(source_rcept_no는 호출부가 이미 앎, source_section/source_table은 LLM이
   답한다) — source_table이 없는 항목은 적재하지 않는다(스키마 도구 호출에서
   required로 강제).
3. `extracted_by='llm:claude-sonnet-5'`로 규칙 산출물(`'rule'`)과 구분한다.
4. `value_basis`를 채운다 — 특히 segment_revenue는 회사마다 분류축이 달라서
   (업종별/공사종류별/제품계층별) 이 필드가 없으면 나중에 서로 다른 축의 숫자를
   같은 개념으로 착각한다.
5. 게이트는 규칙 산출물과 동일하게 적용한다 — 이 파일은 게이트를 직접 걸지 않는다.
   `extract_profile.extract_one()`이 규칙 facts와 이 파일이 만든 facts를 합쳐 하나의
   리스트로 `apply_gates()`에 넘기므로, 부문합 vs `fin_periods.revenue` ±1% 게이트와
   자릿수 sanity 게이트가 LLM facts에도 그대로 걸린다(별도 구현 불필요, 그대로 재사용).
6. 원문 섹션 전체(수만 자)를 통째로 넣지 않는다 — 표 주변만 잘라 넣는다(아래
   `cut_heading_block`/`cut_keyword_windows`). 어떻게 잘랐는지(스팬·매칭 키워드)를
   dry-run 덤프와 notes에 남겨 재현 가능하게 한다.

## 기간 라벨을 LLM에게 계산시키지 않는 이유
segment_revenue·market_share 표의 열 헤더는 '제65기'·'당기/전기/전전기'·'2025.12' 등
제각각이다. "이게 몇 년도냐"는 계산이 아니라 문서 규약을 아는 문제이므로, LLM에게는
헤더 문자열을 원문 그대로 옮기게만 하고(`period_header`), 연도 매핑은 규칙 파서가 이미
쓰는 `parse_period_col()`/`infer_period_labels()`를 **그대로 재사용**한다(호출부가
함수 참조를 넘겨준다 — 재발명·이중 유지보수 금지). '당기/전기/전전기'류 상대 표현만
이 파일이 추가로 처리한다(규칙 파서가 다루지 않던 표현).

## 윈도우 절단 방식 (3사 실측 원문으로 보정, 2026-08-25)
- **연혁**: `## N. 회사의 연혁` 헤딩부터 다음 `##` 헤딩 전까지(세 회사 다 동일 구조로
  확인: 부국 147~186행, 삼양 123~242행, 동신 62~77행 — 헤딩 경계가 깨끗해 키워드
  윈도우보다 이 방식이 더 정확하다).
- **부문별 매출**: 키워드(`SEGMENT_KEYWORDS`) 주변 윈도우. 헤딩 레벨이 회사마다
  달라(부국은 `##` 밖 부제목, 삼양·동신은 `##`) 헤딩 기준 절단이 안 통한다.
- **시장점유율**: 키워드(`MARKET_SHARE_KEYWORDS`) 주변 윈도우. 부국은 "9) 시장점유율
  등"(꺾쇠 아님, 규칙 파서가 못 찾는 바로 그 패턴)이라 키워드 매칭만 신뢰할 수 있다.
- 키워드가 원문에 0건이면(예: 동신건설 "시장점유율" 0건 — 3사 재현시험이 이미 grep으로
  실측) **LLM 호출 자체를 생략**하고 확인불가로 남긴다 — 이 판정 자체가 이미
  결정론적이라(정규식 매칭 유무), LLM에게 "찾아봤는데 없다"를 다시 시키는 건 비용
  낭비다.
"""
import datetime as dt
import json
import os
import re
import urllib.error
import urllib.request

MODEL = "claude-sonnet-5"
API_URL = "https://api.anthropic.com/v1/messages"
API_VERSION = "2023-06-01"
EXTRACTED_BY_LLM = "llm:%s" % MODEL

# 표에 적힌 단위 문구 → KRW 배수. 이 사전에 없는 단위 문구가 오면(오탈자·새 단위)
# **추측해서 배수를 고르지 않는다** — 확인불가로 남긴다(규칙 파서의 세그먼트 스케일
# 하드코딩과 달리, 여기는 회사마다 단위가 다를 수 있어 화이트리스트로 막는다).
UNIT_SCALE = {"억원": 100_000_000, "백만원": 1_000_000, "천원": 1_000, "원": 1}


def _normalize_unit_label(s):
    """LLM이 프롬프트 지시를 따르지 않고 캡션을 통째로 베껴도(예: '단위:천원, %',
    '(백만원)') UNIT_SCALE 조회가 실패하지 않도록 방어적으로 정리한다 — 실측:
    삼양식품 부문표 캡션이 '(단위:천원, %)' 형태라 프롬프트에서 '단위:'를 떼라고
    지시했지만, 지시를 어겨도 여기서 한 번 더 걸러야 조용히 확인불가로 새지 않는다."""
    if not s:
        return None
    s = s.strip().strip("()（）")
    s = re.sub(r"^단위\s*[:：]\s*", "", s)
    s = re.split(r"[,，%]", s)[0].strip()
    return s or None

# 사업보고서 관용구 — 표 헤더가 '제N기' 대신 상대 표현을 쓰는 경우(부국증권 부문별
# 정보 표 실측: '<당기>'/'<전기>'/'<전전기>' 마커, 표 헤더 자체엔 기간 라벨이 없다).
# fallback_year(=report_fiscal_year, filings.report_nm에서 결정론적으로 구한 값)를
# 기준으로 오프셋만 더한다 — LLM에게 연도 계산을 맡기지 않는다.
RELATIVE_PERIOD_MAP = {"당기": 0, "전기": -1, "전전기": -2, "전전전기": -3}

HISTORY_HEADING_RE = re.compile(r"^##\s*\d+\.\s*회사의\s*연혁")

SEGMENT_KEYWORDS = ["매출실적", "영업실적", "영업 실적", "매출 및 수주상황", "공사종류",
                     "부문별 매출", "사업부문별 현황", "사업부문별 요약"]
MARKET_SHARE_KEYWORDS = ["시장점유율", "시장 점유율", "점유율 추이", "점유율 등"]


# ══════════════════════════════════════════════════════════ 원문 절단

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


# ══════════════════════════════════════════════════════════ Claude API 호출

SYSTEM_PROMPT_COMMON = """당신은 한국 상장기업 DART 사업보고서 원문에서 구조화된 사실만 옮겨 적는 추출기다.
아래 규칙을 절대 어기지 마라 — 이건 재무 데이터이고, 잘못 만들어낸 값은 실제 투자
판단에 쓰일 수 있다.

1. 아래 <원문> 안에 실제로 적힌 숫자·문구만 옮긴다. <원문>에 없는 값을 생성·추정·
   보간하지 않는다. 계산도 하지 않는다 — 합계가 필요하면 <원문>에 합계/계 행이 있는지
   찾아 그 행의 값을 그대로 옮겨라. 네가 직접 더하거나 나누지 마라.
2. <원문>에서 찾을 수 없으면 found=false로 답하고 not_found_reason에 왜 없는지 적어라
   (예: "정성 서술만 있고 정량 수치 자체가 없음", "이 회사엔 해당 개념이 없음(업종상
   무관)", "표가 아예 없고 산문뿐"). items는 빈 배열로 둔다. 억지로 만들어내지 마라.
3. 숫자는 <원문> 표기 그대로 raw_amount에 옮긴다 — 콤마·마이너스·△ 부호를 그대로
   유지한다("12,345", "△301,146", "-" 등). 단위 환산(억원→원 등)은 네가 하지 않는다 —
   표/캡션에 적힌 단위 문구를, "단위:"·괄호·쉼표·퍼센트 기호 같은 장식은 다 떼고
   순수 단위 단어만 unit_label에 옮겨라. 예: 캡션이 "(단위:천원, %)"이면 금액 칸에는
   "천원"만 적는다("단위:천원"이나 "천원, %"처럼 장식을 남기지 마라). 단위 문구를 못
   찾으면 null로 둬라(추측하지 마라).
4. 표 헤더의 기간 라벨(period_header)도 원문 그대로 옮긴다 — "제65기", "2025.12",
   "2025년", "당기", "전기", "전전기" 등. 네가 실제 연도로 계산하지 마라(호출부가
   별도 규칙으로 변환한다).
5. 각 항목마다 어느 표/문단에서 나왔는지 source_table에 적어라(예: 표 바로 위 소제목,
   또는 "II.4.가 매출실적 표"). 어느 표인지 특정할 수 없으면 그 항목은 아예 넣지 마라.
"""


def _tool_schema_history():
    return {
        "name": "report_corp_history",
        "description": "사업보고서 '회사의 연혁' 섹션의 개별 항목을 구조화해 보고한다.",
        "input_schema": {
            "type": "object",
            "properties": {
                "found": {"type": "boolean"},
                "not_found_reason": {"type": ["string", "null"]},
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "event_ym": {"type": "string",
                                "description": "이 항목의 시점, 원문 표기 그대로(예: '2021', '2021.03', '1985.04')"},
                            "category": {"type": ["string", "null"],
                                "description": "원문에 별도 구분 칸이 있을 때만 채운다. 없으면 null(지어내지 마라)."},
                            "content": {"type": "string", "description": "그 시점의 사건 내용, 원문 문구 그대로"},
                            "source_table": {"type": "string",
                                "description": "이 항목이 나온 표/문단 식별자(예: '주요 변동사항 표')"},
                        },
                        "required": ["event_ym", "content", "source_table"],
                    },
                },
            },
            "required": ["found", "items"],
        },
    }


def _tool_schema_numeric(name, description, item_name_desc):
    return {
        "name": name,
        "description": description,
        "input_schema": {
            "type": "object",
            "properties": {
                "found": {"type": "boolean"},
                "not_found_reason": {"type": ["string", "null"]},
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "item_name": {"type": "string", "description": item_name_desc},
                            "period_header": {"type": "string",
                                "description": "표 헤더의 기간 라벨 원문 그대로(예: '제65기','2025.12','당기')"},
                            "raw_amount": {"type": "string",
                                "description": "셀 값 원문 그대로(콤마·부호 유지, 공란이면 '-')"},
                            "unit_label": {"type": ["string", "null"],
                                "description": "표/캡션에 적힌 단위 원문 그대로(예: '억원'). 모르면 null"},
                            "value_basis": {"type": ["string", "null"],
                                "description": "이 값이 어떤 분류축의 값인지 설명(예: '업종별_영업수익', '공사종류별_국내도급')"},
                            "source_table": {"type": "string"},
                        },
                        "required": ["item_name", "period_header", "raw_amount", "source_table"],
                    },
                },
            },
            "required": ["found", "items"],
        },
    }


def call_claude(system, user_text, tool):
    """Claude Messages API를 tool-use 강제 호출로 때린다(순수 stdlib — SKILL.md의
    '별도 pip 설치 불필요' 원칙을 이 폴백에도 유지한다). ANTHROPIC_API_KEY가 없으면
    조용히 건너뛰지 않고 여기서 명확히 예외를 던진다(감독 지시 그대로)."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY 환경변수가 없다 — LLM 폴백을 실행할 수 없다. "
            "export ANTHROPIC_API_KEY=... 를 설정하고 재실행하라(조용히 건너뛰지 않는다).")
    body = {
        "model": MODEL,
        "max_tokens": 8192,
        "system": system,
        "messages": [{"role": "user", "content": user_text}],
        "tools": [tool],
        "tool_choice": {"type": "tool", "name": tool["name"]},
    }
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        API_URL, data=data, method="POST",
        headers={"x-api-key": api_key, "anthropic-version": API_VERSION,
                 "content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            resp_json = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:800]
        raise RuntimeError("Claude API 호출 실패 %s %s: %s" % (e.code, API_URL, detail))
    for block in resp_json.get("content", []):
        if block.get("type") == "tool_use" and block.get("name") == tool["name"]:
            return block["input"]
    raise RuntimeError("Claude 응답에 tool_use 블록이 없음(모델=%s): %s" %
                        (MODEL, json.dumps(resp_json, ensure_ascii=False)[:500]))


# ══════════════════════════════════════════════════════════ 기간 라벨 해석 (규칙 재사용)

def resolve_periods(period_headers, fallback_year, full_section_text, parse_period_col_fn,
                     infer_period_labels_fn):
    """LLM이 돌려준 period_header 문자열 집합 → {header: 'YYYY'} 매핑.

    '당기/전기/전전기'는 이 파일이 직접(fallback_year 기준 오프셋으로) 처리하고,
    '제N기'/'20XX' 류는 규칙 파서의 `infer_period_labels`를 그대로 재사용한다 —
    재발명하지 않는다. `infer_period_labels`는 "표의 첫 period 컬럼 = 최신 회차"를
    전제하므로, 넘기는 리스트는 기수가 큰(최신) 순서로 정렬해야 한다."""
    out = {}
    remaining = []
    for ph in period_headers:
        p = (ph or "").strip()
        if p in RELATIVE_PERIOD_MAP:
            if fallback_year:
                out[ph] = str(fallback_year + RELATIVE_PERIOD_MAP[p])
            continue
        remaining.append(ph)

    def sort_key(p):
        parsed = parse_period_col_fn((p or "").strip())
        return -parsed[1] if parsed and parsed[0] == "gi" else 0

    remaining_sorted = sorted(set(remaining), key=sort_key)
    label_source = None
    if remaining_sorted:
        labels, label_source = infer_period_labels_fn(
            full_section_text, len(full_section_text), remaining_sorted, fallback_year)
        out.update(labels)
    return out, label_source


# ══════════════════════════════════════════════════════════ 덤프(dry-run)

def _dump_prompt(dump_dir, corp_code, rcept_no, block, system, user_text, spans, keywords_or_heading):
    if not dump_dir:
        return None
    os.makedirs(dump_dir, exist_ok=True)
    fn = os.path.join(dump_dir, "%s_%s_%s.txt" % (corp_code, rcept_no, block))
    with open(fn, "w", encoding="utf-8") as f:
        f.write("corp_code=%s rcept_no=%s block=%s\n" % (corp_code, rcept_no, block))
        f.write("dumped_at=%s\n" % dt.datetime.now().isoformat())
        f.write("cut_spans(char offset)=%s\n" % spans)
        f.write("cut_method=%s\n" % keywords_or_heading)
        f.write("user_text_chars=%d\n" % len(user_text))
        f.write("=" * 70 + " SYSTEM PROMPT " + "=" * 70 + "\n")
        f.write(system + "\n")
        f.write("=" * 70 + " USER PROMPT (원문 절단분) " + "=" * 70 + "\n")
        f.write(user_text + "\n")
    return fn


# ══════════════════════════════════════════════════════════ 블록별 폴백

def _fallback_history(corp_code, rcept_no, section_text, dry_run, dump_dir, notes):
    cut, span = cut_heading_block(section_text, HISTORY_HEADING_RE)
    if cut is None:
        notes.append("LLM폴백(연혁): '## N. 회사의 연혁' 헤딩을 못 찾아 호출 생략 — 확인불가")
        return []
    user_text = "<원문 — 'I. 회사의 개요 > 회사의 연혁' 섹션 발췌>\n%s\n</원문>" % cut
    tool = _tool_schema_history()
    if dry_run:
        fn = _dump_prompt(dump_dir, corp_code, rcept_no, "corp_history",
                           SYSTEM_PROMPT_COMMON, user_text, [span], "heading:%s" % HISTORY_HEADING_RE.pattern)
        notes.append("LLM폴백(연혁): dry-run 덤프=%s (호출 안 함)" % fn)
        return []
    try:
        result = call_claude(SYSTEM_PROMPT_COMMON, user_text, tool)
    except Exception as e:  # noqa: BLE001 — 이 블록 하나의 실패가 나머지를 막으면 안 된다
        notes.append("LLM폴백(연혁): 호출 실패 — %s: %s" % (type(e).__name__, e))
        return []
    if not result.get("found"):
        notes.append("LLM폴백(연혁): found=false — %s" % result.get("not_found_reason"))
        return []
    items = result.get("items") or []
    hist = []
    for it in items:
        if not it.get("event_ym") or not it.get("content") or not it.get("source_table"):
            continue  # 출처 없는 항목은 적재 거부(감독 규칙 ②)
        hist.append({
            "event_ym": it["event_ym"], "category": it.get("category"),
            "content": it["content"],
            "source_section": "I. 회사의 개요 > 2. 회사의 연혁",
            "source_table": it["source_table"],
            "extracted_by": EXTRACTED_BY_LLM,
        })
    notes.append("LLM폴백(연혁): %d건 추출(원문 절단 %d~%d행)" % (len(hist), span[0], span[1]))
    return hist


def _fallback_numeric_block(block_label, concept, item_name_desc, extra_instruction, keywords,
                             corp_code, rcept_no, section_text, fy_int, dry_run, dump_dir, notes,
                             fact_fn, num_fn, parse_period_col_fn, infer_period_labels_fn,
                             unit_scale_required):
    cut, spans, hit_kw = cut_keyword_windows(section_text, keywords)
    if cut is None:
        notes.append("LLM폴백(%s): 키워드 %s 원문 0건 — 호출 생략, 확인불가" % (block_label, keywords))
        return []
    user_text = ("%s\n\n"
                 "<원문 — 'II. 사업의 내용' 섹션에서 %s 관련 구간만 발췌(전체 아님)>\n"
                 "%s\n"
                 "</원문>") % (extra_instruction, block_label, cut)
    tool = _tool_schema_numeric(
        "report_%s" % concept, "%s 표의 개별 셀 값을 구조화해 보고한다." % block_label, item_name_desc)
    if dry_run:
        fn = _dump_prompt(dump_dir, corp_code, rcept_no, concept, SYSTEM_PROMPT_COMMON, user_text,
                           spans, "keywords_matched=%s" % hit_kw)
        notes.append("LLM폴백(%s): dry-run 덤프=%s (호출 안 함, 매칭키워드=%s)" % (block_label, fn, hit_kw))
        return []
    try:
        result = call_claude(SYSTEM_PROMPT_COMMON, user_text, tool)
    except Exception as e:  # noqa: BLE001
        notes.append("LLM폴백(%s): 호출 실패 — %s: %s" % (block_label, type(e).__name__, e))
        return []
    if not result.get("found"):
        notes.append("LLM폴백(%s): found=false — %s" % (block_label, result.get("not_found_reason")))
        return []
    items = result.get("items") or []
    period_headers = [it.get("period_header") for it in items if it.get("period_header")]
    year_map, label_source = resolve_periods(
        period_headers, fy_int, section_text, parse_period_col_fn, infer_period_labels_fn)
    facts = []
    skipped_no_year = 0
    for it in items:
        if not it.get("item_name") or not it.get("source_table"):
            continue  # 출처 없는 항목은 적재 거부
        year = year_map.get(it.get("period_header"))
        if not year:
            skipped_no_year += 1
            continue
        raw = it.get("raw_amount")
        v = num_fn(raw)
        unit_label = _normalize_unit_label(it.get("unit_label"))
        amount, unit_out, status = None, None, "확인불가:원문값없음(공란)"
        if v is not None:
            if unit_scale_required:
                scale = UNIT_SCALE.get(unit_label)
                if scale is None:
                    status = "확인불가:LLM단위불명(unit_label=%r)" % unit_label
                else:
                    amount, unit_out, status = v * scale, "KRW", "ok"
            else:
                amount, unit_out, status = v, "pct", "ok"
        facts.append(fact_fn(concept, it["item_name"], "%sA" % year, amount, unit_out,
                              it.get("value_basis"), status,
                              "II. 사업의 내용(LLM 폴백, %s)" % block_label, it["source_table"],
                              extracted_by=EXTRACTED_BY_LLM))
    notes.append("LLM폴백(%s): %d건 추출(기간라벨경로=%s, 연도미확인스킵=%d, 매칭키워드=%s)" %
                 (block_label, len(facts), label_source, skipped_no_year, hit_kw))
    return facts


def run_fallback(corp_code, rcept_no, sections, fy_int, existing_facts, existing_hist,
                  fact_fn, num_fn, parse_period_col_fn, infer_period_labels_fn,
                  dry_run=False, dump_dir=None):
    """규칙 파서가 이미 만든 facts/hist를 보고, 비어 있는 3블록만 LLM으로 채운다.
    반환: (new_facts, new_hist, notes) — extract_profile.extract_one()이 자기
    facts/hist에 그대로 더한다. 함수 참조를 넘기는 이유: extract_profile.py의
    fact()/num()/parse_period_col()/infer_period_labels()를 재구현하지 않고
    그대로 재사용하기 위해서다(순환 import 없이, 재발명 없이)."""
    notes = []
    new_facts, new_hist = [], []

    need_history = len(existing_hist) == 0
    need_market_share = not any(f["concept"] == "market_share" for f in existing_facts)
    need_segment_revenue = not any(f["concept"] == "segment_revenue" for f in existing_facts)

    if need_history:
        if "I. 회사의 개요" in sections:
            new_hist += _fallback_history(corp_code, rcept_no, sections["I. 회사의 개요"],
                                           dry_run, dump_dir, notes)
        else:
            notes.append("LLM폴백(연혁): 'I. 회사의 개요' 섹션 없음 — 호출 생략")

    if need_market_share:
        if "II. 사업의 내용" in sections:
            new_facts += _fallback_numeric_block(
                "시장점유율", "market_share", "제품/세부항목 이름, 원문 라벨 그대로(예: '집합투자재산|자산운용업')",
                "아래 표에는 '시장점유율'(퍼센트, 대개 '점유율'이라는 이름의 행)과 그 점유율을 "
                "계산하는 데 쓰인 절대 실적치(예: '영업수익'·'수탁고'·'회사 신기술금융투자실적' 같은 "
                "원 단위 숫자 행)가 함께 나올 수 있다. **오직 점유율(퍼센트) 값만 추출하라 — 절대 "
                "실적치·산업 전체 수치 행은 추출하지 마라.** 정성적 서술(숫자 없는 경쟁 구도 설명)만 "
                "있고 실제 퍼센트 수치가 없으면 found=false로 답하라.",
                MARKET_SHARE_KEYWORDS, corp_code, rcept_no, sections["II. 사업의 내용"], fy_int,
                dry_run, dump_dir, notes, fact_fn, num_fn, parse_period_col_fn,
                infer_period_labels_fn, unit_scale_required=False)
        else:
            notes.append("LLM폴백(시장점유율): 'II. 사업의 내용' 섹션 없음 — 호출 생략")

    if need_segment_revenue:
        if "II. 사업의 내용" in sections:
            new_facts += _fallback_numeric_block(
                "부문별매출", "segment_revenue",
                "매출/영업수익 행의 부문·사업축 이름, 원문 라벨 그대로(영업이익·순이익 등 다른 지표 행은 추출하지 마라. "
                "합계/계 행이 있으면 item_name='합계'로 그 행 값도 반드시 포함하라)",
                "아래에는 매출(또는 영업수익) 표 말고도 영업이익·순이익·비용 등 다른 지표를 담은 "
                "행이 같은 표 안에 섞여 있을 수 있고, 매출과 무관한 다른 표(예: 수주현황)가 함께 "
                "잘려 들어와 있을 수도 있다. **매출/영업수익을 나타내는 행만 추출하라.** 그 표에 "
                "합계·계 행이 있으면 그 행도 item_name='합계'로 반드시 포함해라(적재 후 fin_periods "
                "매출액과 대조하는 데 쓰인다). 표가 없거나 매출을 이 분류축으로 쪼갠 정보가 없으면 "
                "found=false로 답하라.",
                SEGMENT_KEYWORDS, corp_code, rcept_no, sections["II. 사업의 내용"], fy_int,
                dry_run, dump_dir, notes, fact_fn, num_fn, parse_period_col_fn,
                infer_period_labels_fn, unit_scale_required=True)
        else:
            notes.append("LLM폴백(부문별매출): 'II. 사업의 내용' 섹션 없음 — 호출 생략")

    return new_facts, new_hist, notes
