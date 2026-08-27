#!/usr/bin/env python3
"""채 1 보강 — 산업 중앙값이 삼키는 하위군집을 찾는다.

1) 산업별 2026TTM 중앙값 (지금 잘하는지)
2) KSIC 3자리 군집 (n>=6)
3) H4 컷 통과 전 종목 목록

접속·분류는 sector_screen.py 와 같다.
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from statistics import median

import sector_screen as s

YEARS_A = (2021, 2022, 2023, 2024, 2025)
KSIC_DIV = {
    "10": "식료품", "11": "음료", "13": "섬유", "14": "의복", "15": "가죽·신발",
    "17": "종이", "20": "화학", "21": "의약품", "22": "고무·플라스틱",
    "23": "비금속광물", "24": "1차금속", "25": "금속가공",
    "26": "전자부품·컴퓨터·통신", "27": "의료·정밀·광학", "28": "전기장비",
    "29": "기타기계", "30": "자동차", "31": "기타운송장비", "32": "가구",
    "33": "기타제품", "35": "전기·가스", "41": "종합건설", "42": "전문공사업",
    "46": "도매", "47": "소매", "49": "육상운송", "58": "출판", "59": "영상",
    "62": "IT서비스", "63": "정보서비스", "64": "금융", "70": "연구개발",
    "71": "전문서비스", "72": "건축기술", "73": "기타전문과학", "85": "교육",
    "86": "보건", "96": "기타개인서비스",
}


def pick_fs(fs_map):
    if "CFS" in fs_map:
        return fs_map["CFS"], "CFS"
    if "OFS" in fs_map:
        return fs_map["OFS"], "OFS"
    return None, None


def fnum(v):
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def cagr(a, b, years):
    if a is None or b is None or a <= 0 or b <= 0 or years <= 0:
        return None
    return (b / a) ** (1 / years) - 1


def med(xs):
    xs = [x for x in xs if x is not None]
    return round(median(xs), 1) if xs else None


def med_pct(xs):
    xs = [x for x in xs if x is not None]
    return round(median(xs) * 100, 1) if xs else None


def main():
    url, key = s.credentials()
    companies = s.get("companies", {
        "select": "corp_code,name,stock_code,market,sector_code",
        "market": "in.(KOSPI,KOSDAQ)",
        "order": "corp_code",
    }, url, key)
    periods = s.get("fin_periods", {
        "select": ",".join([
            "corp_code", "period_key", "fs_div", "bsns_year", "period_type",
            "revenue", "operating_income", "opm_pct", "roe_pct", "debt_ratio_pct",
        ]),
        "or": "(and(period_type.eq.A,bsns_year.in.(2021,2022,2023,2024,2025)),"
              "and(period_type.eq.TTM,bsns_year.in.(2025,2026)))",
        "order": "corp_code",
    }, url, key)

    store = defaultdict(lambda: defaultdict(dict))  # corp -> period_key -> fs_div -> row
    for p in periods:
        store[p["corp_code"]][p["period_key"]][p["fs_div"]] = p

    firms = []
    for co in companies:
        if not co.get("stock_code"):
            continue
        industry = s.classify(co.get("sector_code"), co.get("stock_code"))
        code = (co.get("sector_code") or "").strip()
        ksic2, ksic3 = code[:2] if len(code) >= 2 else None, code[:3] if len(code) >= 3 else (code[:2] if len(code) >= 2 else None)
        picked = {}
        for pk, fs_map in store.get(co["corp_code"], {}).items():
            row, fs = pick_fs(fs_map)
            if not row:
                continue
            picked[pk] = {
                "revenue": fnum(row.get("revenue")),
                "opm": fnum(row.get("opm_pct")),
                "roe": fnum(row.get("roe_pct")),
                "debt": fnum(row.get("debt_ratio_pct")),
                "oi": fnum(row.get("operating_income")),
                "fs": fs,
            }

        def g(pk, field):
            return (picked.get(pk) or {}).get(field)

        growth, span = None, None
        for a, b, y in (("2021A", "2025A", 4), ("2022A", "2025A", 3), ("2021A", "2024A", 3)):
            val = cagr(g(a, "revenue"), g(b, "revenue"), y)
            if val is not None:
                growth, span = val, f"{a}->{b}"
                break
        ttm_g = cagr(g("2025TTM", "revenue"), g("2026TTM", "revenue"), 1)
        latest_rev = g("2025A", "revenue") or g("2024A", "revenue")
        latest_opm = g("2025A", "opm") if g("2025A", "opm") is not None else g("2024A", "opm")
        latest_roe = g("2025A", "roe") if g("2025A", "roe") is not None else g("2024A", "roe")
        ttm_opm = g("2026TTM", "opm")
        ttm_roe = g("2026TTM", "roe")
        ttm_rev = g("2026TTM", "revenue")
        h4 = (
            growth is not None and growth >= 0.10
            and latest_opm is not None and latest_opm >= 8.0
            and latest_roe is not None and latest_roe >= 12.0
            and latest_rev is not None and latest_rev >= 30_000_000_000
        )
        now_good = (
            ttm_opm is not None and ttm_opm >= 8.0
            and ttm_roe is not None and ttm_roe >= 10.0
            and ttm_rev is not None and ttm_rev >= 30_000_000_000
            and (ttm_g is None or ttm_g >= -0.05)
        )
        firms.append({
            "name": co["name"], "stock_code": co["stock_code"], "market": co["market"],
            "sector_code": code, "industry": industry,
            "industry_name": s.INDUSTRIES[industry][0] if industry else None,
            "ksic2": ksic2, "ksic3": ksic3,
            "growth": growth, "span": span,
            "rev_억": round(latest_rev / 1e8, 0) if latest_rev else None,
            "opm": latest_opm, "roe": latest_roe,
            "ttm_rev_억": round(ttm_rev / 1e8, 0) if ttm_rev else None,
            "ttm_opm": ttm_opm, "ttm_roe": ttm_roe, "ttm_yoy": ttm_g,
            "h4": h4, "now_good": now_good,
        })

    def summarize(members, extra):
        return {
            **extra,
            "n": len(members),
            "n_ttm": sum(1 for m in members if m["ttm_opm"] is not None),
            "median_cagr": med_pct([m["growth"] for m in members]),
            "median_opm": med([m["opm"] for m in members]),
            "median_roe": med([m["roe"] for m in members]),
            "median_ttm_opm": med([m["ttm_opm"] for m in members]),
            "median_ttm_roe": med([m["ttm_roe"] for m in members]),
            "median_ttm_yoy": med_pct([m["ttm_yoy"] for m in members]),
            "n_h4": sum(1 for m in members if m["h4"]),
            "n_now": sum(1 for m in members if m["now_good"]),
            "h4_names": [m["name"] for m in members if m["h4"]],
            "now_names": [m["name"] for m in members if m["now_good"]],
        }

    by_ind = defaultdict(list)
    by_k3 = defaultdict(list)
    for m in firms:
        if m["industry"]:
            by_ind[m["industry"]].append(m)
        if m["ksic3"]:
            by_k3[m["ksic3"]].append(m)

    industries = []
    for ind, members in by_ind.items():
        name, sid, sname = s.INDUSTRIES[ind]
        row = summarize(members, {"industry": ind, "industry_name": name, "sector": sid})
        # 트랙 A: 연간 중앙값 (원래 채1)
        row["pass_annual"] = (
            row["n"] >= 8 and row["median_cagr"] is not None and row["median_cagr"] >= 8
            and row["median_opm"] is not None and row["median_opm"] >= 6
            and row["median_roe"] is not None and row["median_roe"] >= 8
            and row["n_h4"] >= 3
        )
        # 트랙 B: 지금(2026TTM) 중앙값이 좋고 H4 클러스터
        row["pass_now"] = (
            row["n"] >= 8 and row["n_ttm"] >= 6
            and row["median_ttm_opm"] is not None and row["median_ttm_opm"] >= 6
            and row["median_ttm_roe"] is not None and row["median_ttm_roe"] >= 8
            and row["n_now"] >= 3
        )
        # 트랙 C: 중앙값은 평범, H4 밀도가 있다
        row["pass_cluster"] = row["n"] >= 15 and row["n_h4"] >= 5
        industries.append(row)
    industries.sort(key=lambda r: (-r["n_now"], -r["n_h4"], -(r["median_ttm_opm"] or -99)))

    clusters = []
    for k3, members in by_k3.items():
        if len(members) < 6:
            continue
        k2 = k3[:2]
        row = summarize(members, {
            "ksic3": k3,
            "ksic2_name": KSIC_DIV.get(k2, k2),
            "example": ", ".join(m["name"] for m in members[:4]),
        })
        row["pass"] = (
            row["n"] >= 6
            and row["median_ttm_opm"] is not None and row["median_ttm_opm"] >= 6
            and row["median_ttm_roe"] is not None and row["median_ttm_roe"] >= 8
            and (row["n_now"] >= 2 or row["n_h4"] >= 2)
        )
        clusters.append(row)
    clusters.sort(key=lambda r: (0 if r["pass"] else 1, -r["n_now"], -(r["median_ttm_opm"] or -99)))

    h4_firms = [m for m in firms if m["h4"]]
    h4_firms.sort(key=lambda m: (-(m["growth"] or -99), -(m["roe"] or -99)))
    now_firms = [m for m in firms if m["now_good"]]
    now_firms.sort(key=lambda m: (-(m["ttm_opm"] or -99), -(m["ttm_roe"] or -99)))

    def slim(m):
        return {k: m[k] for k in (
            "name", "stock_code", "market", "industry_name", "sector_code",
            "growth", "span", "rev_억", "opm", "roe",
            "ttm_rev_억", "ttm_opm", "ttm_roe", "ttm_yoy", "h4", "now_good",
        )}

    out = {
        "표본": {"상장사": len(firms), "fin_periods": len(periods),
                 "h4": len(h4_firms), "now_good": len(now_firms)},
        "산업": industries,
        "ksic3_통과": [c for c in clusters if c["pass"]],
        "ksic3_전체": clusters,
        "h4_종목": [slim(m) for m in h4_firms],
        "now_종목": [slim(m) for m in now_firms],
    }
    json.dump(out, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
