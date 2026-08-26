#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ok 원문 정기보고서 중 섹션이 없는 회차를 날짜 창으로 추출한다.

주석(drain_notes)은 sections.json.gz 가 있어야 돌아간다. docs_storage.py 는
회사 목록(--corps)만 받아 전량 창이 없다. 이 스크립트는 drain_pending 과 같이
rcept_dt 창만 REST 로 받아 extract_one 한다. DART 호출 0건.
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
import docs_storage as ds  # noqa: E402
import ingest  # noqa: E402

_KIND = {
    "A": "*사업보고서 (*",
    "H": "*반기보고서 (*",
    "Q": "*분기보고서 (*",
}
_SEASON = {
    "A": (3, 4),
    "H": (8, 9),
    "Q": (5, 8, 11),
}


_PAGE = 500
_SCAN_CAP = 10000


def _pending_window(report_like, gte, lte, n=80):
    """창 안 ok 원문 중 sections_extracted_at 이 없는 쌍을 최대 n개."""
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
            "filing_docs?select=rcept_no,status,storage_path,sections_extracted_at"
            "&rcept_no=in.(" + ",".join(rcepts) + ")")
        need = {}
        for d in (docs or []):
            if d.get("status") == "ok" and d.get("storage_path") \
                    and not d.get("sections_extracted_at"):
                need[d["rcept_no"]] = d["storage_path"]
        for r in rows:
            if "제출기한연장" in (r.get("report_nm") or ""):
                continue
            path = need.get(r["rcept_no"])
            if path:
                out.append({"corp_code": r["corp_code"], "rcept_no": r["rcept_no"],
                            "storage_path": path})
                if len(out) >= n:
                    break
        offset += _PAGE
        if offset % 1000 == 0:
            print("  sections scan %s..%s offset=%d found=%d" % (gte, lte, offset, len(out)),
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
        if rec.get("status") == "ok":
            done.add((rec["corp"], rec["rcept"]))
    return done


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--kind", required=True, choices=("A", "H", "Q"))
    ap.add_argument("--from-date", required=True)
    ap.add_argument("--to-date")
    ap.add_argument("--walk-back", action="store_true")
    ap.add_argument("--months", default="")
    ap.add_argument("--years", type=int, default=4)
    ap.add_argument("--batch", type=int, default=80)
    ap.add_argument("--log", required=True)
    args = ap.parse_args()

    like = _KIND[args.kind]
    done = _load_done(args.log)
    print("kind=%s done=%d walk=%s" % (args.kind, len(done), args.walk_back), flush=True)
    ingest.print_target()

    windows = []
    if args.walk_back:
        end = dt.datetime.strptime(args.from_date, "%Y%m%d")
        months = [int(x) for x in args.months.split(",") if x.strip()]
        if not months:
            months = list(_SEASON[args.kind])
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
    n_ok = n_fail = 0
    with open(args.log, "a", encoding="utf-8") as log:
        for gte, lte, tag in windows:
            while True:
                pairs = _pending_window(like, gte, lte, args.batch)
                pairs = [p for p in pairs
                         if (p["corp_code"], p["rcept_no"]) not in done]
                print("window %s %s..%s pending=%d" % (tag, gte, lte, len(pairs)),
                      flush=True)
                if not pairs:
                    break
                for i, p in enumerate(pairs, 1):
                    corp, rcept = p["corp_code"], p["rcept_no"]
                    print("######## %d/%d %s %s ########" % (i, len(pairs), corp, rcept),
                          flush=True)
                    status, extra, n = "ok", "", 0
                    try:
                        n = ds.extract_one(p, corp)
                        extra = "n_sections=%d" % n
                    except Exception as e:  # noqa: BLE001
                        status = "exc"
                        extra = "%s: %s" % (type(e).__name__, e)
                        traceback.print_exc()
                    rec = {"corp": corp, "rcept": rcept, "status": status,
                           "n": n, "extra": extra[:240]}
                    log.write(json.dumps(rec, ensure_ascii=False) + "\n")
                    log.flush()
                    print("=> %s %s" % (status, extra[:120]), flush=True)
                    if status == "ok":
                        done.add((corp, rcept))
                        n_ok += 1
                    else:
                        n_fail += 1
                if len(pairs) < args.batch:
                    break
    print("drain_sections done ok=%d fail=%d" % (n_ok, n_fail), flush=True)
    return 0 if n_fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
