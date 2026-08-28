#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""pending 회차 중 I/II/VII(개요·개황·사업·주주)가 없으면 표식만 남긴다.

drain_pending 의 전체 추출(파서·게이트·concept별 replace_scope)을 건너뛰어
'섹션 구조 없음' 회차를 빠르게 pending 에서 뺀다. 해당 섹션이 있으면 손대지
않는다 — 실데이터는 drain_pending 이 파싱한다.
"""
import argparse
import datetime as dt
import json
import os
import sys
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                "..", "..", "..", "..", "platform", "ingest"))
import drain_pending as dp  # noqa: E402
import extract_profile as ep  # noqa: E402
import ingest  # noqa: E402


def _classify(corp, rcept):
    sections, err = ep.load_sections(corp, rcept)
    if err:
        ep.mark_attempted(corp, rcept)
        return "mark_err", err[:160]
    _ov, overview = ep.find_section(
        sections, "I. 회사의 개요", "회사의 개요", "회사의 개황")
    _bz, biz = ep.find_section(sections, "II. 사업의 내용", "사업의 내용")
    _sh, share = ep.find_section(
        sections, "VII. 주주에 관한 사항", "주주에 관한 사항")
    if overview is None and biz is None and share is None:
        titles = ",".join(list(sections)[:8])
        ep.mark_attempted(corp, rcept)
        return "mark_empty", titles[:160]
    return "has_sec", ""


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--kind", required=True, choices=("A", "H", "Q"))
    ap.add_argument("--from-date", required=True)
    ap.add_argument("--to-date")
    ap.add_argument("--walk-back", action="store_true")
    ap.add_argument("--months", default="")
    ap.add_argument("--years", type=int, default=6)
    ap.add_argument("--batch", type=int, default=200)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--log", required=True)
    args = ap.parse_args()

    like = dp._KIND[args.kind]
    done = dp._load_done(args.log)
    print("kind=%s done=%d walk=%s workers=%d" % (
        args.kind, len(done), args.walk_back, args.workers), flush=True)
    ingest.print_target()

    windows = []
    if args.walk_back:
        end = dt.datetime.strptime(args.from_date, "%Y%m%d")
        months = [int(x) for x in args.months.split(",") if x.strip()]
        if not months:
            months = list(dp._SEASON[args.kind])
        for y in range(args.years):
            year = end.year - y
            for m in months:
                s = dt.date(year, m, 1)
                e = dt.date(year, 12, 31) if m == 12 else (
                    dt.date(year, m + 1, 1) - dt.timedelta(days=1))
                windows.append((s.strftime("%Y%m%d"), e.strftime("%Y%m%d"),
                                "y%d-m%02d" % (y, m)))
    else:
        windows.append((args.from_date, args.to_date or args.from_date, "one"))

    os.makedirs(os.path.dirname(args.log) or ".", exist_ok=True)
    n_mark = n_keep = n_fail = 0
    with open(args.log, "a", encoding="utf-8") as log:
        for gte, lte, tag in windows:
            while True:
                pairs = dp._pending_window(like, gte, lte, args.batch, exclude=done)
                pairs = [p for p in pairs
                         if (p["corp_code"], p["rcept_no"]) not in done]
                print("window %s %s..%s pending=%d" % (tag, gte, lte, len(pairs)),
                      flush=True)
                if not pairs:
                    break
                with ThreadPoolExecutor(max_workers=args.workers) as pool:
                    futs = {
                        pool.submit(_classify, p["corp_code"], p["rcept_no"]): p
                        for p in pairs
                    }
                    for fut in as_completed(futs):
                        p = futs[fut]
                        corp, rcept = p["corp_code"], p["rcept_no"]
                        try:
                            status, extra = fut.result()
                        except Exception as e:  # noqa: BLE001
                            status, extra = "exc", "%s: %s" % (type(e).__name__, e)
                            traceback.print_exc()
                        rec = {"corp": corp, "rcept": rcept,
                               "status": status, "extra": extra[:240]}
                        log.write(json.dumps(rec, ensure_ascii=False) + "\n")
                        log.flush()
                        done.add((corp, rcept))
                        if status.startswith("mark"):
                            n_mark += 1
                        elif status == "has_sec":
                            n_keep += 1
                        else:
                            n_fail += 1
                        print("%s %s %s" % (status, corp, rcept), flush=True)
                if len(pairs) < args.batch:
                    break
    print("drain_mark_empty done mark=%d has_sec=%d fail=%d" % (
        n_mark, n_keep, n_fail), flush=True)
    return 0 if n_fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
