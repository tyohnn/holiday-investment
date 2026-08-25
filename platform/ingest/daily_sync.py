#!/usr/bin/env python3
"""OpenDART 신규 공시 일일 증분 수집.

배경: `filings`는 Phase 1(회사 단위 전 역사 적재)로 한 번 채워졌을 뿐 갱신 경로가 없어서,
DART 가 매일 300~1,325건씩 새로 내는 공시가 3주째 안 들어왔다(2026-08-25 시점 max(rcept_dt)
=2026-08-04). 이 스크립트가 그 갱신 경로다.

설계 — `ingest.load_filings()`(회사별 반복)를 재사용하지 않는 이유:
  회사를 순회하면 3,978개사 × 1콜 이상이 든다. list.json 은 corp_code 를 생략하면 **전 법인**
  대상으로 bgn_de~end_de 구간 전체를 한 번에(page_count=100 단위 페이지네이션) 돌려준다 —
  하루치가 대개 3~14콜이다(피크 1,325건/100 ≈ 14). 그래서 여기는 날짜 구간 기반으로 새로
  짠다: `ingest.py`/`backfill.py`(회사 단위 요청/체크포인트 헬퍼)와 `dart_api.py`(HTTP·재시도)를
  최대한 재사용하되, 수집 루프 자체는 이 파일에 둔다.

체크포인트: 별도 테이블을 안 쓴다(요구사항 — filings/filing_docs 외 테이블 쓰기 금지). 대신
`filings.max(rcept_dt)+1일`을 시작점으로 매번 다시 계산한다. 이게 안전하려면 "부분 실패가
최신 날짜만 기록하고 그 전 날짜에 구멍을 남기는" 일이 없어야 한다 — 그래서:
  1. DART 쪽 실패(콜 예산 소진 등)는 **그 실행에서 아무것도 안 쓴다**(구간 전체를 메모리에
     모은 뒤에만 DB 에 쓴다) → 재시도 시 같은 구간을 그대로 다시 긁어도 안전(업서트라 멱등).
  2. DB 쪽 쓰기가 500행 배치 중간에 실패하면(rest() 의 재시도 10회·300초를 다 쓴 뒤에도)
     일부 배치만 반영될 수 있다 — 이때 **최신 날짜부터 반영되면** max(rcept_dt)가 이미 끝난
     것처럼 보여 그 앞 날짜의 구멍을 다음 실행이 건너뛴다. 그래서 쓰기 전에 rcept_dt 오름차순
     으로 정렬한다: 실패는 항상 "아직 못 간 미래 쪽"에서 나고, max(rcept_dt)는 실제로 다
     끝난 지점까지만 전진한다.

우선순위("신규 수집이 백필보다 우선") — KeyPool(ingest_api_quota, 키당 하루 예산)을
backfill.py 와 그대로 공유한다(요구사항). 이 스크립트가 쓰는 콜은 평소 14콜 안팎, 원문까지
받아도 하루 500~1,325콜 — 키당 하루 예산(기본 20,000)의 1% 안팎이라 **예산 자체를 다투는
일은 실질적으로 없다**(작업 지시서의 실측 규모 참고). 진짜 우선순위 보장 수단은 예산 예약이
아니라 **먼저 끝내는 것**이다: 이 스크립트는 cron 등으로 phase3_daily.sh 의 재기동 시각
(00:10 KST)보다 먼저(예: 00:05) 돌리도록 스케줄하면, 그 시점 키 사용량은 하루 중 가장 낮고
이 스크립트가 원하는 콜은 그 예산의 1% 뿐이라 항상 여유가 있다.
남는 리스크는 예산이 아니라 **회계**다 — `KeyPool.flush()`는 그 프로세스가 마지막으로 읽은
시점 이후의 in-memory 사용량을 그대로 덮어쓰므로(마지막 쓰기가 이긴다), 이 스크립트와
phase3 파티션이 **같은 키를 정말 동시에** 쓰면 한쪽의 사용량 기록이 지워질 수 있다(총 호출
자체가 사라지는 게 아니라 장부에서만 사라진다 — DART 쪽 실제 콜은 이미 나갔다). phase3
파티션·스크립트를 건드리지 말라는 지시 때문에 락으로 막을 수 없어서, 운영으로 피한다:
동시 실행을 피할 스케줄(위 00:05 안)을 쓰거나, 두 실행이 겹칠 걸 알면 이 스크립트에
phase3 가 안 쓰는 키만 골라 `DART_API_KEY(S)`로 넘긴다. 이 스크립트 자체가 락을 걸지는
않는다(요구사항 밖).

사용법:
    python3 daily_sync.py --dry-run                 # 콜 0건 — 대상 구간·추정치만
    python3 daily_sync.py                            # 목록만 수집 (기본)
    python3 daily_sync.py --with-docs                # 원문까지 Storage 에 적재
    python3 daily_sync.py --start 2026-08-05 --end 2026-08-05   # 특정 하루만(검증용)
"""
import argparse
import datetime as dt
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO = os.path.dirname(os.path.dirname(_HERE))
sys.path.insert(0, _HERE)
sys.path.insert(0, os.path.join(_REPO, "plugin", "skills", "company-analysis", "scripts"))
import ingest             # noqa: E402  rest·upsert·dedupe_by·d8·CORRECTION_RE·print_target 재사용
import backfill as bf     # noqa: E402  KeyPool·재시도/쿼터 몽키패치·resolve_keys 재사용
import dart_api as api    # noqa: E402

