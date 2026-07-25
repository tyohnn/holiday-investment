#!/usr/bin/env python3
"""사실 시계열 원장 CLI — A2 실험의 B안(DB 정본) 도구.

로드맵 "P-A 설계 유보 사항 ⑵"의 판정을 위해 만든다. B안의 핵심 우려는 "에이전트가
행 삽입 도구를 거쳐야 하는 마찰"이었으므로, valuation.py 에서 검증된 '스크립트 강제'
패턴을 그대로 쓴다 — 에이전트는 사실을 판단하고, 스크립트가 형식·중복·순서를 강제한다.

append-only: update/delete 를 제공하지 않는다. 정정도 새 행이다.

사용법:
    tracking.py add --corp 크래프톤 --topic 자금조달-지분희석 \
        --date 2026-02-09 --fact "자기주식 취득 결정" --value "840,330주 / 2,000억" \
        --source "주요사항보고서" --rcept 20260209000388
    tracking.py add --corp 크래프톤 --json '[{...}, {...}]'     # 여러 건 한 번에
    tracking.py list --corp 크래프톤 [--topic 자금조달-지분희석]
    tracking.py export-md --corp 크래프톤 --out-dir 리서치/기업/크래프톤/트래킹
    tracking.py import-md <md파일…> --corp 크래프톤              # 기존 md → 원장 이행
"""
import argparse
import datetime as dt
import hashlib
import json
import os
import re
import sys
import urllib.parse

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
from ingest import rest, REST  # noqa: E402  (REST 헬퍼 재사용)

_REPO = os.path.dirname(os.path.dirname(_HERE))
sys.path.insert(0, os.path.join(_REPO, "plugin", "skills", "company-analysis", "scripts"))
import dart_api as api  # noqa: E402


def resolve_corp(name):
    """회사명 → corp_code (DB 우선, 없으면 DART 조회)."""
    rows = rest("GET", "companies?select=corp_code,name&name=eq.%s" % urllib.parse.quote(name))
    if rows:
        return rows[0]["corp_code"], rows[0]["name"]
    key = api.resolve_key() or api.read_env_file(os.path.join(_REPO, ".env.local")).get("DART_API_KEY")
    corp, _ = api.find_corp(key, name) if key else (None, None)
    if not corp:
        print(json.dumps({"ok": False, "error": "회사 특정 실패: %s" % name}, ensure_ascii=False))
        sys.exit(1)
    return corp["corp_code"], corp["corp_name"]


def fact_keys(corp_code, topic, fact_date, fact, rcept=None):
    """중복 판정 키. A2 실험 교훈: 문장·날짜 기반 키만으로는 같은 공시를 다른 표현으로
    쓴 중복을 놓친다(접수일 vs 효력일). 출처 공시가 있으면 (topic, rcept)가 1순위다."""
    keys = []
    if rcept:
        keys.append("R|%s|%s|%s" % (corp_code, topic, rcept))
    norm = re.sub(r"\s+", "", fact)[:60]
    keys.append("F|" + hashlib.sha1(
        ("%s|%s|%s|%s" % (corp_code, topic, fact_date, norm)).encode()).hexdigest()[:16])
    return keys


def norm_date(raw):
    """'2025-09'(월만 아는 사실) 같은 부분 날짜를 (날짜, 정밀도)로 정규화한다."""
    raw = (raw or "").strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
        return raw, "day"
    if re.fullmatch(r"\d{4}-\d{2}", raw):
        return raw + "-01", "month"
    m = re.fullmatch(r"(\d{4})[\s-]?([1-4])Q", raw, re.I)
    if m:
        return "%s-%02d-01" % (m.group(1), (int(m.group(2)) - 1) * 3 + 1), "quarter"
    if re.fullmatch(r"\d{4}", raw):
        return raw + "-01-01", "year"
    raise ValueError("날짜 형식을 해석할 수 없다: %r (YYYY-MM-DD | YYYY-MM | YYYY-1Q | YYYY)" % raw)


def cmd_add(args):
    corp_code, corp_name = resolve_corp(args.corp)
    if args.json:
        items = json.loads(args.json)
    else:
        items = [{"topic": args.topic, "date": args.date, "fact": args.fact,
                  "value": args.value, "source": args.source, "rcept": args.rcept}]
    # 기존 행 로드 (중복 판정)
    existing = rest("GET", "trackings?select=topic,fact_date,fact,rcept_no&corp_code=eq.%s&limit=5000"
                    % corp_code)
    seen = set()
    for r in existing:
        seen.update(fact_keys(corp_code, r["topic"], r["fact_date"], r["fact"], r.get("rcept_no")))

    rows, dups, errs = [], [], []
    for it in items:
        topic = it.get("topic") or args.topic
        fact = it["fact"]
        try:
            date, precision = norm_date(it["date"])
        except ValueError as e:
            errs.append(str(e))
            continue
        keys = fact_keys(corp_code, topic, date, fact, it.get("rcept"))
        if any(k in seen for k in keys) and not args.allow_dup:
            dups.append({"topic": topic, "date": date, "fact": fact[:40],
                         "사유": "같은 공시·주제" if it.get("rcept") and keys[0] in seen else "같은 사실"})
            continue
        seen.update(keys)
        rows.append({"corp_code": corp_code, "topic": topic, "fact_date": date,
                     "date_precision": precision, "fact": fact, "value_text": it.get("value"),
                     "source": it.get("source") or "미상", "rcept_no": it.get("rcept"),
                     "tags": it.get("tags") or (args.tags.split(",") if args.tags else [])})
    if rows:
        rest("POST", "trackings", rows, prefer="return=minimal")
    out = {"ok": not errs, "종목": corp_name, "추가": len(rows), "중복무시": dups}
    if errs:
        out["오류"] = errs
    print(json.dumps(out, ensure_ascii=False))
    if errs:
        sys.exit(1)


