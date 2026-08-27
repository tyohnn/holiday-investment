#!/usr/bin/env python3
"""채 2 — Google News RSS 건수로 섹터 관심도 비교.

쿼리: "<키워드> 주식" 최근 30일. 고관심 기준선(반도체·조선·이차전지·방산·원전)과
후보 섹터를 같은 방식으로 친다. 본문 해석은 하지 않고 건수·제목만 남긴다.
"""
from __future__ import annotations

import datetime as dt
import email.utils
import json
import sys
import urllib.parse
import xml.etree.ElementTree as ET

sys.path.insert(0, "/workspace/plugin/skills/company-analysis/scripts")
from _net import http_get  # noqa: E402

DAYS = 30
LIMIT = 40

BASELINE = [
    "반도체", "조선주", "이차전지", "방산", "원전", "변압기", "HBM",
]
CANDIDATES = [
    "신용정보", "기업평가", "사교육", "입시학원",
    "화장품 ODM", "K뷰티",
    "자동차부품", "거푸집",
    "사료", "라면 주식",
    "발전정비", "한전KPS",
    "신용평가", "메가스터디",
]


def fetch(keyword):
    q = f"{keyword} 주식" if "주식" not in keyword else keyword
    url = ("https://news.google.com/rss/search?q=%s&hl=ko&gl=KR&ceid=KR:ko"
           % urllib.parse.quote(q + f" when:{DAYS}d"))
    try:
        root = ET.fromstring(http_get(url))
    except Exception as exc:
        return {"query": q, "error": str(exc), "n": 0, "titles": []}
    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=DAYS)
    items = []
    for it in root.findall(".//item"):
        title = (it.findtext("title") or "").strip()
        pub_raw = it.findtext("pubDate") or ""
        src_el = it.find("source")
        source = (src_el.text or "").strip() if src_el is not None else ""
        try:
            pub = email.utils.parsedate_to_datetime(pub_raw)
        except (TypeError, ValueError):
            pub = None
        if pub and pub < cutoff:
            continue
        items.append({
            "date": pub.strftime("%Y-%m-%d") if pub else "",
            "source": source,
            "title": title,
        })
        if len(items) >= LIMIT:
            break
    return {"query": q, "n": len(items), "titles": items}


def main():
    rows = []
    for kw in BASELINE + CANDIDATES:
        row = fetch(kw)
        row["group"] = "baseline" if kw in BASELINE else "candidate"
        row["keyword"] = kw
        rows.append(row)
        print(f"{row['group']:9} {kw:12} n={row['n']:2} {row.get('error') or ''}", file=sys.stderr)
    rows.sort(key=lambda r: (-r["n"], r["keyword"]))
    json.dump({
        "수집일": dt.date.today().isoformat(),
        "범위": f"최근 {DAYS}일",
        "출처": "Google News RSS",
        "쿼리규칙": "<키워드> 주식 when:30d",
        "결과": rows,
    }, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