# 전 법인 대상 list.json 한 창의 총 공시량이 회사 단위보다 훨씬 크다(회사 1개 대신 하루 최대
# 1,325건 안팎) — ingest.load_filings() 의 "연 단위 창" 관례보다 촘촘하게 잡아 안전 마진을
# 둔다. 정상 일일 실행(구간=1일)은 창이 하나뿐이라 이 상수와 무관하다 — 최초 실행처럼 며칠
# 밀린 구간을 한 번에 따라잡을 때만 여러 창으로 쪼갠다.
MAX_WINDOW_DAYS = 31

# 작업 지시서(2026-08-25)가 재둔 실측 벤치마크 — 드라이런의 "몇 건" 추정치 근거.
# DART API 를 부르지 않고도(=드라이런이 오프라인에서도 의미 있게) 자릿수 감을 주기 위함이지
# 정밀 카운트가 아니다.
BENCH_NORMAL_LO, BENCH_NORMAL_HI, BENCH_PEAK = 300, 650, 1325
PAGE_SIZE = 100


def resolve_start_date(explicit):
    if explicit:
        return dt.date.fromisoformat(explicit)
    rows = ingest.rest("GET", "filings?select=rcept_dt&order=rcept_dt.desc&limit=1")
    if not rows:
        raise SystemExit(
            "filings 가 비어 있고 --start 도 안 줬다 — 이 스크립트는 증분 갱신 전용이다. "
            "최초 적재(전 역사)는 backfill.py 의 몫이고, 빈 테이블에서 여기를 그냥 돌리면 "
            "corp_code 없이 전 법인을 무제한으로 긁는 사고가 난다. --start 를 명시해라.")
    max_dt = dt.date.fromisoformat(rows[0]["rcept_dt"])
    return max_dt + dt.timedelta(days=1)


def resolve_end_date(explicit):
    return dt.date.fromisoformat(explicit) if explicit else dt.date.today()


def split_windows(start, end, max_span_days=MAX_WINDOW_DAYS):
    windows, cur = [], start
    while cur <= end:
        w_end = min(cur + dt.timedelta(days=max_span_days - 1), end)
        windows.append((cur, w_end))
        cur = w_end + dt.timedelta(days=1)
    return windows


def fetch_company_universe():
    """companies.corp_code 전체 — filings.corp_code 는 companies 를 FK 로 참조하므로, list.json
    이 돌려주는 corp_code 중 이 집합에 없는 것(비상장·개인 등 — corpCode.xml 의 상장사만
    ingest_corps/companies 로 들어온다, AGENTS.md 참고)은 그대로 upsert 하면 FK 위반(23503)으로
    배치 전체가 실패한다 — 그래서 쓰기 전에 미리 걸러낸다."""
    rows, offset = [], 0
    while True:
        page = ingest.rest(
            "GET", "companies?select=corp_code&order=corp_code&limit=1000&offset=%d" % offset)
        rows.extend(page)
        if len(page) < 1000:
            break
        offset += 1000
    return {r["corp_code"] for r in rows}


