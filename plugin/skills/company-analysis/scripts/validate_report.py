#!/usr/bin/env python3
"""리포트 검증 게이트 — 저장 전에 반드시 통과해야 한다 (exit 0 = 통과).

마크다운 지시("~를 확인하라")를 프로그램 검증으로 대체한다:
frontmatter 스펙, 필수 섹션, 9칸 매트릭스 표, 고지 문구, 그리고
frontmatter 숫자들의 내부 정합성(진입가 = 낙점 ÷ 3, 상승여력 = 낙점/현재가 − 1)을 검사한다.
valuation.json을 주면 계산기 출력과 리포트 frontmatter의 일치까지 교차검증한다.

사용법:
    python3 validate_report.py <report.md> [--valuation valuation.json]

순수 표준 라이브러리(Python 3.9+), 외부 의존성 없음.
"""
import argparse
import json
import re
import sys

FM_REQUIRED_COMMON = [
    "종목", "모드", "데이터기준일", "현재주가", "시가총액",
    "적정주가범위", "낙점적정주가", "상승여력", "진입가", "안전마진충족",
]
SECTIONS_BASIC = ["요약", "기업 개요", "1차 자료", "해자", "밸류에이션", "3요소", "판정", "출처"]
SECTIONS_DEEP = SECTIONS_BASIC + ["산업 해부", "밸류체인"]
DISCLAIMER_PAT = re.compile(r"(투자\s*권유|종목\s*추천).{0,40}(아니|않)")
REL_TOL = 0.015  # 반올림 허용 오차 1.5%


def parse_frontmatter(text):
    m = re.match(r"^---\n(.*?)\n---", text, re.S)
    if not m:
        return None
    fm = {}
    for line in m.group(1).splitlines():
        km = re.match(r"^([\w가-힣]+):\s*(.*)$", line)
        if km:
            fm[km.group(1)] = km.group(2).strip().strip('"')
    return fm


def num(v):
    if v is None:
        return None
    s = str(v).replace(",", "").strip()
    try:
        return float(s)
    except ValueError:
        return None


def close(a, b, tol=REL_TOL):
    if a is None or b is None:
        return False
    if b == 0:
        return abs(a) < 1e-9
    return abs(a - b) / abs(b) <= tol


