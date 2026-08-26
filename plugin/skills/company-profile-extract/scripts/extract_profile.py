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
import io
import json
import os
import re
import sys
import traceback
import urllib.parse
import zipfile

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO = os.path.abspath(os.path.join(_HERE, "..", "..", "..", ".."))
sys.path.insert(0, os.path.join(_REPO, "platform", "ingest"))
sys.path.insert(0, os.path.join(_REPO, "plugin", "skills", "company-analysis", "scripts"))
import ingest  # noqa: E402  — rest()/upsert()/replace_scope()/storage_download() 재사용, 재발명 금지
import dart_doc  # noqa: E402  — split_sections(): 사전 분할본이 없을 때 즉석 분할(load_sections)
# 2026-08-25: llm_fallback.py 를 여기서 import 하지 않는다. 예전엔 --llm-fallback 플래그로
# 이 모듈이 Anthropic API 를 호출하는 폴백을 inline 으로 끼워 넣었지만, 지금은 llm_fallback.py
# 자체가 (에이전트가 직접 실행하는) 독립 2단계 CLI(prepare/ingest)로 바뀌어 이 스크립트와
# 별개로 돈다 — 방향이 뒤집혀 llm_fallback.py 가 이 모듈(extract_profile)을 import 한다.
# 여기서 다시 llm_fallback 을 import 하면 순환 import 가 된다.

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
    """'1,879,673' / '△301,146' / '(11,344)' / '11.3%' → 숫자. 파싱 불가·공란이면 None.

    괄호는 회계 관행상 음수다('(11,344)' = -11,344). 2026-08-26 batch06 실측으로 이
    표기를 못 읽어 부문별매출 일부가 조용히 누락되는 것을 확인해 추가했다 — 그 전에는
    extract_notes_full.py 가 같은 처리를 num_signed() 래퍼로 따로 갖고 있었다(그 래퍼는
    괄호를 먼저 벗겨 이 함수를 부르므로 이 변경과 충돌하지 않는다).
    숫자가 아닌 괄호 문자열('(주1)' 등)은 여전히 float() 에서 걸러져 None 이 된다."""
    if s is None:
        return None
    t = s.strip().replace(",", "").replace("%", "")
    paren_neg = t.startswith("(") and t.endswith(")")
    if paren_neg:
        t = t[1:-1].strip()
    # 한국 공시는 음수를 △·▲ 로 혼용 표기한다(batch35 신세계 실측: ▲ 를 못 읽어
    # 해당 행이 통째로 파싱 실패했다). 괄호 표기는 위에서 이미 처리했다.
    neg = paren_neg or t.startswith("△") or t.startswith("▲") or t.startswith("-")
    t = t.lstrip("△▲-")
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


def make_period_key(year, quarter=None):
    """(year, quarter) → fin_details/fin_periods 공용 period_key 문자열. 하드코딩된
    '%sA' % year 를 전부 이 함수로 모았다(2026-08-25 분기·반기 지원 — 감독 지시 §B).

    quarter=None → 연간('2026A'). quarter=1/2/3 → 분기('2026Q1'). quarter='H1' → 반기
    ('2026H1', fin_periods 에 없는 접미사 — 아래 이유).

    **반기는 fin_periods 의 Q2 에 매핑하지 않는다.** fin_periods 3부(마이그레이션
    20260806000001) 실측 근거: Q1~Q3 의 amount 는 discrete 3개월 단독값이다(삼성전자
    2024 CFS 매출 실측: 1Q 71.9조 + 2Q 74.1조 + 3Q 79.1조 = amount_cum 225.1조 — 즉
    Q2 는 이미 '그 분기만'이지 누적이 아니다). 그런데 사업보고서 원문 표의 '제N기 반기'
    라벨은 통상 반기(6개월) **누적** 값을 가리킨다(반기보고서 관행 — 3개월 단독 Q2와
    별개 컬럼). 이 둘을 같은 'Q2' 로 밀어넣으면 값의 성질이 다른데도 같은 period_key
    아래 섞여 게이트(부문합 대조 등)가 discrete 값과 누적 값을 잘못 비교하게 된다.
    fin_details.period_key 는 자유 텍스트라(마이그레이션 20260823000001 주석: 시점형은
    날짜 문자열도 허용) 'H1' 접미사를 새로 만들어도 스키마 위반이 아니다 — 그래서 반기는
    별도 표기로 남기고, fin_periods 에 대응 타입이 없으니 게이트 비교는 스킵한다
    (apply_gates/db_revenue 의 period_type_of 참고)."""
    if quarter is None:
        return "%dA" % year
    if quarter == "H1":
        return "%dH1" % year
    return "%dQ%d" % (year, quarter)


def period_type_of(period_key):
    """fin_details.period_key 문자열에서 fin_periods.period_type 짝을 뽑는다
    ('A'|'Q1'~'Q4') — 대응이 없으면(H1 등) None. 게이트가 fin_periods 를 대조할 때
    쓴다: db_revenue 가 예전엔 period_type='A' 를 하드코딩해 분기 period_key 를 넣어도
    항상 연간 매출과 비교했다(조용한 오탐/오탈락 원인) — 이제 period_key 자체에서
    타입을 뽑는다."""
    if period_key.endswith("A") and re.fullmatch(r"\d{4}A", period_key):
        return "A"
    m = re.fullmatch(r"\d{4}(Q[1-4])", period_key)
    if m:
        return m.group(1)
    return None  # H1(반기) 등 fin_periods 에 대응 타입 없음 — 호출부가 게이트 스킵


