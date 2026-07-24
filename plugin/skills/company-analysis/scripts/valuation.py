#!/usr/bin/env python3
"""3년 후 적정주가 5단계 계산기 — 9칸 매트릭스·낙점·진입가를 결정론적으로 산출한다.

에이전트는 가정(assumptions)을 고르고, 산수는 이 스크립트가 전담한다.
순수 표준 라이브러리(Python 3.9+), 외부 의존성 없음.

사용법:
    python3 valuation.py <assumptions.json> [--out valuation.json] [--quiet]

assumptions.json 스키마 (금액 단위: 억 원, 비율은 소수):
{
  "종목": "삼양식품",
  "데이터기준일": "2026-07-24",
  "현재주가": 1127000,
  "현재시총_억원": 84897,
  "기준연도매출_억원": 23518,
  "성장률_3케이스": [0.15, 0.20, 0.28],
  "영업이익률": 0.23,
  "적정PER_3값": [15, 20, 25],
  "낙점": {"성장률": 0.20, "PER": 20},
  "발행주식수": 7533015,                  // 선택: 주가×주식수 ↔ 시총 정합 검증용
  "직전연도_영업이익_억원": 5239,        // 선택: 실전 PER 계산용
  "차기연도_영업이익추정_억원": 7137,     // 선택: 포워드 실전 PER
  "세후계수": 0.8,                        // 선택, 기본 0.8
  "연수": 3                               // 선택, 기본 3
}

성장률 케이스는 소수 하나(균등 CAGR) 또는 연차별 배열을 섞어 쓸 수 있다 —
M&A 연결·신공장 램프업처럼 "1년차 점프 후 저성장" 경로가 있는 기업용:
  "성장률_3케이스": [0.08, [0.456, 0.05, 0.05], 0.20],
  "낙점": {"성장률": [0.456, 0.05, 0.05], "PER": 14}
배열 길이는 연수와 같아야 하며, 표에는 CAGR 환산치로 표시된다.

출력: 9칸 매트릭스(적정시총·적정주가·상승여력), 낙점 적정주가·상승여력,
진입가(낙점 적정주가 ÷ 3), 안전마진 충족 여부(상승여력 ≥ 200%),
실전 PER(트레일링/포워드), 낙점 기준 미래 PSR, 리포트에 붙여넣을 마크다운 표.
"""
import argparse
import json
import sys

REQUIRED = [
    "종목", "데이터기준일", "현재주가", "현재시총_억원",
    "기준연도매출_억원", "성장률_3케이스", "영업이익률", "적정PER_3값", "낙점",
]


def fail(msg):
    print(json.dumps({"ok": False, "error": msg}, ensure_ascii=False))
    sys.exit(1)


def growth_factor(g, years):
    """성장률(소수 하나 = 균등 CAGR, 배열 = 연차별 경로) → 누적 성장 배수."""
    if isinstance(g, (list, tuple)):
        f = 1.0
        for y in g:
            f *= 1 + y
        return f
    return (1 + g) ** years


def growth_label(g, years):
    """표시용 라벨 — 배열이면 CAGR 환산치를 병기한다."""
    if isinstance(g, (list, tuple)):
        cagr = growth_factor(g, years) ** (1.0 / len(g)) - 1
        path = "/".join("%g%%" % (y * 100) for y in g)
        return "경로 %s (CAGR %.1f%%)" % (path, cagr * 100)
    return "%g%%" % (g * 100)


def load_assumptions(path):
    try:
        with open(path, encoding="utf-8") as f:
            a = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        fail("assumptions.json 읽기 실패: %s" % e)
    missing = [k for k in REQUIRED if k not in a]
    if missing:
        fail("필수 키 누락: %s" % ", ".join(missing))
    if len(a["성장률_3케이스"]) != 3 or len(a["적정PER_3값"]) != 3:
        fail("성장률_3케이스와 적정PER_3값은 정확히 3개여야 한다 (9칸 매트릭스)")
    years = a.get("연수", 3)
    for g in a["성장률_3케이스"]:
        if isinstance(g, (list, tuple)):
            if len(g) != years:
                fail("연차별 성장률 배열 %s 의 길이는 연수(%d)와 같아야 한다" % (g, years))
            for y in g:
                if not -0.9 < y < 3.0:
                    fail("성장률 %s 은 소수여야 한다 (예: 20%% → 0.20)" % y)
        elif not -0.9 < g < 3.0:
            fail("성장률 %s 은 소수여야 한다 (예: 20%% → 0.20)" % g)
    if not 0.0 < a["영업이익률"] < 1.0:
        fail("영업이익률은 0~1 사이 소수여야 한다 (예: 23%% → 0.23)")
    nail = a["낙점"]
    if nail.get("성장률") not in a["성장률_3케이스"]:
        fail("낙점 성장률 %s 이 성장률_3케이스 안에 없다" % nail.get("성장률"))
    if nail.get("PER") not in a["적정PER_3값"]:
        fail("낙점 PER %s 이 적정PER_3값 안에 없다" % nail.get("PER"))
    # 시총 정합 검증 (발행주식수가 있으면): 주가 × 주식수 ↔ 시총(억원), 3% 초과 시 실패
    if a.get("발행주식수"):
        implied = a["현재주가"] * a["발행주식수"] / 1e8
        if abs(implied - a["현재시총_억원"]) / a["현재시총_억원"] > 0.03:
            fail("시총 정합 실패: 주가×주식수 = %.0f억 vs 현재시총_억원 = %s억 (3%% 초과 괴리)"
                 % (implied, a["현재시총_억원"]))
    return a


