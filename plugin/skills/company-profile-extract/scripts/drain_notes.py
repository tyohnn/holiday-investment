#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""섹션이 있는 정기보고서에서 주석 39종을 financial_facts(sj_div=NOTE)에 계속 적재.

이미 NOTE 가 있는 rcept 와 로그에 찍힌 회차는 건너뛴다. --since 이후 접수분부터
최신 순으로 창을 넓혀 간다.
"""
import argparse
import json
import os
import re
import sys
import traceback
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                "..", "..", "..", "..", "platform", "ingest"))
import extract_notes_full as nf  # noqa: E402
import ingest  # noqa: E402

YEAR_RE = re.compile(r"\((\d{4})\.")
MONTH_RE = re.compile(r"\((\d{4})\.(\d{2})")
KIND = {
    "A": ("*사업보고서 (*", "11011"),
    "H": ("*반기보고서 (*", "11012"),
    "Q": ("*분기보고서 (*", None),  # 1Q=11013 · 3Q=11014, report_nm 월로 가름
}
NOTE_PREF = (
    "3. 연결재무제표 주석",
    "연결재무제표 주석",
    "3. 재무제표 주석",
    "재무제표 주석",
)


def pick_title(sections):
    titles = list(sections)
    for pref in NOTE_PREF:
        for t in titles:
            if t == pref or pref in t:
                return t
    for t in titles:
        if "주석" in t and "목차" not in t:
            return t
    return None


def year_of(report_nm, rcept_no):
    m = YEAR_RE.search(report_nm or "")
    if m:
        return int(m.group(1))
    if rcept_no and len(rcept_no) >= 4:
        return int(rcept_no[:4]) - 1
    return None


def load_one(corp, rcept):
    path = "%s/%s/%s.sections.json.gz" % (ingest.DOCS_PREFIX, corp, rcept)
    status, data = ingest.storage_download(path)
    if status != 200:
        return None, "no_sections:%s" % status
    import gzip
    sections = json.loads(gzip.decompress(data).decode("utf-8"))
    d = {s["title"]: s["content"] for s in sections}
    title = pick_title(d)
    if not title:
        return None, "no_note_title"
    return d[title], title


def reprt_of(kind, report_nm):
    _like, code = KIND[kind]
    if code:
        return code
    m = MONTH_RE.search(report_nm or "")
    if not m:
        return "11013"
    month = int(m.group(2))
    if month <= 3:
        return "11013"
    if month <= 6:
        return "11012"
    return "11014"


def upsert_notes(corp, year, rcept, rows, reprt_code="11011"):
    filters = {
        "corp_code": "eq.%s" % corp, "bsns_year": "eq.%s" % year,
        "reprt_code": "eq.%s" % reprt_code, "fs_div": "eq.CFS", "sj_div": "eq.NOTE",
    }
    ingest.rest("DELETE", "financial_facts?%s" % urllib.parse.urlencode(filters))
    if not rows:
        return 0
    result = ingest.rest(
        "POST", "financial_facts?on_conflict=natural_key", rows,
        prefer="resolution=merge-duplicates,return=representation")
    return len(result) if result else 0


def noted_set():
    out, offset = set(), 0
    while True:
        rows = ingest.rest("GET",
            "financial_facts?select=rcept_no&sj_div=eq.NOTE&limit=1000&offset=%d"
            % offset)
        if not rows:
            break
        out.update(r["rcept_no"] for r in rows)
        if len(rows) < 1000:
            break
        offset += 1000
        if offset % 10000 == 0:
            print("  noted_set offset=%d distinct=%d" % (offset, len(out)), flush=True)
    return out


def pending_notes(since, until, n, skip, kind="A", noted=None):
    like = urllib.parse.quote(KIND[kind][0], safe="")
    out, offset = [], 0
    noted = noted or set()
    until_q = ("&rcept_dt=lte." + until) if until else ""
    page, cap = 500, 10000
    while len(out) < n and offset < cap:
        rows = ingest.rest("GET",
            "filings?select=corp_code,rcept_no,report_nm"
            "&report_nm=like." + like
            + "&rcept_dt=gte." + since
            + until_q
            + "&order=rcept_dt.desc&limit=" + str(page) + "&offset=" + str(offset))
        if not rows:
            break
        rcepts = [r["rcept_no"] for r in rows
                  if "제출기한연장" not in (r.get("report_nm") or "")]
        if rcepts:
            docs = ingest.rest("GET",
                "filing_docs?select=rcept_no,sections_extracted_at&rcept_no=in.("
                + ",".join(rcepts) + ")")
            have = {d["rcept_no"] for d in (docs or []) if d.get("sections_extracted_at")}
            for r in rows:
                key = (r["corp_code"], r["rcept_no"])
                if (r["rcept_no"] in have and key not in skip
                        and r["rcept_no"] not in noted
                        and all(x["rcept_no"] != r["rcept_no"] for x in out)):
                    out.append(r)
                    if len(out) >= n:
                        break
        offset += page
        if offset % 1000 == 0:
            print("  notes scan offset=%d found=%d" % (offset, len(out)), flush=True)
        if len(rows) < page:
            break
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default="20200101")
    ap.add_argument("--until", default=None, help="YYYYMMDD 창 끝. 없으면 since 이후 전부")
    ap.add_argument("--kind", default="A", choices=("A", "H", "Q"),
                    help="A=사업 · H=반기 · Q=분기. 기본 사업보고서")
    ap.add_argument("--retry-empty", action="store_true",
                    help="로그에 empty 로 찍힌 회차를 다시 넣는다(파서 개선 후)")
    ap.add_argument("--empties-from", default="",
                    help="다른 jsonl 들의 empty 회차만 다시 넣는다(쉼표 경로)")
    ap.add_argument("--log", required=True)
    ap.add_argument("--batch", type=int, default=200)
    args = ap.parse_args()

    skip = set()
    if os.path.exists(args.log):
        for line in open(args.log, encoding="utf-8"):
            rec = json.loads(line)
            if args.retry_empty and rec.get("status") == "empty":
                continue
            skip.add((rec["corp"], rec["rcept"]))
    noted = noted_set()
    print("skip_log=%d noted=%d" % (len(skip), len(noted)), flush=True)
    ingest.print_target()
    os.makedirs(os.path.dirname(args.log) or ".", exist_ok=True)

    empty_pairs = []
    if args.empties_from:
        seen = set()
        for path in [p.strip() for p in args.empties_from.split(",") if p.strip()]:
            if not os.path.exists(path):
                continue
            for line in open(path, encoding="utf-8"):
                rec = json.loads(line)
                if rec.get("status") != "empty":
                    continue
                key = (rec["corp"], rec["rcept"])
                if key in seen or key in skip or rec["rcept"] in noted:
                    continue
                seen.add(key)
                empty_pairs.append({
                    "corp_code": rec["corp"], "rcept_no": rec["rcept"],
                    "report_nm": rec.get("report_nm") or "",
                    "year": rec.get("year"),
                })
        print("empties_from=%d" % len(empty_pairs), flush=True)

    while True:
        if empty_pairs:
            pairs = empty_pairs
            empty_pairs = []
        else:
            if args.empties_from:
                # 지정 로그만 재처리하고 끝낸다. pending_notes 스캔은 하지 않는다.
                break
            pairs = pending_notes(args.since, args.until, args.batch, skip,
                                 kind=args.kind, noted=noted)
        print("kind=%s pending_notes=%d" % (args.kind, len(pairs)), flush=True)
        if not pairs:
            break
        with open(args.log, "a", encoding="utf-8") as log:
            for i, p in enumerate(pairs, 1):
                corp, rcept = p["corp_code"], p["rcept_no"]
                year = p.get("year") or year_of(p.get("report_nm"), rcept)
                status, extra, n = "ok", "", 0
                try:
                    if year is None:
                        status, extra = "no_year", ""
                    else:
                        md, info = load_one(corp, rcept)
                        if md is None:
                            status, extra = info.split(":", 1)[0], info
                        else:
                            facts, notes = nf.build_facts(corp, rcept, year, md, [])
                            code = reprt_of(args.kind, p.get("report_nm"))
                            rows = [nf.fact_row(corp, year, rcept, lab, cur, prev, cap,
                                                reprt_code=code)
                                    for (lab, cur, prev, cap) in facts]
                            n = upsert_notes(corp, year, rcept, rows, reprt_code=code)
                            extra = "title=%s facts=%d notes=%d" % (info, n, len(notes))
                            if n == 0:
                                status = "empty"
                except Exception as e:  # noqa: BLE001
                    status, extra = "exc", "%s: %s" % (type(e).__name__, e)
                    traceback.print_exc()
                rec = {"corp": corp, "rcept": rcept, "year": year,
                       "status": status, "n": n, "extra": extra[:240]}
                log.write(json.dumps(rec, ensure_ascii=False) + "\n")
                log.flush()
                skip.add((corp, rcept))
                if status == "ok":
                    noted.add(rcept)
                print("%d/%d %s %s %s n=%s" % (i, len(pairs), corp, rcept, status, n),
                      flush=True)
        # 짧은 배치라도 skip 이 늘면 다음 페이지에서 더 나온다. 0건일 때만 종료.
    print("drain_notes done", flush=True)


if __name__ == "__main__":
    main()
