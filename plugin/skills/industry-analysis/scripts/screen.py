#!/usr/bin/env python3
"""플랫폼 DB 횡단 스크리너 — 채 0단계(유니버스)와 2단계(정량 스크린).

`dart.py` 는 OpenDART 를 종목 단위로 친다. 3,978개 횡단이 안 되므로 섹터 진입
모드의 채를 만들 수 없다. 이 스크립트가 그 자리를 맡는다. 반대로 공시 본문과
시세는 여기 없다(원격 `filing_sections` 는 0행, 주가는 애초에 DB에 없다) —
단일 종목 심층은 계속 `dart.py` 가 한다.

  universe   KSIC 접두로 유니버스를 뽑는다 (채 0단계)
  screen     종목코드 목록의 5개년 매출·영업이익·이익률을 뽑는다 (채 2단계)

접두 매칭을 쓰는 이유: `companies.sector_code` 는 DART `induty_code`(KSIC)인데
기업이 신고한 깊이가 제각각이라(2~5자리) 정확일치로 조회하면 peer 가 통째로
누락된다. 게임만 해도 크래프톤 `5821`, 펄어비스 `58211`, 엔씨소프트 `582` 로
흩어진다. 넓게 긁고 정밀도는 다음 채에 맡긴다.

접속 정보는 apps/web/.env.local 에서 읽는다(레포 루트 기준). 표준 라이브러리만 쓴다.
"""
import argparse
import json
import os
import ssl
import sys
import urllib.parse
import urllib.request

TIMEOUT = 60
PAGE = 1000  # PostgREST 기본 상한. Range 헤더로는 못 넘으므로 offset 으로 넘긴다.

# macOS python.org 빌드는 CA 번들이 없어 기본 컨텍스트가 실패한다. 시스템 CA 로 폴백한다.
# _net.py 와 달리 여기서는 검증 생략 폴백을 두지 않는다 — 이 스크립트는 매 요청에
# service_role 키를 실어 보내므로, 검증 없는 연결은 그 키를 중간자에게 넘길 수 있다.
_CA_PATHS = ["/etc/ssl/cert.pem", "/etc/ssl/certs/ca-certificates.crt"]
_ctx_cache = []


def ssl_contexts():
    if _ctx_cache:
        return _ctx_cache
    _ctx_cache.append(None)  # 기본 (인증서 정상 설치 환경)
    for p in _CA_PATHS:
        if os.path.exists(p):
            _ctx_cache.append(ssl.create_default_context(cafile=p))
    return _ctx_cache

# 손익 계정명은 회사마다 다르다. "매출액" 만 찾으면 게임사는 통째로 빈다.
REVENUE_HINTS = ("매출액", "영업수익", "수익(매출액)", "매출")
PROFIT_HINTS = ("영업이익", "영업손익")
# 부분문자열 매칭의 오폭을 막는다. LG화학은 "영업수익"(45.9조)과 "기타영업수익"(1.6조)을
# 둘 다 내는데, 후자가 먼저 걸리면 매출이 1/28 로 잡히고 이익률이 373% 가 된다.
REVENUE_EXCLUDE = ("기타", "원가", "총이익", "영업외", "누적")
# 영업이익률·영업이익증가율 같은 파생 지표와 지분 귀속 분해를 걷어낸다.
PROFIT_EXCLUDE = ("률", "율", "증가", "비율", "주당", "귀속", "계속", "중단", "영업외")

# ROE·부채비율용. 자산총계는 회사마다 "자본과부채총계"/"부채와자본총계"/"부채 및 자본총계"로
# 적히므로, 부채총계를 직접 못 찾으면 자산총계 − 자본총계로 역산한다.
EQUITY_HINTS = ("자본총계",)
LIAB_HINTS = ("부채총계",)
ASSET_HINTS = ("자산총계", "자본과부채총계", "부채와자본총계", "부채 및 자본총계")
NET_INCOME_HINTS = ("당기순이익", "당기순이익(손실)", "당기순손익")
# 순이익 후보에서 반드시 빼야 하는 것들. "법인세비용차감전순이익"을 순이익으로 잡으면
# 세금만큼 부풀고, "주당순이익"은 단위가 아예 다르다.
NI_EXCLUDE = ("주당", "차감전", "포괄", "률", "율")


def repo_root():
    here = os.path.abspath(__file__)
    for _ in range(6):
        here = os.path.dirname(here)
        if os.path.isdir(os.path.join(here, "apps", "web")):
            return here
    return os.getcwd()


def credentials():
    """URL·service key 를 환경변수 → apps/web/.env.local 순으로 찾는다."""
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if url and key:
        return url.rstrip("/"), key
    path = os.path.join(repo_root(), "apps", "web", ".env.local")
    if not os.path.exists(path):
        sys.exit(f"[screen] 접속 정보를 찾지 못했다: {path} 가 없고 환경변수도 비어 있다.")
    env = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip("\"'")
    url = url or env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = key or env.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        sys.exit("[screen] .env.local 에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없다.")
    return url.rstrip("/"), key