def compute(a):
    tax = a.get("세후계수", 0.8)
    years = a.get("연수", 3)
    price_now = a["현재주가"]
    mcap_now = a["현재시총_억원"]
    rev0 = a["기준연도매출_억원"]
    opm = a["영업이익률"]

    cells = []
    for g in a["성장률_3케이스"]:
        rev_n = rev0 * growth_factor(g, years)
        op = rev_n * opm
        ni = op * tax
        row = {"성장률": g, "매출_억원": round(rev_n, 1),
               "영업이익_억원": round(op, 1), "순이익_억원": round(ni, 1), "칸": []}
        for per in a["적정PER_3값"]:
            mcap_fair = ni * per
            price_fair = mcap_fair / mcap_now * price_now
            upside = price_fair / price_now - 1
            row["칸"].append({
                "PER": per,
                "적정시총_억원": round(mcap_fair, 1),
                "적정주가": round(price_fair),
                "상승여력": round(upside, 4),
            })
        cells.append(row)

    ng, nper = a["낙점"]["성장률"], a["낙점"]["PER"]
    nail_row = next(r for r in cells if r["성장률"] == ng)
    nail = next(c for c in nail_row["칸"] if c["PER"] == nper)

    all_prices = [c["적정주가"] for r in cells for c in r["칸"]]
    all_upsides = [c["상승여력"] for r in cells for c in r["칸"]]

    result = {
        "ok": True,
        "종목": a["종목"],
        "데이터기준일": a["데이터기준일"],
        "입력": {"현재주가": price_now, "현재시총_억원": mcap_now,
                 "기준연도매출_억원": rev0, "영업이익률": opm,
                 "세후계수": tax, "연수": years},
        "매트릭스": cells,
        "적정주가범위": [min(all_prices), max(all_prices)],
        "상승여력범위": [round(min(all_upsides), 4), round(max(all_upsides), 4)],
        "낙점": {
            "성장률": ng, "PER": nper,
            "적정시총_억원": nail["적정시총_억원"],
            "적정주가": nail["적정주가"],
            "상승여력": nail["상승여력"],
        },
        "진입가": round(nail["적정주가"] / 3),
        "안전마진충족": nail["상승여력"] >= 2.0,
    }

    if a.get("직전연도_영업이익_억원"):
        result["실전PER_트레일링"] = round(mcap_now / (a["직전연도_영업이익_억원"] * tax), 1)
    if a.get("차기연도_영업이익추정_억원"):
        result["실전PER_포워드"] = round(mcap_now / (a["차기연도_영업이익추정_억원"] * tax), 1)
    result["미래PSR_낙점"] = round(mcap_now / nail_row["매출_억원"], 2)
    return result


def to_markdown(r):
    """리포트에 그대로 붙여넣을 9칸 매트릭스 표와 핵심 수치."""
    pers = [c["PER"] for c in r["매트릭스"][0]["칸"]]
    lines = []
    header = "| %d년 후 기준 | " % r["입력"]["연수"] + " | ".join("PER %g배" % p for p in pers) + " |"
    lines.append(header)
    lines.append("|---|" + "---|" * len(pers))
    years = r["입력"]["연수"]
    for row in r["매트릭스"]:
        cells = []
        for c in row["칸"]:
            mark = "**" if (row["성장률"] == r["낙점"]["성장률"] and c["PER"] == r["낙점"]["PER"]) else ""
            cells.append("%s%s원 (%+.1f%%)%s" % (mark, format(c["적정주가"], ","), c["상승여력"] * 100, mark))
        lines.append("| 성장 %s (순익 %s억) | " % (growth_label(row["성장률"], years),
                                                   format(round(row["순이익_억원"]), ","))
                     + " | ".join(cells) + " |")
    lines.append("")
    lines.append("- 낙점: 성장률 %s × PER %g배 = 적정주가 %s원 (상승여력 %+.1f%%)"
                 % (growth_label(r["낙점"]["성장률"], years), r["낙점"]["PER"],
                    format(r["낙점"]["적정주가"], ","), r["낙점"]["상승여력"] * 100))
    lines.append("- 안전마진(200%%) %s → 진입가 %s원 (낙점 적정주가 ÷ 3)"
                 % ("충족" if r["안전마진충족"] else "미충족", format(r["진입가"], ",")))
    if "실전PER_트레일링" in r:
        lines.append("- 실전 PER(트레일링): %.1f배" % r["실전PER_트레일링"])
    if "실전PER_포워드" in r:
        lines.append("- 실전 PER(포워드): %.1f배" % r["실전PER_포워드"])
    lines.append("- 미래 PSR(낙점 매출 기준): %.2f배" % r["미래PSR_낙점"])
    return "\n".join(lines)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("assumptions")
    p.add_argument("--out", help="valuation.json 저장 경로")
    p.add_argument("--quiet", action="store_true", help="마크다운 표 생략, JSON만 출력")
    args = p.parse_args()

    a = load_assumptions(args.assumptions)
    r = compute(a)
    md = to_markdown(r)
    r["마크다운"] = md

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(r, f, ensure_ascii=False, indent=2)

    if args.quiet:
        print(json.dumps({k: v for k, v in r.items() if k != "마크다운"}, ensure_ascii=False, indent=2))
    else:
        print(json.dumps({k: v for k, v in r.items() if k not in ("마크다운", "매트릭스")},
                         ensure_ascii=False, indent=2))
        print("\n----- 리포트 붙여넣기용 -----\n")
        print(md)


if __name__ == "__main__":
    main()
