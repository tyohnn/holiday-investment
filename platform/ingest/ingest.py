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
import hashlib
import json
import os
import random
import re
import socket
import ssl
import sys
import time
import urllib.error
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

# Phase 3(공시 원문) Storage 규약 — fin_storage.py/storage_trial.py 의 버킷(platform-raw)을
# 그대로 재사용하고, 원문은 fin/ 과 나란한 docs/ 프리픽스 아래에 둔다: docs/<corp_code>/<rcept_no>.zip
STORAGE_BUCKET = "platform-raw"
DOCS_PREFIX = "docs"

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


# 이 런은 몇 시간짜리 배치이고, 지금까지 세 번 죽었다 — 그중 최소 두 번은 rest() 에 재시도가
# 전혀 없어서다(디스크 풀 503, DNS 조회 실패 URLError). 아래는 "무엇을 재시도할지"의 근거다.
#
# 재시도 대상:
#   - urllib.error.URLError 인데 HTTPError 는 아닌 것: 서버가 아예 응답하지 못한 경우다 —
#     DNS 실패("nodename nor servname provided, or not known", 이번 사고 원인), 연결
#     거부·리셋, 소켓 타임아웃이 전부 이 형태로 온다(urlopen 은 이들을 대개 URLError 로
#     감싼다). 전형적인 트랜스포트 재시도 대상.
#   - socket.timeout/TimeoutError·ConnectionResetError·ssl.SSLError: urlopen 이 항상
#     URLError 로 감싸주는 건 아니다(응답을 읽는 도중 등에는 원본 예외가 그대로 샐 수
#     있다) — 방어적으로 명시해 잡는다.
#   - HTTPError 이면서 5xx 또는 429: 5xx 는 서버·인프라 쪽 일시 장애(과부하·재시작 등)일
#     가능성이 높고, 429 는 "지금 말고 나중에" 라는 명시적 신호다.
#     PostgREST 의 503/53100(statement_timeout·insufficient resources) 은 애매하다 —
#     디스크가 꽉 찬 경우(실제로 한 번 이랬다)처럼 재시도해도 절대 안 풀리는 원인도 있고,
#     순간적 커넥션·리소스 경합처럼 몇 초 뒤엔 풀리는 원인도 있다. 응답 바디를 파싱해
#     53100 을 따로 가려내지 않는 이유: 가려내 봐야 결론이 같다. 진짜 디스크 풀이면
#     재시도가 전부 실패하고 원래대로 예외가 올라가 mark_failed 로 가며(추가 비용은 아래
#     상한이 보장하는 최대 지연뿐 — 몇 시간짜리 배치에 문제 안 됨), 진짜 일시적이면
#     재시도가 그 시도 자체를 구해준다. 그래서 5xx 를 뭉뚱그려 재시도해도 손해가 없다.
#
# 재시도 안 함:
#   - HTTPError 이면서 4xx(429 제외): 클라이언트 쪽 문제다 — 23505 유니크 위반, 42501
#     권한 거부, 잘못된 payload 는 응답이 바뀔 리 없다. 재시도는 시간만 태우고 진짜
#     원인을 더 늦게 드러낼 뿐이라 즉시 올린다.
# 상한을 DART 쪽(backfill.py _run_with_retry)보다 크게 잡는 이유 — 막는 대상이 다르다.
# DART 재시도는 "서버가 잠깐 삐끗함"을 넘기는 용도라 1분이면 충분하다. 여기서 막아야 하는 건
# 그게 아니라 **이 노트북의 네트워크가 통째로 사라지는 것**이다(절전 진입, 와이파이 재접속,
# DNS 재설정). 실측: Phase 1 에서 3번, Phase 2 에서 1번, 전부 같은 예외로 죽었다 —
# URLError [Errno 8] nodename nor servname provided(= DNS 조회 실패). 5회·30초 상한은 총
# 대기가 1분 남짓이라 그보다 긴 단절을 못 넘긴다.
#
# 10회 · 300초 상한이면 총 대기가 15분을 넘어(2,4,8,…,300,300 + 지터) 절전 복귀·재접속을
# 견딘다. 며칠짜리 배치에서 15분 더 기다리는 비용은 사실상 0이고, 반대로 못 넘기면 실행이
# 통째로 죽어 사람이 붙어야 한다 — 비대칭이 크다.
#
# 이걸 늘려도 "영원히 매달리는" 상태는 안 된다: 상한을 다 쓰면 예외가 그대로 올라가고
# backfill 의 _safe_checkpoint → mark_failed 경로가 평소처럼 돈다.
_REST_MAX_ATTEMPTS = 10
_REST_BACKOFF_CAP = 300  # 초


