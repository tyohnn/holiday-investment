/**
 * 이 페이지 전용 표시 헬퍼.
 * `@investment/schema` 의 포매터는 사실 시계열(fact_date/precision)·payload 단위 변환을
 * 담당하고, 여기는 순수 ISO 날짜 문자열(공시일·정정일 등)을 한국어로 보여주는 것만 한다.
 */
export function formatKoDate(date: string | null | undefined): string {
  if (!date) return '—';
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return date;
  return `${m[1]}.${m[2]}.${m[3]}`;
}

export function dartUrl(rceptNo: string): string {
  return `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`;
}
