#!/usr/bin/env python3
"""DART 공시 수집기 — OpenDART 공식 API 전면 커버 (OpenDartReader 커버리지 참조, 순수 stdlib).

"이사회 승인 문서 > 실적 공시 > 리포트 로데이터 > 언론"이라는 자료 위계(D1)를 프로그램으로
구현한다. 산출물은 pandas 가 아니라 자료/ 레이아웃의 마크다운이다.

필요: 무료 API 키 — https://opendart.fss.or.kr (개인회원이면 IP 등록 불필요, 일 20,000건)
      환경변수 DART_API_KEY 또는 --api-key. 없으면 안내 후 exit 2 → 스킬은 웹서치 폴백.

사용법:
    python3 dart.py corp 크래프톤                          # 식별 + 기업개황
    python3 dart.py filings 크래프톤 --days 180 --out …    # 공시 목록 + 자금조달 플래그
    python3 dart.py fin 크래프톤 --years 4 --quarters --out …   # 연간+최근 분기 재무 추이
    python3 dart.py indicators 크래프톤 --out …            # 공식 재무지표 (수익성·안정성·성장성·활동성)
    python3 dart.py report 크래프톤 직원 --year 2025       # 정기보고서 항목 (배당|증자|자기주식|
                                                           #  최대주주|최대주주변동|소액주주|임원|직원|
                                                           #  임원전체보수|개인별보수|타법인출자)
    python3 dart.py events 크래프톤 --days 365 --out …     # 유증·CB·BW·자사주·소송 주요사항
    python3 dart.py ownership 크래프톤 --out …             # 대량보유(5%)·임원 소유보고 → 내부자 매수 판독
    python3 dart.py doc <접수번호> --out …                  # 공시 원본 문서 → 텍스트 md
    python3 dart.py snapshot 크래프톤 --out-dir 리서치/기업/크래프톤/자료
                                                           # ↑ 표준 수집 일괄 실행 (딸깍)

snapshot 이 만드는 파일 (data-layout.md 준수):
    재무/YYYY-MM-DD-재무추이.md · 재무/YYYY-MM-DD-재무지표.md
    공시/YYYY-MM-DD-공시목록.md · 공시/YYYY-MM-DD-지배구조-정기보고서.md
    공시/YYYY-MM-DD-자금조달-주요사항.md · 공시/YYYY-MM-DD-지분거래.md
"""
import argparse
import datetime as dt
import json
import os
import re
import sys

import dart_api as api

TODAY = dt.date.today
FLAG_WORDS = ["유상증자", "무상증자", "전환사채", "신주인수권", "교환사채", "합병", "분할",
              "소송", "최대주주", "자기주식", "감자", "전환청구", "조회공시", "불성실"]
NUMERIC = re.compile(r"^-?[\d,]+$")


def out_key(args):
    key = args.api_key or os.environ.get("DART_API_KEY")
    if not key:
        print(json.dumps({
            "ok": False, "skip": True,
            "reason": "DART_API_KEY 없음 — 이 단계를 웹서치(DART 사이트 열람)로 폴백하라",
            "발급": "https://opendart.fss.or.kr 개인회원 무료 인증키 → export DART_API_KEY=<키>",
        }, ensure_ascii=False))
        sys.exit(2)
    return key


def resolve(key, name):
    corp, candidates = api.find_corp(key, name)
    if not corp:
        print(json.dumps({"ok": False, "error": "기업을 특정 못함", "후보": candidates[:10]},
                         ensure_ascii=False))
        sys.exit(1)
    return corp


def fm(subject, source, extra=None):
    today = TODAY().isoformat()
    lines = ["---", "수집일: %s" % today, "기준일: %s" % today,
             "출처: %s" % source, "대상: %s" % subject]
    lines += extra or []
    lines += ["---", ""]
    return lines


def fmt_cell(v):
    s = str(v if v is not None else "").strip()
    if NUMERIC.match(s.replace(",", "")) and len(s.replace(",", "").lstrip("-")) > 3:
        try:
            return format(int(s.replace(",", "")), ",")
        except ValueError:
            pass
    return s.replace("|", "¦").replace("\n", " ") or "—"


def md_table(rows, cols=None, labels=None):
    """list[dict] → md 표. cols 미지정 시 등장 필드 전부(메타 제외)."""
    if not rows:
        return ["(데이터 없음)", ""]
    skip = {"rcept_no", "corp_cls", "corp_code", "corp_name", "stlm_dt"}
    if cols is None:
        cols, seen = [], set()
        for r in rows:
            for k in r:
                if k not in seen and k not in skip:
                    seen.add(k)
                    cols.append(k)
        cols = cols[:12]  # 표 폭 상한
    head = labels or cols
    out = ["| " + " | ".join(head) + " |", "|" + "---|" * len(cols)]
    for r in rows:
        out.append("| " + " | ".join(fmt_cell(r.get(c)) for c in cols) + " |")
    out.append("")
    return out


