#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ok 원문 정기보고서 중 fin_details 가 없는 회차를 날짜 창으로 계속 적재한다.

extract_profile.pending() 전량 페이지는 호스티드에서 타임아웃이 난다. 이 스크립트는
rcept_dt 창(기본: 각 해 3월 사업보고서 시즌, 반기 8월, 분기 5월)만 REST 로 받아
(corp, rcept) 1:1 로 extract_profile.run 한다. --walk-back 이면 같은 달 창을
한 해씩 과거로 옮기며 Phase 3 신규분(--recent-days)도 한 바퀴마다 다시 본다.

사용:
    python3 drain_pending.py --kind A --from-date 20220301 --to-date 20220331
    python3 drain_pending.py --kind A --walk-back --from-date 20220331 --years 8
    python3 drain_pending.py --kind Q --walk-back --from-date 20260520 --years 4
"""
import argparse
import datetime as dt
import json
import os
import sys
import traceback
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                "..", "..", "..", "..", "platform", "ingest"))
import extract_profile as ep  # noqa: E402
import ingest  # noqa: E402

_KIND = {
    "A": "*사업보고서 (*",
    "H": "*반기보고서 (*",
    "Q": "*분기보고서 (*",
}
# walk-back 에 --months 를 안 주면 접수 시즌 전체를 연다.
# 반기를 9월만 보면 8월 회차가 통째로 남는다(2014 창이 21건에서 끝난 이유).
_SEASON = {
    "A": (3, 4),
    "H": (8, 9),
    "Q": (5, 8, 11),
}


# PostgREST 상한 1000. 11월 분기 시즌은 한 달에 2천 건이 넘어 예전
# limit=200 / offset<4000 이면 창 끝 미적재가 스캔 밖으로 남았다.
_PAGE = 500
_SCAN_CAP = 10000


def _pending_window(report_like, gte, lte, n=400, exclude=None):
    """창 안 ok 원문 중 fin_details.source_rcept_no 가 없는 쌍을 최대 n개."""
    sql_like = report_like.replace("*", "%")
    exclude_rcepts = sorted({r for (_c, r) in (exclude or set())})
    try:
        rows = ingest.rest("POST", "rpc/pending_profile_rcepts", {
            "report_like": sql_like, "dt_gte": gte, "dt_lte": lte, "n": n,
            "exclude_rcepts": exclude_rcepts,
        })
        if rows is not None:
            return [{"corp_code": r["corp_code"], "rcept_no": r["rcept_no"]}
                    for r in rows]
    except Exception as e:  # noqa: BLE001
        print("  rpc pending_profile_rcepts fallback: %s" % e, flush=True)
    out, offset = [], 0
    like = urllib.parse.quote(report_like, safe="")
    while len(out) < n and offset < _SCAN_CAP:
        q = (
            "filings?select=corp_code,rcept_no,rcept_dt,report_nm"
            "&report_nm=like." + like
            + "&rcept_dt=gte." + gte
            + "&rcept_dt=lte." + lte
            + "&order=rcept_dt.desc,rcept_no.desc"
            + "&limit=" + str(_PAGE) + "&offset=" + str(offset)
        )
        rows = ingest.rest("GET", q)
        if not rows:
            break
        rcepts = [r["rcept_no"] for r in rows]
        docs = ingest.rest("GET",
            "filing_docs?select=rcept_no,status,storage_path&rcept_no=in.("
            + ",".join(rcepts) + ")")
        ok = {d["rcept_no"] for d in (docs or [])
              if d.get("status") == "ok" and d.get("storage_path")}
        dets = ingest.rest("GET",
            "fin_details?select=source_rcept_no&source_rcept_no=in.("
            + ",".join(rcepts) + ")")
        have = {d["source_rcept_no"] for d in (dets or [])}
        for r in rows:
            if "제출기한연장" in (r.get("report_nm") or ""):
                continue
            if r["rcept_no"] in ok and r["rcept_no"] not in have:
                out.append({"corp_code": r["corp_code"], "rcept_no": r["rcept_no"]})
                if len(out) >= n:
                    break
        offset += _PAGE
        if offset % 1000 == 0:
            print("  pending scan %s..%s offset=%d found=%d" % (gte, lte, offset, len(out)),
                  flush=True)
        if len(rows) < _PAGE:
            break
    return out


def _load_done(log_path):
    done = set()
    if not os.path.exists(log_path):
        return done
    for line in open(log_path, encoding="utf-8"):
        line = line.strip()
        if not line:
            continue
        rec = json.loads(line)
        # ok 만이 아니라 fail/exc 도 건너뛴다. 한 회차가 REST 재시도에
        # 몇 분씩 묶이면 창 전체가 멈춘다. 재시도는 로그를 지운 뒤 한다.
        if rec.get("corp") and rec.get("rcept"):
            done.add((rec["corp"], rec["rcept"]))
    return done


def _extract_pairs(pairs, log_path, done):
    os.makedirs(os.path.dirname(log_path) or ".", exist_ok=True)
    n_ok = n_fail = 0
    with open(log_path, "a", encoding="utf-8") as log:
        for i, p in enumerate(pairs, 1):
            corp, rcept = p["corp_code"], p["rcept_no"]
            if (corp, rcept) in done:
                continue
            print("\n######## %d/%d %s %s ########" % (i, len(pairs), corp, rcept),
                  flush=True)
            status, extra = "ok", ""
            try:
                fails = ep.run([corp], [rcept], do_load=True)
                if fails:
                    status = "fail"
                    extra = (fails[0].get("exc_msg") or "")[:200]
            except Exception as e:  # noqa: BLE001
                status = "exc"
                extra = "%s: %s" % (type(e).__name__, e)
                traceback.print_exc()
            rec = {"corp": corp, "rcept": rcept, "status": status, "extra": extra[:240]}
            log.write(json.dumps(rec, ensure_ascii=False) + "\n")
            log.flush()
            print("=> %s %s" % (status, extra[:120]), flush=True)
            if status == "ok":
                done.add((corp, rcept))
                n_ok += 1
            else:
                n_fail += 1
    return n_ok, n_fail


def _shift_year(yyyymmdd, years):
    d = dt.datetime.strptime(yyyymmdd, "%Y%m%d")
    try:
        return (d.replace(year=d.year + years)).strftime("%Y%m%d")
    except ValueError:
        return (d.replace(day=28, year=d.year + years)).strftime("%Y%m%d")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--kind", required=True, choices=("A", "H", "Q"))
    ap.add_argument("--from-date", required=True, help="YYYYMMDD 창 시작(또는 walk-back 의 최신일)")
    ap.add_argument("--to-date", help="YYYYMMDD 창 끝. 없으면 from-date 의 같은 달 말일")
    ap.add_argument("--walk-back", action="store_true",
                    help="같은 달 창을 한 해씩 과거로 옮기며 반복")
    ap.add_argument("--months", default="",
                    help="쉼표 월(예: 5,8,11). 비우면 kind 시즌(A=3·4, H=8·9, Q=5·8·11)")
    ap.add_argument("--years", type=int, default=6, help="walk-back 연수")
    ap.add_argument("--recent-days", type=int, default=0,
                    help="창 앞에 최근 N일 Phase 3 증분을 한 번 훑음. 0 이면 생략(--loop 가 담당)")
    ap.add_argument("--batch", type=int, default=250)
    ap.add_argument("--loop", action="store_true",
                    help="창을 비운 뒤 최근 --recent-days 를 다시 본다 (Phase 3 증분)")
    ap.add_argument("--sleep", type=int, default=90)
    ap.add_argument("--log", required=True)
    ap.add_argument("--count", action="store_true",
                    help="창별 pending 만 찍고 추출하지 않는다 (잔량 실측)")
    args = ap.parse_args()

    like = _KIND[args.kind]
    done = _load_done(args.log)
    print("kind=%s done=%d walk=%s" % (args.kind, len(done), args.walk_back), flush=True)
    ingest.print_target()

    windows = []
    if args.recent_days:
        today = dt.date.today()
        start = today - dt.timedelta(days=args.recent_days)
        windows.append((start.strftime("%Y%m%d"), today.strftime("%Y%m%d"), "recent"))
    if args.walk_back:
        end = dt.datetime.strptime(args.from_date, "%Y%m%d")
        months = [int(x) for x in args.months.split(",") if x.strip()]
        if not months:
            months = list(_SEASON[args.kind])
        for y in range(args.years):
            year = end.year - y
            for m in months:
                s = dt.date(year, m, 1)
                if m == 12:
                    e = dt.date(year, 12, 31)
                else:
                    e = dt.date(year, m + 1, 1) - dt.timedelta(days=1)
                windows.append((s.strftime("%Y%m%d"), e.strftime("%Y%m%d"),
                                "y%d-m%02d" % (y, m)))
    else:
        gte = args.from_date
        lte = args.to_date or args.from_date
        windows.append((gte, lte, "one"))

    def _run(wins):
        n_ok = n_fail = 0
        for gte, lte, tag in wins:
            while True:
                pairs = _pending_window(like, gte, lte, args.batch, exclude=done)
                pairs = [p for p in pairs if (p["corp_code"], p["rcept_no"]) not in done]
                print("window %s %s..%s pending=%d" % (tag, gte, lte, len(pairs)), flush=True)
                if not pairs:
                    break
                if args.count:
                    break
                ok, fail = _extract_pairs(pairs, args.log, done)
                n_ok += ok
                n_fail += fail
                if len(pairs) < args.batch:
                    break
        return n_ok, n_fail

    if args.count:
        args.batch = max(args.batch, 4000)
        _run(windows)
        return 0

    total_ok, total_fail = _run(windows)
    while args.loop:
        print("loop sleep %ds then recent %dd" % (args.sleep, args.recent_days or 20),
              flush=True)
        import time
        time.sleep(args.sleep)
        today = dt.date.today()
        start = today - dt.timedelta(days=args.recent_days or 20)
        extra_ok, extra_fail = _run([(
            start.strftime("%Y%m%d"), today.strftime("%Y%m%d"), "recent-loop")])
        total_ok += extra_ok
        total_fail += extra_fail
    print("drain done ok=%d fail=%d" % (total_ok, total_fail), flush=True)
    return 0 if total_fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
