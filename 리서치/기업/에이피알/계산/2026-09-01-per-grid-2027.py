#!/usr/bin/env python3
"""2027 매출 시나리오 × PER 주가 그리드. 산식은 valuation.py와 같다.

    주가 = 순이익_억원 × PER × 1e8 / 발행주식수
    순이익 = 매출 × 영업이익률 × 세후계수

valuation.py는 PER 3개만 받으므로, 15/20/25/30/36 표는 여기서 만든다.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "2026-09-01-per-grid-2027.json")

SHARES = 37438155
PRICE = 432500
MCAP = PRICE * SHARES / 1e8
OPM = 0.25
TAX = 0.8
PERS = [15, 20, 25, 30, 36]
SCENARIOS = [
    {"이름": "2026E 동결", "성장률": 0.00, "매출2027_억원": 30000,
     "무엇을보나": "2026 가이던스 3.0조를 2027에도 유지"},
    {"이름": "08-18 균등", "성장률": 0.27, "매출2027_억원": 38100,
     "무엇을보나": "8/18 리포트 낙점 CAGR을 2027 한 해에 적용"},
    {"이름": "약화", "성장률": 0.60, "매출2027_억원": 48000,
     "무엇을보나": "08-25·08-28 케이스1. 북미 더블 실패"},
    {"이름": "권역 하나 빠짐", "성장률": 0.80, "매출2027_억원": 54000,
     "무엇을보나": "08-25: 한 권역이 빠지면 전사 +78~88%"},
    {"이름": "채널 더블", "성장률": 1.00, "매출2027_억원": 60000,
     "무엇을보나": "08-25·08-28 케이스2·3. 2027은 채널과 의료가 같다"},
]


def main():
    rows = []
    for s in SCENARIOS:
        op = s["매출2027_억원"] * OPM
        ni = op * TAX
        prices = {str(p): round(ni * p * 1e8 / SHARES) for p in PERS}
        upsides = {str(p): round(prices[str(p)] / PRICE - 1, 4) for p in PERS}
        rows.append({
            **s,
            "영업이익2027_억원": round(op, 1),
            "순이익2027_억원": round(ni, 1),
            "내재PER": round(MCAP / ni, 2),
            "내재PSR": round(MCAP / s["매출2027_억원"], 2),
            "주가": prices,
            "여력": upsides,
        })
    out = {
        "종목": "에이피알",
        "데이터기준일": "2026-09-01",
        "산식": "주가 = 2027순익_억원 × PER × 1억 / 발행주식수. 순익 = 매출 × 0.25 × 0.8. 주가는 현재가와 무관.",
        "시세": {
            "주가": PRICE,
            "시총_억원": round(MCAP, 2),
            "발행주식수": SHARES,
            "출처": "다음금융 A278470, 2026-09-02 07:00 PRE_MARKET, prevClosingPrice=432500 (2026-09-01 종가), isClosing false",
            "high52w": 475000,
            "high52wDate": "2026-09-01",
            "비고": "475,000은 09-01 당일 고가. 종가는 432,500.",
        },
        "고정가정": {
            "기준연도매출_억원": 30000,
            "영업이익률": OPM,
            "세후계수": TAX,
            "순이익률": OPM * TAX,
        },
        "PER목록": PERS,
        "시나리오": rows,
        "검산": {
            "PER20_동결": 320529,
            "PER30_더블": rows[-1]["주가"]["30"],
            "2028낙점대비_더블PER30": "961,586 = 08-28 2년 낙점 1,346,220 × (12,000/16,800)",
        },
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(json.dumps({"ok": True, "out": OUT, "implied_double": rows[-1]["내재PER"]},
                     ensure_ascii=False))


if __name__ == "__main__":
    main()
