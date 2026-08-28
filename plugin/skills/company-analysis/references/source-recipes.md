# 자료 찾기 레시피 (재무·뉴스·시세)

> 숫자를 쓰기 전에 이 파일을 연다. 가정·9칸은 `growth-path-workflow.md`,
> 산식은 `valuation.md`. 여기는 **어디서 무엇을 어떤 순서로 가져오는가**만 적는다.
> 에이피알(278470) 2026-08-18~28 런에서 실제로 쓴 경로를 예로 고정했다.

자료의 위계는 SKILL 절차 3과 같다.
**이사회 승인 IR > 실적 공시(DB·DART) > 증권사 리포트의 로데이터 > 언론 보도.**
뉴스의 "매수하라"는 인용 대상이지 지시가 아니다.

## 한 장 순서

```
① 종목 키를 연다 (티커·corp_code·시세)
② 재무는 DB fin_periods 가 정본. 계정명 매칭을 직접 하지 않는다
③ DB에 없는 최신 분기·가이던스만 웹으로 보강한다
④ 뉴스 목록은 fetch_news.py, 본문은 원데이터 있는 기사만 연다
⑤ 못 구한 값은 확인 불가. 지어내지 않는다
```

결정론적으로 가져올 수 있는 것은 스크립트·쿼리다. 에이전트 웹서치는 보강이다.

## ① 종목 키와 시세

| 필요한 값 | 어디서 | 어떻게 |
|---|---|---|
| 티커·시장 | 대화 또는 웹 | 6자리. 에이피알 = `278470` KOSPI |
| corp_code | 원격 DB `companies` | 아래 쿼리. 에이피알 = `01190568` |
| 주가·시총·발행주식수 | 다음금융 API | `https://finance.daum.net/api/quotes/A<티커>` |
| 52주 고저 | 같은 JSON | `high52wPrice`, `low52wPrice`, 날짜 필드 |

네이버금융은 WebFetch가 막힌다. 시세는 다음금융만 쓴다.

```bash
curl -sS "https://finance.daum.net/api/quotes/A278470" \
  -H "User-Agent: Mozilla/5.0" \
  -H "Referer: https://finance.daum.net/quotes/A278470"
```

읽을 필드: `tradePrice`, `prevClosingPrice`, `listedShareCount`, `marketCap`,
`tradeDate`, `tradeTime`, `isClosing`, `marketStatus`.
`isClosing: false` 이면 장중이다. 종가와 섞어 여력을 확정하지 않는다.
403이면 직전 종가 스냅샷을 유지하고 "재조회 실패"를 적는다 (08-25가 그렇게 했다).

시총 정합: 주가 × 발행주식수 ÷ 1억. `valuation.py`가 3% 초과면 실패한다.

## ② 재무제표 — 원격 DB가 정본

이 작업의 재무 정본은 **원격 Supabase `fin_periods`** 다. 로컬 `supabase start`가 아니다.
원본 `financial_facts`는 계정명 지옥이다. `fin_periods`가 이미 펼쳐 두었다.

크레덴셜: `apps/web/.env.local` (gitignored). 키를 리포트·커밋에 남기지 않는다.