def parse_period_col(s):
    """표 헤더 열 하나가 회계기간을 가리키는지 판정한다.
    반환: ('gi', N, quarter) | ('year', YYYY, quarter) | None.
    quarter 는 1/2/3(분기 단독) | 'H1'(반기) | None(연간) — 호출부는 항상 3-tuple 을
    받는다(2026-08-25 이전엔 2-tuple 이었다, 아래 확장과 함께 호출부 전체를 맞췄다).

    실측 근거(삼성전자 2026Q1 분기보고서, rcept_no=20260515002181, 'II. 사업의 내용'):
    이전 정규식은 '제58기 1분기'(원문 12회)·'2026년 1분기'(원문 26회)·'제58기 반기' 를
    전부 None 으로 떨어뜨렸다 — '제\\s*(\\d+)\\s*기' 가 fullmatch라 뒤에 '1분기'가
    붙으면 매치 자체가 실패했다. 이 실패는 단순 누락에 그치지 않고 **표 파싱 전체를
    한 칸씩 밀리게 만들었다**: infer_period_labels 가 이 열 자체를 periods 목록에서
    빼버려서, 다음 열(예: '제57기' 연간 데이터)이 그 자리를 대신 차지하고 '당분기(Q1)
    값'이 '전기(연간) 값' 라벨을 달고 적재될 뻔했다(실측: 수정 전 verify 에서 부문합
    게이트가 2025A/2024A 둘 다 실패 — 2025A 부문합 133.87조는 사실 Q1 값이었다).

    '2026.MM' 은 월에서 분기를 유도한다(03→Q1, 06→반기, 09→Q3, 12→연간) — 06 은 위와
    같은 이유로 Q2(discrete)가 아니라 H1(반기, 누적)로 취급한다. 그 외 월(04·05·07·08·
    10·11)은 분기 경계가 아니라 판정 불가로 None 을 돌려준다(지어내지 않는다).
    '당분기'처럼 그 자체로 연도·기수 정보가 없는 라벨은 이 함수의 책임 밖이다(과제
    지정 최소 형태에 없다 — anchor 로도 못 채운다)."""
    s = s.strip()

    # '제59기(2025년)' — 기수와 연도가 한 칸에 같이 있다. 연도가 직접 적혀 있으므로
    # 기수 역산보다 신뢰도가 높아 'year' 로 돌려준다(2026-08-26 batch02 실측:
    # 계룡건설산업 00102432 에서 이 헤더가 None 이 되어 부문별매출이 통째로 0행이었다).
    # '년' · '년도' · 접미사 없음, 'FY' 접두까지 함께 받는다 — 실측 변형:
    # 제59기(2025년) / 제40기(2025년도) / 제N기(FY 2025)  (batch02·batch10)
    # 기수와 연도가 한 칸에 있는 모든 배열을 받는다. 기수 뒤에 '연간'·'당'·'전' 같은
    # 수식어가 끼는 변형까지 허용한다(batch31: '제46기 연간(2024년도)').
    # 연도 표기는 '년' · '년도' · '연도' 모두 실측된다.
    m = re.fullmatch(r"제\s*\d+\s*기\s*(?:연간|당기|전기|전전기|기말)?\s*"
                     r"[（(]\s*(?:FY\s*)?(\d{4})\s*(?:년도|연도|년)?\s*(?:말)?\s*[)）]",
                     s, re.IGNORECASE)
    if m:
        return ("year", int(m.group(1)), None)
    # '제46기 기말 (2024년 12월말)' — 12월말만 연간. 다른 월은 YTD라 거부
    # (2026-08-26 batch03 애경산업 00139454).
    m = re.fullmatch(r"제\s*\d+\s*기\s*기말\s*[（(]\s*(\d{4})\s*년\s*(\d{1,2})\s*월\s*말\s*[)）]", s)
    if m:
        if int(m.group(2)) == 12:
            return ("year", int(m.group(1)), None)
        return None
    # '제70기 당기' / '제69기 전기' — 당기·전기는 상대 표기일 뿐이고 기수가 정보를 담는다.
    # 이걸 None 으로 떨어뜨리면 그 열이 periods 목록에서 빠지면서 **뒤 열이 그 자리를
    # 차지해 전 기간 라벨이 한 칸씩 밀린다**(2026-08-26 batch02 실측: 고려산업 00102751 —
    # 이번엔 부문합 게이트가 3.5% 차이로 우연히 잡았지만, 인접연도 매출차가 1% 미만이면
    # 잘못된 연도로 조용히 적재된다). '당분기'처럼 분기 번호가 없는 변형은 여전히
    # 판정 불가(None)로 둔다 — 몇 분기인지 지어내지 않는다.
    m = re.fullmatch(r"제?\s*(\d+)\s*기\s*(?:당기|전기|전전기)", s)
    if m:
        return ("gi", int(m.group(1)), None)
    # '2025년도(제38기)' — 위와 순서가 뒤집힌 형태(batch29 실측). 연도가 직접 적혀
    # 있으므로 기수 역산보다 신뢰도가 높아 'year' 로 돌려준다.
    m = re.fullmatch(r"(\d{4})\s*(?:년도|년)?\s*[（(]\s*제?\s*\d+\s*기\s*[)）]", s)
    if m:
        return ("year", int(m.group(1)), None)
    # '제70기(당)' · '제 70 (당) 기' · '제70기 연간' — 2026-08-26 batch13/batch17 실측.
    # 괄호 안 '당/전/전전'과 '연간'은 상대·기간종류 표기일 뿐 기수가 정보를 담는다.
    # 기수 위치가 괄호 앞뒤로 뒤바뀌는 변형('제 70(당) 기')까지 같이 받는다.
    m = re.fullmatch(r"제?\s*(\d+)\s*기\s*[（(]\s*(?:당|전|전전)(?:기)?(?:말)?\s*[)）]", s)
    if m:
        return ("gi", int(m.group(1)), None)
    m = re.fullmatch(r"제?\s*(\d+)\s*[（(]\s*(?:당|전|전전)(?:기)?(?:말)?\s*[)）]\s*기", s)
    if m:
        return ("gi", int(m.group(1)), None)
    # '제58기 기말' · '제58기말' — 기말은 시점 표기일 뿐 기수가 정보를 담는다(batch32).
    m = re.fullmatch(r"제?\s*(\d+)\s*기\s*(?:기?말)?", s)
    if m:
        return ("gi", int(m.group(1)), None)
    # '2025년 12월 31일' — 결산일 표기. 그 연도의 연간 열이다(batch32·batch23).
    m = re.fullmatch(r"(\d{4})\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일\s*(?:기준|현재)?", s)
    if m:
        return ("year", int(m.group(1)), None)
    m = re.fullmatch(r"제?\s*(\d+)\s*기\s*연간", s)
    if m:
        return ("gi", int(m.group(1)), None)
    # 'FY2025' — 연도가 그대로 적혀 있다.
    m = re.fullmatch(r"FY\s*(\d{4})", s, re.IGNORECASE)
    if m:
        return ("year", int(m.group(1)), None)
    # 'YYYY누계' 는 **의도적으로 받지 않는다**. 사업보고서에서는 연간이지만 분기보고서에서는
    # 해당 분기까지의 누계(YTD)라 이 함수가 가진 정보(헤더 문자열)만으로는 구분이 안 된다.
    # 연간으로 단정하면 분기보고서에서 분기 누계값이 연간 라벨을 달고 적재된다 — 조용한
    # 연도 오염이라 게이트도 못 잡는다. 판정 불가(None)로 두는 쪽이 안전하다
    # (2026-08-26 batch13 대한제강 '2025누계'에서 관측 — 그 결과 전량 스킵됐고, 그게 옳다).

    m = re.fullmatch(r"제?\s*(\d+)\s*기\s*(\d)\s*분기", s)
    if m:
        return ("gi", int(m.group(1)), int(m.group(2)))
    m = re.fullmatch(r"제?\s*(\d+)\s*기\s*반기", s)
    if m:
        return ("gi", int(m.group(1)), "H1")
    m = re.fullmatch(r"제?\s*(\d+)\s*기", s)
    if m:
        return ("gi", int(m.group(1)), None)

    m = re.fullmatch(r"(\d{4})년\s*(\d)\s*분기", s)
    if m:
        return ("year", int(m.group(1)), int(m.group(2)))
    m = re.fullmatch(r"(\d{4})년\s*반기", s)
    if m:
        return ("year", int(m.group(1)), "H1")

    m = re.fullmatch(r"(\d{4})\.(\d{2})", s)
    if m:
        year, mm = int(m.group(1)), m.group(2)
        month_quarter = {"03": 1, "06": "H1", "09": 3, "12": None}
        if mm in month_quarter:
            return ("year", year, month_quarter[mm])
        return None  # 04/05/07/08/10/11 등은 분기 경계가 아니다 — 확인 불가

    # '2024.01~2024.12' — 같은 해 1~12월만 연간. '2025.01~2025.09' 같은 YTD는 거부
    # (2026-08-26 batch02 현대차증권 00137997).
    m = re.fullmatch(r"(\d{4})\.01\s*[-~～]\s*(\d{4})\.12", s)
    if m and m.group(1) == m.group(2):
        return ("year", int(m.group(1)), None)

    # '2025' · '2025년' · '2025년도' · '2025연도' · '2025년 당기' · '2025년(1.1~12.31)'
    # · '2025년 말' · '2025년말' · '2025년 기말'
    # 연도가 맨 앞에 오고 뒤따르는 것이 **기간 종류 표기**(당기/전기/연간/말/기말)이거나
    # 그 연도의 기간 범위 괄호뿐이면, 연도 자체는 확정된 정보다
    # (batch20·batch30·batch31·batch04 GS리테일 실측).
    # 뒤에 '누계'가 붙는 것은 여기 해당하지 않는다 — 아래 주석 참고.
    m = re.fullmatch(r"(\d{4})\s*(?:년도|연도|년)?\s*"
                     r"(?:당기|전기|전전기|연간|기말|말)?\s*"
                     r"(?:[（(][^)）]*[)）])?", s)
    if m and m.group(1):
        return ("year", int(m.group(1)), None)
    return None


