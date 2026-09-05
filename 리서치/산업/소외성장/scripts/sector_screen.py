#!/usr/bin/env python3
"""전 상장사 fin_periods 를 산업으로 접어 채 1(실적 우수 섹터)을 돌린다.

분류 규칙은 packages/schema/src/sectors.ts 의 classifySector 와 같게 옮겼다.
접속: 환경변수 또는 apps/web/.env.local 의 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_KEY.
표준 라이브러리만 쓴다. 값은 stdout 에 JSON.
"""
from __future__ import annotations

import json
import math
import os
import ssl
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from statistics import median

PAGE = 1000
TIMEOUT = 60
_CA_PATHS = ["/etc/ssl/cert.pem", "/etc/ssl/certs/ca-certificates.crt"]

INDUSTRIES = {
    "oil-gas": ("정유·가스", "energy", "에너지"),
    "mining": ("광업", "energy", "에너지"),
    "chemicals": ("화학", "materials", "소재"),
    "battery-materials": ("이차전지 소재", "materials", "소재"),
    "steel": ("철강", "materials", "소재"),
    "non-ferrous": ("비철금속", "materials", "소재"),
    "metal-products": ("금속제품", "materials", "소재"),
    "paper": ("제지·목재", "materials", "소재"),
    "building-materials": ("시멘트·건축자재", "materials", "소재"),
    "machinery": ("기계", "industrials", "산업재"),
    "electrical-equipment": ("전기장비", "industrials", "산업재"),
    "battery": ("이차전지", "industrials", "산업재"),
    "shipbuilding": ("조선", "industrials", "산업재"),
    "aerospace": ("우주항공·방산", "industrials", "산업재"),
    "construction": ("건설", "industrials", "산업재"),
    "engineering": ("건축기술·엔지니어링", "industrials", "산업재"),
    "transport": ("운송·물류", "industrials", "산업재"),
    "commercial-services": ("사업서비스", "industrials", "산업재"),
    "printing": ("인쇄", "industrials", "산업재"),
    "auto": ("자동차", "consumer-discretionary", "경기관련소비재"),
    "auto-parts": ("자동차부품", "consumer-discretionary", "경기관련소비재"),
    "textiles-apparel": ("섬유·의류", "consumer-discretionary", "경기관련소비재"),
    "consumer-durables": ("가정용품·가구", "consumer-discretionary", "경기관련소비재"),
    "cosmetics": ("화장품", "consumer-discretionary", "경기관련소비재"),
    "retail": ("유통", "consumer-discretionary", "경기관련소비재"),
    "trading-companies": ("무역", "consumer-discretionary", "경기관련소비재"),
    "hotels-leisure": ("호텔·레저", "consumer-discretionary", "경기관련소비재"),
    "restaurants": ("음식점", "consumer-discretionary", "경기관련소비재"),
    "education": ("교육", "consumer-discretionary", "경기관련소비재"),
    "food-beverage": ("음식료", "consumer-staples", "필수소비재"),
    "agriculture": ("농업·어업", "consumer-staples", "필수소비재"),
    "tobacco": ("담배", "consumer-staples", "필수소비재"),
    "household-goods": ("생활용품", "consumer-staples", "필수소비재"),
    "pharma": ("제약", "health-care", "건강관리"),
    "biotech": ("바이오·신약", "health-care", "건강관리"),
    "medical-devices": ("의료기기", "health-care", "건강관리"),
    "health-services": ("의료서비스", "health-care", "건강관리"),
    "banks": ("은행", "financials", "금융"),
    "securities": ("증권", "financials", "금융"),
    "insurance": ("보험", "financials", "금융"),
    "holding-companies": ("지주회사", "financials", "금융"),
    "consumer-finance": ("여신·기타금융", "financials", "금융"),
    "real-estate": ("부동산", "financials", "금융"),
    "semiconductors": ("반도체", "it", "IT"),
    "semiconductor-equipment": ("반도체장비", "it", "IT"),
    "display": ("디스플레이", "it", "IT"),
    "electronic-components": ("전자부품", "it", "IT"),
    "electronic-products": ("전자제품", "it", "IT"),
    "precision-instruments": ("정밀기기", "it", "IT"),
    "software": ("소프트웨어", "it", "IT"),
    "it-services": ("IT서비스", "it", "IT"),
    "internet": ("인터넷서비스", "it", "IT"),
    "game": ("게임엔터테인먼트", "communication", "커뮤니케이션서비스"),
    "media": ("미디어·엔터테인먼트", "communication", "커뮤니케이션서비스"),
    "telecom": ("통신서비스", "communication", "커뮤니케이션서비스"),
    "advertising": ("광고", "communication", "커뮤니케이션서비스"),
    "publishing": ("출판", "communication", "커뮤니케이션서비스"),
    "electric-utilities": ("전기·가스", "utilities", "유틸리티"),
    "water-waste": ("수도·환경", "utilities", "유틸리티"),
}

