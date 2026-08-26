#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""감독(메인 에이전트)의 QC 하네스 — 서브에이전트가 보고한 결함을 고친 뒤 "안전한가"를
한 명령으로 판정한다.

2026-08-26 368개사 배치에서 감독이 결함 13건을 고치며 매번 손으로 짜던 검증을 모았다.
그때 실제로 대형 결함을 잡아낸 세 종류를 그대로 담는다:

  regress   삼성전자 2개 회차의 블록별 적재 수치가 기준선과 같은가 (파서 회귀)
  cases     parse_period_col / num() 의 케이스 표 — 받을 것과 **거부할 것** 둘 다
  integrity DB 에 물리적으로 불가능한 값이 있는가 (R&D>매출·미래연도·합계100% 점유율)

`integrity` 가 특히 중요하다. 게이트가 통과시킨 데이터에서 실제로 세 건의 대형 결함을
찾아냈다: R&D 단위 1000배(72개사 232행) · 종속회사 앵커 오적용(2028A~2089A) ·
시장점유율에 고객사 구성비 적재(합계 100%).

사용법:
    python3 qc.py all          # 전부 (수정 후 항상 이것)
    python3 qc.py regress      # 파서를 고쳤을 때
    python3 qc.py integrity    # 적재 후 / 배치 웨이브가 끝날 때마다
    python3 qc.py baseline     # 기준선 재생성 (의도한 개선을 확정할 때만)
