-- 분기보고서 금액 유실(전기동분기·누적 3컬럼 추가) + 자연키를 해시 다이제스트로 교체.
--
-- ─────────────────────────────────────────────── 1부. 무슨 일이 있었나 (금액 유실)
--
-- ingest 의 load_financials 는 finstate_all 응답에서 금액 필드를 딱 셋만 읽는다:
-- thstrm_amount(당기) / frmtrm_amount(전기) / bfefrmtrm_amount(전전기). 연간
-- 사업보고서(11011)에서는 이게 맞다. 분기·반기 보고서에서는 틀리다.
--
-- raw 표본 6,000파일 1,029,884행 실측 (data/raw/<corp>/fin_<year>_<reprt>.json):
--
--   필드 유효값률(%)          11011   11012   11013   11014
--   thstrm_amount              93.6    95.6    95.6    95.5
--   frmtrm_amount              93.3    34.1    36.8    33.4   ← 분기에서 급락
--   bfefrmtrm_amount           92.9    10.0    16.8     9.1
--   frmtrm_q_amount             0.0    68.8    68.1    68.8   ← 읽지 않던 필드
--   thstrm_add_amount           0.0    16.8    16.8    16.0   ← 읽지 않던 필드
--   frmtrm_add_amount           0.0    16.8    16.8    16.0   ← 읽지 않던 필드
--
-- sj_div 로 갈라보면 왜 이런 모양인지가 한눈에 보인다(11013 기준, 유효값률 %):
--
--                              BS      IS     CIS      CF     SCE
--   frmtrm_amount            98.8     9.3     8.3     9.1    19.5
--   frmtrm_q_amount           0.0    99.6    98.4    92.5    92.9
--   thstrm_add_amount         0.0    98.5    98.2     0.0     0.0
--   frmtrm_add_amount         0.0    99.6    98.4     0.0     0.0
--
-- 스톡(재무상태표 BS)은 분기에도 직전 "기말"과 비교하므로 frmtrm_amount 가 온다.
-- 플로우(IS·CIS·CF·SCE)는 전기 연간이 아니라 **전기 동분기**와 비교하는 게 회계적으로
-- 옳고, DART 도 그 값을 frmtrm_q_amount 로 따로 보낸다. 손익계산서·포괄손익계산서는
-- 여기에 더해 **누적(YTD)** 도 thstrm_add_amount / frmtrm_add_amount 로 보낸다.
-- ingest 는 이 셋을 통째로 버렸다. 그래서 분기 플로우 행의 비교값이 90% 가까이
-- 조용히 NULL 이 되고("DART 가 안 준 것"이 아니라 "받고 버린 것"), 분기 누적 분석은
-- 아예 불가능했다.
--
-- ─────────────────────────────────────────────── 왜 amount_prev 에 안 넣나
--
-- frmtrm_q_amount 를 amount_prev 에 흘려넣으면 한 컬럼에 의미가 둘이 된다 —
-- 연간 행에서는 전기(annual), 분기 행에서는 전기동분기. 그러면 이 컬럼을 읽는 모든
-- 코드가 reprt_code 로 분기해야 뜻을 안다. 게다가 실측상 그 둘은 같은 행에 동시에
-- 오기도 한다(분기 행의 7~9%). 그 동시존재 11,528행 중 64.3% 는 두 값이 아예 같고
-- (frmtrm_nm='제 35 기', frmtrm_q_nm='제 35 기 1분기' 인데 금액은 동일 — DART 가
-- 연간 라벨에 분기 금액을 담아 보낸 경우다) 나머지 35.7% 는 서로 다르다. 덮어쓰기든
-- 폴백이든 어느 쪽을 택해도 일부 행에서 값이 조용히 바뀐다. 컬럼을 나누면 그 선택
-- 자체가 사라진다. amount / amount_prev / amount_prev2 의 매핑은 손대지 않는다.
--
-- ─────────────────────────────────────────────── 왜 frmtrm_q_nm 은 저장하지 않나
--
-- frmtrm_q_nm 은 '제 55 기 3분기' 같은 라벨이고 분기 행의 73% 에 온다. 저장하지 않는다:
-- 표본 111,471행 전수에서 thstrm_nm 의 기수 -1 + 같은 분기표기로 100.00% 유도된다
-- (유도 실패 0건). 즉 새 정보가 0이다. 라벨이 필요한 화면은 (bsns_year, reprt_code)
-- 에서 만들면 된다. 기수(제 N 기)가 정말 필요해지면 그때 thstrm_nm 을 별도 컬럼으로
-- 받는 편이 낫다 — 파생 라벨이 아니라 원천 값이므로.
--
-- (초안에서는 "자연키가 id 를 뺀 전 컬럼이므로 컬럼을 하나 늘리면 인덱스가 그만큼
--  커진다"도 이유로 적었다. 2부가 그 전제를 없앤다 — 이제 키에 컬럼을 더해도 인덱스
--  크기는 그대로다. 그래도 위의 "새 정보 0" 이라는 이유만으로 결론은 같다.)
--
-- ─────────────────────────────────────────────── 2부. 자연키를 왜 해시로 바꾸나
--
-- ff_natural_key(20260803000001)는 "id 를 뺀 전 컬럼" 유니크 + nulls not distinct 였다.
-- 의미는 옳았는데 대가가 컸다. 호스티드 실측: 5,548,404행에서 이 인덱스 하나가
-- **947 MB** — financial_facts 인덱스 총량 1,244 MB 의 76% 다. 힙이 1,071 MB 이니
-- 인덱스가 테이블보다 크다. 게다가 초안대로 컬럼 3개를 더 넣으면 더 커진다.
--
-- 이유는 단순하다. 자연키의 실질은 "이 행이 다른 행과 같은가"라는 판정 하나뿐인데,
-- b-tree 는 그 판정을 위해 13~17개 컬럼 값을 **전부 복제해서** 들고 있다. 판정에
-- 필요한 건 동치류 식별자 하나면 된다. 그래서 값 전체 대신 값의 다이제스트를
-- 생성 컬럼(stored generated)에 한 번 계산해 두고, 유니크 인덱스는 그 한 컬럼에만 건다.
--
-- 스크래치 DB 에 실제 매핑 데이터 1,030,000행을 넣고 잰 값:
--   넓은 키          : 204~214 B/행 (인덱스)
--   해시(uuid) 키    : 31.6 B/행 (인덱스) + 17.3 B/행 (힙의 uuid 컬럼) = 48.9 B/행
-- 2,756개사 전 유니버스로 외삽하면 약 3.7 GB → 약 904 MB 다.
--
-- ★ 부수효과가 더 중요하다: 인덱스 컬럼 목록이 사라지므로 **자연키의 정의가 한 곳에만
--   남는다.** 지금까지는 마이그레이션의 인덱스 컬럼 목록과 ingest.py 의 FIN_KEY 튜플이
--   글자 그대로 같아야 했다(PostgREST 의 on_conflict 가 컬럼 목록으로 인덱스를 추론하기
--   때문). 이중 소스는 그 자체가 결함이었다 — 어긋나도 컴파일 타임에 안 잡히고 런타임에
--   42P10 으로만 드러난다. 이제 on_conflict 는 natural_key 한 컬럼만 가리키므로, 키에
--   무엇이 들어가는지는 아래 생성식 하나가 단독으로 정한다. ingest.py 는 더 이상 사본을
--   들고 있지 않아도 된다.
--
-- ─────────────────────────────────────────────── 다이제스트 입력을 어떻게 만드나
--
-- 요구조건: 자연키 컬럼 값 튜플 → 문자열이 **단사(injective)** 여야 한다. 두 튜플이
-- 다르면 문자열도 반드시 달라야 한다. 순진한 방법은 전부 새는 게 있다:
--   * concat(a,b)        : ('a',NULL) 과 (NULL,'a') 가 둘 다 'a' 로 붙는다.
--   * coalesce(x,'')     : 진짜 빈 문자열과 NULL 이 같아진다.
--   * 구분자 || 로 잇기  : 데이터에 그 구분자가 들어오면 경계가 밀린다. account_nm·
--                          account_detail 은 DART 가 보내는 임의 텍스트라 "절대 안 나오는
--                          문자"를 보장할 수 없다.
--
-- 그래서 **길이 접두(length-prefix)** 를 쓴다. 필드마다
--     NULL 이면        '~'
--     아니면           <문자길이>':'<값>
-- 로 인코딩해서 이어붙인다. 왼쪽부터 읽으면 '~' 이거나(NULL) 숫자로 시작해 ':' 까지가
-- 길이이고 그 다음 그만큼이 값이므로, 경계가 데이터 내용과 무관하게 결정된다 —
-- 즉 복호가 유일하고 따라서 인코딩은 단사다. 실측한 함정 케이스:
--     ('a',NULL)→'1:a~'   (NULL,'a')→'~1:a'   ('','')→'0:0:'   (NULL,NULL)→'~~'
--     ('3:abc','x')→'5:3:abc1:x'   ('3',':abcx')→'1:35::abcx'   ('~',NULL)→'1:~~'
-- 전부 서로 다르다. 값이 무엇이든 토큰은 항상 숫자로 시작하므로 NULL 토큰 '~' 와
-- 충돌할 수도 없다.
--
-- (to_jsonb(row) 로 튜플을 통째로 직렬화하는 방법도 검토했다. 인코딩은 안전한데 쓸 수
--  없다 — to_jsonb·record_out·array_out 은 전부 provolatile='s'(STABLE) 라 생성 컬럼
--  식에 들어가지 못한다. 실측으로 확인했다.)
--
-- ─────────────────────────────────────────────── 왜 numeric 을 trim_scale 하나
--
-- amount 계열은 numeric 이다. numeric 은 표시 스케일을 보존하므로 1.0 과 1.00 은
-- **값으로는 같은데 텍스트로는 다르다**. 다이제스트를 텍스트에서 만들면 이 둘이 서로
-- 다른 해시가 되어 두 행이 다 살아남는다 — 넓은 키(numeric 비교)가 막던 것을 조용히
-- 놓치는 것이고, 이건 제약이 약해지는 방향의 회귀다.
--
-- trim_scale(x)::text 로 정규화해서 막는다. trim_scale 은 소수부의 잉여 0 을 떨어내
-- 동치류마다 대표 표기를 하나로 만든다(실측: 1.0→'1', 1.00→'1', -0.0→'0'). 즉
-- "numeric 으로 같다" ⇔ "정규화 텍스트가 같다" 가 성립하고, 다이제스트의 동치관계가
-- 옛 인덱스의 동치관계와 정확히 일치한다.
--
-- DART 가 실제로 이걸 만들 수 있나? 지금 경로에서는 사실상 안 만든다 — ingest 의
-- num() 이 int→float 순으로 파싱하므로 '1.0' 과 '1.00' 은 파이썬 단계에서 이미 같은
-- float 1.0 이 되고, 금액은 원 단위 정수로 온다. 그래도 정규화를 넣는다: 이 등가성은
-- ingest 구현에 기대는 우연이지 스키마가 보장하는 성질이 아니고, 무엇보다 **정규화가
-- 있어야 다이제스트 동치 == 옛 인덱스 동치가 증명되어** 아래 인덱스 생성이 기존
-- 데이터에서 실패할 수 없다고 말할 수 있다. (그리고 NaN·±Infinity 도 같은 규칙으로
-- 일관되게 처리된다 — numeric b-tree 에서 NaN=NaN 이고 텍스트도 'NaN' 으로 같다.)
--
-- ─────────────────────────────────────────────── 왜 md5 가 아니라 sha256 인가
--
-- 둘 다 128비트로 잘라 uuid 에 담으면 **우발 충돌 확률은 같다** — 전 유니버스 추정
-- 1,730만 행에서 n²/2^129 ≈ 4e-25 로 어느 쪽이든 무시 가능하다. 차이는 하나뿐이다:
-- md5 는 의도적 충돌 생성이 깨져 있고(chosen-prefix 실용화) sha256 은 아니다.
-- 여기서 충돌이 나면 merge-duplicates upsert 가 서로 다른 두 재무 사실 중 하나를
-- 조용히 덮어쓴다. "유니크 위반 = 진짜 중복"을 믿을 수 있어야 이 인덱스가 가드로서
-- 의미가 있으므로, 공짜라면 sha256 이 맞다.
--
-- 문제는 공짜가 아닌 줄 알았다는 것이다. sha256() 은 bytea 만 받는데 text→bytea 의
-- 내장 경로인 convert_to 가 STABLE 이라 생성 컬럼에 못 쓴다(실측). decode(x,'escape')
-- 는 IMMUTABLE 이지만 단사가 아니다('A' 와 '\101' 이 같은 바이트로 간다). 남는 건
-- IMMUTABLE 로 표시한 사용자 함수를 하나 만드는 것인데, 그건 (a) public 스키마 함수라
-- PostgREST 에 /rpc 표면이 새로 생기고 — 20260802000005·20260802000006 의 alter default
-- privileges 는 테이블·시퀀스만 덮지 **함수는 안 덮는다**. 함수는 기본적으로 PUBLIC 에
-- EXECUTE 가 붙으므로 정확히 그 발판을 다시 놓는 셈이다 —, (b) 생성 컬럼이 사용자 함수에
-- 의존하게 되어 나중에 그 함수를 replace 하면 저장된 값과 재작성 시 계산값이 조용히
-- 갈라진다.
--
-- 그럴 필요가 없었다. pgcrypto 가 이미 extensions 스키마에 설치돼 있고(호스티드·로컬
-- 둘 다 실측) extensions.digest(text,text) 는 provolatile='i' 다. extensions 는
-- PostgREST 노출 스키마가 아니라 RPC 표면도 늘지 않는다. 그래서 **새 객체 0개로**
-- sha256 을 쓴다. 128비트로 자르는 것은 uuid(16B 고정폭)에 담기 위해서이고, 위 확률
-- 계산이 그 절단을 정당화한다.
--
-- ─────────────────────────────────────────────── 이 마이그레이션이 안전한 이유
--
-- 아래 인덱스 생성이 기존 데이터에서 실패할 수 있나? 없다. 두 겹으로 확인했다.
--   (1) 증명: 위 인코딩은 단사이고 numeric 정규화까지 했으므로 "다이제스트가 같다" ⇔
--       "옛 자연키 컬럼이 전부 같다(nulls not distinct 포함)" 이다. 그런데 후자는 이미
--       옛 유니크 인덱스가 금지하고 있었다. 새로 추가되는 3컬럼은 기존 행에서 전부
--       NULL 이라 모든 행에 같은 상수 토큰을 더할 뿐이라 충돌을 만들 수 없다.
--   (2) 실측: 푸시 전에 호스티드 5,548,404행 전수에 같은 식을 돌려 distinct 다이제스트가
--       5,548,404 — 잉여 0건이었다.
--
-- ─────────────────────────────────────────────── 실행 순서와 잠금
--
-- stored generated 컬럼 추가는 테이블 **전체 재작성**을 유발하고, 재작성은 딸린 인덱스를
-- 전부 다시 만든다. 그래서 947 MB 짜리 ff_natural_key 를 **재작성 전에 먼저 지운다** —
-- 순서를 반대로 하면 곧 버릴 인덱스를 947 MB 만큼 다시 빌드하고 나서 버리게 된다.
-- numeric 3컬럼 추가는 기본값이 없어 메타데이터만 바꾸므로(재작성 없음) 먼저 붙여
-- 재작성 한 번에 함께 실려 가게 한다.
--
-- 유니크 가드가 비는 구간이 생기지만 문제되지 않는다: concurrently 를 쓰지 않으므로
-- supabase CLI 가 파일 전체를 트랜잭션으로 감싸고(20260803000002 초안에서 스크래치 DB
-- 로 실측한 동작이다), 재작성이 ACCESS EXCLUSIVE 로 테이블을 잡고 있는 동안 다른 세션은
-- 애초에 들어오지 못한다. 끝까지 되거나 통째로 없던 일이 된다.
--
-- 참고: 호스티드에서 이 파일을 실행하는 postgres 롤에는 statement_timeout 설정이 없다
-- (pg_db_role_setting 실측 — 타임아웃이 걸린 롤은 anon 3s, authenticator 8s 뿐이다).
-- 재작성이 몇 분 걸려도 중간에 잘리지 않는다.

