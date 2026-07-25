#!/usr/bin/env python3
"""OpenDART → Supabase(Postgres) 적재 파이프라인 — P-A 파일럿 A1.

설계 (전부 가설 — 시행착오에 따라 바뀐다, 로드맵 'P-A 설계 유보 사항'):
  - 플러그인의 dart_api 를 그대로 재사용한다 (수집 로직 단일 소스).
  - DB 쓰기는 PostgREST(REST API)로 한다 — 드라이버 의존성 없음(순수 stdlib),
    그리고 UI가 쓸 API 표면을 ingest 가 먼저 검증하는 효과.
  - 멱등성: companies/filings 는 PK upsert, 나머지는 스코프 교체(delete → insert).
    같은 명령을 몇 번 돌려도 결과가 같다.
  - 원본 API 응답은 data/raw/<corp_code>/ 에 JSON 으로도 남긴다(재적재·디버깅용, gitignore).

사용법:
    python3 ingest.py 크래프톤                 # 전 역사 적재
    python3 ingest.py 에코프로비엠 --since 2015  # 시작 연도 지정
    python3 ingest.py 크래프톤 --only filings,fin  # 일부 단계만

전제: supabase start 가 떠 있고(로컬 기본 포트), DART_API_KEY 가 설정돼 있다(.env.local 등).
"""
import argparse
import datetime as dt
import json
import os
import re
import sys
import urllib.parse
import urllib.request

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO = os.path.dirname(os.path.dirname(_HERE))
sys.path.insert(0, os.path.join(_REPO, "plugin", "skills", "company-analysis", "scripts"))
import dart_api as api  # noqa: E402

REST = os.environ.get("SUPABASE_REST_URL", "http://127.0.0.1:54321/rest/v1")
# supabase local 의 공용 데모 service_role 키 (모든 로컬 인스턴스 동일 — 비밀 아님)
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0."
    "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU")
RAW_DIR = os.path.join(_HERE, "..", "data", "raw")
FIN_START_DEFAULT = 2015          # fnlttSinglAcntAll·정기보고서 API 데이터 제공 시점
HISTORY_START = 2000              # 전자공시 전면화

CORRECTION_RE = re.compile(r"\[기재정정")


# ─────────────────────────────────────────────── REST 헬퍼

def rest(method, path, body=None, prefer=None):
    url = "%s/%s" % (REST, path)
    headers = {"apikey": SERVICE_KEY, "Authorization": "Bearer %s" % SERVICE_KEY,
               "Content-Type": "application/json"}
    if prefer:
        headers["Prefer"] = prefer
    data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:500]
        raise RuntimeError("PostgREST %s %s → %s: %s" % (method, path, e.code, detail))


def upsert(table, rows, on_conflict):
    for i in range(0, len(rows), 500):
        rest("POST", "%s?on_conflict=%s" % (table, on_conflict), rows[i:i + 500],
             prefer="resolution=merge-duplicates,return=minimal")


def replace_scope(table, filters, rows):
    """스코프 삭제 후 삽입 — 멱등 적재의 기본형. filters 예: {'corp_code':'eq.X','item':'eq.배당'}"""
    q = urllib.parse.urlencode(filters)  # 한글 값(eq.배당 등) percent-encoding
    rest("DELETE", "%s?%s" % (table, q))
    for i in range(0, len(rows), 500):
        rest("POST", table, rows[i:i + 500], prefer="return=minimal")


def save_raw(corp_code, name, obj):
    d = os.path.join(RAW_DIR, corp_code)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, name + ".json"), "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)


def num(s):
    s = (str(s or "")).replace(",", "").strip()
    if not s or s == "-" or set(s) == {"#"}:
        return None
    try:
        return int(s)
    except ValueError:
        try:
            return float(s)
        except ValueError:
            return None


def d8(s):
    s = (s or "").replace(".", "").replace("-", "").strip()
    return "%s-%s-%s" % (s[:4], s[4:6], s[6:8]) if len(s) == 8 and s.isdigit() else None


# ─────────────────────────────────────────────── 단계별 적재