def infer_period_labels(md_text, table_pos, periods, fallback_year=None):
    """'제N기'/'제N기 M분기'/'제N기 반기' 헤더 라벨을 실제 period_key 로 매핑한다.
    반환: (dict, source|None) — dict 값은 이미 make_period_key 로 조립된 완성 문자열
    ('2026A'/'2026Q1'/'2026H1')이다. 예전엔 연도 문자열만 돌려주고 호출부마다
    '%sA' % year 를 반복했는데(연간 전제 하드코딩), 분기·반기가 섞이면서 그 방식이
    깨진다 — 그래서 조립까지 여기서 끝내고(감독 지시 §B: "period_key 조립을 한 곳으로")
    호출부(parse_rd/parse_segment_revenue/parse_segment_summary)는 labels.get(p) 를
    period_key 로 그대로 쓴다. source 는 라벨을 어느 경로로 얻었는지(디버깅·신뢰도
    판단용, notes 에 그대로 남긴다).

    앵커 우선순위(2026-08-25 3사 재현시험 §B — 삼성 전용이던 앵커 1개를 3개로 넓혔다):
    1. **본문 앵커 문장**: 'YYYY년(제N기) 당사의 …' 형태(회사·항목과 무관하게 같은
       회계연도를 반복 재언급 — 삼성전자 실측: '2025년(제57기)'가 문서 전체 9회). 표보다
       앞에 나온 가장 가까운 문장을 쓴다. 세 회사(부국증권·삼양식품·동신건설) 사업보고서
       전수 검색 결과 이 문장이 **한 번도** 나오지 않았다 — 삼성 고유 관용구였지 DART
       표준 문구가 아니다. 그래서 이 앵커 하나에만 의존하면 세 회사 전부 R&D·부문매출이
       조용히 0건이 된다(실측).
    2. **표 헤더 자체의 연도** (`parse_period_col` 이 'year' 로 판정하는 열): 앵커 문장이
       전혀 없어도 헤더가 이미 연도를 담고 있으면 그대로 쓴다.
    3. **report_nm 회계연도 역산 폴백**: 위 둘 다 없으면, DART 관행상 '제N기' 컬럼은
       항상 최신 회차가 맨 앞(왼쪽)에 온다는 전제로, 이 rcept_no 의 회계연도(filings.
       report_nm, 이미 DB 에 있다 — extract_one 이 호출자에서 구해 넘긴다)를 표의 첫
       period 컬럼에 대응시키고 나머지를 그 기수 차이만큼 역산한다. 본문에 앵커 문장이
       없는 회사에서도 최소 1개 앵커를 확보하기 위한 것이다.
    """
    text_anchor = None
    for m in re.finditer(r"(\d{4})년\s*\(제\s*(\d+)\s*기\)", md_text[:table_pos]):
        text_anchor = (int(m.group(1)), int(m.group(2)))

    # 경로 3(회계연도 역산)을 **항상** 계산한다 — 폴백으로만이 아니라 경로 1의 교차 검증에 쓴다.
    fallback_anchor = None
    if fallback_year and periods:
        first = parse_period_col(periods[0])
        if first and first[0] == "gi":
            fallback_anchor = (fallback_year, first[1])

    # ★ 종속회사 앵커 판별. 표 직전의 앵커 문장이 **당사 것이라는 보장이 없다** — 대형
    # 그룹사 보고서에는 종속회사 섹션이 섞여 있고, 그 문장은 연도가 같고(둘 다 당해)
    # 기수만 다르다(본사 제58기 vs 종속 제16기). 그래서 연도 대조로는 못 걸러낸다.
    # 두 경로가 같은 열에 대해 산출하는 연도를 비교하면 잡힌다: 종속회사 기수를 쓰면
    # 수십 년이 어긋난다(실측: 대한항공 +3년·삼천당제약 +64년·대원제약 +47년).
    # 1년 이내 차이는 결산월 차이 등 정상 오차로 보고 본문 앵커를 존중한다.
    if text_anchor and fallback_anchor:
        gi0 = fallback_anchor[1]
        y_text = text_anchor[0] - (text_anchor[1] - gi0)
        gap = y_text - fallback_anchor[0]
        if abs(gap) > 1:
            anchor = fallback_anchor
            anchor_source = "report_nm회계연도역산(본문앵커가 %+d년 어긋나 폐기 — 종속회사 기수 추정)" % gap
        else:
            anchor, anchor_source = text_anchor, "본문앵커문장"
    elif text_anchor:
        anchor, anchor_source = text_anchor, "본문앵커문장"
    elif fallback_anchor:
        anchor, anchor_source = fallback_anchor, "report_nm회계연도역산(표첫컬럼=최신회차가정)"
    else:
        anchor, anchor_source = None, None

    out = {}
    used_anchor = used_direct_year = False
    for p in periods:
        parsed = parse_period_col(p)
        if not parsed:
            continue
        kind, val, quarter = parsed
        if kind == "year":
            out[p] = make_period_key(val, quarter)
            used_direct_year = True
        elif kind == "gi" and anchor:
            anchor_year, anchor_gi = anchor
            year = anchor_year - (anchor_gi - val)
            # ★ 미래 연도 방어. 정기보고서의 실적 표는 회계연도를 넘는 열을 가질 수 없다 —
            # 넘었다면 앵커가 이 회사 것이 아니라는 뜻이다. 2026-08-26 batch14 실측:
            # 대한항공 사업보고서에서 **종속회사(한국공항㈜)의 '2025년(제59기)' 문장**이
            # 표보다 앞에 있어 본사 기수에 잘못 적용됐고, 부문별매출이 2028A~2030A 로
            # 적재됐다(15행, 이후 롤백). 대형 그룹사 보고서에는 종속회사 앵커 문장이
            # 섞여 있어 "표 직전의 가장 가까운 앵커"라는 규칙만으로는 주체를 구분하지
            # 못한다. 연도를 지어내느니 그 열을 버리는 쪽이 옳다.
            if fallback_year and year > fallback_year:
                continue
            out[p] = make_period_key(year, quarter)
            used_anchor = True

    if not out:
        return {}, None
    if used_anchor and used_direct_year:
        source = "%s+표헤더자체연도" % anchor_source
    elif used_anchor:
        source = anchor_source
    else:
        source = "표헤더자체연도"
    return out, source


def fact(concept, item_name, period_key, amount, unit=None, value_basis=None,
         status="ok", section=None, table=None, extracted_by=None):
    # extracted_by 기본값은 모듈 상수(EXTRACTED_BY='rule') — 이 파라미터는 LLM 폴백
    # (llm_fallback.py)이 규칙 산출물과 구분되는 태그('llm:claude-sonnet-5')를 같은
    # fact() 생성기로 만들 수 있게 하려고 추가했다(2026-08-25). 기존 호출부(파서 5개)는
    # 전부 이 인자를 안 넘기므로 동작이 그대로다 — 폴백만 추가, 기존 동작 불변.
    return {"concept": concept, "item_name": item_name, "period_key": period_key,
            "amount": amount, "unit": unit, "value_basis": value_basis, "status": status,
            "source_section": section, "source_table": table,
            "extracted_by": extracted_by or EXTRACTED_BY}


# ══════════════════════════════════════════════════════════ 1. 회사의 연혁 → corp_history

def parse_hist_ym(col0):
    """연혁 표 첫 칸 → event_ym. '1984'·'1984년'·'1947. 05. 10' 을 받는다.
    못 읽으면 None — 그 행을 적재하면 NOT NULL 위반으로 회차 전체가 죽는다
    (2026-08-26 00109037 2010A: content='1947. 05. 10', event_ym=NULL → HTTP 400)."""
    s = norm(col0)
    m = re.fullmatch(r"((?:19|20)\d\d)(?:년도|년)?", s)
    if m:
        return m.group(1)
    m = re.fullmatch(r"((?:19|20)\d\d)[.\-년](\d{1,2})(?:[.\-월](\d{1,2})일?)?", s)
    if m:
        return "%s.%02d" % (m.group(1), int(m.group(2)))
    return None


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
            # 연도는 19xx 도 받는다. '20\d\d' 만 매칭하던 시절엔 1999년 이전 설립 회사의
            # 연도 칸이 "연도가 아님"으로 판정돼 **rowspan 붕괴 분기로 잘못 흘러가고**,
            # 그 연도 문자열 자체가 content 로 적재됐다(2026-08-26 실측: 00108490 엔피케이
            # 1987·1989·1990·1995·1998·1999 → event_ym=None + content='1987' 꼴 6행).
            # 크래시가 아니라 조용한 오염이라 게이트에도 안 걸린다.
            # 연도 칸은 '1984' · '1984년' · '1984년도' 를 모두 받는다. 접미사를 못 받으면
            # 그 행이 rowspan 붕괴 분기로 잘못 흘러 cur_year 가 None 인 채 남고,
            # corp_history.event_ym(NOT NULL) 위반으로 **그 회차 전체가 중단된다**
            # (2026-08-26 batch33 실측: corp=00135111 에서 RuntimeError).
            ym = parse_hist_ym(col0)
            if ym:
                cur_year = ym
                category = None if two_col else (row[1] if len(row) > 1 else None)
                content = (row[1] if two_col else row[2]) if len(row) > (1 if two_col else 2) else ""
                # 첫 칸이 날짜만이고 내용 칸이 비면(1947. 05. 10 | —) 날짜를 내용으로 쓰지 않는다.
                if not content or content == "—":
                    content = col0
            else:
                # rowspan 붕괴: col0 자체가 내용(또는 구분+내용), 마지막 칸은 대개 '—'
                category = None
                content = col0
            if content and content != "—" and cur_year:
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


