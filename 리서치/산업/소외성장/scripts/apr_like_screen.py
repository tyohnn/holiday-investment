#!/usr/bin/env python3
"""에이피알형 스크린 — 높은 매출 CAGR 대비 시총이 싼 종목.

기준점(에이피알 278470, 2026-08-25 리서치):
  2022→2025 CAGR 55.8%, 2025A OPM 23.9%, 시총 14.84조
  간이 PER(시총÷영업이익×0.8) 50.8, PEG 50.8/55.8 ≈ 0.91, PSR 9.7

이 스크립트는 군집실적.json 에서 CAGR≥20%·OPM≥8%·매출≥300억을 읽고
다음금융 API 로 시총을 받아 PEG·PSR 을 계산한다. 해석은 하지 않는다.
"""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path("/workspace/리서치/산업/소외성장")
CLUSTER = ROOT / "스크리닝/2026-08-27-군집실적.json"
OUT = ROOT / "스크리닝/2026-08-27-에이피알형.json"

UA = "Mozilla/5.0"
# 에이피알 스냅샷 — 리서치/기업/에이피알/계산/2026-08-25-valuation.json
APR = {
    "name": "에이피알", "stock_code": "278470",
    "cagr": 0.558, "opm": 23.93, "roe": 64.97,
    "rev_억": 15273, "mcap_억": 148442,
    "간이PER": 50.8, "PEG": 0.91, "PSR": 9.72,
    "출처": "2026-08-25 기본분석, 종가 8/18",
}


def quote(code: str):
    url = f"https://finance.daum.net/api/quotes/A{code}?summary=false&changeStatistics=true"
    req = urllib.request.Request(url, headers={
        "Referer": f"https://finance.daum.net/quotes/A{code}",
        "User-Agent": UA,
        "Accept": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            d = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
        return {"error": str(exc)}
    mcap = d.get("marketCap")
    price = d.get("tradePrice")
    if mcap is None or price is None:
        return {"error": "no marketCap/tradePrice", "raw_keys": list(d.keys())[:12]}
    return {
        "price": float(price),
        "mcap_억": float(mcap) / 1e8,
        "listed": d.get("listedShareCount"),
        "date": d.get("date") or d.get("tradeDate") or "",
        "source": f"https://finance.daum.net/quotes/A{code}",
    }


def main():
    d = json.loads(CLUSTER.read_text())
    seen, rows = set(), []
    for m in d["h4_종목"] + d["now_종목"]:
        if m["stock_code"] in seen:
            continue
        seen.add(m["stock_code"])
        g, opm, rev = m.get("growth"), m.get("opm"), m.get("rev_억")
        if g is None or g < 0.20 or opm is None or opm < 8 or rev is None or rev < 300:
            continue
        rows.append(m)

    out = []
    for i, m in enumerate(rows, 1):
        q = quote(m["stock_code"])
        time.sleep(0.15)
        oi = m["rev_억"] * m["opm"] / 100.0
        ttm_rev = m.get("ttm_rev_억") or m["rev_억"]
        ttm_opm = m.get("ttm_opm") if m.get("ttm_opm") is not None else m["opm"]
        ttm_oi = ttm_rev * ttm_opm / 100.0 if ttm_rev and ttm_opm is not None else oi
        rec = {
            "name": m["name"], "stock_code": m["stock_code"],
            "industry": m.get("industry_name"), "market": m.get("market"),
            "cagr": round(m["growth"] * 100, 1),
            "span": m.get("span"),
            "opm": m["opm"], "roe": m["roe"],
            "rev_억": m["rev_억"], "oi_억": round(oi, 1),
            "ttm_rev_억": m.get("ttm_rev_억"),
            "ttm_opm": m.get("ttm_opm"),
            "ttm_yoy": None if m.get("ttm_yoy") is None else round(m["ttm_yoy"] * 100, 1),
            "h4": m.get("h4"),
        }
        if "error" in q:
            rec["quote_error"] = q["error"]
            rec["PEG"] = None
        else:
            rec.update(q)
            per = rec["mcap_억"] / (oi * 0.8) if oi > 0 else None
            per_ttm = rec["mcap_억"] / (ttm_oi * 0.8) if ttm_oi and ttm_oi > 0 else None
            rec["간이PER"] = round(per, 2) if per else None
            rec["간이PER_TTM"] = round(per_ttm, 2) if per_ttm else None
            rec["PSR"] = round(rec["mcap_억"] / m["rev_억"], 2)
            rec["PEG"] = round(per / (m["growth"] * 100), 3) if per and m["growth"] else None
        out.append(rec)
        print(f"[{i}/{len(rows)}] {m['name']} PEG={rec.get('PEG')} PER={rec.get('간이PER')}", file=sys.stderr)

    out.sort(key=lambda r: (999 if r.get("PEG") is None else r["PEG"], -r["cagr"]))
    payload = {
        "기준": {
            "날짜": "2026-08-27",
            "에이피알": APR,
            "컷": "CAGR≥20% · OPM≥8% · 매출≥300억 · 군집실적.json h4와 now 합집합",
            "간이PER": "시총 ÷ (연간 영업이익 × 0.8)",
            "PEG": "간이PER ÷ (CAGR%)",
            "시세": "finance.daum.net/api/quotes",
        },
        "결과": out,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"n": len(out), "저장": str(OUT)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
