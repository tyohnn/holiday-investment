# investment-analyst — 가치투자 리서치 스킬 팩

능력범위 → 경제적 해자 → 피셔 정성분석 → **3년 후 적정주가 5단계(9칸 시나리오)** → 안전마진
판정으로 상장기업과 산업을 분석해, 재현 가능한 리서치 리포트를 만드는 스킬 팩이다.
방법론 전체가 스킬 폴더 안에 **자립적으로(self-contained)** 들어 있어 외부 교재 없이 동작한다.

## 딸깍 액션

| 하고 싶은 것 | 스킬 | 산출물 |
|---|---|---|
| "OO 기본 분석해줘" | company-analysis (기본) | `리서치/기업/<종목>/…-기본분석.md` |
| "OO 심층 분석해줘" (산업·밸류체인까지) | company-analysis (심층) | `리서치/기업/<종목>/…-심층분석.md` |
| "이 산업/섹터 분석해줘" (채점·국면·유망종목) | industry-analysis | `리서치/산업/<산업>/…-산업분석.md` |
| "이 산업 지도 그려줘" (원리·공급처·병목·신판로) | industry-map | `리서치/산업/<산업>/…-산업지도-*.md` |

'기업분석'이라는 단어가 없어도, 특정 종목·산업의 평가/적정주가/밸류에이션을 요청하면 발동한다.

## 방법론 규율 (요약)

- 시가총액으로 사고한다 (주가·EPS 아님). 순이익 대용치 = 영업이익 × 80%.
- 애널리스트 목표주가·투자의견은 무시하고 역이용한다 (본문 로데이터만 취함).
- 성장률 3케이스 × PER 3케이스 = **9칸 매트릭스**. 낙점은 IR 로데이터로 추리.
- 매수 기준은 상승여력 200%(3년 3배). 미달이면 **진입가 = 적정가 ÷ 3** 를 역산해 남긴다.
- 추정은 객관적으로, 보수성은 매수가로. 결과가 "사지 마라"면 그렇게 쓴다.
- 리포트는 종목 추천이 아니라 방법론의 문제풀이다.

## 스크립트가 강제하고, 모델은 판단한다

계산과 형식 검증은 마크다운 지시가 아니라 번들 Python 스크립트(표준 라이브러리 전용,
3.9+, pip 불필요)가 결정론적으로 수행한다:

- `scripts/valuation.py` — 가정(assumptions.json)을 받아 9칸 매트릭스·낙점 적정주가·
  진입가(÷3)·안전마진 판정·실전 PER·미래 PSR을 계산하고, 리포트에 붙여넣을 마크다운
  표까지 출력한다. 에이전트는 가정 선택과 근거 서술만 담당한다 — 손 산수 금지.
- `scripts/validate_report.py` — 리포트 저장 전 통과해야 하는 게이트. frontmatter 스펙,
  필수 섹션, 9칸 존재, 고지 문구, 그리고 수치 정합성(진입가 = 낙점 ÷ 3, 상승여력 =
  낙점/현재가 − 1, 계산기 출력과의 일치)을 검사한다. exit 0이 아니면 미완성이다.

수집도 같은 원칙이다 — 결정론적으로 가져올 수 있는 것은 스크립트가, 선별·발췌만 에이전트가:

- `scripts/dart.py` + `dart_api.py` — OpenDART 공식 API **전면 커버** (OpenDartReader
  커버리지 참조, stdlib 재구현): `snapshot` 한 방이면 재무 추이(연간+분기)·공식 재무지표·
  공시 목록(유증·CB 플래그)·자금조달 주요사항(유증·무증·CB·BW·EB·감자·자사주·소송)·
  지분거래(대량보유·임원 소유보고)·지배구조(최대주주·변동·배당·직원·타법인출자)를 자료/
  레이아웃으로 일괄 저장. 개별 심화: `report`(정기보고서 11항목), `doc`(원본 문서 텍스트),
  `indicators`, `corp`(기업개황). 산출물마다 방법론 메모(내부자 매수 판독, 문화 판별,
  지분 희석, SOTP 입력) 부착.
- `scripts/fetch_news.py` — Google News RSS로 뉴스 목록(제목·날짜·매체·URL)을 결정론적으로
  수집. 에이전트 웹서치는 런마다 결과가 달라지는 보강용으로 강등.
- `scripts/fetch_youtube.py` — yt-dlp 래퍼. 영상 검색 → 신뢰 채널 선별 → 자막을
  타임스탬프 md로 저장 (심층 모드 전용, 회사 공식 IR 컨퍼런스콜 영상이 주 대상).

### 선택적 외부 요소 (없어도 스킬은 폴백으로 완주한다)