# 긴 표기부터 검사한다 — '십억원'이 '억원'보다, '백만원'이 '원'보다 먼저 와야 한다.
# '원'을 생략한 표기('단위: 백만, %')도 실측된다(2026-08-26 재적재에서 3행이 이걸로
# 확인불가 처리됐다) — 각 단위의 '원' 없는 형태도 함께 받는다.
_UNIT_SCALES = (("십억원", 1_000_000_000), ("십억", 1_000_000_000),
                 ("백만원", 1_000_000), ("백만", 1_000_000),
                 ("억원", 100_000_000), ("억", 100_000_000),
                 ("천원", 1_000), ("천", 1_000),
                 ("원", 1))


def detect_unit_scale(md_text, table_pos, window=2000):
    """표 앞쪽의 `(단위 : 천원)` 류 표기를 읽어 원(KRW) 환산 배수를 돌려준다.
    반환: (scale, 원문표기) — 표기를 못 찾으면 (None, None).

    2026-08-26 실측으로 추가했다. 그 전에는 `unit_scale = 1_000_000` 이 **하드코딩**돼
    있었다(주석: "표 단위: 백만원"). 삼성전자 파일럿 표가 백만원이라 통과했지만 실제로는
    **대부분의 회사가 천원을 쓴다** — 표본 8개사 중 천원 6 · 백만원 1. 그 결과 R&D 금액이
    정확히 1000배로 적재됐다: 보령 연구개발비 46.3조원(실제 463억, 회사 매출은 8,596억).
    전수 검사 결과 **72개사 232행에서 R&D > 매출**이라는 물리적으로 불가능한 값이
    적재돼 있었다(rnd_total 전체의 42%).

    긴 표기부터 매칭한다('백만원'이 '원'보다 먼저여야 '원'에 조기 매칭되지 않는다).
    '천원, %' 처럼 뒤에 비율 단위가 붙는 표기도 그대로 잡힌다."""
    head = md_text[max(0, table_pos - window):table_pos]
    m = None
    for mm in re.finditer(r"단위\s*[:：]?\s*([^)\]|\n]{1,16})", head):
        m = mm  # 표에 가장 가까운(마지막) 표기를 쓴다
    if not m:
        return None, None
    text = m.group(1)
    for label, scale in _UNIT_SCALES:
        if label in text:
            return scale, text.strip()
    return None, text.strip()


def parse_rd(md_text, fallback_year=None, notes=None):
    if notes is None:
        notes = []
    facts = []
    for t in parse_md_tables(md_text):
        if norm(t["header"][0] if t["header"] else "") != "과목":
            continue
        header = t["header"]
        period_idx = [i for i, h in enumerate(header) if i > 0 and parse_period_col(h)]
        periods = [header[i] for i in period_idx]
        labels, label_source = infer_period_labels(md_text, t["_pos"], periods, fallback_year)

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

        if not labels:
            # 라벨(과목) 매칭은 성공했을 수 있는데 연도를 못 붙이면 fin_details.period_key
            # (NOT NULL)를 채울 수 없어 적재 자체가 불가능하다 — 그래도 조용히 버리지 않고
            # 무엇이 매칭됐었는지는 남긴다(2026-08-25 3사 재현시험이 지적한 "조용한 0행"
            # 방지). 다음 '과목' 표가 있으면 계속 찾아본다(continue, 전체 포기 아님).
            notes.append("R&D: 과목 표는 찾았고 라벨 매칭 %d건(%s) 성공했으나 기수→연도 "
                         "앵커를 못 찾아 전체 스킵(period_key 확보 불가) — periods=%s" %
                         (len(matched), ",".join(sorted(matched.keys())) or "없음", periods))
            continue
        notes.append("R&D: 기간 라벨 획득 경로=%s (%s)" %
                     (label_source, ", ".join("%s→%s" % (p, labels.get(p)) for p in periods)))

        # 표 단위는 회사마다 다르다(천원이 다수, 백만원은 소수) — 원문에서 읽는다.
        # 표기를 못 찾으면 배수를 **지어내지 않고** 금액을 확인불가로 남긴다: 잘못된
        # 배수로 적재하면 1000배 틀린 값이 조용히 들어가고(게이트가 비율만 막고 금액은
        # 통과시켰다, 2026-08-26 실측) 사후에 구분할 방법이 없다.
        # 지주사 보고서는 당사 절에 '해당사항 없습니다'를 두고 바로 뒤에
        # '[주요 종속회사 - …]' 연구개발비 표를 나열한다. 첫 과목표를 집어가면
        # 경보제약 숫자를 종근당홀딩스 행으로 적재한다
        # (2026-08-26 00149354: 14.58조 > 당사 매출 0.88조).
        pre = md_text[max(0, t["_pos"] - 2000):t["_pos"]]
        markers = list(re.finditer(r"\[\s*주요\s*(종속회사|자회사|관계회사)[^\]]*\]", pre))
        if markers:
            notes.append("R&D: 직전 제목이 %s — 당사 표가 아니라 스킵" % markers[-1].group(0))
            continue
        unit_scale, unit_text = detect_unit_scale(md_text, t["_pos"])
        if unit_scale is None:
            notes.append("R&D: 표 단위 표기를 찾지 못해 금액을 확인불가로 남김"
                          "(원문 표기=%r) — 비율(%%) 항목은 그대로 적재" % (unit_text,))
        else:
            notes.append("R&D: 표 단위=%r → ×%d" % (unit_text, unit_scale))
        for i, pidx in enumerate(period_idx):
            p = periods[i]
            period_key = labels.get(p)  # infer_period_labels 가 이미 조립한 완성 키
            if not period_key:
                continue
            for canon, (row, shift, basis) in matched.items():
                idx = pidx + shift
                raw = row[idx] if idx < len(row) else None
                v = num(raw)
                is_ratio = canon == "매출액비중_필자게재"
                concept = "rnd_revenue_ratio" if is_ratio else "rnd_total"
                unit = "pct" if is_ratio else "KRW"
                if is_ratio or v is None:
                    amount = v
                elif unit_scale is None:
                    amount = None  # 배수를 모른 채 적재하지 않는다(위 detect_unit_scale 참고)
                else:
                    amount = v * unit_scale
                if amount is not None:
                    status = "ok"
                elif v is not None and not is_ratio and unit_scale is None:
                    status = "확인불가:표단위표기없음(원문표기=%s)" % (unit_text or "없음")
                else:
                    status = "확인불가:원문값없음(공란)"
                facts.append(fact(concept, canon, period_key, amount, unit, basis, status,
                                   "II.6.나 연구개발활동의 개요 및 연구개발비용", "[연구개발비용]"))
        break
    return facts


# ══════════════════════════════════════════════════════════ 3. 부문별 매출 → fin_details

# 함정(파일럿 §1, findings): 6열 헤더(부문/매출유형/품목/제N기...) 중 '기타'·'합계' 행은
# 원본 병합 셀 때문에 실제 칸 수가 줄어 있다 — 헤더 열 수 기준 고정 인덱싱은 이 두 행에서
# 조용히 틀린 값을 읽는다. 라벨(row[0])로 행 종류를 가려 각자의 오프셋을 쓴다.
def parse_segment_revenue(md_text, fallback_year=None, notes=None):
    if notes is None:
        notes = []
    facts = []
    for t in parse_md_tables(md_text):
        h = [norm(c) for c in t["header"]]
        if h[:3] != ["부문", "매출유형", "품목"]:
            continue
        period_idx = [i for i, c in enumerate(t["header"]) if i >= 3 and parse_period_col(c)]
        periods = [t["header"][i] for i in period_idx]
        labels, label_source = infer_period_labels(md_text, t["_pos"], periods, fallback_year)
        if not labels:
            notes.append("부문별 매출: 표는 찾았으나(부문/매출유형/품목 헤더 일치) 기수→연도 "
                         "앵커를 못 찾아 전체 스킵(period_key 확보 불가) — periods=%s" % periods)
            continue
        notes.append("부문별 매출: 기간 라벨 획득 경로=%s (%s)" %
                     (label_source, ", ".join("%s→%s" % (p, labels.get(p)) for p in periods)))
        # 표 단위는 회사마다 다르다. 예전엔 `scale = 1e8`(억원) 이 하드코딩돼 있어
        # 백만원 표(다수)에서 부문합이 정확히 100배가 됐다 — 게이트가 9900% 차이로
        # 막아 적재는 안 됐지만, 규칙 파서 경로가 사실상 죽었다
        # (2026-08-26 코오롱글로벌 00152880 · 삼성물산 00149655).
        unit_scale, unit_text = detect_unit_scale(md_text, t["_pos"])
        if unit_scale is None:
            notes.append("부문별 매출: 표 단위 표기를 찾지 못해 금액을 확인불가로 남김"
                         "(원문 표기=%r)" % (unit_text,))
        else:
            notes.append("부문별 매출: 표 단위=%r → ×%d" % (unit_text, unit_scale))
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
                period_key = labels.get(p)
                if not period_key or i >= len(vals):
                    continue
                v = num(vals[i])
                if v is None:
                    amount, status = None, "확인불가:원문값없음(공란)"
                elif unit_scale is None:
                    amount, status = None, "확인불가:표단위미확인(%s)" % (unit_text,)
                else:
                    amount, status = v * unit_scale, "ok"
                facts.append(fact("segment_revenue", item, period_key,
                                   amount, "KRW", None, status,
                                   "II.4.가 매출실적", "부문별 매출실적"))
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


