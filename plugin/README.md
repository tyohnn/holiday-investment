# investment-analyst — 가치투자 리서치 스킬 팩

능력범위 → 경제적 해자 → 피셔 정성분석 → **3년 후 적정주가 5단계(9칸 시나리오)** → 안전마진
판정으로 상장기업과 산업을 분석해, 재현 가능한 리서치 리포트를 만드는 스킬 팩이다.
방법론 전체가 스킬 폴더 안에 **자립적으로(self-contained)** 들어 있어 외부 교재 없이 동작한다.

## 딸깍 액션

| 하고 싶은 것 | 스킬 | 산출물 |
|---|---|---|
| "OO 기본 분석해줘" | company-analysis (기본) | `리서치/기업/<종목>/…-기본분석.md` |
| "OO 심층 분석해줘" (산업·밸류체인까지) | company-analysis (심층) | `리서치/기업/<종목>/…-심층분석.md` |
| "이 산업/섹터 분석해줘" | industry-analysis | `리서치/산업/<산업>/…-산업분석.md` |

'기업분석'이라는 단어가 없어도, 특정 종목·산업의 평가/적정주가/밸류에이션을 요청하면 발동한다.

## 방법론 규율 (요약)

- 시가총액으로 사고한다 (주가·EPS 아님). 순이익 대용치 = 영업이익 × 80%.
- 애널리스트 목표주가·투자의견은 무시하고 역이용한다 (본문 로데이터만 취함).
- 성장률 3케이스 × PER 3케이스 = **9칸 매트릭스**. 낙점은 IR 로데이터로 추리.
- 매수 기준은 상승여력 200%(3년 3배). 미달이면 **진입가 = 적정가 ÷ 3** 를 역산해 남긴다.
- 추정은 객관적으로, 보수성은 매수가로. 결과가 "사지 마라"면 그렇게 쓴다.
- 리포트는 종목 추천이 아니라 방법론의 문제풀이다.

## 구조

```
plugin/
├── .claude-plugin/
│   ├── plugin.json          # Claude Code 플러그인 매니페스트
│   └── marketplace.json     # 로컬 마켓플레이스 등록용
├── skills/
│   ├── company-analysis/
│   │   ├── SKILL.md
│   │   └── references/      # checklists · valuation · industry-frame · report-templates
│   └── industry-analysis/
│       └── SKILL.md
├── commands/                # Claude Code 슬래시 커맨드 (/analyze-company, /analyze-industry)
├── adapters/                # Cursor · Codex 어댑터 템플릿 (install.sh 가 경로를 채워 설치)
│   ├── cursor/{rules,commands}
│   └── codex/{prompts, AGENTS.snippet.md}
├── install.sh               # Cursor · Codex 세팅
└── README.md
```

한 소스, 세 도구: 방법론은 `skills/`에만 있고, Cursor·Codex 어댑터는 그 파일을 가리키는 얇은
포인터다. 방법론을 고치면 세 도구에 동시에 반영된다.

## 설치

### Claude Code

```bash
claude
# > /plugin marketplace add /path/to/plugin
# > /plugin install investment-analyst@investment-analyst-marketplace
```

이 저장소처럼 프로젝트 `.claude/` 하위에 스킬을 두면 별도 설치 없이 자동 인식된다.
호출: `/analyze-company 삼양식품 심층` 또는 그냥 "삼양식품 심층 분석해줘".

### Cursor · Codex

```bash
plugin/install.sh /path/to/your-project     # 기본값: 현재 디렉토리
```

- **Cursor**: `<project>/.cursor/rules`·`.cursor/commands`에 어댑터 설치.
  호출: `/analyze-company`, `/analyze-industry` (또는 자연어 요청 시 rule 이 자동 개입).
- **Codex**: `<project>/AGENTS.md`에 스킬 블록 추가 + `~/.codex/prompts/`에 프롬프트 설치.
  호출: `/analyze-company <종목> [심층]`, `/analyze-industry <산업>`.

## 검증 (2026-07 기준, 방법론 버전)

같은 프롬프트를 스킬 유무로 비교한 결과, 스킬 런은 일관되게 9칸 매트릭스·진입가 역산·
커버리지 처리·자기비판적 판정을 냈고(예: 에코프로비엠 상승여력 −2.3%까지 정직하게 기록),
베이스라인은 증권사 목표주가 컨센서스에 의존했다. 삼양식품·에코프로비엠·한화에어로스페이스
3종목(강의 커버리지 안 2 + 밖 1)에서 검증했다.

## 데이터 소스

시세·재무 데이터는 스킬이 웹에서 직접 조사한다(공시·IR 우선). 확보 못한 값은 "미확인"으로
남긴다. DART 원본 파싱, 차트 컴포넌트, MDX 대시보드 렌더링은 별도 로드맵(레포 루트 `로드맵.md`).