alter table financial_facts
  add column if not exists amount_prev_q   numeric,
  add column if not exists amount_cum      numeric,
  add column if not exists amount_prev_cum numeric;

comment on column financial_facts.amount_prev_q is
  '전기 동분기 (DART frmtrm_q_amount) — 분기·반기 보고서의 플로우(IS·CIS·CF·SCE) 비교값. '
  '재무상태표(BS)와 연간 보고서에는 오지 않는다(그쪽은 amount_prev).';
comment on column financial_facts.amount_cum is
  '당기 누적/YTD (DART thstrm_add_amount) — 분기·반기 보고서의 IS·CIS 에만 온다.';
comment on column financial_facts.amount_prev_cum is
  '전기 누적/YTD (DART frmtrm_add_amount) — 분기·반기 보고서의 IS·CIS 에만 온다.';

-- 넓은 키를 먼저 버린다(위 "실행 순서와 잠금" 참고). 이름은 아래에서 다시 쓴다 —
-- 자연키 인덱스라는 역할이 같으므로 이름을 유지하는 편이 히스토리가 읽기 쉽다.
drop index if exists ff_natural_key;

-- ★ 이 생성식이 financial_facts 자연키의 **단일 정의**다. 여기 없는 컬럼은 키가 아니고,
--   여기 있는 컬럼은 키다. 키를 바꾸려면 이 식만 고치면 되고, 고치면 컬럼이 다시
--   계산되며 유니크 인덱스가 자동으로 새 정의를 따른다. 다른 어디에도 사본이 없다.
--   (ingest.py 의 FIN_KEY 는 이제 인덱스 계약이 아니라 클라이언트 측 사전 접기 용도뿐이다.)
--
--   토큰 규칙: NULL → '~', 그 외 → <문자길이>':'<값>. numeric 은 trim_scale 로 정규화.
--   근거는 위 "다이제스트 입력을 어떻게 만드나" / "왜 numeric 을 trim_scale 하나".
alter table financial_facts
  add column if not exists natural_key uuid not null generated always as (
    encode(substring(extensions.digest(
        coalesce(length(corp_code)::text||':'||corp_code, '~') ||
        coalesce(length(bsns_year::text)::text||':'||bsns_year::text, '~') ||
        coalesce(length(reprt_code)::text||':'||reprt_code, '~') ||
        coalesce(length(fs_div)::text||':'||fs_div, '~') ||
        coalesce(length(sj_div)::text||':'||sj_div, '~') ||
        coalesce(length(account_id)::text||':'||account_id, '~') ||
        coalesce(length(account_nm)::text||':'||account_nm, '~') ||
        coalesce(length(account_detail)::text||':'||account_detail, '~') ||
        coalesce(length(ord::text)::text||':'||ord::text, '~') ||
        coalesce(length(trim_scale(amount)::text)::text||':'||trim_scale(amount)::text, '~') ||
        coalesce(length(trim_scale(amount_prev)::text)::text||':'||trim_scale(amount_prev)::text, '~') ||
        coalesce(length(trim_scale(amount_prev2)::text)::text||':'||trim_scale(amount_prev2)::text, '~') ||
        coalesce(length(trim_scale(amount_prev_q)::text)::text||':'||trim_scale(amount_prev_q)::text, '~') ||
        coalesce(length(trim_scale(amount_cum)::text)::text||':'||trim_scale(amount_cum)::text, '~') ||
        coalesce(length(trim_scale(amount_prev_cum)::text)::text||':'||trim_scale(amount_prev_cum)::text, '~') ||
        coalesce(length(currency)::text||':'||currency, '~') ||
        coalesce(length(rcept_no)::text||':'||rcept_no, '~')
      , 'sha256') from 1 for 16), 'hex')::uuid
  ) stored;