# sectors.ts KSIC_PREFIX_MAP — 긴 접두가 이긴다.
KSIC_PREFIX_MAP = {
    "01": "agriculture", "02": "agriculture", "03": "agriculture",
    "05": "mining", "06": "mining", "07": "mining", "08": "mining",
    "10": "food-beverage", "11": "food-beverage", "12": "tobacco",
    "13": "textiles-apparel", "14": "textiles-apparel", "15": "textiles-apparel",
    "16": "paper", "17": "paper", "18": "printing",
    "19": "oil-gas", "20": "chemicals", "2042": "cosmetics",
    "21": "pharma", "213": "medical-devices", "22": "chemicals",
    "23": "building-materials", "24": "steel", "242": "non-ferrous", "243": "non-ferrous",
    "25": "metal-products",
    "26": "electronic-components", "261": "semiconductors", "262": "electronic-components",
    "2621": "display", "263": "electronic-products", "264": "electronic-products",
    "265": "electronic-products", "266": "precision-instruments",
    "27": "precision-instruments", "271": "medical-devices",
    "28": "electrical-equipment", "282": "battery",
    "29": "machinery", "2929": "semiconductor-equipment",
    "30": "auto-parts", "301": "auto", "31": "shipbuilding", "313": "aerospace",
    "32": "consumer-durables", "33": "consumer-durables", "34": "machinery",
    "35": "electric-utilities", "36": "water-waste", "37": "water-waste",
    "38": "water-waste", "39": "water-waste",
    "41": "construction", "42": "construction",
    "45": "retail", "46": "retail", "468": "trading-companies", "47": "retail",
    "49": "transport", "50": "transport", "51": "transport", "52": "transport",
    "55": "hotels-leisure", "56": "restaurants",
    "58": "publishing", "582": "software", "5821": "game",
    "59": "media", "60": "media", "61": "telecom",
    "62": "it-services", "63": "internet",
    "64": "consumer-finance", "641": "banks", "649": "holding-companies",
    "65": "insurance", "66": "consumer-finance", "661": "securities", "68": "real-estate",
    "70": "biotech", "71": "commercial-services", "713": "advertising",
    "72": "engineering", "73": "commercial-services", "74": "commercial-services",
    "75": "commercial-services", "76": "commercial-services",
    "84": "commercial-services", "85": "education",
    "86": "health-services", "87": "health-services",
    "90": "hotels-leisure", "91": "hotels-leisure",
    "94": "commercial-services", "95": "commercial-services", "96": "household-goods",
}

OVERRIDES = {
    "005930": "semiconductors",
    "036570": "game",
    "068270": "biotech",
    "207940": "biotech",
    "247540": "battery-materials",
    "003670": "battery-materials",
    "066970": "battery-materials",
    "105560": "banks",
    "055550": "banks",
    "086790": "banks",
    "316140": "banks",
    "138040": "banks",
}


def classify(sector_code, stock_code=None):
    if stock_code and stock_code in OVERRIDES:
        return OVERRIDES[stock_code]
    if not sector_code:
        return None
    code = sector_code.strip()
    for length in range(min(len(code), 5), 1, -1):
        industry = KSIC_PREFIX_MAP.get(code[:length])
        if industry:
            return industry
    return None


def repo_root():
    here = os.path.abspath(__file__)
    for _ in range(8):
        here = os.path.dirname(here)
        if os.path.isdir(os.path.join(here, "apps", "web")):
            return here
    return os.getcwd()


def credentials():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_REST_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if url and key:
        url = url.rstrip("/")
        if url.endswith("/rest/v1"):
            url = url[: -len("/rest/v1")]
        return url, key
    path = os.path.join(repo_root(), "apps", "web", ".env.local")
    env = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip("\"'")
    url = url or env.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("SUPABASE_REST_URL")
    key = key or env.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        sys.exit("[sector_screen] URL/KEY 없음")
    url = url.rstrip("/")
    if url.endswith("/rest/v1"):
        url = url[: -len("/rest/v1")]
    return url, key


def ssl_contexts():
    ctxs = [None]
    for p in _CA_PATHS:
        if os.path.exists(p):
            ctxs.append(ssl.create_default_context(cafile=p))
    return ctxs