def get(table, params, url, key, paginate=True):
    """PostgREST 조회. 1000행을 넘으면 offset 으로 끝까지 가져온다."""
    rows, offset = [], 0
    while True:
        q = dict(params)
        q["limit"] = PAGE
        if paginate:
            q["offset"] = offset
        target = f"{url}/rest/v1/{table}?" + urllib.parse.urlencode(q, safe="")
        req = urllib.request.Request(target, headers={
            "apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json",
        })
        chunk, last_ssl_err = None, None
        for ctx in ssl_contexts():
            try:
                kw = {"timeout": TIMEOUT} if ctx is None else {"timeout": TIMEOUT, "context": ctx}
                with urllib.request.urlopen(req, **kw) as resp:
                    chunk = json.loads(resp.read().decode("utf-8"))
                break
            except urllib.error.HTTPError as exc:
                sys.exit(f"[screen] {table} 조회 실패 {exc.code}: {exc.read().decode('utf-8')[:300]}")
            except (ssl.SSLError, urllib.error.URLError) as exc:
                reason = getattr(exc, "reason", exc)
                if isinstance(exc, ssl.SSLError) or isinstance(reason, ssl.SSLError):
                    last_ssl_err = exc
                    continue
                sys.exit(f"[screen] {table} 연결 실패: {exc}")
        if chunk is None:
            sys.exit("[screen] SSL 인증서 검증에 실패했다. service_role 키를 실어 보내는 요청이라\n"
                     "        검증 생략 폴백을 두지 않는다. macOS python.org 파이썬이면\n"
                     "        /Applications/Python\\ 3.x/Install\\ Certificates.command 를 한 번 실행하라.\n"
                     f"        원인: {last_ssl_err}")
        rows.extend(chunk)
        if not paginate or len(chunk) < PAGE:
            return rows
        offset += PAGE


def pick(rows, hints, exclude=()):
    """계정명 변형을 흡수해 금액을 고른다.

    표(sj_div) 우선순위가 먼저고 그 다음이 힌트 순서다. 회사에 따라 손익을
    IS(손익계산서)에 내기도 하고 CIS(포괄손익계산서)에 내기도 한다 — 크래프톤은
    CIS 뿐이고 LG에너지솔루션은 IS 와 CIS 를 둘 다 낸다. 한쪽만 조회하면
    대형사가 통째로 빈다. 둘 다 있으면 손익계산서 본표인 IS 를 쓴다.
    """
    for sj in ("IS", "CIS"):
        subset = [r for r in rows if r.get("sj_div") == sj]
        # 정확일치가 먼저다. 부분문자열은 "영업수익" 이 "기타영업수익" 에 걸리는 오폭을 낸다.
        for hint in hints:
            for r in subset:
                if (r.get("account_nm") or "").strip() == hint:
                    return r.get("amount"), f"{sj}/{hint}"
        for hint in hints:
            for r in subset:
                nm = (r.get("account_nm") or "").strip()
                if hint in nm and not any(x in nm for x in exclude):
                    return r.get("amount"), f"{sj}/{nm}"
    return None, None


def is_ctrl(nm):
    """지배주주 귀속 항목인가. `비지배`가 섞이면 부호가 반대라 반드시 걸러야 한다."""
    return "지배" in nm and "비지배" not in nm


def pick_bs(rows, hints, ctrl_only=False):
    """재무상태표에서 고른다. ctrl_only 면 지배주주 귀속분만."""
    subset = [r for r in rows if r.get("sj_div") == "BS"]
    for hint in hints:
        for r in subset:
            nm = (r.get("account_nm") or "").strip()
            if nm == hint and (not ctrl_only or is_ctrl(nm)):
                return r.get("amount")
    if ctrl_only:  # 정확일치가 없으면 지배주주 자본 표기를 폭넓게 찾는다
        for r in subset:
            nm = (r.get("account_nm") or "").strip()
            if is_ctrl(nm) and ("자본" in nm or "지분" in nm) and "총계" not in nm:
                return r.get("amount")
    return None


def pick_ni(rows, ctrl_only=False):
    """당기순이익. ctrl_only 면 지배주주 귀속분."""
    subset = [r for r in rows if r.get("sj_div") in ("IS", "CIS")]
    cands = []
    for r in subset:
        nm = (r.get("account_nm") or "").strip()
        if "순이익" not in nm and "순손익" not in nm:
            continue
        if any(x in nm for x in NI_EXCLUDE):
            continue
        if ctrl_only and not is_ctrl(nm):
            continue
        if not ctrl_only and "지배" in nm:  # 총계를 원할 땐 귀속 분해를 배제
            continue
        cands.append((nm, r.get("amount")))
    for hint in NET_INCOME_HINTS:  # 정확일치 우선
        for nm, amt in cands:
            if nm == hint:
                return amt
    return cands[0][1] if cands else None


