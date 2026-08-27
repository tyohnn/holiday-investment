#!/usr/bin/env python3
"""전 상장사 H4∪에이피알형 합집합에 시세·PEG·연도 플래그를 붙인다.

관심도 필터 없음. 고관심 산업은 플래그만. 해석은 하지 않는다.
"""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from pathlib import Path

import apr_like_qc as qc
import apr_like_screen as scr
import sector_screen as s

ROOT = Path("/workspace/리서치/산업/소외성장")
CLUSTER = ROOT / "스크리닝/2026-08-27-군집실적.json"
OLD = ROOT / "스크리닝/2026-08-27-에이피알형.json"
OUT = ROOT / "스크리닝/2026-08-27-전상장-탑후보.json"
MD = ROOT / "스크리닝/2026-08-27-전상장-탑후보.md"

HOT_IND = {
    "반도체", "디스플레이", "이차전지", "전기장비", "조선", "방산", "우주항공·방산",
    "자동차", "석유화학", "화장품", "바이오·신약",
}
HOT_NAME = {
    "한미반도체", "삼양식품", "한화에어로스페이스", "제룡전기", "에이피알", "실리콘투",
    "SK하이닉스", "한화오션", "HD현대중공업", "HD현대일렉트릭", "효성중공업",
    "엘에스일렉트릭", "현대로템", "삼성중공업", "알테오젠", "삼성바이오로직스",
}


def quote(code: str):
    return scr.quote(code)


def main():
    cluster = json.loads(CLUSTER.read_text())
    old = {r["stock_code"]: r for r in json.loads(OLD.read_text())["결과"]}
    seen, rows = {}, []
    for m in cluster["h4_종목"] + cluster["now_종목"]:
        g, opm, rev = m.get("growth"), m.get("opm"), m.get("rev_억")
        h4 = bool(m.get("h4"))
        apr = g is not None and g >= 0.20 and opm is not None and opm >= 8 and rev is not None and rev >= 300
        if not (h4 or apr):
            continue
        code = m["stock_code"]
        if code in seen:
            if h4:
                seen[code]["h4"] = True
            continue
        rec = dict(m)
        rec["h4"] = h4
        rec["apr_cut"] = apr
        seen[code] = rec
        rows.append(rec)

    out = []
    for i, m in enumerate(rows, 1):
        code = m["stock_code"]
        prev = old.get(code)
        if prev and prev.get("mcap_억") and "quote_error" not in prev:
            q = {k: prev[k] for k in ("price", "mcap_억", "listed", "date", "source") if k in prev}
        else:
            q = quote(code)
            time.sleep(0.12)
        oi = (m.get("rev_억") or 0) * (m.get("opm") or 0) / 100.0
        rec = {
            "name": m["name"], "stock_code": code,
            "industry": m.get("industry_name"), "market": m.get("market"),
            "cagr": None if m.get("growth") is None else round(m["growth"] * 100, 1),
            "span": m.get("span"),
            "opm": m.get("opm"), "roe": m.get("roe"),
            "rev_억": m.get("rev_억"), "oi_억": round(oi, 1),
            "ttm_rev_억": m.get("ttm_rev_억"),
            "ttm_opm": m.get("ttm_opm"),
            "ttm_yoy": None if m.get("ttm_yoy") is None else round(m["ttm_yoy"] * 100, 1),
            "h4": m.get("h4"), "apr_cut": m.get("apr_cut"),
        }
        if "error" in q:
            rec["quote_error"] = q["error"]
        else:
            rec.update(q)
            if oi > 0 and rec.get("mcap_억"):
                per = rec["mcap_억"] / (oi * 0.8)
                rec["간이PER"] = round(per, 2)
                rec["PSR"] = round(rec["mcap_억"] / m["rev_억"], 2) if m.get("rev_억") else None
                rec["PEG"] = round(per / rec["cagr"], 3) if rec.get("cagr") else None
        out.append(rec)
        print(f"[{i}/{len(rows)}] {m['name']} PEG={rec.get('PEG')}", file=sys.stderr)

    # year flags
    url, key = s.credentials()
    codes = [r["stock_code"] for r in out]
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
        outy = []
        for k in sorted(years):
            r = years[k]
            rev = s.fnum(r.get("revenue"))
            oi = s.fnum(r.get("operating_income"))
            outy.append({
                "key": k,
                "fs": r.get("fs_div"),
                "rev": None if rev is None else round(rev / 1e8, 1),
                "oi": None if oi is None else round(oi / 1e8, 1),
                "opm": s.fnum(r.get("opm_pct")),
                "roe": s.fnum(r.get("roe_pct")),
            })
        return outy

    for r in out:
        co = by_code.get(r["stock_code"])
        years = pick_years(co["corp_code"]) if co else []
        flags = qc.spike_flags(years)
        name, ind = r["name"], r.get("industry") or ""
        if ind in HOT_IND or name in HOT_NAME:
            flags.append("고관심산업")
        if any(h in name for h in qc.HOLDCO_HINT):
            flags.append("지주")
        if name in qc.TRAVEL:
            flags.append("여행회복")
        if name in qc.KNOWN_TRAP:
            flags.append("기지함정")
        if r.get("ttm_yoy") is not None and r["ttm_yoy"] < 0:
            flags.append("TTM역성장")
        if r.get("rev_억") and r["rev_억"] >= 50_000 and r.get("PSR") is not None and r["PSR"] < 0.1:
            flags.append("연결매출왜곡의심")
        if r.get("PEG") is not None and r["PEG"] < 0.05:
            flags.append("PEG극소_검증필수")
        r["years"] = years
        r["flags"] = flags

    out.sort(key=lambda r: (999 if r.get("PEG") is None else r["PEG"], -(r.get("cagr") or 0)))
    payload = {
        "기준": {
            "날짜": "2026-08-27",
            "컷": "H4(CAGR≥10·OPM≥8·ROE≥12·매출≥300) ∪ 에이피알형(CAGR≥20·OPM≥8·매출≥300)",
            "관심도필터": "없음. 고관심은 플래그만",
            "간이PER": "시총 ÷ (연간 영업이익 × 0.8)",
            "PEG": "간이PER ÷ (매출 CAGR%)",
            "시세": "finance.daum.net — 기존 78사는 8/27 스냅샷 재사용, 신규는 당일 재조회",
        },
        "결과": out,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "---",
        "title: 전 상장사 탑후보 스크린",
        "데이터기준일: 2026-08-27",
        "---",
        "",
        f"# 전 상장사 탑후보 ({len(out)}사)",
        "",
        "해석은 분석 문서. 이 파일은 컷과 숫자만.",
        "",
        "| 종목 | 코드 | 산업 | CAGR | OPM | PEG | 간이PER | 시총억 | H4 | 플래그 |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for r in out:
        if r.get("PEG") is None:
            continue
        flags = ",".join(r.get("flags") or [])
        lines.append(
            f"| {r['name']} | {r['stock_code']} | {r.get('industry') or ''} | "
            f"{r.get('cagr')} | {r.get('opm')} | {r.get('PEG')} | {r.get('간이PER')} | "
            f"{round(r.get('mcap_억') or 0)} | {r.get('h4')} | {flags} |"
        )
    MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"n": len(out), "저장": str(OUT)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
