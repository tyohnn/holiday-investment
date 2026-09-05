#!/usr/bin/env python3
"""에이피알형 78종 연도별 경로 QC.

PEG가 싼 이유: 다년 성장인가, 한 해 스파이크인가, 홀딩/회복/테마인가.
해석 문장은 쓰지 않고 플래그만 붙인다.
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

import sector_screen as s

ROOT = Path("/workspace/리서치/산업/소외성장")
SRC = ROOT / "스크리닝/2026-08-27-에이피알형.json"
OUT = ROOT / "스크리닝/2026-08-27-에이피알형-QC.json"

HOT = {
    "반도체", "디스플레이", "이차전지", "전기장비", "조선", "방산",
    "자동차", "석유화학",
}
HOLDCO_HINT = ("홀딩스", "지주")
TRAVEL = {"하나투어", "참좋은여행", "JTC", "GKL", "모두투어", "노랑풍선", "글로벌텍스프리"}
KNOWN_TRAP = {
    "다우데이타": "연결 유통·증권 매출 팽창, 시총 대비 매출 왜곡",
    "다우기술": "홀딩/연결 왜곡 인접",
    "F&F홀딩스": "지주",
    "HD현대": "지주",
    "한화에어로스페이스": "방산 고관심",
    "제룡전기": "변압기 고관심",
    "삼양식품": "라면 대장 고관심",
    "우원개발": "건설, TTM 역성장",
}


def spike_flags(years):
    """years: list of {key, rev, oi, opm} sorted."""
    flags = []
    if len(years) < 2:
        return ["연간행부족"]
    revs = [y["rev"] for y in years if y["rev"] and y["rev"] > 0]
    ois = [(y["key"], y["oi"]) for y in years if y["oi"] is not None]
    if len(revs) >= 2:
        last, prev = revs[-1], revs[-2]
        if prev > 0 and last / prev >= 2.5:
            flags.append("매출_말년점프")
        if prev > 0 and last / prev < 0.85:
            flags.append("매출_말년하락")
    if len(ois) >= 2:
        last_oi, prev_oi = ois[-1][1], ois[-2][1]
        if prev_oi and prev_oi > 0 and last_oi is not None and last_oi / prev_oi >= 3:
            flags.append("영익_말년점프")
        if last_oi is not None and last_oi <= 0:
            flags.append("최근연적자")
        # mid-path loss then recovery
        if any(oi is not None and oi <= 0 for _, oi in ois[:-1]) and last_oi and last_oi > 0:
            flags.append("적자회복경로")
    # monotonic-ish growth: each year >= 0.9 * prev
    if len(revs) >= 4:
        ok = all(revs[i] >= revs[i - 1] * 0.9 for i in range(1, len(revs)))
        if ok and revs[-1] >= revs[0] * 1.8:
            flags.append("다년성장경로")
    return flags


def main():
    src = json.loads(SRC.read_text())
    rows = src["결과"]
    codes = [r["stock_code"] for r in rows]
    url, key = s.credentials()
    cos = s.get("companies", {
        "select": "corp_code,stock_code,name,sector_code,market",
        "stock_code": f"in.({','.join(codes)})",
    }, url, key)
    by_code = {c["stock_code"]: c for c in cos}
    corps = [c["corp_code"] for c in cos]
    ann = []
    for i in range(0, len(corps), 40):
        chunk = corps[i:i + 40]
        ann.extend(s.get("fin_periods", {
            "select": "corp_code,period_key,fs_div,revenue,operating_income,net_income,opm_pct,roe_pct",
            "period_type": "eq.A",
            "corp_code": f"in.({','.join(chunk)})",
            "order": "period_key.asc",
        }, url, key))
    by_cid = defaultdict(list)
    for r in ann:
        by_cid[r["corp_code"]].append(r)

    def pick_years(corp):
        years = {}
        for r in by_cid.get(corp, []):
            y = r["period_key"]
            if y not in years:
                years[y] = r
            elif r.get("fs_div") == "CFS" and years[y].get("fs_div") != "CFS":
                years[y] = r
        out = []
        for k in sorted(years):
            r = years[k]
            rev = s.fnum(r.get("revenue"))
            oi = s.fnum(r.get("operating_income"))
            out.append({
                "key": k,
                "fs": r.get("fs_div"),
                "rev": None if rev is None else round(rev / 1e8, 1),
                "oi": None if oi is None else round(oi / 1e8, 1),
                "ni": None if s.fnum(r.get("net_income")) is None else round(s.fnum(r.get("net_income")) / 1e8, 1),
                "opm": s.fnum(r.get("opm_pct")),
                "roe": s.fnum(r.get("roe_pct")),
            })
        return out

    qc = []
    for r in rows:
        co = by_code.get(r["stock_code"])
        years = pick_years(co["corp_code"]) if co else []
        flags = spike_flags(years)
        name = r["name"]
        ind = r.get("industry") or ""
        if ind in HOT:
            flags.append("고관심산업")
        if any(h in name for h in HOLDCO_HINT):
            flags.append("지주")
        if name in TRAVEL:
            flags.append("여행회복")
        if name in KNOWN_TRAP:
            flags.append("기지함정")
        if r.get("ttm_yoy") is not None and r["ttm_yoy"] < 0:
            flags.append("TTM역성장")
        if r.get("rev_억") and r["rev_억"] >= 50_000 and r.get("PSR") is not None and r["PSR"] < 0.1:
            flags.append("연결매출왜곡의심")
        if r.get("PEG") is not None and r["PEG"] < 0.05:
            flags.append("PEG극소_검증필수")
        qc.append({
            **{k: r.get(k) for k in (
                "name", "stock_code", "industry", "market", "cagr", "span",
                "opm", "roe", "rev_억", "oi_억", "ttm_rev_억", "ttm_opm", "ttm_yoy",
                "mcap_억", "간이PER", "PSR", "PEG", "source",
            )},
            "sector_code": (co or {}).get("sector_code"),
            "years": years,
            "flags": flags,
        })

    OUT.write_text(json.dumps({
        "기준": {
            "원본": str(SRC),
            "플래그": "매출_말년점프=최근연/직전≥2.5, 영익_말년점프=≥3, 다년성장경로=4년↑ 매년≥0.9×직전",
        },
        "결과": qc,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"n": len(qc), "저장": str(OUT)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
