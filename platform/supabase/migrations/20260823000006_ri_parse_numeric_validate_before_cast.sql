-- ri_parse_numeric: 캐스팅 전에 최종 형태를 검증한다 — 22P02 로 뷰 전체가 죽던 결함 수정.
--
-- 실측 사고(위월드 00663289, KONEX 140660, 소액주주 2015~2017): payload 의
-- hold_stock_rate 원문이 "8.1%.%" 꼴이다(% 두 개 사이에 '.' 하나가 낀 원문 오기).
-- 화이트리스트 strip([^0-9.\-])은 '%' 만 지우고 '.' 두 개를 다 살려 "8.1." 이 되고,
-- ::numeric 캐스팅이 22P02 를 던진다. 함수 주석은 "안전하게 파싱, 실패는 NULL" 을
-- 약속하는데 실제로는 예외가 새어 나가 **그 행을 스치는 질의 전체**가 죽었다 —
-- KONEX 108개사 일괄 조회가 이 3행 때문에 통째로 실패하는 것을 PostgREST 22P02 로 재현.
--
-- 수정: strip 결과가 완전한 숫자 형태(^-?[0-9]+(\.[0-9]+)?$)일 때만 캐스팅, 아니면 NULL.
-- 같은 파일의 ri_parse_tenure_years 가 처음부터 쓰던 패턴(검증 후 캐스팅)과 동일하다 —
-- ri_parse_numeric 만 이 규율을 빠뜨렸던 것. 덤으로 지금까지 던졌을 다른 형태들도
-- 조용히 NULL 이 된다: 중간 하이픈("2023-01-01" → strip 후 그대로 → NULL), 점 두 개,
-- 단독 '-'(기존에는 별도 when 으로 걸렀는데 이제 검증 정규식이 흡수).
--
-- 예외 핸들러(plpgsql BEGIN/EXCEPTION)가 아니라 정규식 검증을 쓴 이유: SQL 함수를
-- 유지해 인라인 최적화가 살고(plpgsql 은 행마다 함수 호출 오버헤드 + 예외 스택),
-- "어떤 입력이 NULL 이 되는가"가 정규식 한 줄로 명시적이다.

create or replace function internal.ri_parse_numeric(raw text)
returns numeric
language sql
immutable
parallel safe
set search_path = pg_catalog, pg_temp
as $$
  select case
           when s ~ '^-?[0-9]+(\.[0-9]+)?$' then s::numeric
           else null
         end
  from (select regexp_replace(coalesce(raw, ''), '[^0-9.\-]', '', 'g') as s) t
$$;

comment on function internal.ri_parse_numeric(text) is
  'report_items payload의 콤마 천단위·부호·%/원/명 등 단위 접미사가 섞인 숫자 문자열을 '
  'numeric으로 정리한다. strip 결과가 완전한 숫자 형태일 때만 캐스팅하고 그 외(결측 "-", '
  '빈 문자열, "8.1%.%" 같은 원문 오기, 중간 하이픈)는 전부 NULL — 절대 던지지 않는다 '
  '(20260823000006, 위월드 22P02 사고). 이 레포의 유일한 정의처 — 각 뷰가 이 함수를 '
  '호출할 뿐 자체 정규식을 반복하지 않는다.';
