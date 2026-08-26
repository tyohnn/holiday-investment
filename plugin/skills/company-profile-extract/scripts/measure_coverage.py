#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ok 원문 정기보고서 대비 프로필(fin_details)·주석(NOTE) 잔량을 연·종류별로 센다.

호스티드에서 전량 조인은 타임아웃이 나서, 해마다 rcept_dt 창만 받아
filing_docs / fin_details / NOTE rcept 를 in.() 으로 교차한다.
"""
import argparse
import collections
import json
import os
import sys
import urllib.parse

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                "..", "..", "..", "..", "platform", "ingest"))
import ingest  # noqa: E402

KIND = {
    "A": "*사업보고서 (*",
    "H": "*반기보고서 (*",
    "Q": "*분기보고서 (*",
}


def _page_filings(like, gte, lte):
    out, offset = [], 0
    qlike = urllib.parse.quote(like, safe="")
    while offset < 20000:
        rows = ingest.rest("GET",
            "filings?select=corp_code,rcept_no,rcept_dt,report_nm"
            "&report_nm=like." + qlike
            + "&rcept_dt=gte." + gte
            + "&rcept_dt=lte." + lte
            + "&order=rcept_dt.desc,rcept_no.desc"
            + "&limit=200&offset=" + str(offset))
        if not rows:
            break
        for r in rows:
            if "제출기한연장" in (r.get("report_nm") or ""):
                continue
            out.append(r)
        if len(rows) < 200:
            break
        offset += 200
    return out


def _in_chunks(ids, n=80):
    for i in range(0, len(ids), n):
        yield ids[i:i + n]


def _status_sets(rcepts):
    ok, profiled, noted = set(), set(), set()
    for chunk in _in_chunks(rcepts):
        joined = ",".join(chunk)
        docs = ingest.rest("GET",
            "filing_docs?select=rcept_no,status,storage_path,sections_extracted_at"
            "&rcept_no=in.(" + joined + ")")
        for d in docs or []:
            if d.get("status") == "ok" and d.get("storage_path"):
                ok.add(d["rcept_no"])
        dets = ingest.rest("GET",
            "fin_details?select=source_rcept_no&source_rcept_no=in.("
            + joined + ")")
        profiled.update(d["source_rcept_no"] for d in (dets or []))
        notes = ingest.rest("GET",
            "financial_facts?select=rcept_no&sj_div=eq.NOTE&rcept_no=in.("
            + joined + ")")
        noted.update(n["rcept_no"] for n in (notes or []))
    return ok, profiled, noted


def measure_kind(kind, year_from, year_to):
    like = KIND[kind]
    rows = []
    for year in range(year_to, year_from - 1, -1):
        gte, lte = "%d0101" % year, "%d1231" % year
        print("  scan %s %s.." % (kind, year), flush=True)
        filings = _page_filings(like, gte, lte)
        rcepts = [f["rcept_no"] for f in filings]
        ok, profiled, noted = _status_sets(rcepts) if rcepts else (set(), set(), set())
        ok_n = len(ok)
        pend = len(ok - profiled)
        note_n = len(ok & noted)
        rows.append({
            "kind": kind, "year": year, "filings": len(filings),
            "ok": ok_n, "profiled": ok_n - pend, "pending": pend,
            "notes": note_n,
        })
        print("    ok=%d pending=%d notes=%d" % (ok_n, pend, note_n), flush=True)
    return rows


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--kinds", default="A,H,Q")
    ap.add_argument("--from-year", type=int, default=2004)
    ap.add_argument("--to-year", type=int, default=2026)
    ap.add_argument("--out", default="")
    args = ap.parse_args()
    ingest.print_target()
    all_rows = []
    for kind in [k.strip() for k in args.kinds.split(",") if k.strip()]:
        all_rows.extend(measure_kind(kind, args.from_year, args.to_year))
    totals = collections.defaultdict(lambda: {
        "ok": 0, "pending": 0, "profiled": 0, "notes": 0, "filings": 0})
    print("\nkind year filings ok profiled pending notes")
    for r in all_rows:
        t = totals[r["kind"]]
        for k in t:
            t[k] += r[k]
        print("%(kind)s %(year)s %(filings)5d %(ok)5d %(profiled)5d %(pending)5d %(notes)5d" % r)
    print("\nTOTAL")
    for kind in ("A", "H", "Q"):
        if kind not in totals:
            continue
        t = totals[kind]
        print("%s ok=%d profiled=%d pending=%d notes=%d" % (
            kind, t["ok"], t["profiled"], t["pending"], t["notes"]))
    if args.out:
        os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump({"rows": all_rows, "totals": dict(totals)}, f,
                      ensure_ascii=False, indent=1)
        print("wrote", args.out)


if __name__ == "__main__":
    main()
