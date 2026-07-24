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
│   └── marketplace.json     # Claude Code 마켓플레이스 등록용
├── .cursor-plugin/
│   └── plugin.json          # Cursor 플러그인 매니페스트 (공식 스펙, cursor.com/docs/reference/plugins)
├── .codex-plugin/
│   └── plugin.json          # Codex CLI 플러그인 매니페스트 (공식 스펙, developers.openai.com/codex)
├── skills/                  # ← 세 도구가 전부 이 폴더를 그대로 네이티브 인식한다
│   ├── company-analysis/
│   │   ├── SKILL.md
│   │   └── references/      # checklists · valuation · industry-frame · report-templates
│   └── industry-analysis/
│       └── SKILL.md
├── commands/                # 슬래시 커맨드 — Claude Code·Cursor 둘 다 이 폴더를 자동 인식
└── README.md
```

**한 소스, 세 매니페스트**: Claude Code·Cursor·Codex 모두 `skills/<name>/SKILL.md` 형식을
그대로 네이티브 인식하는 자체 플러그인 시스템을 갖고 있어서, 방법론 파일(`skills/`, `commands/`)은
도구마다 하나씩만 존재한다. 세 도구는 각자 어디를 찾을지 알려주는 매니페스트(`.claude-plugin/`,
`.cursor-plugin/`, `.codex-plugin/`)만 따로 갖는다. 방법론을 고치면 세 도구에 동시에 반영된다.

## 설치

### Claude Code

```bash
claude
# > /plugin marketplace add /path/to/plugin
# > /plugin install investment-analyst@investment-analyst-marketplace
```

이 저장소처럼 프로젝트 `.claude/` 하위에 스킬을 두면 별도 설치 없이 자동 인식된다.
호출: 자연어 요청("삼양식품 심층 분석해줘")에 스킬 description으로 자동 트리거, 또는
`/analyze-company 삼양식품 심층`.

### Cursor

공식 로컬 개발 경로(`cursor.com/docs/plugins`)에 심링크한다:

```bash
mkdir -p ~/.cursor/plugins/local
ln -s /path/to/plugin ~/.cursor/plugins/local/investment-analyst
# Cursor 재시작 또는 Cmd/Ctrl+Shift+P → "Developer: Reload Window"
```

공개 배포 시에는 `cursor.com/marketplace` 제출 절차를 따른다(별도 검수).
**호출**: Cursor의 Skill은 자동 트리거되지 않고 채팅에서 `/company-analysis`처럼 명시적으로
불러야 한다(공식 문서 명시 사항). `commands/`는 자동 인식되므로 `/analyze-company` 커맨드로
부르는 쪽이 더 안정적이다.

### Codex CLI

공식 플러그인 매니페스트(`.codex-plugin/plugin.json`)를 로컬 마켓플레이스에 등록한다:

```bash
mkdir -p ~/.codex/plugins
cp -r /path/to/plugin ~/.codex/plugins/investment-analyst

mkdir -p ~/.agents/plugins   # 개인 스코프. 프로젝트 스코프는 <repo>/.agents/plugins/
cat > ~/.agents/plugins/marketplace.json <<'EOF'
{
  "name": "personal-marketplace",
  "owner": { "name": "you" },
  "plugins": [
    {
      "name": "investment-analyst",
      "source": { "source": "local", "path": "~/.codex/plugins/investment-analyst" }
    }
  ]
}
EOF

codex
# > /plugins   (설치 확인 후 새 스레드 시작)
```

**호출**: 이 스킬 팩이 다루는 질문(기업·산업 평가·적정주가)을 자연어로 물으면 Codex가
번들된 `SKILL.md`를 workflow로 사용한다. 잘 안 잡히면 종목명과 함께 "company-analysis 스킬로
분석해줘"처럼 스킬 이름을 명시한다.

## 검증 (2026-07 기준, 방법론 버전)

같은 프롬프트를 스킬 유무로 비교한 결과, 스킬 런은 일관되게 9칸 매트릭스·진입가 역산·
커버리지 처리·자기비판적 판정을 냈고(예: 에코프로비엠 상승여력 −2.3%까지 정직하게 기록),
베이스라인은 증권사 목표주가 컨센서스에 의존했다. 삼양식품·에코프로비엠·한화에어로스페이스
3종목(강의 커버리지 안 2 + 밖 1)에서 검증했다.

## 데이터 소스

시세·재무 데이터는 스킬이 웹에서 직접 조사한다(공시·IR 우선). 확보 못한 값은 "미확인"으로
남긴다. DART 원본 파싱, 차트 컴포넌트, MDX 대시보드 렌더링은 별도 로드맵(레포 루트 `로드맵.md`).
