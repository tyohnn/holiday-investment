#!/usr/bin/env python3
"""뉴스 수집기 — Google News RSS 로 종목/산업 뉴스 목록을 결정론적으로 가져온다.

에이전트 웹서치는 런마다 결과가 달라지고 샘플링된다. 이 스크립트가 목록(제목·날짜·매체·URL)을
깔면, 에이전트는 그중 원데이터(숫자·계약·물량)가 있는 기사만 선별해 본문을 열어 발췌한다.
키·비용·외부 의존성 없음 (순수 표준 라이브러리, Python 3.9+).

사용법:
    python3 fetch_news.py "크래프톤" --out 자료/뉴스/2026-07.md   # 월 버킷
    python3 fetch_news.py "크래프톤" --queries "실적,수주,신작,유상증자" --days 60
    python3 fetch_news.py "이차전지" --queries "정책,점유율,캐즘" --days 90   # 산업용

출력 md: frontmatter(수집일·출처·쿼리) + 쿼리별 표(날짜|매체|제목|링크).
Google News 링크는 리디렉트 링크다 — 본문을 열 때는 매체 도메인과 제목으로 원문을 찾아도 된다.
"""
import argparse
import datetime as dt
import email.utils
import json
import re
import sys
import urllib.parse
import xml.etree.ElementTree as ET

from _net import http_get

DEFAULT_QUERIES = ["실적", "수주", "공시", "신제품", "증설 투자", "유상증자 전환사채"]


def fetch_query(subject, keyword, days, limit):
    q = ("%s %s" % (subject, keyword)).strip()
    url = ("https://news.google.com/rss/search?q=%s&hl=ko&gl=KR&ceid=KR:ko"
           % urllib.parse.quote(q + (" when:%dd" % days)))
    try:
        root = ET.fromstring(http_get(url))
    except Exception as e:
        print("[경고] 쿼리 '%s' 실패: %s" % (q, e), file=sys.stderr)
        return q, []
    items = []
    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)
    for it in root.findall(".//item"):
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        pub_raw = it.findtext("pubDate") or ""
        src_el = it.find("source")
        source = (src_el.text or "").strip() if src_el is not None else ""
        src_url = src_el.get("url", "") if src_el is not None else ""
        try:
            pub = email.utils.parsedate_to_datetime(pub_raw)
        except (TypeError, ValueError):
            pub = None
        if pub and pub < cutoff:
            continue
        items.append({"title": title, "link": link, "source": source,
                      "source_url": src_url,
                      "date": pub.strftime("%Y-%m-%d") if pub else ""})
        if len(items) >= limit:
            break
    return q, items


def dedup(all_items):
    """제목 정규화 기준으로 쿼리 간 중복 제거 (첫 등장 유지)."""
    seen = set()
    for q, items in all_items:
        kept = []
        for it in items:
            key = re.sub(r"\s+|[\[\]()\"'…·-]", "", it["title"])[:40]
            if key in seen:
                continue
            seen.add(key)
            kept.append(it)
        yield q, kept


def to_markdown(subject, results, days):
    today = dt.date.today().isoformat()
    lines = ["---",
             "수집일: %s" % today,
             "출처: Google News RSS (news.google.com/rss/search)",
             "대상: %s" % subject,
             "수집범위: 최근 %d일" % days,
             "쿼리: [%s]" % ", ".join(q for q, _ in results),
             "---", "",
             "# %s 뉴스 클리핑 (%s)" % (subject, today), "",
             "> 목록은 스크립트 수집분이다. 원데이터가 있는 기사만 골라 본문을 열고,",
             "> 발췌(숫자·표)를 아래 '발췌' 절에 출처와 함께 추가한다. 해석은 쓰지 않는다.", ""]
    total = 0
    for q, items in results:
        lines.append("## 쿼리: %s (%d건)" % (q, len(items)))
        lines.append("")
        if not items:
            lines.append("(수집 결과 없음)")
            lines.append("")
            continue
        lines.append("| 날짜 | 매체 | 제목 | 링크 |")
        lines.append("|---|---|---|---|")
        for it in sorted(items, key=lambda x: x["date"], reverse=True):
            lines.append("| %s | %s | %s | [열기](%s) |"
                         % (it["date"], it["source"], it["title"].replace("|", "¦"), it["link"]))
            total += 1
        lines.append("")
    lines.append("## 발췌 (에이전트가 선별 기사에서 추가)")
    lines.append("")
    lines.append("<!-- 형식: ### 기사제목 (매체, 날짜, URL) / 아래에 숫자·표 발췌만 -->")
    lines.append("")
    return "\n".join(lines), total


def main():
    p = argparse.ArgumentParser()
    p.add_argument("subject", help="종목명 또는 산업명")
    p.add_argument("--queries", help="쉼표로 구분한 키워드 (기본: %s)" % ",".join(DEFAULT_QUERIES))
    p.add_argument("--days", type=int, default=30)
    p.add_argument("--max-per-query", type=int, default=15)
    p.add_argument("--out", help="저장할 md 경로 (자료/뉴스/YYYY-MM-DD-뉴스클리핑.md)")
    args = p.parse_args()

    keywords = ([k.strip() for k in args.queries.split(",") if k.strip()]
                if args.queries else DEFAULT_QUERIES)
    results = [fetch_query(args.subject, kw, args.days, args.max_per_query) for kw in keywords]
    results = list(dedup(results))
    md, total = to_markdown(args.subject, results, args.days)

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(md)
        print(json.dumps({"ok": True, "저장": args.out, "기사수": total}, ensure_ascii=False))
    else:
        print(md)


if __name__ == "__main__":
    main()