def cmd_list(args):
    corp_code, corp_name = resolve_corp(args.corp)
    q = "trackings?select=topic,fact_date,fact,value_text,source,rcept_no&corp_code=eq.%s" % corp_code
    if args.topic:
        q += "&topic=eq.%s" % urllib.parse.quote(args.topic)
    q += "&order=topic,fact_date&limit=2000"
    rows = rest("GET", q)
    if args.format == "json":
        print(json.dumps({"종목": corp_name, "건수": len(rows), "행": rows},
                         ensure_ascii=False, indent=2))
        return
    cur = None
    for r in rows:
        if r["topic"] != cur:
            cur = r["topic"]
            print("\n## %s" % cur)
            print("| 시점 | 사실 | 수치 | 출처 |")
            print("|---|---|---|---|")
        print("| %s | %s | %s | %s |" % (r["fact_date"], r["fact"],
                                          r["value_text"] or "—", r["source"]))
    print("\n(%d행)" % len(rows))


def cmd_export_md(args):
    """DB → md 뷰 생성. B안이 채택돼도 에이전트·사람이 읽는 경로는 유지된다."""
    corp_code, corp_name = resolve_corp(args.corp)
    rows = rest("GET", "trackings?select=topic,fact_date,date_precision,fact,value_text,"
                "source,rcept_no,tags&corp_code=eq.%s&order=topic,fact_date&limit=5000" % corp_code)
    by_topic = {}
    for r in rows:
        by_topic.setdefault(r["topic"], []).append(r)
    os.makedirs(args.out_dir, exist_ok=True)
    today = dt.date.today().isoformat()
    for topic, items in by_topic.items():
        path = os.path.join(args.out_dir, "%s.md" % topic)
        lines = ["---", "주제: %s" % topic, "종목: %s" % corp_name,
                 "생성: DB 원장에서 자동 생성 (%s) — 직접 편집하지 말 것" % today,
                 "행수: %d" % len(items), "---", "",
                 "# %s" % topic, "",
                 "| 시점 | 사실 | 수치 | 출처 |", "|---|---|---|---|"]
        for r in items:
            src = r["source"]
            if r["rcept_no"] and r["rcept_no"] not in src:
                src += " (%s)" % r["rcept_no"]
            d = r["fact_date"]
            prec = r.get("date_precision", "day")
            shown = {"month": d[:7], "quarter": "%s-%dQ" % (d[:4], (int(d[5:7]) - 1) // 3 + 1),
                     "year": d[:4]}.get(prec, d)
            fact = r["fact"].replace("|", "¦")
            if r.get("tags"):
                fact += " " + " ".join("`#%s`" % t for t in r["tags"])
            lines.append("| %s | %s | %s | %s |" % (shown, fact,
                                                    (r["value_text"] or "—").replace("|", "¦"), src))
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
    print(json.dumps({"ok": True, "생성": len(by_topic), "위치": args.out_dir,
                      "행": len(rows)}, ensure_ascii=False))


ROW_RE = re.compile(r"^\|\s*(\d{4}(?:[\s-]?[1-4]Q|-\d{2}(?:-\d{2})?)?)\s*\|(.+?)\|(.+?)\|(.+?)\|\s*$")
RCEPT_RE = re.compile(r"\b(\d{14})\b")


def cmd_import_md(args):
    """기존 md 트래킹 문서 → 원장 이행 (표 행 파싱)."""
    corp_code, corp_name = resolve_corp(args.corp)
    items = []
    for path in args.files:
        topic = os.path.splitext(os.path.basename(path))[0]
        with open(path, encoding="utf-8") as f:
            for line in f:
                m = ROW_RE.match(line.rstrip())
                if not m:
                    continue
                date, fact, value, source = (x.strip() for x in m.groups())
                rc = RCEPT_RE.search(source)
                items.append({"topic": topic, "date": date, "fact": fact,
                              "value": None if value == "—" else value,
                              "source": source, "rcept": rc.group(1) if rc else None})
    args.json = json.dumps(items, ensure_ascii=False)
    args.topic = None
    cmd_add(args)


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("add")
    a.add_argument("--corp", required=True)
    a.add_argument("--topic"); a.add_argument("--date"); a.add_argument("--fact")
    a.add_argument("--value"); a.add_argument("--source"); a.add_argument("--rcept")
    a.add_argument("--tags", help="쉼표 구분 교차 주제 태그")
    a.add_argument("--json", help="여러 건: [{topic,date,fact,value,source,rcept,tags[]}, …]")
    a.add_argument("--allow-dup", action="store_true")

    l = sub.add_parser("list")
    l.add_argument("--corp", required=True); l.add_argument("--topic")
    l.add_argument("--format", choices=["md", "json"], default="md")

    e = sub.add_parser("export-md")
    e.add_argument("--corp", required=True); e.add_argument("--out-dir", required=True)

    i = sub.add_parser("import-md")
    i.add_argument("files", nargs="+"); i.add_argument("--corp", required=True)
    i.add_argument("--allow-dup", action="store_true"); i.add_argument("--tags")

    args = p.parse_args()
    {"add": cmd_add, "list": cmd_list, "export-md": cmd_export_md,
     "import-md": cmd_import_md}[args.cmd](args)


if __name__ == "__main__":
    main()
