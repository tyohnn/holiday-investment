<!-- investment-analyst:start -->
## 투자분석 스킬 (investment-analyst)

상장기업이나 산업·섹터·테마의 평가·분석·적정주가·밸류에이션 요청을 받으면('기업분석'이라는
단어가 없어도) 이 플러그인의 방법론을 그대로 따른다. 방법론이 아래 파일들 안에 자립적으로 있다.

- 개별 기업 → `{{PLUGIN_DIR}}/skills/company-analysis/SKILL.md` 를 읽고 절차·references/ 를 따른다.
  "심층"이면 산업·밸류체인·경쟁사까지. 또는 `/analyze-company <종목> [심층]` 프롬프트 사용.
- 산업/섹터/테마 → `{{PLUGIN_DIR}}/skills/industry-analysis/SKILL.md` 를 읽고 따른다.
  또는 `/analyze-industry <산업>` 프롬프트 사용.

규율: 시가총액 기준 · 순이익 = 영업이익 × 80% · 애널리스트 목표주가 무시·역이용 · 9칸 매트릭스 ·
상승여력 200% 안전마진(미달 시 진입가 = 적정가 ÷ 3) · 기준일·출처 필수 · 결과가 "사지 마라"면
그렇게 쓴다. 산출물은 `리서치/기업/` 또는 `리서치/산업/`에 저장. 방법론 문제풀이이며 투자 권유 아님.
<!-- investment-analyst:end -->
