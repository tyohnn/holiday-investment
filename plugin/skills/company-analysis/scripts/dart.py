#!/usr/bin/env python3
"""DART 공시 수집기 — OpenDART 공식 API 로 공시 목록·재무 추이를 원본 숫자로 가져온다.

"이사회 승인 문서 > 실적 공시 > 리포트 로데이터 > 언론"이라는 자료 위계(D1)를 프로그램으로
구현한다. 재무 추이를 뉴스에서 긁지 말고 공시 원본에서 가져온다.

필요: 무료 API 키 — https://opendart.fss.or.kr → 인증키 신청 (이메일 가입, 즉시 발급)
      환경변수 DART_API_KEY 또는 --api-key 인자. 키가 없으면 안내 후 exit 2 —
      스킬은 웹서치 방식으로 폴백한다.

사용법:
    python3 dart.py corp 크래프톤                       # 고유번호·종목코드 조회
    python3 dart.py filings 크래프톤 --days 90 \
        --out 자료/공시/2026-07-24-공시목록.md           # 공시 목록 + 자금조달 플래그
    python3 dart.py fin 크래프톤 --years 4 \
        --out 자료/재무/2026-07-24-재무추이.md           # 연간 재무 추이 (연결 우선)

순수 표준 라이브러리 (Python 3.9+). corpCode 목록은 ~/.cache/investment-analyst/ 에 30일 캐시.
"""
import argparse
import datetime as dt
import io
import json
import os
import re
import sys
import urllib.parse
import xml.etree.ElementTree as ET
import zipfile

from _net import http_get

BASE = "https://opendart.fss.or.kr/api"
CACHE_DIR = os.path.expanduser("~/.cache/investment-analyst")
FLAG_WORDS = ["유상증자", "무상증자", "전환사채", "신주인수권", "교환사채", "합병", "분할",
              "소송", "최대주주", "자기주식", "감자", "전환청구", "조회공시", "불성실"]


def get_key(args):
    key = args.api_key or os.environ.get("DART_API_KEY")
    if not key:
        print(json.dumps({
            "ok": False, "skip": True,
            "reason": "DART_API_KEY 없음 — 이 단계를 웹서치(DART 사이트 열람)로 폴백하라",
            "발급": "https://opendart.fss.or.kr 에서 무료 인증키 신청 후 export DART_API_KEY=<키>",
        }, ensure_ascii=False))
        sys.exit(2)
    return key


def api_json(path, **params):
    url = "%s/%s?%s" % (BASE, path, urllib.parse.urlencode(params))
    data = json.loads(http_get(url).decode("utf-8"))
    return data


def load_corpcodes(key):
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache = os.path.join(CACHE_DIR, "corpcode.xml")
    if not (os.path.exists(cache) and
            dt.datetime.now().timestamp() - os.path.getmtime(cache) < 30 * 86400):
        raw = http_get("%s/corpCode.xml?crtfc_key=%s" % (BASE, key), timeout=60)
        try:
            with zipfile.ZipFile(io.BytesIO(raw)) as z:
                xml_bytes = z.read(z.namelist()[0])
        except zipfile.BadZipFile:
            # zip 이 아니면 오류 JSON/XML — 그대로 보여준다 (키 오류 등)
            print(json.dumps({"ok": False, "error": raw[:300].decode("utf-8", "replace")},
                             ensure_ascii=False))
            sys.exit(1)
        with open(cache, "wb") as f:
            f.write(xml_bytes)
    return ET.parse(cache).getroot()


def find_corp(key, name):
    """상장사(종목코드 보유) 중 이름 일치 → 부분 일치 순으로 찾는다."""
    root = load_corpcodes(key)
    exact, partial = [], []
    for el in root.iter("list"):
        cname = (el.findtext("corp_name") or "").strip()
        stock = (el.findtext("stock_code") or "").strip()
        if not stock:
            continue
        item = {"corp_code": el.findtext("corp_code"), "corp_name": cname, "stock_code": stock}
        if cname == name:
            exact.append(item)
        elif name in cname:
            partial.append(item)
    if exact:
        return exact[0], exact + partial
    if len(partial) == 1:
        return partial[0], partial
    return None, partial


