# 우공이산 위키 (Fumadocs)

저장소 루트 `교재/` 마크다운을 Fumadocs(Next.js) 문서로 서빙합니다.

## 개발

```bash
cd website
pnpm install
pnpm dev
```

`pnpm sync` / `predev` / `prebuild`가 `교재/` → `content/docs/`로 변환합니다.
원본 교재(`교재/`)가 정본이고, `content/docs/`는 생성물(gitignore)입니다.

## URL 구조

| 경로 | 내용 |
|---|---|
| `/docs` | 교재 홈 (INDEX) |
| `/docs/book1` | 교재① 방법론 목차 |
| `/docs/book1/A1` … `/docs/book1/appendix` | 교재① 챕터 |
| `/docs/book2` | 교재② 이차전지 목차 |
| `/docs/book2/A1` … `/docs/book2/F3` | 교재② 챕터 |
| `/docs/reference` | 종목 DB · 용어교정 · 보강계획 · PLAN |

한글 파일명은 frontmatter `title`로 유지하고, URL 슬러그만 ASCII로 둡니다
(중첩 한글 경로가 Next.js 정적 생성에서 깨지는 이슈 회피).

## 스크립트

| 명령 | 설명 |
|---|---|
| `pnpm sync` | 교재 Markdown → Fumadocs content |
| `pnpm dev` | 로컬 개발 서버 |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm start` | 빌드 결과 실행 |