def load_company(key, corp):
    try:
        prof = api.company(key, corp["corp_code"])
    except api.DartError:
        prof = {}
    save_raw(corp["corp_code"], "company", prof)
    market = {"Y": "KOSPI", "K": "KOSDAQ", "N": "KONEX"}.get(prof.get("corp_cls"))
    upsert("companies", [{
        "corp_code": corp["corp_code"], "name": corp["corp_name"],
        "stock_code": corp["stock_code"], "market": market,
        "sector_code": prof.get("induty_code"),
        "fiscal_month": num(prof.get("acc_mt")), "ceo": prof.get("ceo_nm"),
        "established": d8(prof.get("est_dt")), "profile": prof or None,
        "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }], on_conflict="corp_code")
    print("  companies: 1")


def load_filings(key, corp, since_year):
    """공시 메타 전 역사 — 연 단위 창으로 수집(장기 범위 제한 회피)."""
    rows = []
    this_year = dt.date.today().year
    for y in range(since_year, this_year + 1):
        chunk, page = [], 1
        while True:
            d = api.call_json(key, "list.json", raw=True, corp_code=corp["corp_code"],
                              bgn_de="%d0101" % y, end_de="%d1231" % y,
                              page_no=page, page_count=100)
            if not d:
                break
            chunk.extend(d.get("list", []))
            if page >= int(d.get("total_page", 1) or 1):
                break
            page += 1
        rows.extend(chunk)
    save_raw(corp["corp_code"], "filings", rows)
    db_rows = [{
        "rcept_no": r["rcept_no"], "corp_code": corp["corp_code"],
        "report_nm": r.get("report_nm", ""), "flr_nm": r.get("flr_nm"),
        "rcept_dt": d8(r.get("rcept_dt")), "rm": r.get("rm"),
        "is_correction": bool(CORRECTION_RE.search(r.get("report_nm", ""))),
    } for r in rows if r.get("rcept_no")]
    # rcept_no 는 전역 유일 — upsert 로 멱등
    upsert("filings", db_rows, on_conflict="rcept_no")
    print("  filings: %d (정정 %d)" % (len(db_rows), sum(r["is_correction"] for r in db_rows)))


def load_financials(key, corp, since_year):
    this_year = dt.date.today().year
    total = 0
    for y in range(max(since_year, FIN_START_DEFAULT), this_year + 1):
        for reprt in ("11011", "11013", "11012", "11014"):
            rows, fs = api.finstate_all(key, corp["corp_code"], y, reprt=reprt)
            if not rows:
                continue
            save_raw(corp["corp_code"], "fin_%d_%s" % (y, reprt), rows)
            db_rows = [{
                "corp_code": corp["corp_code"], "bsns_year": y, "reprt_code": reprt,
                "fs_div": fs, "sj_div": r.get("sj_div", ""), "account_id": r.get("account_id"),
                "account_nm": r.get("account_nm", ""),
                "amount": num(r.get("thstrm_amount")),
                "amount_prev": num(r.get("frmtrm_amount")),
                "amount_prev2": num(r.get("bfefrmtrm_amount")),
                "ord": num(r.get("ord")), "currency": r.get("currency"),
                "rcept_no": r.get("rcept_no"),
            } for r in rows]
            replace_scope("financial_facts",
                          {"corp_code": "eq.%s" % corp["corp_code"],
                           "bsns_year": "eq.%d" % y, "reprt_code": "eq.%s" % reprt},
                          db_rows)
            total += len(db_rows)
    print("  financial_facts: %d" % total)


def load_report_items(key, corp, since_year):
    this_year = dt.date.today().year
    total = 0
    for item in api.REPORT_ITEMS:
        for y in range(max(since_year, FIN_START_DEFAULT), this_year):
            try:
                rows = api.report_item(key, corp["corp_code"], item, y)
            except api.DartError:
                continue
            if not rows:
                continue
            db_rows = [{"corp_code": corp["corp_code"], "bsns_year": y, "item": item,
                        "payload": r, "rcept_no": r.get("rcept_no")} for r in rows]
            replace_scope("report_items",
                          {"corp_code": "eq.%s" % corp["corp_code"],
                           "item": "eq.%s" % item, "bsns_year": "eq.%d" % y},
                          db_rows)
            total += len(db_rows)
    print("  report_items: %d" % total)


def load_events(key, corp, since_year):
    """주요사항 — 엔드포인트별 전체 기간을 3년 창으로."""
    this_year = dt.date.today().year
    total = 0
    for label, path in api.EVENT_ITEMS.items():
        rows = []
        y = max(since_year, FIN_START_DEFAULT)
        while y <= this_year:
            end_y = min(y + 2, this_year)
            try:
                chunk = api.call_json(key, path, corp_code=corp["corp_code"],
                                      bgn_de="%d0101" % y, end_de="%d1231" % end_y)
                rows.extend(chunk)
            except api.DartError:
                pass
            y = end_y + 1
        if not rows:
            continue
        save_raw(corp["corp_code"], "events_%s" % path.replace(".json", ""), rows)
        db_rows = [{"corp_code": corp["corp_code"], "event_type": label,
                    "rcept_no": r.get("rcept_no"), "rcept_dt": d8(r.get("rcept_dt")),
                    "payload": r} for r in rows]
        replace_scope("events",
                      {"corp_code": "eq.%s" % corp["corp_code"], "event_type": "eq.%s" % label},
                      db_rows)
        total += len(db_rows)
    print("  events: %d" % total)


def load_registrations(key, corp, since_year):
    days = (dt.date.today() - dt.date(max(since_year, FIN_START_DEFAULT), 1, 1)).days
    data = api.registrations(key, corp["corp_code"], days)
    total = 0
    for label, rows in data.items():
        save_raw(corp["corp_code"], "reg_%s" % label, rows)
        db_rows = [{"corp_code": corp["corp_code"], "reg_type": label,
                    "rcept_no": r.get("rcept_no"), "rcept_dt": d8(r.get("rcept_dt")),
                    "payload": r} for r in rows]
        replace_scope("registrations",
                      {"corp_code": "eq.%s" % corp["corp_code"], "reg_type": "eq.%s" % label},
                      db_rows)
        total += len(db_rows)
    print("  registrations: %d" % total)


def load_docs(key, corp, redo=False):
    """공시 원문 전량 — zip 보존 + 목차 섹션을 DB 행으로. rcept_no 단위 증분(재실행 시 skip)."""
    import dart_doc
    # 이 회사의 전체 공시 목록 (DB에서 페이지네이션으로)
    rcepts, offset = [], 0
    while True:
        page = rest("GET", "filings?corp_code=eq.%s&select=rcept_no&order=rcept_no"
                    "&limit=1000&offset=%d" % (corp["corp_code"], offset))
        rcepts.extend(r["rcept_no"] for r in page)
        if len(page) < 1000:
            break
        offset += 1000
    done = set()
    if not redo:
        # in-list 필터는 URL 길이 한계에 걸리므로 filing_docs 전량을 받아 로컬에서 거른다
        offset = 0
        while True:
            page = rest("GET", "filing_docs?select=rcept_no&limit=1000&offset=%d" % offset)
            done.update(r["rcept_no"] for r in page)
            if len(page) < 1000:
                break
            offset += 1000
    todo = [r for r in rcepts if r not in done]
    print("  docs: 대상 %d건 (기존 %d 건너뜀)" % (len(todo), len(rcepts) - len(todo)))

    doc_dir = os.path.join(RAW_DIR, corp["corp_code"], "docs")
    os.makedirs(doc_dir, exist_ok=True)
    ok = err = n_sec = 0
    for i, rcept in enumerate(todo, 1):
        try:
            files = api.call_zip(key, "document.xml", rcept_no=rcept)
            main_name = sorted(files)[0]
            raw = files[main_name]
            with open(os.path.join(doc_dir, rcept + "." + main_name.split(".")[-1]), "wb") as f:
                f.write(raw)
            sections = dart_doc.split_sections(api.decode_kr(raw))
            sec_rows = [{
                "rcept_no": rcept, "sec_no": n, "title": title[:300],
                "content": body[:5_000_000],
                "is_note": dart_doc.is_note_section(title),
                "is_biz": dart_doc.is_biz_section(title),
            } for n, (title, body) in enumerate(sections, 1)]
            replace_scope("filing_sections", {"rcept_no": "eq.%s" % rcept}, sec_rows)
            upsert("filing_docs", [{
                "rcept_no": rcept, "file_name": main_name, "n_files": len(files),
                "n_sections": len(sec_rows), "bytes": len(raw), "status": "ok",
            }], on_conflict="rcept_no")
            ok += 1
            n_sec += len(sec_rows)
        except Exception as e:  # 원문 없는 공시 등 — 기록하고 계속
            err += 1
            upsert("filing_docs", [{"rcept_no": rcept, "status": "error:%s" % str(e)[:200]}],
                   on_conflict="rcept_no")
        if i % 100 == 0:
            print("    …%d/%d (섹션 %d)" % (i, len(todo), n_sec))
    print("  filing_docs: 성공 %d · 실패 %d · 섹션 %d" % (ok, err, n_sec))


def load_ownership(key, corp):
    data = api.ownership(key, corp["corp_code"])
    kind_map = {"대량보유(5%)": "majorstock", "임원·주요주주 소유보고": "elestock"}
    total = 0
    for label, rows in data.items():
        kind = kind_map.get(label, label)
        save_raw(corp["corp_code"], "ownership_%s" % kind, rows)
        db_rows = [{"corp_code": corp["corp_code"], "kind": kind,
                    "rcept_no": r.get("rcept_no"), "rcept_dt": d8(r.get("rcept_dt")),
                    "payload": r} for r in rows]
        replace_scope("ownership_txns",
                      {"corp_code": "eq.%s" % corp["corp_code"], "kind": "eq.%s" % kind},
                      db_rows)
        total += len(db_rows)
    print("  ownership_txns: %d" % total)


STAGES = ["company", "filings", "fin", "items", "events", "regs", "ownership", "docs"]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("name", help="회사명")
    p.add_argument("--since", type=int, default=HISTORY_START, help="공시 수집 시작 연도")
    p.add_argument("--only", help="쉼표 구분 단계 (%s)" % ",".join(STAGES))
    p.add_argument("--redo-docs", action="store_true", help="원문을 기존 것 포함해 다시 수집")
    args = p.parse_args()

    key = api.resolve_key() or api.read_env_file(os.path.join(_REPO, ".env.local")).get("DART_API_KEY")
    if not key:
        print(json.dumps({"ok": False, "error": "DART_API_KEY 없음 (레포 루트 .env.local 확인)"},
                         ensure_ascii=False))
        sys.exit(2)
    corp, cands = api.find_corp(key, args.name)
    if not corp:
        print(json.dumps({"ok": False, "error": "기업 특정 실패", "후보": cands[:5]},
                         ensure_ascii=False))
        sys.exit(1)
    stages = [s.strip() for s in args.only.split(",")] if args.only else STAGES
    print("적재 시작: %s (%s) — 단계: %s" % (corp["corp_name"], corp["stock_code"], ",".join(stages)))
    t0 = dt.datetime.now()

    if "company" in stages:
        load_company(key, corp)
    if "filings" in stages:
        load_filings(key, corp, args.since)
    if "fin" in stages:
        load_financials(key, corp, args.since)
    if "items" in stages:
        load_report_items(key, corp, args.since)
    if "events" in stages:
        load_events(key, corp, args.since)
    if "regs" in stages:
        load_registrations(key, corp, args.since)
    if "ownership" in stages:
        load_ownership(key, corp)
    if "docs" in stages:
        load_docs(key, corp, redo=args.redo_docs)

    print("완료: %s (%.1f분)" % (corp["corp_name"],
                                (dt.datetime.now() - t0).total_seconds() / 60))


if __name__ == "__main__":
    main()
