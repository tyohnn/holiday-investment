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
import ssl
import sys
import urllib.parse
import urllib.request

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO = os.path.dirname(os.path.dirname(_HERE))
sys.path.insert(0, os.path.join(_REPO, "plugin", "skills", "company-analysis", "scripts"))
import dart_api as api  # noqa: E402

# 주의: 프로세스 환경만 보면 안 된다. .env.local 에 호스티드 주소를 적어두고도 셸에
# export 하지 않으면 조용히 기본값(로컬 Docker 스택)으로 떨어져서, 호스티드에 백필하고
# 있다고 믿으며 노트북 DB 를 채우는 사고가 실제로 났다. 조용한 게 문제의 본체였다.
# 그래서 (1) DART_API_KEY 와 똑같이 레포 루트 .env.local 을 폴백으로 읽고(프로세스
# 환경이 여전히 우선 — 일회성 오버라이드가 가능해야 한다), (2) print_target() 으로 매
# 명령이 시작 전에 해석된 대상을 소리내어 찍는다. 키는 절대 찍지 않는다.
_ENV_FILE = api.read_env_file(os.path.join(_REPO, ".env.local"))


def env_setting(name, default):
    """프로세스 환경 > 레포 루트 .env.local > 기본값."""
    return os.environ.get(name) or _ENV_FILE.get(name) or default


REST = env_setting("SUPABASE_REST_URL", "http://127.0.0.1:54321/rest/v1")
# supabase local 의 공용 데모 service_role 키 (모든 로컬 인스턴스 동일 — 비밀 아님)
SERVICE_KEY = env_setting("SUPABASE_SERVICE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0."
    "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU")
RAW_DIR = os.path.join(_HERE, "..", "data", "raw")
FIN_START_DEFAULT = 2015          # fnlttSinglAcntAll·정기보고서 API 데이터 제공 시점
HISTORY_START = 2000              # 전자공시 전면화

CORRECTION_RE = re.compile(r"\[기재정정")


# ─────────────────────────────────────────────── 대상 표시

def target_host():
    return urllib.parse.urlsplit(REST).netloc or REST


def is_local_target():
    host = target_host().split(":")[0]
    return host in ("127.0.0.1", "localhost", "::1", "0.0.0.0")


def target_label():
    return "%s (로컬)" % target_host() if is_local_target() else target_host()


def print_target():
    """해석된 대상 DB 호스트를 명령 시작 전에 출력한다 — 어떤 DB 를 채우고 있는지가
    조용하면 안 된다(위 env_setting 주석 참고). 호스트만 찍고 키는 절대 찍지 않는다."""
    print("대상: %s" % target_label())


# ─────────────────────────────────────────────── REST 헬퍼

# 이 연결은 service_role 키를 실어 나른다 — 검증 생략 폴백(_net.py 의 마지막 수단)을
# 여기 복사해오면 안 된다. _net.py 의 폴백은 DART 공개 read-only API 전용이고, 여기서
# 검증을 끄면 그 키가 중간자에게 그대로 노출된다. python.org 파이썬은 시스템 CA 를
# 안 써서 hosted(https://*.supabase.co)에 CERTIFICATE_VERIFY_FAILED 가 나므로,
# 해법은 검증을 끄는 게 아니라 certifi 의 CA 번들을 명시적으로 물리는 것이다.
try:
    import certifi
    _SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:  # certifi 가 없으면 표준 기본 컨텍스트 — 여전히 검증은 한다
    _SSL_CTX = ssl.create_default_context()


def rest(method, path, body=None, prefer=None):
    url = "%s/%s" % (REST, path)
    headers = {"apikey": SERVICE_KEY, "Authorization": "Bearer %s" % SERVICE_KEY,
               "Content-Type": "application/json"}
    if prefer:
        headers["Prefer"] = prefer
    data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60, context=_SSL_CTX) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:500]
        raise RuntimeError("PostgREST %s %s → %s: %s" % (method, path, e.code, detail))


def upsert(table, rows, on_conflict):
    for i in range(0, len(rows), 500):
        rest("POST", "%s?on_conflict=%s" % (table, on_conflict), rows[i:i + 500],
             prefer="resolution=merge-duplicates,return=minimal")