def _is_retryable_rest_error(exc):
    if isinstance(exc, urllib.error.HTTPError):
        return exc.code >= 500 or exc.code == 429
    if isinstance(exc, urllib.error.URLError):
        return True
    if isinstance(exc, (socket.timeout, TimeoutError, ConnectionResetError, ssl.SSLError)):
        return True
    return False


def _sleep_backoff(attempt):
    base = min(2 ** attempt, _REST_BACKOFF_CAP)
    time.sleep(base + random.uniform(0, base))  # 지수 백오프 + 지터


def rest(method, path, body=None, prefer=None):
    headers = {"apikey": SERVICE_KEY, "Authorization": "Bearer %s" % SERVICE_KEY,
               "Content-Type": "application/json"}
    if prefer:
        headers["Prefer"] = prefer
    url = "%s/%s" % (REST, path)
    data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None

    for attempt in range(1, _REST_MAX_ATTEMPTS + 1):
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=60, context=_SSL_CTX) as resp:
                raw = resp.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:500]
            if _is_retryable_rest_error(e) and attempt < _REST_MAX_ATTEMPTS:
                _sleep_backoff(attempt)
                continue
            raise RuntimeError("PostgREST %s %s → %s: %s" % (method, path, e.code, detail))
        except Exception as e:
            # URLError·socket.timeout 등 — 재시도 대상이 아니거나 상한을 다 썼으면 원본
            # 예외를 그대로 올린다(감싸지 않는다 — 호출부가 지금과 똑같이 처리할 수 있게).
            if _is_retryable_rest_error(e) and attempt < _REST_MAX_ATTEMPTS:
                _sleep_backoff(attempt)
                continue
            raise


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


# ─────────────────────────────────────────────── Storage 헬퍼 (Phase 3 공시 원문)
#
# fin_storage.py 가 이미 이 형태(http_retry 로 전송 재시도를 물린 뒤 Storage REST 를 직접
# 때리는 방식)를 구현해뒀지만, fin_storage.py 는 이 모듈(ingest.py)을 import 하므로
# 여기서 거꾸로 fin_storage 를 import 하면 순환 import 가 된다. 그래서 같은 형태를
# 이 모듈 안에서 다시 얹는다(재발명이 아니라 복제 — 판단 기준은 fin_storage.http_retry 와
# 동일: HTTPError 는 상태코드로 5xx/429 를 재시도, 그 외 예외는 _is_retryable_rest_error 로).

def _storage_base():
    return REST.replace("/rest/v1", "/storage/v1")


def svc_headers(extra=None):
    h = {"apikey": SERVICE_KEY, "Authorization": "Bearer %s" % SERVICE_KEY}
    h.update(extra or {})
    return h


def _http(method, url, body=None, headers=None, raw=False):
    """상태코드·본문을 예외로 삼키지 않고 그대로 돌려준다(재시도 판단은 호출부가 한다)."""
    req = urllib.request.Request(url, data=body, headers=headers or {}, method=method)
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=120, context=_SSL_CTX) as resp:
            data = resp.read()
            return resp.status, (data if raw else data.decode("utf-8", "replace")), time.time() - t0
    except urllib.error.HTTPError as e:
        data = e.read()
        return e.code, (data if raw else data.decode("utf-8", "replace")), time.time() - t0


def storage_http_retry(method, url, body=None, headers=None, raw=False):
    """Storage 호출 전송 재시도 — rest() 의 상수(10회·300초)·_is_retryable_rest_error() 를
    그대로 물린다(fin_storage.http_retry() 와 같은 형태)."""
    for attempt in range(1, _REST_MAX_ATTEMPTS + 1):
        try:
            status, data, elapsed = _http(method, url, body, headers, raw=raw)
        except Exception as e:
            if _is_retryable_rest_error(e) and attempt < _REST_MAX_ATTEMPTS:
                _sleep_backoff(attempt)
                continue
            raise
        if (status >= 500 or status == 429) and attempt < _REST_MAX_ATTEMPTS:
            _sleep_backoff(attempt)
            continue
        return status, data, elapsed
    raise RuntimeError("unreachable")  # 루프는 항상 return 또는 raise 로 빠진다