def parse_segment_summary(md_text, corp_code, fallback_year=None, notes=None):
    if notes is None:
        notes = []
    wl = SEGMENT_SUMMARY_WHITELIST.get(corp_code)
    if not wl:
        return [], "확인불가:부문화이트리스트미등록(회사별전용파서필요,LLM폴백후보)"
    facts = []
    for t in parse_md_tables(md_text):
        h = [norm(c) for c in t["header"]]
        if h[:2] != ["부문", "구분"]:
            continue
        period_idx = [i for i, c in enumerate(t["header"]) if i >= 2 and parse_period_col(c)]
        periods = [t["header"][i] for i in period_idx]
        labels, label_source = infer_period_labels(md_text, t["_pos"], periods, fallback_year)
        if not labels:
            return [], "확인불가:기수연도앵커없음(periods=%s)" % periods
        notes.append("부문별 요약재무현황: 기간 라벨 획득 경로=%s (%s)" %
                     (label_source, ", ".join("%s→%s" % (p, labels.get(p)) for p in periods)))
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
                pk = labels.get(p)
                if not pk:
                    continue
                amt_s = rest[2 * i] if 2 * i < len(rest) else None
                pct_s = rest[2 * i + 1] if 2 * i + 1 < len(rest) else None
                amt, pct = num(amt_s), num(pct_s)
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
                facts.append(fact("market_share", "%s|%s" % (product, item),
                                   make_period_key(int(mm.group(1))),
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


def treasury_total_col(rows):
    """'주식의 총수' 표에서 '합계' 열이 데이터 행의 몇 번째 칸인지 찾는다.

    함정(2026-08-25 3사 재현시험 §5·§C): 원표는 '구분|주식의종류(보통주/우선주/합계)|비고'
    2단 헤더인데, rowspan(연도 병합과 같은 계열의 붕괴)이 markdown 변환에서 풀리며
    상위 헤더('구분|주식의종류|비고')는 `t["header"]`로, 하위 서브헤더('보통주|우선주|
    합계|…')는 표의 첫 데이터 행(`rows[0]`)처럼 보이는 별도 줄로 쪼개진다. 이때 서브헤더는
    맨 앞 라벨 칸('구분')을 반복하지 않으므로, 데이터 행 기준으로 한 칸씩 밀려 있다
    (서브헤더 index i == 데이터 행 index i+1). '합계' 열은 우선주가 있으면 3번째 칸
    (부국증권·삼성전자 실측), 우선주가 없으면 2번째 칸(동신건설 실측)이라 **고정 인덱스로는
    한쪽에서 반드시 틀린 칸(비고)을 읽는다** — 그래서 인덱스를 서브헤더에서 직접 찾는다.
    못 찾으면 None(호출부는 확인불가로 남기고 절대 추측하지 않는다)."""
    if not rows:
        return None
    subheader = rows[0]
    if not subheader or norm(subheader[0]) != "보통주":
        return None
    for i, c in enumerate(subheader):
        if norm(c) == "합계":
            return i + 1  # 라벨 칸만큼 데이터 행에서는 한 칸 뒤로 밀린다
    return None


def parse_treasury(md_text):
    """자기주식 보유비율 — 'I. 회사의 개요 > 4. 주식의 총수 등'에 있다(섹션이 다르다,
    파일럿 §2-4 함정). 원문 반올림(1자리)과 발행주식총수÷자기주식수 정밀계산 두 값을
    별도 item_name 으로 남긴다(같은 자연키에 value_basis 만 다른 두 행은 유니크 제약을
    위반한다 — 마이그레이션 주석 그대로).

    함정(2026-08-25 3사 재현시험 §5): 자기주식수(Ⅴ)가 통째로 공란('-')인 회사가 있다
    (삼양식품 2025 사업보고서) — 발행주식총수(Ⅳ)는 정상 숫자인데 자기주식수만 없으면
    `treasury/issued`가 None 으로 나눗셈을 시도해 TypeError 로 배치 전체를 죽였다. 이제
    두 값 중 하나라도 없으면 계산하지 않고 확인불가 레코드로 남긴다 — 지어내지 않는다."""
    facts = []
    tables = parse_md_tables(md_text)
    for t in tables:
        h = [norm(c) for c in t["header"]]
        row0s = [r[0] for r in t["rows"] if r]
        if h[:1] != ["구분"]:
            continue
        total_col = treasury_total_col(t["rows"])
        if "Ⅶ.자기주식보유비율" in [norm(r) for r in row0s]:
            for row in t["rows"]:
                if row and norm(row[0]) == "Ⅶ.자기주식보유비율":
                    idx = total_col if total_col is not None and total_col < len(row) else None
                    v = num(row[idx]) if idx is not None else None
                    status = ("ok" if v is not None else
                               "확인불가:원문값없음(공란)" if idx is not None else
                               "확인불가:합계열위치불명(서브헤더미탐지)")
                    facts.append(fact("shareholding_pct", "자사주_원문반올림", None, v, "pct",
                                       "원문반올림1자리", status,
                                       "I.4.가 주식의 총수", "주식의 총수 등 (자기주식 보유비율)"))
        if "Ⅳ.발행주식의총수(Ⅱ-Ⅲ)" in [norm(r) for r in row0s]:
            rows_by_label = {norm(r[0]): r for r in t["rows"] if r}
            v4 = rows_by_label.get("Ⅳ.발행주식의총수(Ⅱ-Ⅲ)")
            v5 = rows_by_label.get("Ⅴ.자기주식수")
            if v4 and v5:
                if total_col is None:
                    facts.append(fact("shareholding_pct", "자사주_정밀계산", None, None, "pct",
                                       "정밀계산", "확인불가:합계열위치불명(서브헤더미탐지)",
                                       "I.4.가 주식의 총수",
                                       "자기주식수(Ⅴ)/발행주식총수(Ⅳ)×100"))
                else:
                    issued = num(v4[total_col]) if total_col < len(v4) else None
                    treasury = num(v5[total_col]) if total_col < len(v5) else None
                    if issued is None or treasury is None:
                        facts.append(fact("shareholding_pct", "자사주_정밀계산", None, None, "pct",
                                           "정밀계산", "확인불가:원문값없음(발행주식수또는자기주식수공란)",
                                           "I.4.가 주식의 총수",
                                           "자기주식수(Ⅴ)/발행주식총수(Ⅳ)×100"))
                    else:
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
    """fin_periods.revenue 대조값. **period_type 을 더는 'A' 로 고정하지 않는다** —
    예전엔 분기 period_key('2026Q1')를 넘겨도 항상 연간 매출과 비교해, 분기 게이트가
    (a) 진짜 오류를 통과시키거나 (b) 정상값을 거짓 실패로 몰 수 있었다(2026-08-25
    분기 지원 확장, 감독 지시 §검증-2: "게이트가 분기에도 동작하는지가 핵심"). H1(반기)
    처럼 fin_periods 에 대응 period_type 이 없으면(period_type_of 가 None) 애초에
    질의하지 않고 (None, None) 을 돌려준다 — 호출부(apply_gates)가 스킵 사유를 남긴다."""
    ptype = period_type_of(period_key)
    if ptype is None:
        return None, None
    for fs in ("CFS", "OFS"):
        rows = db_rows_pg("fin_periods", {
            "select": "revenue", "corp_code": "eq.%s" % corp_code, "period_type": "eq.%s" % ptype,
            "period_key": "eq.%s" % period_key, "fs_div": "eq.%s" % fs})
        if rows and rows[0].get("revenue") is not None:
            return rows[0]["revenue"], fs
    return None, None


def report_fiscal_year(rcept_no):
    """이 rcept_no 가 다루는 회계기간. filings.report_nm 이 '사업보고서 (YYYY.MM)'/
    '분기보고서 (YYYY.MM)'/'반기보고서 (YYYY.MM)' 꼴이라 거기서 뽑는다.

    반환: (year:int|None, period_key:str|None, report_nm:str|None).
      - year 는 infer_period_labels 의 기수→연도 앵커 폴백에 쓴다(분기·반기 여부와
        무관하게 연도만 필요).
      - period_key 는 주주현황·자사주처럼 표 자체에 기간 라벨이 없는 '시점형' 개념의
        period_key 를 채우는 데 쓴다 — 사업보고서는 회계연도 말, 분기·반기보고서는 그
        분기·반기 말 기준 스냅숏이므로 rcept_no 당 기간 하나가 자연스럽게 대응된다.
        'YYYY.MM' 의 월을 parse_period_col 과 **같은 규칙**(03→Q1,06→H1,09→Q3,12→연간)
        으로 분기화한다 — 규칙을 두 곳에 따로 두면 어긋날 수 있어 parse_period_col 을
        그대로 재사용한다.

    섹션 C(감독 지시) — 표 헤더에서 얻은 분기와 report_nm 이 어긋나면 어느 쪽을
    믿을지: **표 헤더 쪽을 신뢰한다.** report_nm 의 월은 보고서 '종류'를 나타내는
    거친 신호일 뿐이고, 실제 표는 같은 문서 안에서도 여러 회차(전기·전전기 등)를
    나란히 보여준다 — infer_period_labels 의 앵커 우선순위에서 report_nm 역산은
    이미 최하위(③)이고, 이 함수의 period_key 는 표 라벨이 아예 없는 시점형 개념
    전용 폴백으로만 쓰인다(R&D·부문매출처럼 표 라벨이 있는 개념에는 관여하지 않는다).
    """
    rows = db_rows_pg("filings", {"select": "report_nm", "rcept_no": "eq.%s" % rcept_no})
    if not rows:
        return None, None, None
    report_nm = rows[0].get("report_nm") or ""
    m = re.search(r"\((\d{4})\.(\d{2})\)", report_nm)
    if not m:
        return None, None, report_nm
    year = int(m.group(1))
    parsed = parse_period_col("%s.%s" % (m.group(1), m.group(2)))
    quarter = parsed[2] if parsed else None
    return year, make_period_key(year, quarter), report_nm


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

    # 게이트 3b: R&D 금액이 같은 기간 매출보다 크면 단위 결함이다(2026-08-26 전수에서
    # 72사 232행). qc.py integrity 가 이걸 사후에 잡지만, 적재 게이트에 없으면 드레인이
    # 같은 행을 다시 넣는다. 매출이 없는 기간은 스킵(지어내지 않음).
    kept_rnd = []
    for f in ok:
        if f["concept"] != "rnd_total" or not f.get("amount") or not f.get("period_key"):
            kept_rnd.append(f)
            continue
        db_rev, fs = db_revenue(corp_code, f["period_key"])
        if db_rev is None or not db_rev:
            kept_rnd.append(f)
            continue
        if float(f["amount"]) / float(db_rev) > 1:
            f["status"] = "확인불가:게이트실패(R&D>매출)"
            notes.append("게이트 실패(R&D>매출, %s, %s): R&D=%s vs DB매출=%s → 적재 보류" %
                         (f["period_key"], fs, f["amount"], db_rev))
            f["amount"] = None
            held.append(f)
        else:
            kept_rnd.append(f)
    ok = kept_rnd

    # 게이트 4: 자릿수 sanity — 같은 concept·item_name 의 연속 기간 값이 10배 이상 튀면 보류.
    # 2026-08-25 분기 지원 실측(삼성 2026Q1 분기보고서, verify 실행): 이 게이트는 "연속
    # period_key 는 같은 주기(cadence)"를 전제로 짰다 — 예전엔 fin_details 에 연간
    # period_key 만 있어서 그 전제가 늘 성립했다. 분기를 로드하기 시작하니 같은 표에
    # '제58기 1분기'(2026Q1)와 '제57기'(2025A)가 나란히 있고, 분기 값은 원래 연간의
    # 약 1/4~1/3 수준이라 **정상 데이터인데도 ratio<=0.1 로 걸려 실측 3건이 오탐 보류됐다**
    # (rnd_total/정부보조금, segment_operating_income·_pct/SDC). 기간종류(period_type_of)가
    # 다른 쌍은 애초에 "몇 배가 정상"이라는 기준 자체가 없으므로 비교하지 않는다 — 같은
    # 기간종류끼리만(연간↔연간, 같은 Qn↔같은 Qn) 자릿수 점프를 본다.
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
            if period_type_of(a["period_key"]) != period_type_of(b["period_key"]):
                continue  # 기간종류가 다르면(예: 연간 vs 분기) 자릿수 비교 대상 아님
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
    """섹션 사전을 만든다. 사전 분할본(`docs_storage.py sections` 산출물)이 있으면 그걸 쓰고,
    없으면 **원문 zip 을 받아 즉석에서 쪼갠다** — 그 회차를 스킵하지 않는다.

    2026-08-25 실측으로 사전 분할이 이 용도에 이득이 없다는 것을 확인했다: 두 경로 모두
    Storage 왕복이 정확히 1회이고(0.34s vs 0.36s), 차이는 문서당 분할 CPU 0.44초뿐이며,
    결과 섹션은 제목까지 동일했다. 추출은 한 회차를 **한 번만** 읽으므로 사전 계산이
    상각되지 않는다 — 40,383건을 미리 쪼개서 368건 × 0.44초를 아끼는 셈이었다.
    (반대로 웹에서 같은 공시를 반복 조회하는 용도라면 사전 분할이 여전히 옳다 — 그래서
    docs_storage.py 를 없애지 않고, 있으면 쓰는 폴백 구조로 둔다.)"""
    path = "%s/%s/%s.sections.json.gz" % (ingest.DOCS_PREFIX, corp_code, rcept_no)
    status, data = ingest.storage_download(path)
    if status == 200:
        try:
            sections = json.loads(gzip.decompress(data).decode("utf-8"))
        except Exception as e:  # noqa: BLE001 — 원문 손상은 스킵 사유로만 쓴다
            return None, "확인불가:섹션디코드실패(%s)" % e
        return {s["title"]: s["content"] for s in sections}, None

    zip_path = "%s/%s/%s.zip" % (ingest.DOCS_PREFIX, corp_code, rcept_no)
    zip_status, raw = ingest.storage_download(zip_path)
    if zip_status != 200:
        return None, "확인불가:Storage에원문없음(path=%s,status=%s)" % (zip_path, zip_status)
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            text = ingest.api.decode_kr(z.read(sorted(z.namelist())[0]))
        sections = dart_doc.split_sections(text)
    except Exception as e:  # noqa: BLE001 — 원문 손상은 스킵 사유로만 쓴다
        return None, "확인불가:원문분할실패(%s)" % e
    return {title: body for title, body in sections}, None


def extract_one(corp_code, rcept_no):
    """한 (corp_code, rcept_no) 에서 5블록을 규칙 기반으로 전부 추출한다(항상 규칙만 —
    2026-08-25부터 이 함수는 LLM/에이전트 폴백을 호출하지 않는다). 규칙이 0행으로 남긴
    블록(연혁·부문별매출·시장점유율)을 보충하려면 이 스크립트의 `extract`/`verify`를
    먼저 돌린 뒤, 별도로 `llm_fallback.py prepare`→(에이전트가 채움)→`llm_fallback.py
    ingest`를 이어서 실행한다(SKILL.md 절차 참고) — 이 함수 안에서 자동으로 이어지지
    않는다(재현성-시험-3사.md 결론: "규칙이 되는 걸 LLM/에이전트로 대체하지 마라",
    그리고 에이전트 폴백은 이제 이 프로세스 안에서 동기 실행되는 API 호출이 아니라
    별도 세션에서 에이전트가 수행하는 절차이므로 애초에 여기서 호출할 수 없다).
    반환: (fin_details 후보 facts, corp_history 후보 items, notes)"""
    notes = []
    sections, err = load_sections(corp_code, rcept_no)
    if err:
        notes.append(err)
        return [], [], notes

    facts, hist = [], []

    # 이 rcept_no 의 회계기간을 한 번만 구해 두 곳에 재사용한다: ① 본문에 '제N기' 기수→
    # 연도 앵커 문장이 없는 회사에서 infer_period_labels 의 폴백 앵커로(연도만, 분기 무관),
    # ② 아래 주주·자사주 같은 시점형 개념의 period_key 채우기로(분기·반기까지 반영한
    # 완성 키). 예전엔 ②에서만, facts 를 다 만든 뒤에 구했다 — 지금은 R&D·부문매출 파싱
    # 전에 필요해져서 앞으로 옮겼다(DB 호출은 여전히 1회).
    fy_int, fy_period_key, fy_report_nm = report_fiscal_year(rcept_no)
    if fy_int is None:
        notes.append("확인불가: rcept_no=%s 의 회계연도를 filings.report_nm 에서 못 구함 — "
                     "기수→연도 앵커 폴백과 주주·자사주 period_key 채우기 둘 다 이 값에 기댄다" % rcept_no)
    else:
        # 섹션 C(감독 지시) 판단 기록: report_nm 과 표 헤더 라벨이 어긋나면 표 헤더 쪽을
        # 신뢰한다 — report_nm 역산은 infer_period_labels 앵커 우선순위에서 이미 최하위(③)
        # 이고, fy_period_key 는 표 라벨이 아예 없는 시점형 개념(주주·자사주) 전용 폴백일
        # 뿐 R&D·부문매출처럼 표 자체 라벨이 있는 개념에는 관여하지 않는다.
        notes.append("회차 기간: report_nm=%r → 시점형 폴백 period_key=%s (R&D·부문매출은 "
                     "표 헤더/본문앵커가 우선이고 이 값과 어긋나도 표 쪽을 따른다)" %
                     (fy_report_nm, fy_period_key))

    if "I. 회사의 개요" in sections:
        hist += parse_history(sections["I. 회사의 개요"])
        facts += parse_treasury(sections["I. 회사의 개요"])
    else:
        notes.append("확인불가: 'I. 회사의 개요' 섹션 없음 — 연혁·자사주 스킵")

    if "II. 사업의 내용" in sections:
        md = sections["II. 사업의 내용"]
        facts += parse_rd(md, fy_int, notes)
        facts += parse_segment_revenue(md, fy_int, notes)
        seg_summary_facts, seg_err = parse_segment_summary(md, corp_code, fy_int, notes)
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

    # 주주·자사주는 표 자체에 기간 라벨이 없는 '시점형' 개념이라 period_key 를 못 채운 채
    # 반환됐다(parse_shareholders/parse_treasury) — 이 rcept_no 의 회계기간(report_nm 에서
    # 뽑은 fy_period_key, 분기·반기까지 반영됨)으로 채운다. fin_details.period_key 는
    # NOT NULL 이라, 못 구하면 적재 대신 스킵하고 보고한다.
    missing_pk = [f for f in facts if f["period_key"] is None]
    if missing_pk:
        if fy_period_key:
            for f in missing_pk:
                f["period_key"] = fy_period_key
        else:
            notes.append("확인불가: 주주·자사주 %d행 스킵(period_key NOT NULL, 회계기간 불명)" % len(missing_pk))
            facts = [f for f in facts if f["period_key"] is not None]

    return facts, hist, notes


# ══════════════════════════════════════════════════════════ 적재

def to_db_row(corp_code, rcept_no, f):
    return {
        "corp_code": corp_code, "period_key": f["period_key"], "concept": f["concept"],
        "item_name": f["item_name"], "amount": f["amount"], "unit": f["unit"],
        "value_basis": f["value_basis"], "status": f["status"], "source_rcept_no": rcept_no,
        "source_section": f["source_section"], "source_table": f["source_table"],
        # f.get(...) 폴백: 규칙 파서 5개는 이 키를 안 채우던 시절과 동일하게 'rule'로
        # 떨어진다. LLM 폴백(llm_fallback.py)이 만든 fact 는 'llm:claude-sonnet-5' 를
        # 직접 채워 넣어 여기서 그대로 통과한다(감독 규칙 ③, extracted_by 로 구분).
        "extracted_by": f.get("extracted_by") or EXTRACTED_BY,
    }


def to_history_row(corp_code, rcept_no, h):
    return {
        "corp_code": corp_code, "event_ym": h["event_ym"], "category": h["category"],
        "content": h["content"], "source_rcept_no": rcept_no,
        "source_section": h["source_section"],
        "extracted_by": h.get("extracted_by") or EXTRACTED_BY,
    }


def load_scope(corp_code, rcept_no, facts, hist, only_concepts=None):
    """스코프 교체: (corp_code × concept × source_rcept_no) 단위로 delete→insert.
    ALL_CONCEPTS 전체를 매번 훑어, 이번 파싱에서 안 나온 concept 은 빈 리스트로
    replace_scope 를 걸어 스테일 행(이전엔 파싱됐다가 이번엔 안 나오는 사실)을 지운다.

    only_concepts (--concepts): 주어지면 **그 concept 만** 교체하고 나머지는 손대지 않는다.
    corp_history 도 건너뛴다(연혁은 concept 축이 아니므로 명시 요청이 아니면 보존).

    ★ 이 옵션이 왜 필요한가 (2026-08-26 실측 사고): 규칙 파서의 R&D 단위 결함을 고치려고
    161개사에 `extract` 를 재실행했더니, 규칙이 0행으로 내는 블록(연혁·부문별매출·
    시장점유율)의 **에이전트 폴백 산출물이 빈 리스트로 전부 덮어써졌다**
    (fin_details -2,819행 · corp_history -3,512행). 위 "스테일 행 제거"는 규칙 단독
    운영을 전제한 설계인데, 지금은 같은 스코프에 에이전트 산출물이 공존한다.
    한 concept 만 고치려는 재실행이 다른 concept 을 파괴해서는 안 된다."""
    by_concept = {}
    for f in facts:
        by_concept.setdefault(f["concept"], []).append(to_db_row(corp_code, rcept_no, f))
    targets = ALL_CONCEPTS if only_concepts is None else [
        c for c in ALL_CONCEPTS if c in only_concepts]
    for concept in targets:
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

    if only_concepts is not None:
        # --concepts 로 특정 concept 만 고치는 재실행 — 연혁은 손대지 않는다(위 docstring).
        print("  corp_history: 건너뜀(--concepts 지정)")
        return
    hist_rows = [to_history_row(corp_code, rcept_no, h) for h in hist if h.get("event_ym")]
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
        # pending 과 동일: 제출기한연장신고서를 최신 사업보고서로 고르지 않는다.
        "report_nm": "like.*사업보고서 (*", "order": "rcept_dt.desc", "limit": "1"})
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

