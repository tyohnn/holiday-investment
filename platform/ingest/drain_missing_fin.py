#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""2015+ ok 정기보고서 중 fin_periods 가 없는 (corp, year, reprt) 만 DART 로 채운다.

fnlttSinglAcntAll 은 2015부터다. pre-2015 은 이 경로로 못 채운다.
적재 후 회사별로 internal.fin_periods_refresh 를 호출하는 건 운영자가 SQL 로 한다
(PostgREST 는 internal 스키마를 안 연다). 이 스크립트는 financial_facts 만 쓴다.

    python3 drain_missing_fin.py --kind A --log /tmp/logs/drain-fin-a.jsonl
    python3 drain_missing_fin.py --kind Q --log /tmp/logs/drain-fin-q.jsonl
"""
import argparse
import json
import os
import sys
import traceback

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO = os.path.dirname(os.path.dirname(_HERE))
sys.path.insert(0, _HERE)
sys.path.insert(0, os.path.join(_REPO, "plugin", "skills", "company-analysis", "scripts"))
import backfill as bf  # noqa: E402
import dart_api as api  # noqa: E402
import ingest  # noqa: E402

_KIND = {
    "A": ("*사업보고서 (*", "11011", None),
    "H": ("*반기보고서 (*", "11012", None),
    "Q": ("*분기보고서 (*", None, True),
}
_PAGE = 500
_SCAN_CAP = 20000


def _year_month(report_nm):
    import re
    m = re.search(r"\((\d{4})\.(\d{2})", report_nm or "")
    if not m:
        return None, None
    return int(m.group(1)), int(m.group(2))


def _reprt_of(kind, report_nm):
    like, fixed, _q = _KIND[kind]
    if fixed:
        return fixed
    _y, mo = _year_month(report_nm)
    if mo is None:
        return None
    if mo <= 3:
        return "11013"
    if 7 <= mo <= 9:
        return "11014"
    return None


def _period_key(kind, year, reprt):
    if reprt == "11011":
        return "%dA" % year
    if reprt == "11013":
        return "%dQ1" % year
    if reprt == "11012":
        return "%dQ2" % year
    if reprt == "11014":
        return "%dQ3" % year
    return None


def _have_periods(pairs):
    """(corp, period_key) 목록 중 이미 fin_periods 에 있는 것을  mo은다."""
    have = set()
    corps = sorted({c for (c, _k) in pairs})
    for i in range(0, len(corps), 80):
        chunk = corps[i:i + 80]
        keys = sorted({k for (c, k) in pairs if c in set(chunk)})
        if not chunk or not keys:
            continue
        rows = ingest.rest("GET",
            "fin_periods?select=corp_code,period_key&corp_code=in.("
            + ",".join(chunk) + ")&period_key=in.(" + ",".join(keys)
            + ")&limit=1000")
        for r in (rows or []):
            have.add((r["corp_code"], r["period_key"]))
    return have


def _discover(kind, since_year):
    like = _KIND[kind][0]
    enc = __import__("urllib.parse").parse.quote(like, safe="")
    # 사업보고서는 다음 해 3월 접수, 분기·반기는 해당 연도에 접수.
    gte = ("%d0301" % (since_year + 1)) if kind == "A" else ("%d0101" % since_year)
    cand, seen = [], set()
    offset = 0
    while offset < _SCAN_CAP:
        rows = ingest.rest("GET",
            "filings?select=corp_code,rcept_no,report_nm"
            "&report_nm=like." + enc
            + "&rcept_dt=gte." + gte
            + "&order=rcept_dt.desc,rcept_no.desc"
            + "&limit=%d&offset=%d" % (_PAGE, offset))
        if not rows:
            break
        rcepts = [r["rcept_no"] for r in rows
                  if "제출기한연장" not in (r.get("report_nm") or "")]
        ok = set()
        if rcepts:
            docs = ingest.rest("GET",
                "filing_docs?select=rcept_no,status&rcept_no=in.("
                + ",".join(rcepts) + ")")
            ok = {d["rcept_no"] for d in (docs or []) if d.get("status") == "ok"}
        for r in rows:
            if r["rcept_no"] not in ok:
                continue
            year, _mo = _year_month(r.get("report_nm"))
            if year is None or year < since_year:
                continue
            reprt = _reprt_of(kind, r.get("report_nm"))
            if not reprt:
                continue
            key = (r["corp_code"], year, reprt)
            if key in seen:
                continue
            seen.add(key)
            pkey = _period_key(kind, year, reprt)
            if not pkey:
                continue
            cand.append((r["corp_code"], year, reprt, pkey))
        offset += _PAGE
        if offset % 2000 == 0:
            print("  discover offset=%d cand=%d" % (offset, len(cand)), flush=True)
        if len(rows) < _PAGE:
            break
    have = _have_periods([(c, k) for (c, _y, _r, k) in cand])
    jobs = [{"corp": c, "year": y, "reprt": r}
            for (c, y, r, k) in cand if (c, k) not in have]
    return jobs


def _load_done(path):
    done = set()
    if not os.path.exists(path):
        return done
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if not line:
            continue
        rec = json.loads(line)
        if rec.get("corp") and rec.get("year") and rec.get("reprt"):
            done.add((rec["corp"], rec["year"], rec["reprt"]))
    return done


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--kind", required=True, choices=("A", "H", "Q"))
    ap.add_argument("--since", type=int, default=ingest.FIN_START_DEFAULT)
    ap.add_argument("--log", required=True)
    ap.add_argument("--jobs", default="", help="미리 뽑은 jsonl (corp,year,reprt)")
    args = ap.parse_args()

    keys = bf.resolve_keys()
    if not keys:
        print("DART_API_KEY(S) 없음", flush=True)
        return 2
    ingest.print_target()
    print("kind=%s keys=%d since=%d" % (args.kind, len(keys), args.since), flush=True)

    done = _load_done(args.log)
    if args.jobs:
        jobs = []
        for line in open(args.jobs, encoding="utf-8"):
            rec = json.loads(line)
            jobs.append({"corp": rec["corp"], "year": int(rec["year"]),
                         "reprt": rec["reprt"]})
    else:
        jobs = _discover(args.kind, args.since)
    jobs = [j for j in jobs if (j["corp"], j["year"], j["reprt"]) not in done]
    print("jobs=%d (skip_log=%d)" % (len(jobs), len(done)), flush=True)

    os.makedirs(os.path.dirname(args.log) or ".", exist_ok=True)
    ki = 0
    n_ok = n_empty = n_fail = 0
    with open(args.log, "a", encoding="utf-8") as log:
        for i, j in enumerate(jobs, 1):
            corp, year, reprt = j["corp"], j["year"], j["reprt"]
            key = keys[ki % len(keys)]
            ki += 1
            status, extra, n = "ok", "", 0
            try:
                rows, fs = api.finstate_all(key, corp, year, reprt=reprt)
                if not rows:
                    status, extra = "empty", "no_dart"
                else:
                    n = ingest.write_fin_scope(corp, year, reprt, fs, rows)
                    extra = "fs=%s n=%d" % (fs, n)
            except Exception as e:  # noqa: BLE001
                status, extra = "exc", "%s: %s" % (type(e).__name__, e)
                traceback.print_exc()
            rec = {"corp": corp, "year": year, "reprt": reprt,
                   "status": status, "n": n, "extra": extra[:200]}
            log.write(json.dumps(rec, ensure_ascii=False) + "\n")
            log.flush()
            if status == "ok":
                n_ok += 1
            elif status == "empty":
                n_empty += 1
            else:
                n_fail += 1
            print("%d/%d %s %s %s %s n=%s" % (
                i, len(jobs), corp, year, reprt, status, n), flush=True)
    print("drain_missing_fin done ok=%d empty=%d fail=%d" % (n_ok, n_empty, n_fail),
          flush=True)
    return 0 if n_fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