def count_matrix_cells(text):
    """'적정주가 (여력%)' 형태의 매트릭스 셀 수를 센다.

    '1,985,288원 (+76.2%)'와 '198.5만 (+76.2%)' 두 표기를 모두 인식한다.
    """
    full_won = r"[\d,]{4,}\s*원?"
    man_won = r"\d+(?:\.\d+)?\s*만\s*원?"
    pat = r"(?:%s|%s)\s*\([+\-−]?\s*\d+(?:\.\d+)?\s*%%\)" % (full_won, man_won)
    return len(re.findall(pat, text))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("report")
    p.add_argument("--valuation", help="valuation.py 출력 JSON과 교차검증")
    args = p.parse_args()

    try:
        with open(args.report, encoding="utf-8") as f:
            text = f.read()
    except OSError as e:
        print(json.dumps({"passed": False, "failures": ["리포트 읽기 실패: %s" % e]}, ensure_ascii=False))
        sys.exit(1)

    failures = []
    warnings = []

    # 1. frontmatter
    fm = parse_frontmatter(text)
    if fm is None:
        failures.append("frontmatter(---)가 없다")
        fm = {}
    else:
        for k in FM_REQUIRED_COMMON:
            if k not in fm or fm[k] == "":
                failures.append("frontmatter 키 누락: %s" % k)

    mode = fm.get("모드", "기본")
    if mode not in ("기본", "심층"):
        failures.append("모드는 '기본' 또는 '심층'이어야 한다 (현재: %r)" % mode)

    # 2. 필수 섹션
    sections = SECTIONS_DEEP if mode == "심층" else SECTIONS_BASIC
    for s in sections:
        if not re.search(r"^##.*%s" % re.escape(s), text, re.M):
            failures.append("필수 섹션 없음: '## … %s'" % s)

    # 3. 9칸 매트릭스 (적정주가+여력 셀 9개 이상)
    n_cells = count_matrix_cells(text)
    if n_cells < 9:
        failures.append("9칸 매트릭스 미달: '가격원 (+x.x%%)' 형태 셀 %d개 < 9개" % n_cells)

    # 4. 고지 문구
    if not DISCLAIMER_PAT.search(text):
        failures.append("고지 문구 없음 (투자 권유/종목 추천이 아니라는 문장)")

    # 5. 기준일 표기
    if not re.search(r"\d{4}-\d{2}-\d{2}", fm.get("데이터기준일", "") or ""):
        failures.append("데이터기준일이 YYYY-MM-DD 형식이 아니다")

    # 6. frontmatter 내부 정합성 — 손계산 오류를 잡는 핵심 게이트
    price_now = num(fm.get("현재주가"))
    nail_price = num(fm.get("낙점적정주가"))
    entry = num(fm.get("진입가"))
    upside_pct = num(fm.get("상승여력"))
    margin = str(fm.get("안전마진충족", "")).lower()

    if nail_price and entry and not close(entry, nail_price / 3):
        failures.append("정합성: 진입가(%s) ≠ 낙점적정주가 ÷ 3 (%s)"
                        % (format(int(entry), ","), format(int(nail_price / 3), ",")))
    if nail_price and price_now and upside_pct is not None:
        expected = (nail_price / price_now - 1) * 100
        if not close(upside_pct, expected, tol=0.02):
            failures.append("정합성: 상승여력 %.1f%% ≠ (낙점/현재가−1) = %.1f%%" % (upside_pct, expected))
    if upside_pct is not None and margin in ("true", "false"):
        should = upside_pct >= 200
        if should != (margin == "true"):
            failures.append("정합성: 상승여력 %.1f%%인데 안전마진충족=%s" % (upside_pct, margin))

    # 7. valuation.json 교차검증 (있으면)
    if args.valuation:
        try:
            with open(args.valuation, encoding="utf-8") as f:
                v = json.load(f)
            if not close(nail_price, v["낙점"]["적정주가"]):
                failures.append("교차검증: frontmatter 낙점적정주가(%s) ≠ 계산기(%s)"
                                % (fm.get("낙점적정주가"), v["낙점"]["적정주가"]))
            if not close(num(fm.get("진입가")), v["진입가"]):
                failures.append("교차검증: frontmatter 진입가(%s) ≠ 계산기(%s)"
                                % (fm.get("진입가"), v["진입가"]))
            if upside_pct is not None and not close(upside_pct, v["낙점"]["상승여력"] * 100, tol=0.02):
                failures.append("교차검증: frontmatter 상승여력(%s%%) ≠ 계산기(%.1f%%)"
                                % (upside_pct, v["낙점"]["상승여력"] * 100))
            fm_range = fm.get("적정주가범위", "")
            for bound in v["적정주가범위"]:
                if format(bound, ",") not in fm_range and str(bound) not in fm_range.replace(",", ""):
                    warnings.append("적정주가범위에 계산기 값 %s 이 안 보인다 — 확인 필요" % format(bound, ","))
        except (OSError, json.JSONDecodeError, KeyError) as e:
            failures.append("valuation.json 교차검증 실패: %s" % e)

    # 8. 출처·기준일 밀도 (경고만)
    if len(re.findall(r"https?://|출처", text)) < 3:
        warnings.append("출처 표기가 3건 미만 — 1차 자료 근거가 충분한지 확인")

    out = {"passed": not failures, "failures": failures, "warnings": warnings,
           "checked": {"모드": mode, "매트릭스셀": n_cells}}
    print(json.dumps(out, ensure_ascii=False, indent=2))
    sys.exit(0 if not failures else 1)


if __name__ == "__main__":
    main()