def cmd_corp(key, name):
    corp, candidates = find_corp(key, name)
    print(json.dumps({"ok": corp is not None, "선택": corp, "후보": candidates[:10]},
                     ensure_ascii=False, indent=2))
    sys.exit(0 if corp else 1)


def cmd_filings(key, name, days, out):
    corp, candidates = find_corp(key, name)
    if not corp:
        print(json.dumps({"ok": False, "error": "기업을 특정 못함", "후보": candidates[:10]},
                         ensure_ascii=False))
        sys.exit(1)
    end = dt.date.today()
    bgn = end - dt.timedelta(days=days)
    rows, page = [], 1
    while True:
        d = api_json("list.json", crtfc_key=key, corp_code=corp["corp_code"],
                     bgn_de=bgn.strftime("%Y%m%d"), end_de=end.strftime("%Y%m%d"),
                     page_no=page, page_count=100)
        if d.get("status") != "000":
            if d.get("status") == "013":  # 조회 데이터 없음
                break
            print(json.dumps({"ok": False, "error": "%s %s" % (d.get("status"), d.get("message"))},
                             ensure_ascii=False))
            sys.exit(1)
        rows.extend(d.get("list", []))
        if page >= int(d.get("total_page", 1)):
            break
        page += 1

    today = end.isoformat()
    lines = ["---", "수집일: %s" % today, "기준일: %s" % today,
             "출처: OpenDART list API (opendart.fss.or.kr)",
             "대상: %s (%s)" % (corp["corp_name"], corp["stock_code"]),
             "수집범위: 최근 %d일 (%s ~ %s)" % (days, bgn, end), "---", "",
             "# %s 공시 목록 (%s)" % (corp["corp_name"], today), ""]
    flagged = [r for r in rows if any(w in r.get("report_nm", "") for w in FLAG_WORDS)]
    if flagged:
        lines.append("## ⚑ 자금조달·지배구조 플래그 (%d건 — 지분 희석·오버행 점검 대상)" % len(flagged))
        lines.append("")
        for r in flagged:
            lines.append("- %s **%s** (%s) — https://dart.fss.or.kr/dsaf001/main.do?rcpNo=%s"
                         % (r.get("rcept_dt"), r.get("report_nm"), r.get("flr_nm"), r.get("rcept_no")))
        lines.append("")
    lines.append("## 전체 (%d건)" % len(rows))
    lines.append("")
    lines.append("| 접수일 | 보고서 | 제출인 | 원문 |")
    lines.append("|---|---|---|---|")
    for r in rows:
        lines.append("| %s | %s | %s | [dart](https://dart.fss.or.kr/dsaf001/main.do?rcpNo=%s) |"
                     % (r.get("rcept_dt"), r.get("report_nm", "").replace("|", "¦"),
                        r.get("flr_nm"), r.get("rcept_no")))
    md = "\n".join(lines)
    if out:
        with open(out, "w", encoding="utf-8") as f:
            f.write(md)
        print(json.dumps({"ok": True, "저장": out, "건수": len(rows), "플래그": len(flagged)},
                         ensure_ascii=False))
    else:
        print(md)


ACCOUNTS = [("매출액", ["매출액", "수익(매출액)", "영업수익"]),
            ("영업이익", ["영업이익", "영업이익(손실)"]),
            ("당기순이익", ["당기순이익", "당기순이익(손실)", "연결당기순이익"]),
            ("자산총계", ["자산총계"]), ("부채총계", ["부채총계"]), ("자본총계", ["자본총계"])]


def pick_amount(items, names, fs_div):
    for target in names:
        for it in items:
            if it.get("fs_div") != fs_div:
                continue
            if (it.get("account_nm") or "").replace(" ", "") == target.replace(" ", ""):
                raw = (it.get("thstrm_amount") or "").replace(",", "").strip()
                if raw and raw != "-":
                    try:
                        return int(raw)
                    except ValueError:
                        pass
    return None