"""
import argparse
import collections
import json
import os
import re
import subprocess
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO = os.path.abspath(os.path.join(_HERE, "..", "..", "..", ".."))
sys.path.insert(0, os.path.join(_REPO, "platform", "ingest"))
sys.path.insert(0, _HERE)
import ingest                      # noqa: E402
import extract_profile as ep       # noqa: E402

BASELINE = os.path.join(_HERE, "..", "references", "회귀-기준선.json")
GOLDEN_CORP = "00126380"                                    # 삼성전자
GOLDEN_RCEPTS = "20260310002820,20250311001085"             # FY2025 · FY2024

# ── 케이스 표. 받을 것뿐 아니라 **거부해야 할 것**을 반드시 함께 둔다 — 정규식을 넓히다
#    보면 거부해야 할 라벨까지 받아버리는데, 그건 조용한 연도 오염이라 게이트도 못 잡는다.
PERIOD_CASES = [
    ("제57기", ("gi", 57, None)), ("57기", ("gi", 57, None)),
    ("제58기 1분기", ("gi", 58, 1)), ("제58기 반기", ("gi", 58, "H1")),
    ("제58기(당기)", ("gi", 58, None)), ("제58기 기말", ("gi", 58, None)),
    ("제58기말", ("gi", 58, None)), ("제 70(당) 기", ("gi", 70, None)),
    ("제70기 연간", ("gi", 70, None)), ("53기 연간", ("gi", 53, None)),
    ("제38기(2025년도)", ("year", 2025, None)), ("제38기(FY 2025)", ("year", 2025, None)),
    ("제46기 연간(2024년도)", ("year", 2024, None)),
    ("2025년도(제38기)", ("year", 2025, None)), ("2025년(제38기)", ("year", 2025, None)),
    ("2025", ("year", 2025, None)), ("2025년", ("year", 2025, None)),
    ("2025년도", ("year", 2025, None)), ("2025연도", ("year", 2025, None)),
    ("2025년 당기", ("year", 2025, None)), ("2025년(1.1~12.31)", ("year", 2025, None)),
    ("2025년 12월 31일", ("year", 2025, None)), ("FY2025", ("year", 2025, None)),
    ("2025.12", ("year", 2025, None)),
    ("제38기(2025년말)", ("year", 2025, None)),
    ("제46기 기말 (2024년 12월말)", ("year", 2024, None)),
    ("2025년 말", ("year", 2025, None)), ("2025년말", ("year", 2025, None)),
    ("2025년 기말", ("year", 2025, None)),
    ("2024.01~2024.12", ("year", 2024, None)),
    # ↓ 반드시 거부돼야 하는 것들
    ("2025누계", None),      # 사업보고서=연간 / 분기보고서=YTD — 헤더만으로 구분 불가
    ("제58기 당분기", None),  # 분기 번호가 없다
    ("당기", None), ("소계", None), ("합계", None),
    ("2025.01~2025.09", None),          # 9개월 YTD
    ("제46기 기말 (2024년 9월말)", None),  # 12월이 아니면 연간이 아니다
]
NUM_CASES = [
    ("1,879,673", 1879673.0), ("△301,146", -301146.0), ("▲1,234", -1234.0),
    ("(11,344)", -11344.0), ("-5,000", -5000.0), ("11.3%", 11.3),
    ("(주1)", None), ("-", None), ("—", None), ("", None),
    ("1%미만", None),  # 정성 상한. %를 떼도 '1미만'이라 float 실패 — 1.0으로 읽으면 안 됨

]
HIST_YM_CASES = [
    ("1984", "1984"), ("1984년", "1984"), ("1984년도", "1984"),
    ("1947. 05. 10", "1947.05"), ("1947.05.10", "1947.05"), ("1947.05", "1947.05"),
    ("설립", None), ("—", None),
]


def _rows(query, order):
    """PostgREST 페이지네이션. ★ order 가 없으면 페이지가 불안정해 표본이 조용히 잘린다."""
    out, off = [], 0
    while True:
        page = ingest.rest("GET", "%s&order=%s&limit=1000&offset=%d" % (query, order, off))
        out.extend(page)
        if len(page) < 1000:
            return out
        off += 1000


# ──────────────────────────────────────────────────────── regress

def _golden_counts():
    """삼성 2회차를 dry-run 으로 돌려 블록별 (적재, 확인불가, 게이트보류) 를 뽑는다."""
    env = dict(os.environ)
    out = subprocess.run(
        [sys.executable, "-u", os.path.join(_HERE, "extract_profile.py"), "verify",
         "--corps", GOLDEN_CORP, "--rcepts", GOLDEN_RCEPTS],
        capture_output=True, text=True, env=env, cwd=_REPO).stdout
    if "Traceback" in out:
        return None, out
    pat = re.compile(r"^  (\S+)\s+.*?적재=(\d+) \(확인불가=(\d+), 게이트보류=(\d+)\)", re.M)
    counts = [[m.group(1), int(m.group(2)), int(m.group(3)), int(m.group(4))]
              for m in pat.finditer(out)]
    return counts, out


def cmd_regress(args):
    cur, raw = _golden_counts()
    if cur is None:
        print("✗ 회귀 실행 중 예외 발생:\n" + raw[-2000:])
        return 1
    if not os.path.exists(BASELINE):
        print("✗ 기준선이 없다 — `qc.py baseline` 으로 먼저 만든다.")
        return 1
    base = json.load(open(BASELINE))["golden_counts"]
    if cur == base:
        print("✓ 회귀 통과 — 삼성 2회차 블록별 수치가 기준선과 완전 동일 (%d블록)" % len(cur))
        return 0
    print("✗ 회귀 실패 — 기준선과 다르다")
    bmap = collections.Counter()
    for name, a, b, c in base:
        bmap[(name, a, b, c)] += 1
    cmap = collections.Counter()
    for name, a, b, c in cur:
        cmap[(name, a, b, c)] += 1
    for k in sorted(set(bmap) | set(cmap)):
        if bmap[k] != cmap[k]:
            print("   %-30s 적재=%s 확인불가=%s 보류=%s   기준선 %d회 → 지금 %d회"
                  % (k[0], k[1], k[2], k[3], bmap[k], cmap[k]))
    print("\n   의도한 개선이면 `qc.py baseline` 으로 기준선을 갱신한다.")
    return 1


def cmd_baseline(args):
    cur, raw = _golden_counts()
    if cur is None:
        print("✗ 예외가 나는 상태로는 기준선을 만들지 않는다:\n" + raw[-1500:])
        return 1
    json.dump({"golden_corp": GOLDEN_CORP, "golden_rcepts": GOLDEN_RCEPTS,
               "golden_counts": cur},
              open(BASELINE, "w"), ensure_ascii=False, indent=1)
    print("✓ 기준선 갱신 (%d블록) → %s" % (len(cur), os.path.relpath(BASELINE, _REPO)))
    return 0


# ──────────────────────────────────────────────────────── cases

def cmd_cases(args):
    bad = 0
    for s, want in PERIOD_CASES:
        got = ep.parse_period_col(s)
        if got != want:
            bad += 1
            print("   ✗ parse_period_col(%r) → %s   기대 %s" % (s, got, want))
    for s, want in NUM_CASES:
        got = ep.num(s)
        if got != want:
            bad += 1
            print("   ✗ num(%r) → %s   기대 %s" % (s, got, want))
    for s, want in HIST_YM_CASES:
        got = ep.parse_hist_ym(s)
        if got != want:
            bad += 1
            print("   ✗ parse_hist_ym(%r) → %s   기대 %s" % (s, got, want))
    total = len(PERIOD_CASES) + len(NUM_CASES) + len(HIST_YM_CASES)
    accept = sum(1 for _, w in PERIOD_CASES if w is not None)
    reject = len(PERIOD_CASES) - accept
    if bad:
        print("✗ 케이스 %d/%d 실패" % (bad, total))
        return 1
    print("✓ 케이스 전수 통과 %d개 (기간라벨 받을 %d·거부할 %d, 숫자 %d, 연혁연월 %d)"
          % (total, accept, reject, len(NUM_CASES), len(HIST_YM_CASES)))
    return 0


# ──────────────────────────────────────────────────────── integrity

def cmd_integrity(args):
    """DB 에서 **물리적으로 불가능한 값**을 찾는다. 게이트를 통과한 데이터에서도
    대형 결함이 나온다 — 이 스캔이 실제로 세 건을 잡았다."""
    ingest.print_target()
    fails = 0

    fd = _rows("fin_details?select=corp_code,concept,period_key,item_name,amount,status,source_rcept_no",
               "corp_code,concept,period_key,item_name,source_rcept_no")
    ch = _rows("corp_history?select=corp_code,event_ym", "corp_code,event_ym")
    fp = _rows("fin_periods?period_type=eq.A&select=corp_code,period_key,fs_div,revenue",
               "corp_code,period_key,fs_div")
    rev = {}
    for x in fp:
        if x["revenue"] is None:
            continue
        k = (x["corp_code"], x["period_key"])
        if k not in rev or x["fs_div"] == "CFS":
            rev[k] = float(x["revenue"])
    print("  대상: fin_details %d행 · corp_history %d행" % (len(fd), len(ch)))

    # 1) R&D 가 매출보다 크다 — 단위 스케일 결함의 지문
    bad = [x for x in fd if x["concept"] == "rnd_total" and x["status"] == "ok" and x["amount"]
           and (x["corp_code"], x["period_key"]) in rev
           and rev[(x["corp_code"], x["period_key"])]
           and float(x["amount"]) / rev[(x["corp_code"], x["period_key"])] > 1]
    fails += _report("R&D > 매출 (단위 결함)", bad, lambda x: "%s %s %s" % (
        x["corp_code"], x["period_key"], x["amount"]))

    # 2) 보고서가 담을 수 없는 연도 — 앵커 오적용의 지문
    bad = [x for x in fd if x["period_key"] and re.match(r"^\d{4}", x["period_key"])
           and not ("2000" <= x["period_key"][:4] <= "2026")]
    fails += _report("이상 period_key (앵커 오적용)", bad, lambda x: "%s %s %s" % (
        x["corp_code"], x["period_key"], (x["item_name"] or "")[:24]))

    # 3) 연혁 연도 결측 — NOT NULL 위반으로 회차 전체를 죽인다
    bad = [x for x in ch if not x["event_ym"]]
    fails += _report("corp_history.event_ym NULL", bad, lambda x: x["corp_code"])

    # 4) 시장점유율에 **당사가 없다** — 고객사·경쟁사 구성비만 담긴 표의 지문.
    #    합계 100% 만으로는 오탐이 많다: DART 관행상 '당사 65% · 경쟁사 29% · 기타 3%' 처럼
    #    당사와 경쟁사를 함께 싣는 표가 흔하고, 그건 당사 점유율이 제대로 잡힌 정상 케이스다
    #    (2026-08-26 실측: 합계 100% 24건 중 국도화학·한화오션 등 대부분이 이 형태였다).
    #    진짜 결함은 대원산업처럼 **당사가 한 행도 없이** 고객사(완성차 OEM) 구성비만
    #    들어간 경우다. 그래서 '합계≈100%' 이면서 '당사/자사명 행이 없을 때'만 잡는다.
    #    오탐 두 가지를 빼는다: ① 단일 행 100%(무림SP '국내시장' = 독점 점유율)
    #    ② 지주사 보고서의 영업자회사 브랜드(AK홀딩스→제주항공).
    _SELF_ALIASES = {
        "00125080": ("제주항공",),  # AK홀딩스
    }
    names = {}
    for c in {x["corp_code"] for x in fd if x["concept"] == "market_share"}:
        r = ingest.rest("GET", "companies?corp_code=eq.%s&select=name" % c)
        if r:
            names[c] = r[0]["name"]
    # 그룹 키에 item_name 의 '|' 앞부분(표/제품 축)과 source_rcept_no 를 넣는다.
    # 한 회사가 독립적인 점유율 표를 여러 개 갖는 경우가 있어(대원산업: '생산비율' +
    # '판매비율'), (회사,기간)으로만 묶으면 합이 200% 가 되어 범위를 벗어나고
    # **진짜 결함을 놓친다**. 같은 숫자를 여러 회차 zip 에 중복 적재한 경우
    # (삼성 스마트폰 패널 50.1% × 2 rcept = 100.2%)는 회차별로 나눠야 오탐이 안 난다.
    per = collections.defaultdict(list)
    for x in fd:
        if x["concept"] == "market_share" and x["amount"] and "합계" not in (x["item_name"] or ""):
            axis = (x["item_name"] or "").split("|")[0]
            per[(x["corp_code"], x["period_key"], axis, x.get("source_rcept_no"))].append(x)
    bad = []
    for k, items in per.items():
        total = sum(float(i["amount"]) for i in items)
        if not (99.0 <= total <= 101.0):
            continue
        nm = names.get(k[0], "")
        core = re.sub(r"\(주\)|주식회사|㈜|\s", "", nm)
        aliases = _SELF_ALIASES.get(k[0], ())
        has_self = (
            len(items) == 1  # 단일 행 100% = 독점 점유율 (무림SP CCP 국내시장)
            or any(("당사" in (i["item_name"] or "") or "자사" in (i["item_name"] or "")
                    or (core and core in re.sub(r"\(주\)|㈜|\s", "", i["item_name"] or ""))
                    or any(a in (i["item_name"] or "") for a in aliases))
                   for i in items)
        )
        # ③ 지주사·종합제조가 제품별 당사 점유율을 한 표에 나열하면(LG 2019A:
        #    TV 16.3 + 텔레매틱스 16.5 + 반도체기판 22.9 …) 합이 우연히 ≈100% 가
        #    된다. 행 이름은 제품이지 고객사가 아니다. 구성비 지문(내수/수출/OEM/
        #    고객/(주))이 하나라도 있을 때만 결함으로 본다.
        _MIX_HINTS = ("내수", "수출", "OEM", "고객", "거래처", "(주)", "㈜", "주식회사")
        looks_mix = any(any(h in (i["item_name"] or "") for h in _MIX_HINTS)
                        for i in items)
        if not has_self and looks_mix:
            bad.append({"corp_code": k[0], "name": nm, "period_key": k[1],
                        "axis": k[2], "amount": round(total, 1), "n": len(items)})
    fails += _report("시장점유율에 당사 없음 + 합계≈100% (고객사 구성비 의심)", bad,
                     lambda x: "%s %s %s [%s] 합=%s%% (%d행)" % (
                         x["corp_code"], x["name"], x["period_key"],
                         (x["axis"] or "(축없음)")[:20], x["amount"], x["n"]))

    # 5) 비율 개념이 [0,100] 밖 (segment_operating_income_pct 는 정상적으로 벗어난다 — 제외)
    bad = [x for x in fd if x["concept"] in ("market_share", "rnd_revenue_ratio",
                                              "segment_revenue_pct", "segment_total_assets_pct")
           and x["amount"] is not None and not (0 <= float(x["amount"]) <= 100)]
    fails += _report("비율이 [0,100] 밖", bad, lambda x: "%s %s %s=%s" % (
        x["corp_code"], x["period_key"], x["concept"], x["amount"]))

    print("\n" + ("✓ 무결성 스캔 통과 — 불가능한 값 0건" if not fails
                  else "✗ 무결성 스캔에서 %d종 이상 발견 — 위 목록 확인" % fails))
    return 1 if fails else 0


def _report(label, bad, fmt):
    if not bad:
        print("    ✓ %-42s 0건" % label)
        return 0
    print("    ✗ %-42s %d건" % (label, len(bad)))
    for x in bad[:6]:
        print("        %s" % fmt(x))
    if len(bad) > 6:
        print("        … 외 %d건" % (len(bad) - 6))
    return 1


def cmd_all(args):
    rc = 0
    print("── 1/3 케이스 표 ──")
    rc |= cmd_cases(args)
    print("\n── 2/3 삼성 회귀 ──")
    rc |= cmd_regress(args)
    print("\n── 3/3 DB 무결성 ──")
    rc |= cmd_integrity(args)
    print("\n%s" % ("✓✓ QC 전부 통과" if rc == 0 else "✗✗ QC 실패 — 고치기 전에는 배치를 더 띄우지 않는다"))
    return rc


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    for name, fn, help_ in [
            ("all", cmd_all, "케이스+회귀+무결성 전부 (수정 후 항상 이것)"),
            ("cases", cmd_cases, "parse_period_col / num() 케이스 표"),
            ("regress", cmd_regress, "삼성 2회차 블록별 수치 회귀"),
            ("integrity", cmd_integrity, "DB 무결성 — 불가능한 값 스캔"),
            ("baseline", cmd_baseline, "회귀 기준선 재생성(의도한 개선일 때만)")]:
        sp = sub.add_parser(name, help=help_)
        sp.set_defaults(func=fn)
    args = p.parse_args()
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
