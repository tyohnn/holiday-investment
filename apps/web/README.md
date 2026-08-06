# 숫자로 읽는 주식투자 (Next.js + shadcn)

저장소 루트 `교재/` 마크다운을 **읽는 책**(`/book`)으로 서빙합니다.
모노레포 앱 위치: `apps/web`.

UI는 shadcn/ui(`radix-mira` 프리셋)이고, 본문 조판은
[shadcn/typeset](https://ui.shadcn.com/docs/typeset)이 담당합니다 — `app/typeset.css`
한 장이 `.typeset` 컨테이너 안의 모든 마크다운 결과물을 조판하고,
`.typeset-notes` 프리셋(`app/global.css`)이 이 책의 글꼴·크기·행간을 정합니다.

## 개발

저장소 루트에서:

```bash
pnpm install
pnpm dev
```

또는 앱 디렉터리에서:

```bash
cd apps/web
pnpm install
pnpm dev
```

`pnpm sync` / `predev` / `prebuild`가 `교재/` → `content/book/`으로 변환합니다.
원본 교재(`교재/`)가 정본이고, `content/book/`은 생성물(gitignore)입니다.
변환 결과는 **평범한 CommonMark + `manifest.json`** 이며, MDX가 아닙니다.
`manifest.json`이 권·부·장 구조와 제목·설명을 담고, 라우트가 그걸로 목차와
이전/다음을 만듭니다.

## URL 구조

| 경로 | 내용 |
|---|---|
| `/` | 랜딩 (교재 / 리서치 분기) |
| `/book` | 서가 — 권 선택 |
| `/book/book1` | 1권 표제지 + 목차 |
| `/book/book1/A1` … `/book/book1/appendix` | 1권 장 |
| `/book/book2` … | 2권 (공개 시) |
| `/book/reference/stocks`, `/book/reference/glossary` | 자료 |
| `/llms.txt`, `/llms-full.txt` | 기계 판독용 목차 / 전문 |
| `/docs/**` | 옛 Fumadocs 경로 → `/book/**` 301 리다이렉트 |

한글 파일명은 `manifest.json`의 `title`로 유지하고, URL 슬러그만 ASCII로 둡니다
(중첩 한글 경로가 Next.js 정적 생성에서 깨지는 이슈 회피).

## 렌더 파이프라인

`lib/book/render.ts`가 remark/rehype로 장 본문을 컴파일합니다
(gfm · math(`$$…$$`만) · katex · slug, 넓은 표는 `.typeset-scroll`로 감쌈).
본문 안 `@@TEXTBOOK_CHART:<id>@@` 자리표시자는 `<TextbookChart />`로 치환되며,
차트는 `.book-bleed`로 본문 폭(37em)을 넘어 펼쳐집니다.

## 스크립트

| 명령 | 설명 |
|---|---|
| `pnpm sync` | 교재 Markdown → `content/book/` |
| `pnpm dev` | 로컬 개발 서버 |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm start` | 빌드 결과 실행 |
| `pnpm types:check` | `next typegen && tsc --noEmit` |