def replace_scope(table, filters, rows, on_conflict=None):
    """스코프 삭제 후 삽입 — 멱등 적재의 기본형. filters 예: {'corp_code':'eq.X','item':'eq.배당'}

    on_conflict 를 주면 삽입을 upsert 로 돌린다. 삭제·삽입 두 요청 사이에는 트랜잭션이
    없어서(PostgREST 요청 단위로 끊긴다) 같은 스코프를 동시에 처리하는 프로세스가 있으면
    delete→delete→insert→insert 로 엇물려 행이 두 배가 될 수 있다. 대상 테이블에
    자연키 유니크 인덱스가 있으면 merge-duplicates 가 그 창을 닫는다 —
    뒤 삽입이 앞 삽입을 덮어써서, 몇 번을 엇물려도 결과 집합은 같다.
    """
    q = urllib.parse.urlencode(filters)  # 한글 값(eq.배당 등) percent-encoding
    rest("DELETE", "%s?%s" % (table, q))
    path = table if on_conflict is None else "%s?on_conflict=%s" % (table, on_conflict)
    prefer = ("return=minimal" if on_conflict is None
              else "resolution=merge-duplicates,return=minimal")
    for i in range(0, len(rows), 500):
        rest("POST", path, rows[i:i + 500], prefer=prefer)


def dedupe_by(rows, key_cols, label):
    """자연키가 겹치는 행을 첫 번째만 남기고 제거한다.

    Postgres 의 ON CONFLICT 는 "한 INSERT 문 안에서 같은 키를 두 번" 을 처리하지 못하고
    (cannot affect row a second time) 배치 전체를 실패시킨다. 그래서 upsert 로 보내기 전에
    파이썬에서 먼저 접어야 한다. 지금까지 실측한 DART 응답에는 이 중복이 0건이므로
    (raw 51만 행 검사) 정상 경로에서는 no-op 이다 — 소리 없이 지나가면 안 되니 찍는다."""
    seen, out = set(), []
    for r in rows:
        k = tuple(r.get(c) for c in key_cols)
        if k in seen:
            continue
        seen.add(k)
        out.append(r)
    if len(out) != len(rows):
        print("  ! %s: 응답 내 자연키 중복 %d행 제거" % (label, len(rows) - len(out)))
    return out


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
    return prof  # 호출부(backfill.py)가 재조회 없이 corp_cls 를 읽어 상장상태 게이트에 쓴다


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


# financial_facts 의 자연키는 **DB 가 단독으로 정의한다** — financial_facts.natural_key
# 생성 컬럼(20260803000002)의 식이 유일한 정의이고, ff_natural_key 유니크 인덱스가 그
# 한 컬럼에 걸린다. 그래서 upsert 의 on_conflict 도 컬럼 하나만 가리킨다(아래 상수).
#
# 이전에는 인덱스가 "id 를 뺀 전 컬럼" 목록이었고 여기 FIN_KEY 튜플이 그 목록과 글자
# 그대로 같아야 했다(PostgREST 의 on_conflict 는 컬럼 목록으로 인덱스를 추론한다).
# 정의가 두 곳에 있으니 어긋나도 런타임 42P10 으로만 드러났고, 그건 그 자체가 결함이었다.
# 이제 그 이중 소스가 없다 — 키에 컬럼을 더하거나 빼는 일은 마이그레이션에서만 한다.
FIN_CONFLICT = "natural_key"

