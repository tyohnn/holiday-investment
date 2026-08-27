# 스키마 함정 — 서브에이전트 프롬프트에 복사

이 파일은 산업지도 런마다 서브에이전트 프롬프트에 넣는다. 행수는 증분 적재로
바뀌므로 **개수를 외우지 말고 조회 시점에 다시 센다.**

## 정본 테이블

- **웹·스크리너용 정본은 `fin_periods`.** 원본 `financial_facts`는 DB에 상주한다
  (증분 적재가 여기에 쓰고 rebuild가 회사 전체 이력을 읽는다. 비우면 파이프라인이 깨진다).
- **`fin_periods`가 `sj_div`·`account_nm` 지옥을 이미 흡수했다.** 회사마다 다른
  계정명("매출액"/"영업수익"/"수익(매출액)")과 IS/CIS 선택을 적재 함수가 컬럼으로 편다:
  `revenue · operating_income · net_income · assets · liabilities · equity · cash ·
  cf_operating/investing/financing · net_debt · borrowings_total`.
  비율도 있다 (`opm_pct · npm_pct · roe_pct · debt_ratio_pct · gpm_pct`).
  **계정명 매칭을 직접 하지 마라.**
  `cogs · sga · gross_profit · ebitda · depreciation · amortisation`은 부분 결측.
- `period_type`: `A`(연간) · `Q1~Q4` · `TTM`. `period_key`는 `2021A` 꼴.
  앱의 `db.ts`는 `period_type='A'`로 읽는 곳이 있다. 산업지도는 연간 잠금 + 필요 시 TTM.
- **연결(CFS)이 없는 회사가 있다.** 종속회사가 없으면 별도(OFS)만.
  `fs_div`로 구분. CFS 우선·OFS 폴백, 기준을 표기.

## 주석과 세그먼트 (자주 틀림)

- **주석 정본 = `financial_facts.sj_div='NOTE'`.** 상세는 `notes-protocol.md`.
- **`filing_sections`는 주석이 아니다.** 원격에는 관심종목 목차 추출만 있고
  (2026-08-27 실측: 삼성전자 1사), 로컬 시드와 혼동하지 마라.
- **`fin_details`는 세그먼트·점유율·R&D 등 파생 사실.** NOTE가 있는 회사는
  `fin_details`도 있는 편이나, `fin_details`만 있는 회사도 있다.
- NOTE는 재무제표 **부속 각주 항목**이다. 고객·공장 서술이 아닐 수 있다.
  감가·이자·재고 각주만 있으면 "주석에서 고객을 확인했다"고 쓰지 마라.

## 공시·이벤트

- **`events.event_type`과 `filings.report_nm`을 혼동하지 마라.**
  `대량보유`·`임원ㆍ주요주주`·`주식등의대량보유`는 **`report_nm`** 이다.
  `event_type`은 주요사항보고서 종류(자기주식·유상증자·전환사채·합병·분할·소송 등).
  지분 변동 정본은 `ownership_txns`.
- 시드 2종목(크래프톤·에코프로비엠)은 로컬에서 `events`·`ownership_txns`가 0일 수 있다.
  원격 전역은 있다. "테이블이 비었다"와 "이 회사만 비었다"를 구분한다.
- 공시 본문이 필요하면 DART:
  `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=<rcept_no>`.

## 조회 상한

- **PostgREST 기본 limit은 1000행.** `Range` 헤더도 이 상한을 못 넘는다.
  1000행 초과는 `offset`/`limit`으로 페이지네이션. 조용히 잘린 표본이 최대 오류원.
- 한글 파라미터는 `--data-urlencode`.
- 주가·시가총액·발행주식수는 **DB에 없다.** 웹에서 받고 URL을 남긴다.
  시세는 `https://finance.daum.net/quotes/A<종목코드>` (네이버금융은 차단).
  다음금융은 상장주식수를 안 보여 시총÷종가 역산이 된다. 정밀 PER 분모는 DART.

## `sector_code` (KSIC)

`companies.sector_code` = DART `induty_code` = KSIC. NULL은 없으나 깊이가 제각각
(2자리~5자리)이라 같은 산업이 여러 코드로 흩어진다. 게임만 해도 크래프톤·넷마블
`5821`, 펄어비스 `58211`, 시프트업 `58212`, 엔씨소프트 `582`. 반대로 `582`에는
안랩·루닛·현대오토에버가 섞인다.

1. 후보 풀은 **접두 매칭으로 넓게** (재현율 우선).
2. 최종 유니버스는 이번 지도의 층(수요/중간재/병목) 기준으로 **감독이 손으로 확정**.
3. GICS/WICS는 쓰지 않는다.
4. 상장만: `market in (KOSPI, KOSDAQ)`.