def derive(rows):
    """ROE 와 부채비율을 계산한다.

    ROE 는 지배주주 기준이 표준이므로 분자·분모를 **같은 기준으로 맞춘다**. 지배주주
    순이익과 지배주주지분이 둘 다 있으면 그 쌍을, 아니면 총계 쌍을 쓴다. 한쪽만
    지배주주 기준으로 쓰면 LG화학처럼 총계 -9,771억 / 지배주주 -18,194억으로 갈리는
    회사에서 배 이상 틀린다. 어느 기준을 썼는지 함께 돌려준다.
    """
    ni_c, eq_c = pick_ni(rows, ctrl_only=True), pick_bs(rows, (), ctrl_only=True)
    if ni_c is not None and eq_c:
        roe, basis, denom = ni_c / eq_c * 100, "지배", eq_c
    else:
        ni_t, eq_t = pick_ni(rows), pick_bs(rows, EQUITY_HINTS)
        roe = (ni_t / eq_t * 100) if (ni_t is not None and eq_t) else None
        basis, denom = ("총계" if roe is not None else None), eq_t

    equity = pick_bs(rows, EQUITY_HINTS)
    liab = pick_bs(rows, LIAB_HINTS)
    if liab is None:  # 부채총계를 안 내는 회사는 자산총계에서 뺀다
        asset = pick_bs(rows, ASSET_HINTS)
        if asset is not None and equity is not None:
            liab = asset - equity
    debt_ratio = (liab / equity * 100) if (liab is not None and equity) else None

    # 자본잠식이면 두 비율 모두 뒤집힌다 — 순손실을 음수 자본으로 나누면 ROE 가 양수로,
    # 부채비율은 음수로 나온다. 다원시스 2025 가 실제 사례(자본총계 -5,156억 → ROE +37.9%,
    # 부채비율 -219.5%). 숫자를 내보내는 대신 잠식 사실 자체를 표시한다.
    impaired = (denom is not None and denom < 0) or (equity is not None and equity < 0)
    if impaired:
        return None, "자본잠식", None
    return (round(roe, 1) if roe is not None else None, basis,
            round(debt_ratio, 1) if debt_ratio is not None else None)


def cmd_universe(args):
    url, key = credentials()
    rows = get("companies", {"select": "corp_code,stock_code,name,market,sector_code",
                             "order": "corp_code"}, url, key)
    prefixes = tuple(args.prefix)
    out = [r for r in rows if (r.get("sector_code") or "").startswith(prefixes)]
    if args.listed_only:
        out = [r for r in out if r.get("market") in ("KOSPI", "KOSDAQ")]
    out.sort(key=lambda r: (r.get("sector_code") or "", r.get("name") or ""))
    if args.json:
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return
    print(f"# 유니버스 — 접두 {', '.join(prefixes)} · {len(out)}개"
          + (" (상장사만)" if args.listed_only else ""))
    print()
    print("| sector_code | 종목코드 | 종목명 | 시장 |")
    print("|---|---|---|---|")
    for r in out:
        print(f"| {r['sector_code']} | {r['stock_code']} | {r['name']} | {r.get('market') or '-'} |")