| 요소 | 용도 | 없을 때 |
|---|---|---|
| DART API 키 | dart.py — [opendart.fss.or.kr](https://opendart.fss.or.kr) **개인회원** 무료 즉시 발급 (기업회원은 IP 등록 필요) | DART 웹 열람·웹서치로 폴백 |
| `yt-dlp` CLI | fetch_youtube.py — `brew install yt-dlp` | 유튜브 단계 건너뜀 |

DART 키 설정은 두 갈래다 — 둘 다 `.env.local`에 권한 600으로 저장하고 `.gitignore`에 자동 등록한다:

```bash
# 키를 이미 발급받았다면 (에이전트에게 알려주면 대신 실행해 준다)
python3 skills/company-analysis/scripts/dart.py setup --key <40자리키>

# 키가 없다면 — 브라우저 폼이 열려 발급 절차부터 안내한다
python3 skills/company-analysis/scripts/dart.py setup
```

탐색 순서: `--api-key` > `DART_API_KEY` 환경변수 > `./.env.local` > `./.env` >
`~/.config/investment-analyst/env`. 여러 프로젝트에서 공유하려면 마지막 경로에 두면 된다.

그 외에는 전부 순수 Python 표준 라이브러리(3.9+)다 — pip 설치 없음.

## 데이터 레이아웃 — raw와 분석의 분리

분석 과정에서 수집·생성되는 모든 파일은 종목/산업 폴더 안에서 역할별로 분리된다
(상세: `skills/company-analysis/references/data-layout.md`):

```
리서치/기업/<종목>/
├── 자료/{재무,공시,IR,뉴스,유튜브}/  # raw 수집 자료 (출처 frontmatter 필수, 해석 금지)
├── 분석/YYYY-MM-DD-{기본|심층}분석.md  # 완성 리포트
└── 계산/                             # assumptions.json · valuation.json (재계산 가능)
```

시세(주가·시총)는 계속 변하는 값이라 raw 로 쌓지 않는다 — 계산 시점 스냅샷이 기준일과 함께
`계산/*-assumptions.json` 에 남는다. 다음 분석은 `자료/`를 먼저 재사용하고(재무·공시 90일
이내), 리포트의 모든 숫자는 raw 파일로 역추적된다. 트래커 스킬(로드맵 P3)이 같은 폴더에
데일리 수집을 쌓는다.

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
│   │   ├── references/      # checklists · valuation · industry-frame · report-templates · data-layout
│   │   └── scripts/         # valuation.py (9칸 계산기) · validate_report.py (검증 게이트)
│   ├── industry-analysis/
│   │   └── SKILL.md
│   └── industry-map/
│       ├── SKILL.md
│       └── references/        # schema-traps · notes · supervisor · qc · query · example
└── README.md
```

**한 소스, 세 매니페스트**: Claude Code·Cursor·Codex 모두 `skills/<name>/SKILL.md` 형식을
그대로 네이티브 인식하는 자체 플러그인 시스템을 갖고 있어서, 방법론 파일(`skills/`)은 도구마다
하나씩만 존재한다. 세 도구는 각자 어디를 찾을지 알려주는 매니페스트(`.claude-plugin/`,
`.cursor-plugin/`, `.codex-plugin/`)만 따로 갖는다. 방법론을 고치면 세 도구에 동시에 반영된다.

별도 슬래시 커맨드(`commands/`)는 두지 않았다 — Claude Code는 스킬 description으로 자연어
요청을 자동 트리거하고, Cursor는 스킬을 `/company-analysis`로 직접 호출할 수 있어 커맨드가
같은 진입점의 중복이었다. Codex의 플러그인 매니페스트는 애초에 `commands` 필드를 지원하지
않는다.

## 설치

### Claude Code

```bash
claude
# > /plugin marketplace add /path/to/plugin
# > /plugin install investment-analyst@investment-analyst-marketplace
```

이 저장소처럼 프로젝트 `.claude/` 하위에 스킬을 두면 별도 설치 없이 자동 인식된다.
호출: 자연어 요청("삼양식품 심층 분석해줘")에 스킬 description으로 자동 트리거된다.

### Cursor

공식 로컬 개발 경로(`cursor.com/docs/plugins`)에 심링크한다:

```bash
mkdir -p ~/.cursor/plugins/local
ln -s /path/to/plugin ~/.cursor/plugins/local/investment-analyst
# Cursor 재시작 또는 Cmd/Ctrl+Shift+P → "Developer: Reload Window"
```

공개 배포 시에는 `cursor.com/marketplace` 제출 절차를 따른다(별도 검수).
**호출**: Cursor의 Skill은 자동 트리거되지 않으므로 채팅에서 `/company-analysis` 또는
`/industry-analysis` 또는 `/industry-map`으로 명시적으로 불러야 한다(공식 문서 명시 사항).

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