def fetch_filings_range(pool, bgn_de, end_de):
    """[bgn_de, end_de](YYYYMMDD) 구간의 공시 목록 전체 — corp_code 없이 전 법인 대상,
    page_count=100 페이지네이션. 콜마다 pool.next_key() 로 키를 다시 받으므로, 페이지 도중
    한 키가 소진돼도(020) 같은 page_no 를 다른 키로 이어서 시도한다 — 페이지를 잃지 않는다.
    모든 키가 소진되면 예외를 던진다(지금까지 모은 rows 는 호출자가 아직 안 썼으므로 안전 —
    모듈 docstring의 '아무것도 안 쓴다' 설계)."""
    rows, page = [], 1
    while True:
        key = pool.next_key()
        if key is None:
            raise RuntimeError(
                "쿼터 소진 — list.json 수집 미완료(%s~%s, %d건 모은 뒤 page=%d에서 중단)"
                % (bgn_de, end_de, len(rows), page))
        try:
            d = api.call_json(key, "list.json", raw=True,
                              bgn_de=bgn_de, end_de=end_de,
                              page_no=page, page_count=PAGE_SIZE)
        except bf.QuotaExhausted as e:
            pool.mark_exhausted(e.key)
            continue  # 같은 page_no 를 다음 키로 재시도
        if not d:
            break  # 013 데이터 없음
        rows.extend(d.get("list", []))
        if page >= int(d.get("total_page", 1) or 1):
            break
        page += 1
    return rows


def run_docs_with_rotation(pool, items, redo):
    """load_docs_for_rcepts 를 감싸 쿼터 소진 시 키를 돌려가며 이어서 처리한다.
    items 는 ingest.load_docs_for_rcepts 가 in-place 로 줄인다 — 여기서 반복해도 이미 처리한
    항목은 다시 안 건드린다."""
    ok_total = err_total = 0
    while items:
        key = pool.next_key()
        if key is None:
            print("  [원문] 쿼터 소진 — %d건 미처리로 남음(다음 실행이 이어감, filings 는 이미 "
                  "적재됐으니 유실 아님)" % len(items))
            break
        try:
            ok, err = ingest.load_docs_for_rcepts(key, items, redo=redo)
            ok_total += ok
            err_total += err
        except bf.QuotaExhausted as e:
            pool.mark_exhausted(e.key)
            continue
    return ok_total, err_total, len(items)