def write_or_print(md, out_path, summary):
    if out_path:
        os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(md)
        summary["저장"] = out_path
        print(json.dumps(summary, ensure_ascii=False))
    else:
        print(md)


# ------------------------------------------------------------- 서브커맨드

def cmd_corp(key, name):
    corp = resolve(key, name)
    try:
        prof = api.company(key, corp["corp_code"])
    except api.DartError as e:
        prof = {"오류": str(e)}
    print(json.dumps({"ok": True, "선택": corp, "기업개황": prof}, ensure_ascii=False, indent=2))


def cmd_filings(key, name, days, out):
    corp = resolve(key, name)
    rows, bgn, end = api.filings(key, corp["corp_code"], days)
    flagged = [r for r in rows if any(w in r.get("report_nm", "") for w in FLAG_WORDS)]
    lines = fm("%s (%s)" % (corp["corp_name"], corp["stock_code"]),
               "OpenDART list API", ["수집범위: %s ~ %s" % (bgn, end)])
    lines += ["# %s 공시 목록" % corp["corp_name"], ""]
    if flagged:
        lines += ["## ⚑ 자금조달·지배구조 플래그 (%d건)" % len(flagged), ""]
        for r in flagged:
            lines.append("- %s **%s** (%s) — https://dart.fss.or.kr/dsaf001/main.do?rcpNo=%s"
                         % (r.get("rcept_dt"), r.get("report_nm"), r.get("flr_nm"), r.get("rcept_no")))
        lines.append("")
    lines += ["## 전체 (%d건)" % len(rows), ""]
    lines += ["| 접수일 | 보고서 | 제출인 | 접수번호 |", "|---|---|---|---|"]
    for r in rows:
        lines.append("| %s | %s | %s | %s |" % (r.get("rcept_dt"),
                     fmt_cell(r.get("report_nm")), r.get("flr_nm"), r.get("rcept_no")))
    write_or_print("\n".join(lines) + "\n", out,
                   {"ok": True, "건수": len(rows), "플래그": len(flagged)})


ACCOUNTS = [("매출액", ["매출액", "수익(매출액)", "영업수익", "매출"]),
            ("영업이익", ["영업이익", "영업이익(손실)"]),
            ("당기순이익", ["당기순이익", "당기순이익(손실)", "연결당기순이익"]),
            ("자산총계", ["자산총계"]), ("부채총계", ["부채총계"]), ("자본총계", ["자본총계"])]


def pick(rows, names, fs_div):
    for target in names:
        for it in rows:
            if it.get("fs_div") != fs_div:
                continue
            if (it.get("account_nm") or "").replace(" ", "") == target.replace(" ", ""):
                raw = (it.get("thstrm_amount") or "").replace(",", "").strip()
                if raw and raw != "-":
                    try:
                        return int(raw)
                    except ValueError:
                        pass
    return None


def extract_row(rows, fs_div, label):
    row = {"구분": label}
    for acc_label, names in ACCOUNTS:
        v = pick(rows, names, fs_div)
        row[acc_label] = round(v / 1e8, 1) if v is not None else None
    return row


def cmd_fin(key, name, years, quarters, out):
    corp = resolve(key, name)
    table, fs_used = [], "CFS"
    this_year = TODAY().year
    for y in range(this_year - years, this_year):
        rows, fs = api.finstate_all(key, corp["corp_code"], y)
        if rows:
            fs_used = fs
            table.append(extract_row(rows, fs, str(y)))
    if quarters:
        for y in (this_year, this_year - 1):
            for q_label, code in [("1Q", "11013"), ("반기", "11012"), ("3Q", "11014")]:
                rows, fs = api.finstate_all(key, corp["corp_code"], y, reprt=code)
                if rows:
                    table.append(extract_row(rows, fs, "%d %s" % (y, q_label)))
            if len(table) and any(r["구분"].startswith(str(y)) for r in table):
                break  # 올해 분기가 있으면 작년 분기는 생략
    if not table:
        print(json.dumps({"ok": False, "error": "재무 데이터 없음"}, ensure_ascii=False))
        sys.exit(1)

    def ratio(a, b):
        return round(a / b * 100, 1) if (a is not None and b) else None

    lines = fm("%s (%s)" % (corp["corp_name"], corp["stock_code"]),
               "OpenDART fnlttSinglAcntAll API (%s)" % ("연결" if fs_used == "CFS" else "별도"),
               ["단위: 억 원"])
    lines += ["# %s 재무 추이" % corp["corp_name"], "",
              "| 항목 | " + " | ".join(r["구분"] for r in table) + " |",
              "|---|" + "---|" * len(table)]
    for acc_label, _ in ACCOUNTS:
        lines.append("| %s | " % acc_label +
                     " | ".join(fmt_cell(r[acc_label]) for r in table) + " |")
    lines.append("| 영업이익률(%) | " + " | ".join(
        str(ratio(r["영업이익"], r["매출액"]) or "—") for r in table) + " |")
    lines.append("| 부채비율(%) | " + " | ".join(
        str(ratio(r["부채총계"], r["자본총계"]) or "—") for r in table) + " |")
    lines.append("| ROE(%, 순이익/자본) | " + " | ".join(
        str(ratio(r["당기순이익"], r["자본총계"]) or "—") for r in table) + " |")
    write_or_print("\n".join(lines) + "\n", out, {"ok": True, "구간수": len(table)})