def run(corps, rcepts_arg, do_load, only_concepts=None):
    """회사×회차를 순회하며 추출·적재한다. 한 회차의 예외가 나머지 전체를 막지 않도록
    회사·회차 단위로 격리한다(2026-08-25 3사 재현시험 실측 — parse_treasury 의 TypeError
    가 run() 에서 잡히지 않아, 세 회사를 한 명령으로 돌렸을 때 삼양식품에서 죽으면서 뒤에
    있던 동신건설은 시도조차 되지 않았다). 실패를 삼키지 않고 어느 회사·회차·무슨 예외인지
    콘솔에 남기고, 마지막에 실패 목록을 모아 반환한다 — 무인 배치에서 이 반환값으로 종료
    코드를 정할 수 있다(아래 main()). 규칙 기반만 실행한다 — 에이전트 폴백은 별도 프로세스
    (`llm_fallback.py prepare`/`ingest`, SKILL.md 절차)로 이 함수 밖에서 돈다."""
    ingest.print_target()
    failures = []
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
            try:
                facts, hist, notes = extract_one(corp_code, rcept_no)
                facts, held = apply_gates(corp_code, facts, notes)
                if do_load:
                    load_scope(corp_code, rcept_no, facts, hist, only_concepts)
                print_coverage(corp_code, rcept_no, facts, hist, held, notes)
            except Exception as e:  # noqa: BLE001 — 의도적으로 넓게 잡는다, 아래 참고
                # 여기서 무엇이든 잡아야 한다: 파서 버그든 네트워크 문제든, 한 회차의 예외가
                # 2,659개사를 도는 무인 배치 전체를 죽이면 안 된다. 대신 절대 조용히
                # 삼키지 않는다 — traceback 전체를 찍어 운영자가 다음날 원인을 바로 알 수
                # 있게 한다.
                tb = traceback.format_exc()
                print("!!! corp=%s rcept=%s 처리 중 예외로 이 회차를 건너뜀: %s: %s" %
                      (corp_code, rcept_no, type(e).__name__, e))
                print(tb)
                failures.append({"corp_code": corp_code, "rcept_no": rcept_no,
                                  "exc_type": type(e).__name__, "exc_msg": str(e)})
    if failures:
        print("\n" + "=" * 70)
        print("실패 요약(%d건) — 아래 회차는 적재되지 않았다, 재실행 또는 조사 필요:" % len(failures))
        for f in failures:
            print("  · corp=%s rcept=%s %s: %s" %
                  (f["corp_code"], f["rcept_no"], f["exc_type"], f["exc_msg"]))
        print("=" * 70)
    return failures


