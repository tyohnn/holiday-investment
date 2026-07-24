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
_TAG = re.compile(r"<[^>]+>")
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
    """표는 md 표로 치환하고 나머지는 텍스트화한다."""
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
            lines = [re.sub(r"\s+", " ", ln).strip() for ln in text.splitlines()]
            out.extend(ln for ln in lines if ln)
    return "\n\n".join(out)


def split_sections(text):
    """원문 전체 → [(제목, 마크다운 본문)]. 최상위 목차를 못 찾으면 단일 섹션."""
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
