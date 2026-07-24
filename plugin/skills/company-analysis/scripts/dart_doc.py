"""DART 원본 문서(DSD XML) → 목차 단위 마크다운 변환기.

사업보고서·감사보고서 원문은 회사마다 서식이 달라 완전 정형 파싱이 불가능하다.
이 모듈의 역할은 딱 세 가지다 — 그 이상을 시도하지 않는다:
  1. 목차(TITLE) 기준으로 섹션을 나눈다  (주석·감사보고서를 따로 읽을 수 있게)
  2. 표(<TABLE>)를 마크다운 표로 보존한다 (수치 손실 방지, 완벽하지 않음)
  3. 나머지 태그를 걷어 텍스트화한다
해석·발췌는 에이전트(LLM)의 몫이다. 원본 XML은 항상 함께 저장돼 있으므로
수치 인용 전에 원문(DART 뷰어)과 대조한다.
"""
import html
import re

_TITLE = re.compile(r"<TITLE[^>]*>(.*?)</TITLE>", re.I | re.S)
_TABLE = re.compile(r"<TABLE[^>]*>.*?</TABLE>", re.I | re.S)
_TR = re.compile(r"<TR[^>]*>(.*?)</TR>", re.I | re.S)
_CELL = re.compile(r"<T[DHEU][^>]*>(.*?)</T[DHEU]>", re.I | re.S)
# DSD 태그는 ASCII 로 시작한다. <배틀그라운드> 같은 홑화살괄호 고유명사는 보존해야 한다
_TAG = re.compile(r"</?(?:[A-Z][A-Z0-9-]*|(?:br|p|span|b|u|i|em|strong|sub|sup|font|img|a|td|th|tr|table|tbody|thead|div|hr|col|colgroup|li|ul|ol))(?=[\s/>])[^>]*>")
_STYLE = re.compile(r"<(STYLE|SCRIPT)[^>]*>.*?</\1>", re.I | re.S)
# 최상위 목차: 로마숫자("I. 회사의 개요"), 감사보고서, 재무제표/연결재무제표 주석
_TOP = re.compile(r"^\s*[IVXLC]+\s*\.|감사보고서|주석\s*$")


def _clean(s):
    s = _TAG.sub("", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def _table_to_md(block):
    rows = []
    for tr in _TR.findall(block):
        cells = [_clean(c) or "—" for c in _CELL.findall(tr)]
        if cells:
            rows.append(cells)
    if not rows:
        return ""
    width = max(len(r) for r in rows)
    rows = [r + ["—"] * (width - len(r)) for r in rows]
    out = ["| " + " | ".join(c.replace("|", "¦") for c in rows[0]) + " |",
           "|" + "---|" * width]
    for r in rows[1:]:
        out.append("| " + " | ".join(c.replace("|", "¦") for c in r) + " |")
    return "\n".join(out)


def _chunk_to_md(chunk):
    """하위 목차는 ## 헤딩으로 살리고, 표는 md 표로 치환하고, 나머지는 텍스트화한다."""
    # 하위 TITLE("1. 사업의 개요" 등)을 ## 헤딩으로 치환해 섹션 내 탐색성을 확보한다
    chunk = _TITLE.sub(lambda m: "\n## %s\n" % _clean(m.group(1)), chunk)
    parts, last = [], 0
    for m in _TABLE.finditer(chunk):
        parts.append(("text", chunk[last:m.start()]))
        parts.append(("table", m.group(0)))
        last = m.end()
    parts.append(("text", chunk[last:]))
    out = []
    for kind, seg in parts:
        if kind == "table":
            md = _table_to_md(seg)
            if md:
                out.append(md)
        else:
            text = html.unescape(_TAG.sub("\n", seg))
            for ln in text.splitlines():
                ln = re.sub(r"\s+", " ", ln).strip()
                if ln:
                    out.append(ln)
    return "\n\n".join(out)


def split_sections(text):
    """원문 전체 → [(제목, 마크다운 본문)]. 최상위 목차를 못 찾으면 단일 섹션."""
    text = _STYLE.sub("", text)
    marks = [(m.start(), _clean(m.group(1))) for m in _TITLE.finditer(text)]
    tops = [(pos, t) for pos, t in marks if t and _TOP.search(t)]
    if len(tops) < 2:
        return [("전체", _chunk_to_md(text))]
    sections = []
    for i, (pos, title) in enumerate(tops):
        end = tops[i + 1][0] if i + 1 < len(tops) else len(text)
        sections.append((title, _chunk_to_md(text[pos:end])))
    return sections


def is_note_section(title):
    return "주석" in title


def is_biz_section(title):
    return "사업의 내용" in title


NOTE_CHECKLIST = """\
## 주석에서 볼 것 (에이전트 독해 체크리스트 — D1 확장)

주석은 정형 파싱이 불가능한 반정형 문서다. 아래 항목을 찾아 읽고, 발견한 수치·사실만
자료 파일에 발췌한다 (해석은 리포트에서).

- [ ] 부문별·지역별 매출 상세 (영업부문 주석) — 매출 추정의 분해 입력
- [ ] 투자자산 구성: 종속·관계기업 투자(지분율·장부가), 당기손익/기타포괄 금융자산 — SOTP·숨은 가치
- [ ] 차입금·사채 만기 구조와 이자율, 담보 제공 자산 — 재무 리스크
- [ ] 약정사항·우발부채: 지급보증, 소송, 매입 약정 — 표 밖의 폭탄
- [ ] 리스 부채, 충당부채(품질보증 등)의 증감 — 이익의 질
- [ ] 특수관계자 거래 — 오너 계열사로의 이익 이전 (지배구조 체크와 연결)
- [ ] 수주·계약부채(선수금) 변동 — 미래 매출의 선행 지표
- [ ] 감사보고서: 감사의견, 핵심감사사항(KAM) — 감사인이 지목한 위험이 곧 관찰 포인트
"""

BIZ_CHECKLIST = """\
## "사업의 내용"(☆)에서 볼 것 — 밸류에이션 입력의 원천

- [ ] 주요 제품·서비스와 매출 비중, 판가 추이 — 매출 분해의 출발점
- [ ] 시장점유율과 경쟁 상황 (회사가 스스로 밝힌 수치·경쟁사)
- [ ] 생산능력(캐파)·가동률 — 이익률 회복의 선행 지표 (D1)
- [ ] 수주 상황·수주잔고 — 바인딩 물량만 추정에 반영
- [ ] 원재료 가격 추이와 조달 구조 — 이익률의 원자재 층
- [ ] 연구개발 투자·핵심 기술 — 해자 판정 근거
- [ ] 신규 사업·설비 투자 계획 — 확정분만 매출 추정에
"""