comment on column financial_facts.natural_key is
  'financial_facts 자연키의 단일 정의 — id 를 뺀 전 컬럼을 길이접두 인코딩으로 이어붙여 '
  'sha256 한 뒤 앞 16바이트를 uuid 로 담는다. ff_natural_key 유니크 인덱스가 이 컬럼 '
  '하나에 걸리고, ingest 의 PostgREST on_conflict 도 이 컬럼을 가리킨다. 넓은 자연키 '
  '인덱스(947 MB/5.5M행)를 대체한 것이며, 키 정의를 바꾸려면 이 컬럼의 생성식만 고친다.';

-- NULL 은 구조적으로 나올 수 없다(모든 필드가 NULL 이어도 토큰 '~' 가 채워지므로 입력
-- 문자열이 NULL 이 되지 않는다). 그래서 컬럼에 not null 을 박았고, 여기서는 옛 인덱스가
-- 필요로 했던 nulls not distinct 가 필요 없다 — NULL 이 없으면 그 구분 자체가 없다.
create unique index if not exists ff_natural_key on financial_facts (natural_key);

-- 이미 적재된 행은 새 금액 3컬럼이 전부 NULL 이다. 이 마이그레이션은 백필하지 않는다 —
-- 값은 DART 응답에만 있고, data/raw 에 남은 원본으로 오프라인 재적재하는 것이
-- 별도 과제다(915개사 account_detail 재적재와 같은 작업으로 묶으면 한 번에 끝난다).
-- 그때까지 amount_prev_q·amount_cum·amount_prev_cum 은 신규 적재분에만 채워진다.
-- 그 NULL 들은 다이제스트에서 '~' 토큰으로 일관되게 처리되므로 재적재 전후로 자연키
-- 의미가 흔들리지 않는다(재적재로 값이 채워지면 그건 "값이 바뀐 것"이므로 새 키가 되는
-- 게 맞다 — replace_scope 의 스코프 삭제가 옛 행을 걷어간다).

-- 권한 주의(20260802000005 / 20260802000006 의 그 발판): 여기서도 새 테이블·시퀀스·
-- **함수**를 만들지 않는다 — 기존 테이블의 컬럼과 인덱스뿐이다. 생성 컬럼은 테이블
-- 권한을 상속하므로 financial_facts 의 권한(anon·authenticated 0, service_role 만)이
-- 그대로 유지되고, 인덱스는 grant 대상 객체가 아니다. sha256 을 사용자 함수 대신
-- pgcrypto(extensions 스키마, PostgREST 비노출)로 얻은 것도 같은 이유다.
-- 새로 열리는 표면은 없다.