def get(table, params, url, key):
    rows, offset = [], 0
    while True:
        q = dict(params)
        q["limit"] = PAGE
        q["offset"] = offset
        target = f"{url}/rest/v1/{table}?" + urllib.parse.urlencode(q, safe="")
        req = urllib.request.Request(target, headers={
            "apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json",
        })
        chunk = None
        for ctx in ssl_contexts():
            try:
                kw = {"timeout": TIMEOUT} if ctx is None else {"timeout": TIMEOUT, "context": ctx}
                with urllib.request.urlopen(req, **kw) as resp:
                    chunk = json.loads(resp.read().decode("utf-8"))
                break
            except urllib.error.HTTPError as exc:
                sys.exit(f"[sector_screen] {table} {exc.code}: {exc.read().decode('utf-8')[:300]}")
            except (ssl.SSLError, urllib.error.URLError):
                continue
        if chunk is None:
            sys.exit(f"[sector_screen] {table} SSL/연결 실패")
        rows.extend(chunk)
        if len(chunk) < PAGE:
            break
        offset += PAGE
    return rows


def fnum(v):
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def cagr(start, end, years):
    if start is None or end is None or start <= 0 or end <= 0 or years <= 0:
        return None
    return (end / start) ** (1 / years) - 1


def pick_fs(rows_by_fs):
    """같은 회사·연도에서 CFS 우선, 없으면 OFS."""
    if "CFS" in rows_by_fs:
        return rows_by_fs["CFS"], "CFS"
    if "OFS" in rows_by_fs:
        return rows_by_fs["OFS"], "OFS"
    return None, None


def latest_metric(years_map, key, prefer=(2025, 2024)):
    for y in prefer:
        row = years_map.get(y)
        if row and row.get(key) is not None:
            return y, row[key]
    return None, None


def company_cagr(years_map):
    """2021→2025 우선, 없으면 2022→2025."""
    for start, end in ((2021, 2025), (2022, 2025), (2021, 2024), (2022, 2024)):
        a = (years_map.get(start) or {}).get("revenue")
        b = (years_map.get(end) or {}).get("revenue")
        val = cagr(a, b, end - start)
        if val is not None:
            return val, f"{start}->{end}"
    return None, None