def print_dry_run(start, end, n_days, with_docs):
    est_lo, est_hi, est_peak = (n_days * BENCH_NORMAL_LO, n_days * BENCH_NORMAL_HI,
                                 n_days * BENCH_PEAK)
    calls_lo, calls_hi, calls_peak = (-(-est_lo // PAGE_SIZE), -(-est_hi // PAGE_SIZE),
                                       -(-est_peak // PAGE_SIZE))
    print("=== DRY RUN — 실제 DART 호출 0건 (PostgREST 로 시작일만 조회) ===")
    print("대상 구간: %s ~ %s (%d일)" % (start, end, n_days))
    print("추정 공시 건수: 평상시 %d~%d건 · 3월 피크 가정 %d건"
          " (실측 벤치마크 기반 추정 — 정확한 값은 API 호출 없이는 모른다)"
          % (est_lo, est_hi, est_peak))
    print("추정 list.json 콜 수(%d건/페이지): 평상시 %d~%d콜 · 피크 가정 %d콜"
          % (PAGE_SIZE, calls_lo, calls_hi, calls_peak))
    windows = split_windows(start, end)
    if len(windows) > 1:
        print("창 분할(%d일 단위): %d개 — %s" %
              (MAX_WINDOW_DAYS, len(windows),
               ", ".join("%s~%s" % (w[0], w[1]) for w in windows)))
    if with_docs:
        print("--with-docs: 원문 콜은 대략 위 건수와 1:1 (공시 1건 = document.xml 1콜)"
              " — 평상시 %d~%d콜 · 피크 가정 %d콜 추가" % (est_lo, est_hi, est_peak))


def main():
    p = argparse.ArgumentParser(description="OpenDART 신규 공시 일일 증분 수집")
    p.add_argument("--start", help="시작일 YYYY-MM-DD (기본: filings.max(rcept_dt)+1일)")
    p.add_argument("--end", help="종료일 YYYY-MM-DD (기본: 오늘)")
    p.add_argument("--with-docs", action="store_true",
                    help="공시 원문도 Storage(docs/<corp_code>/<rcept_no>.zip)에 적재 — 기본은 목록만")
    p.add_argument("--redo-docs", action="store_true",
                    help="--with-docs 와 함께: 이미 받은(status=ok) rcept_no 도 다시 받는다")
    p.add_argument("--dry-run", action="store_true", help="DART 호출 없이 대상 구간·추정치만 출력")
    p.add_argument("--budget", type=int, default=bf.DEFAULT_DAILY_BUDGET,
                    help="키당 일일 호출 예산(backfill.py 와 같은 ingest_api_quota 공유)")
    args = p.parse_args()

    ingest.print_target()

    start = resolve_start_date(args.start)
    end = resolve_end_date(args.end)
    if start > end:
        print("이미 최신 — max(rcept_dt)+1일(%s) 이 종료일(%s) 이후라 신규 구간 없음" % (start, end))
        return
    n_days = (end - start).days + 1
    print("대상 구간: %s ~ %s (%d일)" % (start, end, n_days))

    if args.dry_run:
        print_dry_run(start, end, n_days, args.with_docs)
        return

    company_set = fetch_company_universe()
    print("companies 유니버스: %d개(상장사만 — 비상장·개인 등 corp_code 는 FK 상 filings 에 못 들어감)"
          % len(company_set))

    keys = bf.resolve_keys()
    if not keys:
        print("DART_API_KEY(S) 없음 — .env.local 또는 DART_API_KEYS/DART_API_KEY 확인", file=sys.stderr)
        sys.exit(2)
    today = dt.date.today().isoformat()
    pool = bf.KeyPool(keys, args.budget, today)
    bf.install_patches(on_call=pool.record_call)

    calls_before = sum(pool.used.values())
    windows = split_windows(start, end)
    raw_rows = []
    try:
        for w_start, w_end in windows:
            raw_rows.extend(fetch_filings_range(
                pool, w_start.strftime("%Y%m%d"), w_end.strftime("%Y%m%d")))
    finally:
        try:
            pool.flush()
        except Exception as e:
            print("  [기록 실패] pool.flush — %s" % str(e)[:300], file=sys.stderr)

    calls_used = sum(pool.used.values()) - calls_before
    print("DART 호출: %d건 (list.json)" % calls_used)
    print("수집된 목록(전 법인, 구간 내): %d건" % len(raw_rows))

    known, unknown_n = [], 0
    for r in raw_rows:
        if r.get("corp_code") in company_set:
            known.append(r)
        else:
            unknown_n += 1
    if unknown_n:
        print("companies 미매칭(비상장·개인 등 추정) %d건 — filings 에 넣지 않음(정상, FK 설계상)"
              % unknown_n)

    db_rows = [{
        "rcept_no": r["rcept_no"], "corp_code": r["corp_code"],
        "report_nm": r.get("report_nm", ""), "flr_nm": r.get("flr_nm"),
        "rcept_dt": ingest.d8(r.get("rcept_dt")), "rm": r.get("rm"),
        "is_correction": bool(ingest.CORRECTION_RE.search(r.get("report_nm", ""))),
    } for r in known if r.get("rcept_no")]
    db_rows = ingest.dedupe_by(db_rows, ("rcept_no",), "filings(daily_sync)")
    # 오름차순 정렬 — 배치 쓰기가 도중에 실패해도 "최신 날짜는 반영됐는데 그 전 날짜에 구멍"이
    # 안 생기게 한다(모듈 docstring 참고, 다음 실행의 시작점은 max(rcept_dt)+1일 뿐이라서).
    db_rows.sort(key=lambda r: (r["rcept_dt"] or "", r["rcept_no"]))

    ingest.upsert("filings", db_rows, on_conflict="rcept_no")
    n_corr = sum(1 for r in db_rows if r["is_correction"])
    print("filings 적재: %d건 (정정 %d)" % (len(db_rows), n_corr))

    if args.with_docs and db_rows:
        items = [(r["corp_code"], r["rcept_no"]) for r in db_rows]
        ok, err, left = run_docs_with_rotation(pool, items, args.redo_docs)
        try:
            pool.flush()
        except Exception as e:
            print("  [기록 실패] pool.flush(docs) — %s" % str(e)[:300], file=sys.stderr)
        print("filing_docs(원문): 성공 %d · 실패 %d · 미처리(쿼터소진) %d" % (ok, err, left))

    print("완료")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        print("실패: %s" % str(e)[:1000], file=sys.stderr)
        sys.exit(1)
