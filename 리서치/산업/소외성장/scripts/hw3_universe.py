#!/usr/bin/env python3
"""이차전지·반도체장비·전자부품 전수 유니버스.

해석하지 않는다. 분류는 sector_screen.classify (sectors.ts 와 동일).
한미반도체 등 기계로 잡힌 장비 후보는 EXTRA_EQ 로만 덧붙인다.
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

import sector_screen as s

ROOT = Path("/workspace/리서치/산업/소외성장")
OUT = ROOT / "스크리닝/2026-08-27-hw3-유니버스.json"

TARGET = {
    "battery": "이차전지",
    "battery-materials": "이차전지 소재",
    "semiconductor-equipment": "반도체장비",
    "electronic-components": "전자부품",
}
# KSIC 가 2929가 아니라 29xx 로 떨어져 기계로 분류된 장비 후보. 확인용.
EXTRA_EQ = {
    "042700": "한미반도체",
    "240810": "원익IPS",
    "036930": "주성엔지니어링",
    "319660": "피에스케이",
    "095610": "테스",
    "084370": "유진테크",
    "039030": "이오테크닉스",
    "064760": "티씨케이",
    "403870": "HPSP",
    "140860": "파크시스템스",
}


def main():
    url, key = s.credentials()
    companies = s.get("companies", {
        "select": "corp_code,name,stock_code,market,sector_code",
        "market": "in.(KOSPI,KOSDAQ)",
        "order": "corp_code",
    }, url, key)
    periods = s.get("fin_periods", {
        "select": "corp_code,period_key,fs_div,bsns_year,period_type,revenue,operating_income,opm_pct,roe_pct",
        "or": "(and(period_type.eq.A,bsns_year.in.(2022,2023,2024,2025)),"
              "and(period_type.eq.TTM,bsns_year.in.(2026)))",
        "order": "corp_code",
    }, url, key)
    store = defaultdict(lambda: defaultdict(dict))
    for p in periods:
        store[p["corp_code"]][p["period_key"]][p.get("fs_div")] = p

    rows = []
    for co in companies:
        code = co.get("stock_code")
        if not code:
            continue
        ind = s.classify(co.get("sector_code"), code)
        extra = code in EXTRA_EQ
        if ind not in TARGET and not extra:
            continue
        picked = {}
        for pk, fs_map in store.get(co["corp_code"], {}).items():
            row, fs = s.pick_fs(fs_map)
            if not row:
                continue
            rev = s.fnum(row.get("revenue"))
            oi = s.fnum(row.get("operating_income"))
            picked[pk] = {
                "rev": None if rev is None else round(rev / 1e8, 1),
                "oi": None if oi is None else round(oi / 1e8, 1),
                "opm": s.fnum(row.get("opm_pct")),
                "roe": s.fnum(row.get("roe_pct")),
                "fs": fs,
            }

        def g(pk, f):
            return (picked.get(pk) or {}).get(f)

        growth, span = None, None
        for a, b, y in (("2022A", "2025A", 3), ("2023A", "2025A", 2), ("2022A", "2024A", 2)):
            va, vb = g(a, "rev"), g(b, "rev")
            if va and vb and va > 0:
                growth = (vb / va) ** (1 / y) - 1
                span = f"{a}->{b}"
                break
        latest = "2025A" if g("2025A", "rev") else ("2024A" if g("2024A", "rev") else None)
        rows.append({
            "name": co["name"], "stock_code": code, "market": co.get("market"),
            "sector_code": co.get("sector_code"),
            "industry": TARGET.get(ind, "기계(장비후보)"),
            "industry_id": ind,
            "extra_eq": extra,
            "cagr": None if growth is None else round(growth * 100, 1),
            "span": span,
            "rev_억": g(latest, "rev") if latest else None,
            "oi_억": g(latest, "oi") if latest else None,
            "opm": g(latest, "opm") if latest else None,
            "roe": g(latest, "roe") if latest else None,
            "ttm_rev_억": g("2026TTM", "rev"),
            "ttm_oi_억": g("2026TTM", "oi"),
            "ttm_opm": g("2026TTM", "opm"),
            "years": {k: picked[k] for k in sorted(picked) if k.endswith("A") or k.endswith("TTM")},
        })

    rows.sort(key=lambda r: (r["industry"], -(r.get("cagr") or -999)))
    OUT.write_text(json.dumps({
        "기준": {
            "날짜": "2026-08-27",
            "산업": list(TARGET.values()) + ["기계(장비후보)"],
            "분류": "packages/schema/src/sectors.ts 2026.08.1",
        },
        "n": len(rows),
        "결과": rows,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    by = defaultdict(int)
    for r in rows:
        by[r["industry"]] += 1
    print(json.dumps({"n": len(rows), "by": dict(by), "저장": str(OUT)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