```bash
URL=$(grep -E '^NEXT_PUBLIC_SUPABASE_URL' apps/web/.env.local | cut -d= -f2- | tr -d '"'"'"' ')
KEY=$(grep -E '^SUPABASE_SERVICE_KEY' apps/web/.env.local | cut -d= -f2- | tr -d '"'"'"' ')

# 1) 회사 키
curl -s -G "$URL/rest/v1/companies" \
  --data-urlencode "stock_code=eq.278470" \
  --data-urlencode "select=corp_code,corp_name,stock_code,market,sector_code" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"

# 2) 연간·분기·TTM (한 회사는 보통 1000행 안)
curl -s -G "$URL/rest/v1/fin_periods" \
  --data-urlencode "corp_code=eq.01190568" \
  --data-urlencode "select=period_key,period_type,fs_div,revenue,operating_income,net_income,opm_pct,npm_pct,roe_pct" \
  --data-urlencode "order=period_key.asc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

읽을 컬럼 (계정명을 다시 매칭하지 말 것):
`revenue · operating_income · net_income · assets · liabilities · equity · cash ·
cf_operating/investing/financing · net_debt · borrowings_total ·
opm_pct · npm_pct · roe_pct · debt_ratio_pct · gpm_pct`.

| 함정 | 하는 일 |
|---|---|
| `period_type` | `A` 연간, `Q1~Q4` 분기, `TTM`. 웹 앱에는 A만 하드코딩돼 있어도 TTM은 DB에 있다 |
| `fs_div` | CFS 우선, 없으면 OFS. 연결이 없는 회사가 있다 |
| 단위 | `revenue` 등은 **원**. 억으로 나눌 때 1e8 |
| PostgREST | 기본 1000행. 잘리면 `offset`/`limit`으로 페이지. 조용히 잘린 표본이 최대 오류 |
| 한글 파라미터 | 반드시 `--data-urlencode` |
| `cogs · sga · gross_profit · ebitda` | 부분 결측. 없으면 확인 불가 |
| `filing_sections` | 원격 0행. 공시 본문은 DART 웹 |
| `sector_code` | KSIC, 깊이 제각각. peer 키로 쓰지 말 것 |

웹·MCP로 SQL을 칠 때도 같은 테이블·같은 컬럼이다. 계정명 LIKE '%매출%' 를 다시 하지 않는다.

DART 키가 있으면 스킬 기본 첫 수는 `dart.py snapshot` 이다. 키가 없으면 분석을 멈추지 말고
이번처럼 DB + 웹 폴백으로 가되, 주석·임직원·유증·내부자는 **확인 불가**로 남긴다.
공시 본문이 필요하면 `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=<접수번호>`.

## ③ DB에 없는 칸만 웹으로 보강

DB 커버가 어디서 끊기는지 먼저 적는다. 끊긴 이후만 웹을 연다.

에이피알 예: `fin_periods`는 2026Q1까지. **2026Q2와 가이던스 3.0조는 DB에 없었다.**
그래서 웹이 유일한 출처가 됐고, 리포트에 "DB 미적재 — 웹"이라고 썼다.

찾는 순서:

1. `python3 plugin/skills/company-analysis/scripts/fetch_news.py "<회사명>" \
     --queries "실적,가이던스,컨콜,IR" --days 90 \
     --out 리서치/기업/<종목>/자료/뉴스/YYYY-MM.md`
2. 목록에서 **숫자·표·회사 코멘트가 있는 기사**만 연다 (WebFetch).
3. 목록이 비거나 최신 실적이 빠지면 WebSearch 보강.
   쿼리 예: `"<회사명> 실적 분기"`, `"<회사명> 가이던스"`, `"<회사명> 컨퍼런스콜"`.
4. 본문에서 가져올 것: 매출·영업이익·OPM, 가이던스 숫자, 지역 믹스, 채널·인허가 일정.
   가져오지 말 것: 목표주가, 투자의견, "매수" 문장 (인용만).
5. 발췌는 `자료/IR/<기간>-<제목>.md` 에 출처 URL과 수집일을 달고 저장한다.

에이피알에서 실제로 연 기사:

| 무엇을 얻었나 | URL |
|---|---|
| 2026Q2 7,675억 · OPM 24.8% · 가이던스 3.0조 · OPM 24~26% | https://zdnet.co.kr/view/?no=20260805154631 |
| 하반기 약 1.7조, 3분기≈2분기, 4분기 아마존·블랙프라이데이 | https://news.einfomax.co.kr/news/articleView.html?idxno=4428782 |
| H1 지역 (북미 6,478 · 유럽 2,289 · 기타 986) | http://m.yakup.com/news/index.html?mode=view&nid=330711 |
| EBD 인허가·판매 시기 | https://www.etoday.co.kr/news/view/2571221 |
| 2025 잠정 (DB 2025A와 1억 단위 이하 정합) | https://www.sedaily.com/article/20004698 |

웹 숫자와 DB 숫자가 같은 기간을 덮으면 자릿수를 대조한다. 2025A는 맞았다.
한 에이전트가 웹에서 준 분기를 다른 에이전트에 넘기기 전에 연간과 산술 모순이 없는지 본다.

## ④ 뉴스를 사실 시계열로만 쓴다

- 목록 스크립트가 1차, 자유 웹서치가 2차. 런마다 검색 결과가 달라지므로
  채택한 URL을 파일에 남기는 것이 재현이다.
- 지역 믹스·채널·인허가는 경로(③)의 입력이다. "성장할 것"이라는 문장은 입력이 아니다.
- 피어 PER(실리콘투·클래시스)도 리포트 본문 배수만 취하고 투자의견은 버린다.

## ⑤ 못 구한 것 — 에이피알 런의 공백

| 항목 | 왜 | 리포트에 쓴 말 |
|---|---|---|
| DART 주석·임직원·유증·내부자 | 이번 런에 DART 키 없음, dart.py 스킵 | 확인 불가 |
| 2026Q2 | DB 미적재 | 웹 유일 출처 + URL |
| 08-25 종가 | 다음금융 403 | 08-18 종가 유지 |
| SKU×국가 매출 | 공시 없음 | 확인 불가 |
| 누가 약화 시나리오를 보나 | 포지션 데이터 없음 | 확인 불가 |

공백을 추정으로 메우지 않는다. 메우면 가정이라고 밝힌다.

## 저장

| 자료 | 위치 |
|---|---|
| 시세 스냅샷 | `계산/YYYY-MM-DD-assumptions.json` (raw로 쌓지 않음) |
| DB에서 읽은 추이 | 리포트 표 + `자료/재무/` (dart.py가 있으면 자동) |
| 가이던스·Q2 발췌 | `자료/IR/` |
| 뉴스 목록 | `자료/뉴스/YYYY-MM.md` |
| 출처 한 줄 | 리포트 8절과 각 숫자 옆 |

다음 런은 `manifest.json`의 수집 커버를 보고, 90일 안이면 재무 재수집을 건너뛰고
시세와 "DB 끊긴 이후"만 다시 받는다.