def storage_upload(path, data, content_type):
    """버킷 STORAGE_BUCKET 에 x-upsert 로 업로드. (status, text) 반환(예외를 던지지 않는다 —
    호출부가 status 로 성공 여부를 판단, 실패해도 다른 rcept_no 처리를 막지 않기 위해서)."""
    base = _storage_base()
    status, text, _ = storage_http_retry(
        "POST", "%s/object/%s/%s" % (base, STORAGE_BUCKET, path), data,
        svc_headers({"Content-Type": content_type, "x-upsert": "true"}))
    return status, text


def storage_download(path):
    """Storage 객체를 원본 바이트로 받는다. (status, bytes|에러텍스트) 반환."""
    base = _storage_base()
    status, data, _ = storage_http_retry(
        "GET", "%s/object/%s/%s" % (base, STORAGE_BUCKET, path),
        headers=svc_headers(), raw=True)
    return status, data


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


def fin_db_rows(corp_code, year, reprt, fs, rows):
    """DART finstate_all 응답 행 → financial_facts 행. **매핑의 단일 소스.**

    load_financials(온라인, API 응답)와 restore_fin_from_raw.py(오프라인, data/raw 에
    저장된 같은 응답)가 둘 다 이 함수를 부른다. 매핑을 복사하면 두 경로가 조용히 갈라져
    "재적재했더니 신규 적재와 다른 행이 들어가는" 사고가 나므로, 사본을 만들지 않는다.

    fs(fs_div)만 응답 밖에서 온다 — DART 는 fs_div 를 요청 파라미터로만 받고 응답 행에는
    싣지 않기 때문에(dart_api.finstate_all 주석), 오프라인 경로는 이 값을 DB 의 기존
    스코프에서 읽어 넘긴다.
    """
    db_rows = [{
            "corp_code": corp_code, "bsns_year": year, "reprt_code": reprt,
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
    return dedupe_by(db_rows, FIN_KEY, "financial_facts %s %s/%s" % (corp_code, year, reprt))


def write_fin_scope(corp_code, year, reprt, fs, rows):
    """한 (회사, 연도, 보고서) 스코프를 통째로 교체한다. 온라인·오프라인 공통 쓰기 경로.

    replace_scope 의 delete→insert 가 여기서 본질적이다: 매핑이 바뀌면(account_detail
    복원, 분기 금액 3컬럼) 같은 사실의 natural_key 가 달라지므로 순수 upsert 로는 옛 행이
    나란히 남는다. 스코프를 먼저 비우는 것이 '누적'이 아니라 '교체'를 만든다.
    """
    db_rows = fin_db_rows(corp_code, year, reprt, fs, rows)
    # 삭제 필터에 fs_div 를 넣지 않는 것은 의도적이다. finstate_all 은 CFS 를
    # 먼저 시도하고 없으면 OFS 로 폴백하므로, 같은 (corp, year, reprt) 의
    # fs_div 가 연도·재적재 시점에 따라 바뀐다. 필터에 fs_div 를 넣으면 이전
    # 적재가 남긴 반대쪽 fs_div 행이 지워지지 않고 살아남아 연결·별도 재무제표가
    # 한 스코프에 섞인다 — 지금보다 나쁜 오염이다. 스코프는 넓게 지우는 게 맞다.
    replace_scope("financial_facts",
                  {"corp_code": "eq.%s" % corp_code,
                   "bsns_year": "eq.%s" % year, "reprt_code": "eq.%s" % reprt},
                  db_rows, on_conflict=FIN_CONFLICT)
    return len(db_rows)


def load_financials(key, corp, since_year):
    this_year = dt.date.today().year
    total = 0
    for y in range(max(since_year, FIN_START_DEFAULT), this_year + 1):
        for reprt in ("11011", "11013", "11012", "11014"):
            rows, fs = api.finstate_all(key, corp["corp_code"], y, reprt=reprt)
            if not rows:
                continue
            save_raw(corp["corp_code"], "fin_%d_%s" % (y, reprt), rows)
            total += write_fin_scope(corp["corp_code"], y, reprt, fs, rows)
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
    """공시 원문 전량 — DART 원본 zip 을 그대로 Storage(docs/<corp_code>/<rcept_no>.zip)에
    올리고 filing_docs 에 매니페스트만 남긴다. rcept_no 단위 증분(재실행 시 skip).

    섹션 추출(filing_sections)은 여기서 하지 않는다 — 전 종목 본문을 Postgres 에 넣는 건
    물리적으로 불가능하고(회사당 162MB × 2,756개사), 관심종목이 정해진 뒤 docs_storage.py 가
    이 Storage 원문에서 뽑는다. 이 함수가 DART document.xml 을 부르는 유일한 지점이므로,
    나중에 관심종목이 늘어나도 DART 를 다시 호출하지 않는다(docs_storage.py 는 DART 호출 0건).
    """
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
        # 예전엔 filing_docs 전량(전 종목이면 200만+ 행)을 페이지네이션으로 받아 로컬에서
        # 걸렀다 — 회사 하나 처리할 때마다 왕복 2,000회 이상이라 전 종목 규모에서는
        # 비현실적이었다. filing_docs 는 corp_code 컬럼이 없지만(rcept_no 로만 filings 를
        # 참조) PostgREST 임베딩으로 그 회사 것만 조인해서 받을 수 있다 — 실측 확인
        # (filing_docs?select=rcept_no,filings!inner(corp_code)&filings.corp_code=eq.<code>
        # 가 호스티드에서 200/[] 로 정상 응답, filings→companies 같은 형태의 임베딩 필터가
        # 실제로 3행을 돌려주는 것도 별도로 확인했다).
        #
        # ★ status=eq.ok 가 반드시 있어야 한다. 없으면 실패 기록(020 쿼터 초과·일시적
        #   네트워크 오류 등)까지 "완료"로 간주해 **영영 재시도하지 않는다** — 2026-08-24
        #   실측으로 85,509건이 이 상태로 묶여 있었다(쿼터 소진 중 계속 돌린 결과).
        #   원문 없는 공시(status=014)도 error 로 기록되어 매번 재시도되지만, 그건
        #   회사당 1% 남짓이고 헛돈 콜보다 데이터 유실이 훨씬 나쁘다.
        offset = 0
        while True:
            page = rest("GET",
                "filing_docs?select=rcept_no,filings!inner(corp_code)&status=eq.ok"
                "&filings.corp_code=eq.%s&limit=1000&offset=%d" % (corp["corp_code"], offset))
            done.update(r["rcept_no"] for r in page)
            if len(page) < 1000:
                break
            offset += 1000
    todo = [r for r in rcepts if r not in done]
    print("  docs: 대상 %d건 (기존 %d 건너뜀)" % (len(todo), len(rcepts) - len(todo)))

    ok = err = 0
    for i, rcept in enumerate(todo, 1):
        try:
            files = api.call_zip(key, "document.xml", rcept_no=rcept)
            main_name = sorted(files)[0]
            zip_bytes = files.raw  # 원본 zip 전체 바이트(dart_api.ZipFiles.raw) — 대표 파일 하나만
            sha256 = hashlib.sha256(zip_bytes).hexdigest()  # 남기던 이전 구현과 달리 손실이 없다
            path = "%s/%s/%s.zip" % (DOCS_PREFIX, corp["corp_code"], rcept)
            status, text = storage_upload(path, zip_bytes, "application/zip")
            if status not in (200, 201):
                raise RuntimeError("Storage 업로드 실패 %s: %s" % (status, str(text)[:200]))
            upsert("filing_docs", [{
                "rcept_no": rcept, "file_name": main_name, "n_files": len(files),
                "bytes": len(files[main_name]), "status": "ok",
                "storage_path": path, "zip_bytes": len(zip_bytes), "zip_sha256": sha256,
            }], on_conflict="rcept_no")
            ok += 1
        except Exception as e:  # 원문 없는 공시 등 — 기록하고 계속
            err += 1
            upsert("filing_docs", [{"rcept_no": rcept, "status": "error:%s" % str(e)[:200]}],
                   on_conflict="rcept_no")
        if i % 100 == 0:
            print("    …%d/%d" % (i, len(todo)))
    print("  filing_docs: 성공 %d · 실패 %d" % (ok, err))


def load_docs_for_rcepts(key, items, redo=False):
    """공시 원문 — load_docs() 와 같은 Storage 규약(docs/<corp_code>/<rcept_no>.zip)·
    filing_docs 매니페스트를 쓰지만, **회사 전체 이력이 아니라 호출자가 지정한 (corp_code,
    rcept_no) 목록만** 받는다. daily_sync.py 가 "오늘 새로 들어온 공시" 만 원문을 받고 싶을 때
    쓰는 경로다 — load_docs() 는 그 회사의 filings 전체를 DB 에서 다시 긁어 done-set 과
    diff 하므로 이 용도엔 안 맞는다(코드 재사용 대신 나란히 추가한 이유: load_docs() 자체를
    고치면 백필의 회사 단위 경로가 흔들릴 위험이 있다 — 요구사항이 기존 동작 불변임).

    items: [(corp_code, rcept_no), ...] 리스트 — **in-place 로 줄인다**(처리한 항목을
    앞에서부터 pop 한다). 쿼터 소진(backfill.QuotaExhausted)을 만나면 그 항목은 빼지 않고
    즉시 위로 던진다: load_docs() 의 기존 관용구(`except Exception` 으로 전부 삼켜 "error:"
    기록 후 계속)를 그대로 따르면, 소진된 키로 남은 rcept 전부를 계속 시도해 020 을 반복해서
    맞는다 — phase3-daily.log 의 "020 급증" 버스트가 이 경로(load_docs 의 동일 관용구)에서
    난 것으로 보인다(정황상 추정, 확인 불가). QuotaExhausted 를 클래스명 문자열로만 식별하는
    이유는 ingest.py 가 backfill.py 를 import 하면 순환 import 가 되기 때문이다(backfill.py 가
    이미 ingest.py 를 import 한다) — isinstance 대신 type(e).__name__ 비교로 결합 없이 구분한다.

    호출자(daily_sync.py)는 예외를 잡고 items 에 남은 걸 보고 새 키로 다시 부르면 이어서
    처리된다(멱등 — filing_docs.status=ok 스킵 로직이 재호출마다 다시 돈다).
    반환: (ok건수, err건수) — 정상 종료(items 를 끝까지 비웠을 때)만.
    """
    if not redo and items:
        # load_docs() 의 "status=eq.ok 만 완료로 본다" 규약을 그대로 따른다(실패 기록을
        # 완료로 착각해 영영 재시도 안 하는 사고 재발 방지 — ingest.py 모듈 주석 참고).
        rcepts = [r for _, r in items]
        done = set()
        for i in range(0, len(rcepts), 200):  # in.() URL 길이 보호 (fetch_corp_info 규약과 동일)
            chunk = rcepts[i:i + 200]
            q = ("filing_docs?select=rcept_no&status=eq.ok&rcept_no=in.(%s)" %
                 ",".join(urllib.parse.quote(r) for r in chunk))
            done.update(row["rcept_no"] for row in rest("GET", q))
        items[:] = [(c, r) for c, r in items if r not in done]

    ok = err = 0
    while items:
        corp_code, rcept = items[0]
        try:
            files = api.call_zip(key, "document.xml", rcept_no=rcept)
            main_name = sorted(files)[0]
            zip_bytes = files.raw
            sha256 = hashlib.sha256(zip_bytes).hexdigest()
            path = "%s/%s/%s.zip" % (DOCS_PREFIX, corp_code, rcept)
            status, text = storage_upload(path, zip_bytes, "application/zip")
            if status not in (200, 201):
                raise RuntimeError("Storage 업로드 실패 %s: %s" % (status, str(text)[:200]))
            upsert("filing_docs", [{
                "rcept_no": rcept, "file_name": main_name, "n_files": len(files),
                "bytes": len(files[main_name]), "status": "ok",
                "storage_path": path, "zip_bytes": len(zip_bytes), "zip_sha256": sha256,
            }], on_conflict="rcept_no")
            ok += 1
        except Exception as e:
            if type(e).__name__ == "QuotaExhausted":
                raise
            err += 1
            upsert("filing_docs", [{"rcept_no": rcept, "status": "error:%s" % str(e)[:200]}],
                   on_conflict="rcept_no")
        items.pop(0)
    return ok, err


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