def cmd_indicators(key, name, years, out):
    corp = resolve(key, name)
    this_year = TODAY().year
    lines = fm("%s (%s)" % (corp["corp_name"], corp["stock_code"]),
               "OpenDART fnlttSinglIndx API (공식 산출 지표)")
    lines += ["# %s 재무지표" % corp["corp_name"], ""]
    got = 0
    for y in range(this_year - years, this_year):
        data = api.indicators(key, corp["corp_code"], y)
        if not data:
            continue
        got += 1
        lines += ["## %d" % y, ""]
        for cls, rows in data.items():
            lines += ["### %s" % cls, ""]
            lines += md_table(rows, cols=["idx_nm", "idx_val"], labels=["지표", "값"])
    if not got:
        print(json.dumps({"ok": False, "error": "재무지표 데이터 없음"}, ensure_ascii=False))
        sys.exit(1)
    write_or_print("\n".join(lines) + "\n", out, {"ok": True, "연도수": got})


def cmd_report(key, name, item, year, out):
    if item not in api.REPORT_ITEMS:
        print(json.dumps({"ok": False, "error": "지원 항목: %s" % ", ".join(api.REPORT_ITEMS)},
                         ensure_ascii=False))
        sys.exit(1)
    corp = resolve(key, name)
    year = year or TODAY().year - 1
    rows = api.report_item(key, corp["corp_code"], item, year)
    memo = api.REPORT_ITEMS[item][1]
    lines = fm("%s (%s)" % (corp["corp_name"], corp["stock_code"]),
               "OpenDART 정기보고서 주요정보 (%d 사업연도)" % year, ["방법론 메모: %s" % memo])
    lines += ["# %s — %s (%d)" % (corp["corp_name"], item, year), ""]
    lines += md_table(rows)
    write_or_print("\n".join(lines) + "\n", out, {"ok": True, "건수": len(rows)})


def cmd_events(key, name, days, out):
    corp = resolve(key, name)
    data = api.events(key, corp["corp_code"], days)
    lines = fm("%s (%s)" % (corp["corp_name"], corp["stock_code"]),
               "OpenDART 주요사항보고서 API", ["수집범위: 최근 %d일" % days,
               "방법론 메모: 유증·CB·BW는 지분 희석(I1 체크리스트) 대상"])
    lines += ["# %s 자금조달·주요사항" % corp["corp_name"], ""]
    if not data:
        lines += ["(해당 기간 주요사항 결정 없음 — 자금조달 리스크 관점에서는 긍정 신호)", ""]
    for label, rows in data.items():
        lines += ["## %s (%d건)" % (label, len(rows)), ""]
        lines += md_table(rows)
    write_or_print("\n".join(lines) + "\n", out,
                   {"ok": True, "항목": {k: len(v) for k, v in data.items()}})


def cmd_ownership(key, name, out):
    corp = resolve(key, name)
    data = api.ownership(key, corp["corp_code"])
    lines = fm("%s (%s)" % (corp["corp_name"], corp["stock_code"]),
               "OpenDART 지분공시 API (majorstock·elestock)",
               ["방법론 메모: 오너 개인 자금 매수 = 신호, 오너 불참 임원 매수 = 제스처 함정 (B4)"])
    lines += ["# %s 지분 거래" % corp["corp_name"], ""]
    if not data:
        lines += ["(지분공시 데이터 없음)", ""]
    for label, rows in data.items():
        lines += ["## %s (%d건)" % (label, len(rows)), ""]
        lines += md_table(rows[:60])
    write_or_print("\n".join(lines) + "\n", out,
                   {"ok": True, "항목": {k: len(v) for k, v in data.items()}})


TAG = re.compile(r"<[^>]+>")


