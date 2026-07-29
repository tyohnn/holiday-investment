---
topic: "korean-prose-craft-for-bestseller-nonfiction"
type: "domain"
goals: "한글 소설·웹소설·링크드인·비문학 작법 원칙을 조사하고, 타이탄의 도구들·부의 추월차선·더 골·마케팅 설계자형 구조를 Cursor 스킬로 증류"
date: "2026-07-29"
methodology: "Parallel web research via 5 sub-agents (novel / webnovel / LinkedIn / bestseller structures / nonfiction). Citations in agent memos; synthesis below. Confidence High/Medium/Low."
---

# Research Report — Korean Prose Craft for Bestseller-Style Nonfiction

> **Type:** domain | **Date:** 2026-07-29  
> **Assumptions:** type=domain(+craft), scope=KR + usable global craft, deliverable=Cursor skill with mode switches.  
> **Constraints:** Operable rules for investment/business textbook rewriting; no fabricating facts in scenes.

---

## Key Findings

첫째, “소설처럼”은 허구를 쓰라는 뜻이 아니라 **이미 달라진 순간·좌표·감각 1~2개·행동 증거**로 장면을 조직하라는 뜻이다. 첫 문장 미학보다 첫 페이지의 정보 사슬이 중요하고, 기록에 없는 대사·날씨·표정은 논픽션에서 추가하면 안 된다 (Friedman; Poynter; Gutkind).

둘째, 웹소설에서 교재로 가져올 핵심은 자극적 절단이 아니라 **궁금증→이해→적용→새 궁금증**과 **약속 상환**이다. 모바일 여백·짧은 문장은 화면 장치이지 “문단=3줄” 절대법칙이 아니다 (최배은; 한콘진; 플랫폼 규정).

셋째, 링크드인 스타일은 **스캔 레이어**(즉시 요점, 짧은 문단, 정보성 첫 문장)로만 빌려야 한다. 80–140자는 공식 규정이 아니라 진단용 휴리스틱이며, 바이럴 미끼·매 문장 개행·가짜 취약성은 책 품질을 깎는다 (LinkedIn/Edelman; NN/g; Microsoft).

넷째, 네 모델 책의 최적 배합은 **더 골(장 엔진) + 부의 추월차선(대조·구분법) + 마케팅 설계자=DotCom Secrets(도식·스크립트) + 타이탄의 도구들(모듈·교차참조)**이다. 공통 법칙은 “구체 경험 → 이름표 → 전이 도구”이며, 네 권 모두 일화가 증거를 대체하는 약점이 있어 교재는 **증거 등급**을 올려야 한다.

다섯째, 한국어 특유 실패 모드는 장소 관용구의 상황 대용(「이 자리에서」), 강제 `~을수록` 역설, 추상 은유 군집, LLM형 쉼표·병렬 남발이다. `이 자리에서` 자체는 사전상 모임·기회에서 정당할 수 있으므로 **문맥 판별**이 필요하다 (국립국어원; ACL 2025 KatFishNet).

---

## Strategic Recommendations

1. **단일 스킬 + 모드 스위치** — `skills/korean-bestseller-prose`에 novel / webnovel / linkedin / nonfiction / anti-patterns 참조를 두고, 교재 기본값은 nonfiction+webnovel+linkedin. Evidence: 네 영역이 겹치되 금지가 다름.
2. **12운동 장 템플릿** — 발견→이름→도식→증거 사다리→스크립트→구분법. Evidence: 네 베스트셀러 구조 합성.
3. **안티패턴 파일 필수** — 사용자 지적(「이 자리에서」, 「확인하지 않으려 할수록…」)을 규칙으로 고정. Evidence: 국립국어원 + 작문 휴리스틱.
4. **humanize와 분리** — AI 티 윤문 ≠ 장면·구조 작법. Evidence: im-not-ai는 fidelity-first 윤문; 본 스킬은 구조 개작.
5. **프로젝트 가이드와 병행** — `교재/_집필스타일.md`, `textbook-plan/REWRITE-GUIDE.md`와 충돌 시 사실 보존 우선.

---

## Risks and Uncertainties

- 「문단 80–140자」「문장 15–20자」류 수치는 플랫폼 공식 규칙이 아님 (Low–Medium). 진단용으로만.
- 웹소설 상업 블로그(노벨라스튜디오 등)는 Low-tier; 원칙은 KCI·한콘진·공식 규정과 교차 확인.
- *부의 추월차선*·*DotCom Secrets*의 사업/투자 주장은 구조와 분리할 것.
- ACL 연구 특징을 “일부러 맞춤법을 어겨라”로 오해하지 말 것.

---

## Deliverable

스킬 경로: [`skills/korean-bestseller-prose/`](../skills/korean-bestseller-prose/SKILL.md)

| 파일 | 역할 |
|---|---|
| `SKILL.md` | 오케스트레이터 |
| `references/chapter-template.md` | 12운동 |
| `references/novel-opening.md` | 소설적 도입 |
| `references/webnovel-breath.md` | 웹소설 호흡 |
| `references/linkedin-scan.md` | 링크드인 스캔 |
| `references/nonfiction-evidence.md` | 비문학 증거 |
| `references/anti-patterns.md` | 한국어 안티패턴 |
| `references/model-books.md` | 네 권 구조 |

---

## Axis memos (요약 인덱스)

상세 본문·URL은 조사 시 서브에이전트 산출에 있으며, 스킬 참조 파일이 운용 규칙으로 증류했다.

| Axis | 핵심 산출 |
|---|---|
| Novel | 12 운용 규칙 — 장면/요약, 감각, `~을수록`, `이 자리에서` |
| Webnovel | 14 규칙 — 사건→긴장→정보, 약속 상환, 싸구려 vs 프리미엄 |
| LinkedIn | 13 규칙 — 스캔 레이어, 80–140 휴리스틱, 바이럴 금지 |
| Four books | 『마케팅 설계자』=*DotCom Secrets*; 통합 12운동 템플릿 |
| Nonfiction | 15 규칙 — Poynter, 우화 경계, 한국형 상투 제거 |

## Next Steps

- 1부(A1–A4)에 이 스킬로 재패스 (특히 안티패턴·도입 호흡)
- humanize-korean이 `.agents`에 복구되면 **윤문 후 작법** 또는 **작법 후 윤문** 순서를 고정
- 필요 시 Notion 「글쓰기 개선」페이지와 교차 링크