def main():
    url, key = credentials()
    companies = get("companies", {
        "select": "corp_code,name,stock_code,market,sector_code",
        "market": "in.(KOSPI,KOSDAQ)",
        "order": "corp_code",
    }, url, key)
    periods = get("fin_periods", {
        "select": ",".join([
            "corp_code", "period_key", "fs_div", "bsns_year", "period_type",
            "revenue", "operating_income", "net_income",
            "opm_pct", "npm_pct", "roe_pct", "debt_ratio_pct",
        ]),
        "period_type": "eq.A",
        "bsns_year": "in.(2021,2022,2023,2024,2025)",
        "order": "corp_code",
    }, url, key)

    by_corp_year = defaultdict(lambda: defaultdict(dict))
    for p in periods:
        by_corp_year[p["corp_code"]][p["bsns_year"]][p["fs_div"]] = p

    firms = []
    for co in companies:
        if not co.get("stock_code"):
            continue
        industry = classify(co.get("sector_code"), co.get("stock_code"))
        years_map = {}
        basis = None
        for year, fs_map in by_corp_year.get(co["corp_code"], {}).items():
            row, fs = pick_fs(fs_map)
            if not row:
                continue
            basis = fs if basis is None else basis
            years_map[year] = {
                "revenue": fnum(row.get("revenue")),
                "operating_income": fnum(row.get("operating_income")),
                "net_income": fnum(row.get("net_income")),
                "opm_pct": fnum(row.get("opm_pct")),
                "roe_pct": fnum(row.get("roe_pct")),
                "debt_ratio_pct": fnum(row.get("debt_ratio_pct")),
                "fs_div": fs,
            }
        growth, growth_span = company_cagr(years_map)
        latest_y, latest_rev = latest_metric(years_map, "revenue")
        _, latest_opm = latest_metric(years_map, "opm_pct")
        _, latest_roe = latest_metric(years_map, "roe_pct")
        _, latest_debt = latest_metric(years_map, "debt_ratio_pct")
        h4 = (
            growth is not None and growth >= 0.10
            and latest_opm is not None and latest_opm >= 8.0
            and latest_roe is not None and latest_roe >= 12.0
            and latest_rev is not None and latest_rev >= 30_000_000_000
        )
        h4_strict = (
            h4
            and latest_opm is not None and latest_opm >= 10.0
            and latest_roe is not None and latest_roe >= 15.0
        )
        firms.append({
            "corp_code": co["corp_code"],
            "name": co["name"],
            "stock_code": co["stock_code"],
            "market": co.get("market"),
            "sector_code": co.get("sector_code"),
            "industry": industry,
            "industry_name": INDUSTRIES[industry][0] if industry else None,
            "sector": INDUSTRIES[industry][1] if industry else None,
            "basis": basis,
            "growth": growth,
            "growth_span": growth_span,
            "latest_year": latest_y,
            "latest_rev": latest_rev,
            "latest_opm": latest_opm,
            "latest_roe": latest_roe,
            "latest_debt": latest_debt,
            "h4": h4,
            "h4_strict": h4_strict,
            "years": years_map,
        })

    grouped = defaultdict(list)
    unclassified = 0
    for f in firms:
        if f["industry"]:
            grouped[f["industry"]].append(f)
        else:
            unclassified += 1

    sectors = []
    for industry, members in grouped.items():
        name, sector_id, sector_name = INDUSTRIES[industry]
        with_rev = [m for m in members if m["latest_rev"] is not None]
        growths = [m["growth"] for m in members if m["growth"] is not None]
        opms = [m["latest_opm"] for m in members if m["latest_opm"] is not None]
        roes = [m["latest_roe"] for m in members if m["latest_roe"] is not None]
        debts = [m["latest_debt"] for m in members if m["latest_debt"] is not None]
        h4s = [m for m in members if m["h4"]]
        h4_stricts = [m for m in members if m["h4_strict"]]
        pass_n = (
            len(members) >= 8
            and len(with_rev) >= 6
            and growths and median(growths) >= 0.08
            and opms and median(opms) >= 6.0
            and roes and median(roes) >= 8.0
            and len(h4s) >= 3
        )
        sectors.append({
            "industry": industry,
            "industry_name": name,
            "sector": sector_id,
            "sector_name": sector_name,
            "n_listed": len(members),
            "n_with_rev": len(with_rev),
            "median_cagr": round(median(growths) * 100, 1) if growths else None,
            "median_opm": round(median(opms), 1) if opms else None,
            "median_roe": round(median(roes), 1) if roes else None,
            "median_debt": round(median(debts), 1) if debts else None,
            "n_h4": len(h4s),
            "n_h4_strict": len(h4_stricts),
            "share_opm_pos": round(sum(1 for x in opms if x > 0) / len(opms), 3) if opms else None,
            "pass_sieve1": pass_n,
            "h4_names": [
                {
                    "name": m["name"],
                    "stock_code": m["stock_code"],
                    "market": m["market"],
                    "growth_pct": round(m["growth"] * 100, 1) if m["growth"] is not None else None,
                    "growth_span": m["growth_span"],
                    "latest_year": m["latest_year"],
                    "rev_억": round(m["latest_rev"] / 1e8, 0) if m["latest_rev"] else None,
                    "opm": m["latest_opm"],
                    "roe": m["latest_roe"],
                    "debt": m["latest_debt"],
                    "strict": m["h4_strict"],
                    "sector_code": m["sector_code"],
                }
                for m in sorted(h4s, key=lambda x: (-(x["growth"] or -99), -(x["latest_roe"] or -99)))
            ],
        })

    sectors.sort(key=lambda s: (
        0 if s["pass_sieve1"] else 1,
        -(s["n_h4"] or 0),
        -(s["median_cagr"] or -99),
    ))

    out = {
        "기준": {
            "날짜": "2026-08-27",
            "유니버스": "KOSPI+KOSDAQ",
            "기간": "2021A-2025A",
            "테이블": "fin_periods",
            "분류": "packages/schema/src/sectors.ts classifySector",
            "채1": {
                "n_listed>=8": True,
                "n_with_rev>=6": True,
                "median_cagr>=8%": True,
                "median_opm>=6%": True,
                "median_roe>=8%": True,
                "n_h4>=3": True,
                "h4": "CAGR>=10% & OPM>=8% & ROE>=12% & 매출>=300억",
            },
        },
        "표본": {
            "상장사": len(companies),
            "종목코드있는_상장사": len(firms),
            "fin_periods행": len(periods),
            "미분류": unclassified,
            "산업수": len(sectors),
            "채1통과": sum(1 for s in sectors if s["pass_sieve1"]),
        },
        "섹터": sectors,
    }
    json.dump(out, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