# ══════════════════════════════════════════════════════════ 일일 진입점 — pending

# "정기보고서"라고 해도 이 스킬의 5블록 파서(특히 연혁·R&D 섹션 헤딩)는 사업보고서 구조를
# 전제로 검증됐다(분기·반기보고서는 그 섹션들을 축약하거나 아예 생략하는 경우가 많다 —
# 미검증). latest_annual_rcept() 가 이미 쓰는 필터와 동일하게 사업보고서만 대상으로 좁힌다
# — 스코프를 넓히려면(분기·반기 포함) 먼저 그 보고서 유형에서 5블록 파서가 실제로 뭘
# 뽑아내는지 검증해야 한다(이번 작업 범위 밖).
# '사업보고서*' 는 '사업보고서제출기한연장신고서'까지 잡는다 — 원문이 있어도 5블록
# 섹션이 없어 추출이 실패하거나 쓰레기 행만 남는다. 실제 사업보고서(정정·첨부추가 포함)
# 만 대상으로 좁힌다.
_REPORT_NM_FILTER = "like.*사업보고서 (*"


def _paginate_rest(path, params, page_size=1000):
    """PostgREST 기본 limit(1000)을 넘는 결과를 offset 페이지네이션으로 전부 받는다.
    AGENTS.md 경고 그대로: "조용히 잘린 표본이 최대 오류원이다" — pending 목록이 잘리면
    이미 처리된 rcept를 처리 안 된 걸로 오판하거나 그 반대가 나서, 여기선 항상 끝까지 받는다."""
    rows, offset = [], 0
    base = dict(params)
    while True:
        base["limit"] = str(page_size)
        base["offset"] = str(offset)
        page = db_rows_pg(path, base)
        rows.extend(page)
        if len(page) < page_size:
            break
        offset += page_size
    return rows