def cmd_fin(key, name, years, out):
    corp, candidates = find_corp(key, name)
    if not corp:
        print(json.dumps({"ok": False, "error": "기업을 특정 못함", "후보": candidates[:10]},
                         ensure_ascii=False))
        sys.exit(1)
    this_year = dt.date.today().year
    table, fs_used = [], None
    for y in range(this_year - years, this_year):
        d = api_json("fnlttSinglAcntAll.json", crtfc_key=key, corp_code=corp["corp_code"],
                     bsns_year=str(y), reprt_code="11011", fs_div="CFS")
        items = d.get("list", []) if d.get("status") == "000" else []
        fs = "CFS"
        if not items:
            d = api_json("fnlttSinglAcntAll.json", crtfc_key=key, corp_code=corp["corp_code"],
                         bsns_year=str(y), reprt_code="11011", fs_div="OFS")
            items = d.get("list", []) if d.get("status") == "000" else []
            fs = "OFS"
        if not items:
            continue
        fs_used = fs
        row = {"연도": y}
        for label, names in ACCOUNTS:
            v = pick_amount(items, names, fs)
            row[label] = round(v / 1e8, 1) if v is not None else None  # 억 원
        table.append(row)

    if not table:
        print(json.dumps({"ok": False, "error": "재무 데이터 없음 (사업보고서 미제출 또는 계정 상이)"},
                         ensure_ascii=False))
        sys.exit(1)

    def ratio(a, b):
        return round(a / b * 100, 1) if (a is not None and b) else None

    today = dt.date.today().isoformat()
    lines = ["---", "수집일: %s" % today, "기준일: 각 연도 사업보고서",
             "출처: OpenDART fnlttSinglAcntAll API (%s 기준)" % ("연결" if fs_used == "CFS" else "별도"),
             "대상: %s (%s)" % (corp["corp_name"], corp["stock_code"]), "---", "",
             "# %s 재무 추이 (%s 수집)" % (corp["corp_name"], today), "",
             "단위: 억 원. 순이익률·부채비율·ROE는 산출값.", "",
             "| 항목 | " + " | ".join(str(r["연도"]) for r in table) + " |",
             "|---|" + "---|" * len(table)]

    def fmt(v):
        return format(v, ",") if v is not None else "미확인"

    for label, _ in ACCOUNTS:
        lines.append("| %s | " % label + " | ".join(fmt(r[label]) for r in table) + " |")
    lines.append("| 영업이익률(%) | " + " | ".join(
        str(ratio(r["영업이익"], r["매출액"]) or "미확인") for r in table) + " |")
    lines.append("| 매출 YoY(%) | " + " | ".join(
        (str(round((table[i]["매출액"] / table[i - 1]["매출액"] - 1) * 100, 1))
         if i > 0 and table[i]["매출액"] and table[i - 1]["매출액"] else "—")
        for i in range(len(table))) + " |")
    lines.append("| 부채비율(%) | " + " | ".join(
        str(ratio(r["부채총계"], r["자본총계"]) or "미확인") for r in table) + " |")
    lines.append("| ROE(%, 순이익/자본) | " + " | ".join(
        str(ratio(r["당기순이익"], r["자본총계"]) or "미확인") for r in table) + " |")

    md = "\n".join(lines) + "\n"
    if out:
        with open(out, "w", encoding="utf-8") as f:
            f.write(md)
        print(json.dumps({"ok": True, "저장": out, "연도수": len(table)}, ensure_ascii=False))
    else:
        print(md)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--api-key")
    sub = p.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("corp"); c.add_argument("name")
    f = sub.add_parser("filings"); f.add_argument("name")
    f.add_argument("--days", type=int, default=90); f.add_argument("--out")
    g = sub.add_parser("fin"); g.add_argument("name")
    g.add_argument("--years", type=int, default=4); g.add_argument("--out")
    args = p.parse_args()

    key = get_key(args)
    if args.cmd == "corp":
        cmd_corp(key, args.name)
    elif args.cmd == "filings":
        cmd_filings(key, args.name, args.days, args.out)
    else:
        cmd_fin(key, args.name, args.years, args.out)


if __name__ == "__main__":
    main()
