# 원격 Supabase 조회 레시피

크레덴셜은 `apps/web/.env.local`(gitignore). 키를 리포트·커밋·프롬프트에 남기지 않는다.
로컬 `supabase start`는 이 작업에 쓰지 않는다.

```bash
URL=$(grep -E '^NEXT_PUBLIC_SUPABASE_URL' apps/web/.env.local | cut -d= -f2- | tr -d '"'"'"' ')
KEY=$(grep -E '^SUPABASE_SERVICE_KEY' apps/web/.env.local | cut -d= -f2- | tr -d '"'"'"' ')
H=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY")
```

한글 필터는 `--data-urlencode`. 1000행이 넘으면 `offset`/`limit`으로 페이지네이션.

## 회사

```bash
# 종목코드
curl -s -G "$URL/rest/v1/companies" "${H[@]}" \
  --data-urlencode "stock_code=eq.247540" \
  --data-urlencode "select=corp_code,corp_name,stock_code,market,sector_code"

# KSIC 접두 (재현율 우선 — 정확 일치 금지)
curl -s -G "$URL/rest/v1/companies" "${H[@]}" \
  --data-urlencode "sector_code=like.582*" \
  --data-urlencode "market=in.(KOSPI,KOSDAQ)" \
  --data-urlencode "select=corp_code,corp_name,stock_code,market,sector_code" \
  --data-urlencode "limit=1000"
```

## 연간·TTM 잠금 (`fin_periods`)

계정명을 매칭하지 않는다. 컬럼을 그대로 고른다.

```bash
curl -s -G "$URL/rest/v1/fin_periods" "${H[@]}" \
  --data-urlencode "corp_code=eq.01160363" \
  --data-urlencode "period_type=eq.A" \
  --data-urlencode "period_key=in.(2022A,2023A,2024A,2025A)" \
  --data-urlencode "select=corp_code,period_key,fs_div,revenue,operating_income,opm_pct,net_income" \
  --data-urlencode "order=period_key.asc,fs_div.asc"
```

같은 연도에 CFS와 OFS가 같이 오면 CFS를 잠그고 OFS는 버린다. CFS가 없으면 OFS를
쓰고 표에 `OFS`를 적는다.

## 주석 (`financial_facts` NOTE)

```bash
# 회사별 NOTE 행수 — 한계표의 첫 줄
curl -s -G "$URL/rest/v1/financial_facts" "${H[@]}" \
  --data-urlencode "corp_code=eq.00126362" \
  --data-urlencode "sj_div=eq.NOTE" \
  --data-urlencode "select=id" \
  --data-urlencode "limit=1"
# 행수는 Prefer: count=exact 헤더로 센다
curl -s -D - -o /dev/null -G "$URL/rest/v1/financial_facts" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Prefer: count=exact" \
  --data-urlencode "corp_code=eq.00126362" \
  --data-urlencode "sj_div=eq.NOTE" \
  --data-urlencode "select=id" \
  --data-urlencode "limit=1"
# content-range: 0-0/537 → 537행
```

특정 연도 NOTE(단위 오염 검사용). `reprt_code=11011`이 연간인 경우가 많다.
컬럼은 조회 시 `select`로 확인한다 (`account_nm`, `amount`, `amount_prev`,
`bsns_year` 또는 `period_key`).

같은 계정명에서 `amount_prev`가 전년도 `amount`의 정확히 1000배(또는 1/1000)로
대부분의 행에 반복되면 그 연도 NOTE를 폐기한다. `notes-protocol.md`.

## 세그먼트 (`fin_details`)

```bash
curl -s -G "$URL/rest/v1/fin_details" "${H[@]}" \
  --data-urlencode "corp_code=eq.00126362" \
  --data-urlencode "concept=in.(segment_revenue,market_share)" \
  --data-urlencode "period_key=in.(2023A,2024A,2025A)" \
  --data-urlencode "select=corp_code,period_key,concept,item_name,amount,unit,source_rcept_no" \
  --data-urlencode "order=period_key.asc,concept.asc" \
  --data-urlencode "limit=1000"
```

`item_name`을 화학·지역·제품으로 재명명하지 않는다. 원문 라벨을 옮긴다.

## 공시 목록

```bash
curl -s -G "$URL/rest/v1/filings" "${H[@]}" \
  --data-urlencode "corp_code=eq.01160363" \
  --data-urlencode "report_nm=like.*공급계약*" \
  --data-urlencode "select=rcept_no,report_nm,rcept_dt" \
  --data-urlencode "order=rcept_dt.desc" \
  --data-urlencode "limit=50"
```

본문은 DB에 없을 수 있다. `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=<rcept_no>`.

## 시세 (DB 밖)

`https://finance.daum.net/quotes/A<종목코드>` — 예: 에코프로비엠 `A247540`.
발행주식수가 필요하면 DART를 따로 받는다.