def cmd_doc(key, rcept_no, out):
    fname, text = api.document(key, rcept_no)
    body = TAG.sub("", text)
    body = re.sub(r"&nbsp;?", " ", body)
    body = re.sub(r"\n{3,}", "\n\n", "\n".join(ln.rstrip() for ln in body.splitlines()))
    lines = fm("접수번호 %s" % rcept_no,
               "OpenDART document API (원본: %s)" % fname,
               ["원문: https://dart.fss.or.kr/dsaf001/main.do?rcpNo=%s" % rcept_no,
                "주의: 태그 제거 텍스트 — 표 서식이 손실됐다. 수치 인용 시 원문 대조"])
    lines += ["# 공시 원본 텍스트 (%s)" % rcept_no, "", body.strip(), ""]
    write_or_print("\n".join(lines), out, {"ok": True, "길이": len(body)})


def cmd_snapshot(key, name, out_dir):
    """표준 수집 일괄 — 자료/ 레이아웃(재무·공시 하위)을 한 번에 채운다."""
    corp = resolve(key, name)
    today = TODAY().isoformat()
    yr = TODAY().year - 1
    made, errors = [], []

    def run(fn, label):
        try:
            fn()
            made.append(label)
        except (api.DartError, OSError) as e:
            errors.append("%s: %s" % (label, e))

    j = os.path.join
    run(lambda: cmd_fin(key, name, 4, True, j(out_dir, "재무", "%s-재무추이.md" % today)), "재무추이")
    run(lambda: cmd_indicators(key, name, 2, j(out_dir, "재무", "%s-재무지표.md" % today)), "재무지표")
    run(lambda: cmd_filings(key, name, 180, j(out_dir, "공시", "%s-공시목록.md" % today)), "공시목록")
    run(lambda: cmd_events(key, name, 365, j(out_dir, "공시", "%s-자금조달-주요사항.md" % today)), "주요사항")
    run(lambda: cmd_ownership(key, name, j(out_dir, "공시", "%s-지분거래.md" % today)), "지분거래")

    def governance():
        lines = fm("%s (%s)" % (corp["corp_name"], corp["stock_code"]),
                   "OpenDART 정기보고서 주요정보 (%d 사업연도)" % yr)
        lines += ["# %s 지배구조·정기보고서 주요정보 (%d)" % (corp["corp_name"], yr), ""]
        for item in ["최대주주", "최대주주변동", "배당", "직원", "타법인출자"]:
            try:
                rows = api.report_item(key, corp["corp_code"], item, yr)
            except api.DartError:
                rows = []
            lines += ["## %s — %s" % (item, api.REPORT_ITEMS[item][1]), ""]
            lines += md_table(rows[:40])
        path = j(out_dir, "공시", "%s-지배구조-정기보고서.md" % today)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
    run(governance, "지배구조")

    print(json.dumps({"ok": not errors or bool(made), "생성": made, "실패": errors,
                      "위치": out_dir}, ensure_ascii=False, indent=2))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--api-key")
    sub = p.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("corp"); c.add_argument("name")
    f = sub.add_parser("filings"); f.add_argument("name")
    f.add_argument("--days", type=int, default=180); f.add_argument("--out")
    g = sub.add_parser("fin"); g.add_argument("name")
    g.add_argument("--years", type=int, default=4)
    g.add_argument("--quarters", action="store_true"); g.add_argument("--out")
    i = sub.add_parser("indicators"); i.add_argument("name")
    i.add_argument("--years", type=int, default=2); i.add_argument("--out")
    r = sub.add_parser("report"); r.add_argument("name"); r.add_argument("item")
    r.add_argument("--year", type=int); r.add_argument("--out")
    e = sub.add_parser("events"); e.add_argument("name")
    e.add_argument("--days", type=int, default=365); e.add_argument("--out")
    o = sub.add_parser("ownership"); o.add_argument("name"); o.add_argument("--out")
    d = sub.add_parser("doc"); d.add_argument("rcept_no"); d.add_argument("--out")
    s = sub.add_parser("snapshot"); s.add_argument("name")
    s.add_argument("--out-dir", required=True)
    args = p.parse_args()

    key = out_key(args)
    if args.cmd == "corp":
        cmd_corp(key, args.name)
    elif args.cmd == "filings":
        cmd_filings(key, args.name, args.days, args.out)
    elif args.cmd == "fin":
        cmd_fin(key, args.name, args.years, args.quarters, args.out)
    elif args.cmd == "indicators":
        cmd_indicators(key, args.name, args.years, args.out)
    elif args.cmd == "report":
        cmd_report(key, args.name, args.item, args.year, args.out)
    elif args.cmd == "events":
        cmd_events(key, args.name, args.days, args.out)
    elif args.cmd == "ownership":
        cmd_ownership(key, args.name, args.out)
    elif args.cmd == "doc":
        cmd_doc(key, args.rcept_no, args.out)
    else:
        cmd_snapshot(key, args.name, args.out_dir)


if __name__ == "__main__":
    main()