def cmd_screen(args):
    url, key = credentials()
    codes = []
    for c in args.stock_codes:
        codes.extend(x.strip() for x in c.split(",") if x.strip())
    companies = get("companies", {
        "select": "corp_code,stock_code,name,market,sector_code",
        "stock_code": "in.(" + ",".join(codes) + ")",
    }, url, key, paginate=False)
    found = {c["stock_code"] for c in companies}
    missing = [c for c in codes if c not in found]

    years = list(range(args.from_year, args.to_year + 1))
    table = []
    for co in companies:
        def fetch(fs_div):
            return get("financial_facts", {
                "select": "bsns_year,sj_div,account_nm,amount",
                "corp_code": f"eq.{co['corp_code']}",
                "reprt_code": "eq.11011",    # 사업보고서(연간)
                "fs_div": f"eq.{fs_div}",
                "sj_div": "in.(IS,CIS,BS)",  # 손익은 IS 또는 CIS(회사마다 다름), BS 는 ROE·부채비율용
                "bsns_year": f"in.({','.join(str(y) for y in years)})",
            }, url, key)

        basis = args.fs_div
        facts = fetch(basis)
        if not facts and basis == "CFS":
            # 종속회사가 없으면 연결재무제표 자체가 없다(에코프로머티 등). 별도로 떨어진다.
            facts = fetch("OFS")
            if facts:
                basis = "OFS"
        row = {"종목": co["name"], "종목코드": co["stock_code"], "기준": basis,
               "corp_code": co["corp_code"], "sector_code": co.get("sector_code"),
               "시장": co.get("market"), "연도": {}}
        for y in years:
            yr = [f for f in facts if f["bsns_year"] == y]
            rev, rev_nm = pick(yr, REVENUE_HINTS, REVENUE_EXCLUDE)
            op, op_nm = pick(yr, PROFIT_HINTS, PROFIT_EXCLUDE)
            roe, roe_basis, debt_ratio = derive(yr)
            entry = {"매출": rev, "영업이익": op, "ROE": roe, "ROE기준": roe_basis,
                     "부채비율": debt_ratio, "계정명": {"매출": rev_nm, "영업이익": op_nm}}
            entry["이익률"] = round(op / rev * 100, 1) if (rev and op is not None and rev != 0) else None
            row["연도"][y] = entry
        table.append(row)
    table.sort(key=lambda r: -(r["연도"].get(years[-1], {}).get("매출") or 0))

    if args.json:
        print(json.dumps({"기준": {"연도": years, "fs_div": args.fs_div, "reprt_code": "11011"},
                          "미발견": missing, "결과": table}, ensure_ascii=False, indent=2))
        return

    def fmt_amt(v):
        return f"{v/1e8:,.0f}" if v else "—"

    def fmt_pct(v):
        return f"{v}" if v is not None else "—"

    print(f"# 정량 스크린 — {len(table)}개사 · {years[0]}~{years[-1]} · 연간(11011)")
    print()
    print("매출은 억원, 이익률·ROE·부채비율은 %. `—` 는 해당 연도 DB 미보유다. "
          "기준은 연결(CFS)이며, 연결재무제표가 없는 회사만 별도(OFS)로 표기했다.")
    print()
    print("## 매출과 영업이익률")
    print()
    print("| 종목 | 코드 | 기준 | " + " | ".join(f"{y} 매출" for y in years) + " | "
          + " | ".join(f"{y} 이익률" for y in years) + " |")
    print("|---|---|---|" + "---|" * (len(years) * 2))
    for r in table:
        cells = [fmt_amt(r["연도"][y]["매출"]) for y in years]
        cells += [fmt_pct(r["연도"][y]["이익률"]) for y in years]
        print(f"| {r['종목']} | {r['종목코드']} | {r['기준']} | " + " | ".join(cells) + " |")

    print()
    print("## ROE와 부채비율")
    print()
    print("교재 기준선은 **ROE 15% 이상**(D1·H1·H4, 버핏)과 **부채비율 100% 미만**(D1)이다. "
          "ROE 기준란의 `지배`는 지배주주순이익÷지배주주지분, `총계`는 당기순이익÷자본총계다 "
          "— 회사가 지배주주 항목을 따로 내지 않으면 총계로 떨어진다.")
    print()
    print("| 종목 | 코드 | ROE 기준 | " + " | ".join(f"{y} ROE" for y in years) + " | "
          + " | ".join(f"{y} 부채" for y in years) + " |")
    print("|---|---|---|" + "---|" * (len(years) * 2))
    for r in table:
        bases = {r["연도"][y]["ROE기준"] for y in years if r["연도"][y]["ROE기준"]}
        basis = "/".join(sorted(bases)) if bases else "—"
        cells = [fmt_pct(r["연도"][y]["ROE"]) for y in years]
        cells += [fmt_pct(r["연도"][y]["부채비율"]) for y in years]
        print(f"| {r['종목']} | {r['종목코드']} | {basis} | " + " | ".join(cells) + " |")

    if missing:
        print()
        print(f"**DB 미발견 종목코드**: {', '.join(missing)}")


def main():
    ap = argparse.ArgumentParser(description="플랫폼 DB 횡단 스크리너 (채 0·2단계)")
    sub = ap.add_subparsers(dest="cmd", required=True)

    u = sub.add_parser("universe", help="KSIC 접두로 유니버스 추출 (채 0단계)")
    u.add_argument("prefix", nargs="+", help="KSIC 접두. 예: 20 26 28 (넓게 긁는다)")
    u.add_argument("--listed-only", action="store_true", help="KOSPI/KOSDAQ 만")
    u.add_argument("--json", action="store_true")
    u.set_defaults(func=cmd_universe)

    s = sub.add_parser("screen", help="종목코드들의 연도별 매출·이익률 (채 2단계)")
    s.add_argument("stock_codes", nargs="+", help="6자리 종목코드. 쉼표 구분 허용")
    s.add_argument("--from-year", type=int, default=2021)
    s.add_argument("--to-year", type=int, default=2025)
    s.add_argument("--fs-div", default="CFS", choices=["CFS", "OFS"])
    s.add_argument("--json", action="store_true")
    s.set_defaults(func=cmd_screen)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