def pending_rcepts(corps=None, limit=None):
    """filing_docs.status='ok'(Storage 원문 백필 완료)인 **사업보고서** 중 fin_details·
    corp_history 어느 쪽에도 이 rcept_no 를 source_rcept_no 로 가진 행이 하나도 없는
    회차를 찾는다 — "오늘 이 스킬이 아직 한 번도 처리하지 않은 회차" 목록이다.

    순서는 **오래된 것부터**(rcept_dt asc)로 정했다: 이 스킬은 무인 배치로 매일 조금씩만
    처리하므로(--limit), 최신 우선으로 정렬하면 신규 사업보고서 시즌마다 몰리는 최근
    회차만 계속 처리하고 훨씬 오래전에 쌓인 백로그(Phase 1 백필 시점부터 누적된 과거
    회차들)는 영영 뒤로 밀린다 — 오래된 것부터 밀어내는 쪽이 전체 백로그를 유한 시간에
    소진한다는 보장이 있다(최신 우선은 그 보장이 없다, 새 공시가 계속 얹히면 꼬리가
    끝없이 늘어난다).

    ★ 알려진 공백(반드시 SKILL.md·references/무인운영-요건.md 와 함께 읽는다): 이 함수가
    보는 filings 테이블 자체가 2026-08-04 이후로 갱신되지 않고 있다(오늘은 08-25) — 신규
    공시를 받아오는 별도 백필 단계가 없으면, 이 목록은 "이미 알고 있던 과거 회차 중
    안 채운 것"만 반환하고 최근 3주치 신규 사업보고서는 애초에 filings 에 없어 여기
    나타나지도 않는다."""
    filter_params = {
        "select": "rcept_no,filings!inner(corp_code,report_nm,rcept_dt)",
        "status": "eq.ok", "storage_path": "not.is.null",
        "filings.report_nm": _REPORT_NM_FILTER,
        # order 를 반드시 명시한다: Postgres는 ORDER BY 없는 결과의 행 순서를 보장하지
        # 않는다 — 실측: order 없이 offset/limit 페이지네이션을 돌리면 페이지 경계에서
        # 같은 행이 중복되거나 누락됐다(6,923건 스캔에서 여러 rcept_no가 두 번씩 나옴).
        # rcept_no는 PK라 항상 유일해 페이지 간 겹침·누락이 생기지 않는다.
        "order": "rcept_no",
    }
    if corps:
        filter_params["filings.corp_code"] = "in.(%s)" % ",".join(corps)
    candidates = _paginate_rest("filing_docs", filter_params)
    candidates = {c["rcept_no"]: c for c in candidates}.values()  # 방어적 dedupe(위 order 수정으로 이론상 불필요하지만 안전망으로 유지)

    done = set()
    for table in ("fin_details", "corp_history"):
        rows = _paginate_rest(table, {"select": "source_rcept_no",
                                       "source_rcept_no": "not.is.null", "order": "id"})
        done.update(r["source_rcept_no"] for r in rows if r.get("source_rcept_no"))

    out = []
    for row in candidates:
        rcept_no = row["rcept_no"]
        if rcept_no in done:
            continue
        f = row.get("filings") or {}
        nm = f.get("report_nm") or ""
        if "제출기한연장" in nm:
            continue
        out.append({"corp_code": f.get("corp_code"), "rcept_no": rcept_no,
                     "report_nm": nm, "rcept_dt": f.get("rcept_dt")})
    out.sort(key=lambda r: (r["rcept_dt"] or "", r["rcept_no"]))
    total = len(out)
    if limit:
        out = out[:limit]
    return out, total


def cmd_pending(args):
    ingest.print_target()
    corps = [c.strip() for c in args.corps.split(",")] if args.corps else None
    rows, total = pending_rcepts(corps=corps, limit=args.limit)
    print("미처리 사업보고서: 총 %d건(정렬: rcept_dt 오름차순, 오래된 것부터)"
          " — 이번 출력 %d건" % (total, len(rows)))
    for r in rows:
        print("  %s  %-14s  %-28s  %s" % (
            r["rcept_dt"] or "?", r["corp_code"] or "?", r["rcept_no"], r["report_nm"] or ""))
    if not rows:
        print("  (없음)")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    def add_common(sp):
        sp.add_argument("--corps", required=True, help="쉼표구분 corp_code 목록 (예: 00126380)")
        sp.add_argument("--concepts", default=None,
                        help="이 concept 만 스코프 교체(쉼표구분). 지정하면 나머지 concept 과 "
                             "corp_history 는 건드리지 않는다 — 규칙으로 못 만드는 블록의 "
                             "에이전트 산출물을 재실행이 지우는 사고를 막는다.")
        sp.add_argument("--rcepts", default=None,
                         help="쉼표구분 rcept_no 목록 — 생략 시 회사별 최신 사업보고서 1건 자동 선택")

    sp_extract = sub.add_parser("extract", help="5블록 규칙 기반 추출 → 게이트 → fin_details/corp_history 적재")
    add_common(sp_extract)
    sp_verify = sub.add_parser("verify", help="적재 없이 파싱+게이트만 재실행(dry-run)")
    add_common(sp_verify)

    sp_pending = sub.add_parser(
        "pending", help="일일 진입점 — 아직 fin_details/corp_history 에 안 실린 사업보고서 목록")
    sp_pending.add_argument("--corps", default=None, help="쉼표구분 corp_code 목록(생략 시 전체)")
    sp_pending.add_argument("--limit", type=int, default=None, help="오늘 처리할 건수 상한")
    sp_pending.set_defaults(func=cmd_pending)

    args = p.parse_args()
    if args.cmd == "pending":
        args.func(args)
        return

    corps = [c.strip() for c in args.corps.split(",") if c.strip()]
    rcepts = [r.strip() for r in args.rcepts.split(",")] if args.rcepts else None
    only = None
    if getattr(args, "concepts", None):
        only = {c.strip() for c in args.concepts.split(",") if c.strip()}
        unknown = only - set(ALL_CONCEPTS)
        if unknown:
            print("알 수 없는 concept: %s\n가능: %s" % (sorted(unknown), ALL_CONCEPTS))
            return 2
    failures = run(corps, rcepts, do_load=(args.cmd == "extract"), only_concepts=only)
    # 무인 실행(cron/launchd 래퍼)이 "일부 실패"를 알 수 있게 종료 코드로도 신호한다 —
    # 콘솔 로그만으로는 사람이 매번 스크롤을 다 읽어야 실패를 알아챈다.
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