# ★ FIN_KEY 는 더 이상 인덱스 계약이 아니다. 남은 용도는 하나뿐 — 아래 dedupe_by 가
#   "한 INSERT 문 안에 같은 키가 두 번" 을 미리 접기 위해 쓰는 클라이언트 측 사본이다
#   (Postgres 의 ON CONFLICT 는 그 경우를 21000 으로 배치째 실패시킨다 — 실측 확인).
#   그래서 이 튜플은 DB 의 정의와 **정확히 같을 필요는 없고, 더 촘촘하기만 하면 안 된다**:
#   DB 가 같다고 볼 두 행을 여기서 다르다고 보면 배치가 깨진다. 지금은 일치한다 —
#   텍스트는 양쪽 다 문자열 동등성이고, 숫자는 파이썬의 1 == 1.0 과 Postgres numeric 의
#   1 = 1.00(마이그레이션의 trim_scale 정규화)이 같은 판정이며, None 끼리도 양쪽 다 같다.
#   컬럼을 추가할 때 여기 빠뜨려도 배치는 안전하게 통과한다(덜 접을 뿐 DB 가 잡는다).
FIN_KEY = ("corp_code", "bsns_year", "reprt_code", "fs_div", "sj_div",
           "account_id", "account_nm", "account_detail", "ord",
           "amount", "amount_prev", "amount_prev2",
           "amount_prev_q", "amount_cum", "amount_prev_cum",
           "currency", "rcept_no")


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
                # ★ 자본변동표(SCE)의 두 번째 축. 이걸 버리면 "자본금/이익잉여금/
                #   기타포괄손익누계액/비지배지분…" 열이 전부 같은 행으로 뭉개져서,
                #   멀쩡한 서로 다른 셀이 완전 중복 행으로 보인다(이번 사고의 원인).
                "account_detail": r.get("account_detail"),
                "amount": num(r.get("thstrm_amount")),
                "amount_prev": num(r.get("frmtrm_amount")),
                "amount_prev2": num(r.get("bfefrmtrm_amount")),
                # ★ 분기·반기 보고서 전용 금액 셋(20260803000002). 위 셋만 읽으면
                #   분기 플로우(IS·CIS·CF·SCE) 행의 비교값이 90% 가까이 NULL 이 된다 —
                #   DART 가 안 준 게 아니라 다른 필드로 주는데 안 읽었던 것이다.
                #   실측(raw 6,000파일 103만행) 유효값률: frmtrm_q_amount 는 분기 행의
                #   68~69%(연간 0%), *_add_amount 는 IS·CIS 행의 98%대(연간 0%).
                #   frmtrm_q_amount 를 amount_prev 에 합치지 않는 이유는 마이그레이션
                #   주석 참고 — 한 컬럼에 전기/전기동분기 두 의미가 섞인다.
                "amount_prev_q": num(r.get("frmtrm_q_amount")),      # 전기 동분기
                "amount_cum": num(r.get("thstrm_add_amount")),       # 당기 누적(YTD)
                "amount_prev_cum": num(r.get("frmtrm_add_amount")),  # 전기 누적(YTD)
                "ord": num(r.get("ord")), "currency": r.get("currency"),
                "rcept_no": r.get("rcept_no"),
            } for r in rows]
            db_rows = dedupe_by(db_rows, FIN_KEY, "financial_facts %d/%s" % (y, reprt))
            # 삭제 필터에 fs_div 를 넣지 않는 것은 의도적이다. finstate_all 은 CFS 를
            # 먼저 시도하고 없으면 OFS 로 폴백하므로, 같은 (corp, year, reprt) 의
            # fs_div 가 연도·재적재 시점에 따라 바뀐다. 필터에 fs_div 를 넣으면 이전
            # 적재가 남긴 반대쪽 fs_div 행이 지워지지 않고 살아남아 연결·별도 재무제표가
            # 한 스코프에 섞인다 — 지금보다 나쁜 오염이다. 스코프는 넓게 지우는 게 맞다.
            replace_scope("financial_facts",
                          {"corp_code": "eq.%s" % corp["corp_code"],
                           "bsns_year": "eq.%d" % y, "reprt_code": "eq.%s" % reprt},
                          db_rows, on_conflict=FIN_CONFLICT)
            total += len(db_rows)
    print("  financial_facts: %d" % total)


def load_report_items(key, corp, since_year):
    this_year = dt.date.today().year
    total = 0
    for item in api.REPORT_ITEMS:
        # 주의: 상한을 this_year(배타)로 두면 당해년도 정기보고서 항목이 영영 수집되지
        # 않는다 — load_financials/load_events 는 this_year를 포함하는데 여기만 빠져
        # 있었다(버그, P-B 백필 착수 전 발견). +1 로 포함시킨다.
        for y in range(max(since_year, FIN_START_DEFAULT), this_year + 1):
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
    print_target()

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
