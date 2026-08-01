#!/usr/bin/env python3
"""배치 백필 오케스트레이터 — P-B 2단계: 전 상장사 순회 적재.

ingest.py 는 회사 1개를 처리하는 워커로 그대로 둔다(단계 함수를 그대로 import 해서 쓴다 —
셸아웃하지 않는다). 이 스크립트가 얹는 것은 세 가지뿐이다:

  1. seed  — corpCode.xml(상장사 전체, 종목코드 보유)을 ingest_corps 큐에 채운다.
  2. run   — (corp_code, stage) 체크포인트(ingest_progress)를 보고 대기 중인 일을 처리한다.
             키 로테이션·일일 쿼터 추적·전송 오류 재시도·쿼터 소진 감지·정상 중단이 모두 여기.
  3. status — 진행률·오늘 키별 사용량·잔여 호출 ETA 를 보여준다.

단계 비용(회사당, 전 역사 기준 실측치 — 로드맵 P-B 문서, ingest_progress 도입 전 2종목 실측):
  company 1 · filings ~30 · fin ~72 · items 253(당해년도 버그 수정 후 +23) · events 140 ·
  regs 6 · ownership 2 → 고정 ~503 + docs 는 그 회사의 공시 건수만큼(document.xml 1건=1콜).
  estimate_stage_calls() 가 이 실측치를 재현하는 연도창 공식으로 근사한다(연도가 지날수록
  이 값도 같이 늘어나야 하므로 상수로 박지 않는다).

전제: supabase start 가 떠 있고, DART_API_KEY(단일) 또는 DART_API_KEYS(쉼표 구분, 로테이션용)
가 설정돼 있다.
"""
import argparse
import datetime as dt
import hashlib
import os
import random
import signal
import socket
import ssl
import sys
import time
import urllib.error
import urllib.parse

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO = os.path.dirname(os.path.dirname(_HERE))
sys.path.insert(0, _HERE)
sys.path.insert(0, os.path.join(_REPO, "plugin", "skills", "company-analysis", "scripts"))
import ingest                      # noqa: E402  회사 단위 워커 — 단계 함수를 그대로 재사용
import dart_api as api             # noqa: E402

rest = ingest.rest                 # PostgREST 헬퍼 재사용 (SERVICE_KEY 로 인증)

DEFAULT_DAILY_BUDGET = int(os.environ.get("DART_DAILY_BUDGET", "20000"))
MAX_JOB_ATTEMPTS = 5               # 이 이상 실패한 (회사,단계)는 run 이 자동으로 재시도 안 함
RUNNING_STALE_MINUTES = 30         # 이보다 오래 running 이면 크래시로 간주하고 회수
QUOTA_EXCEEDED_STATUS = "020"      # OpenDART: "요청 제한을 초과하였습니다" (일일 호출 한도)
_TRANSIENT_DART_STATUSES = {"800"}  # 시스템 점검 — 일시적일 가능성이 높아 재시도 대상

PHASES = {
    1: ["company", "filings", "fin"],              # 이것만으로 스크리너가 돌아간다
    2: ["items", "events", "regs", "ownership"],
    3: ["docs"],
}

# ─────────────────────────────────────────────── 상장상태 게이트
#
# corpCode.xml 의 stock_code 는 "한때 종목코드를 배정받음"이지 "지금 거래 중"이 아니다(조사 완료 —
# 3,978개 stock_code 보유 법인 상당수가 상장폐지, modify_date 는 대용 지표로 못 씀). OpenDART
# company.json 의 corp_cls 는 30개 표본에서 모순 없이 생사를 갈랐다: Y(코스피)/K(코스닥)/N(코넥스)
# 는 생존, 그 외(E=기타법인 등)는 지금 상장 상태가 아니다. company 단계가 이 값을 이미 관측하므로
# (ingest.py load_company), filings/fin/phase2·3 이 이 회사에 또 ~102콜을 쓰기 전에 여기서 막는다.
LIVE_CORP_CLASSES = {"Y", "K", "N"}


def is_delisted_cls(corp_cls):
    """corp_cls 가 '지금은 상장이 아님'으로 확정됐는지. None(=company 단계 미실행, 모름)은
    절대 True 가 되면 안 된다 — "모른다"가 조용히 "건너뛴다"로 새는 걸 막는 게 이 함수의 존재
    이유다. corp_cls 가 문자열인데 Y/K/N 이 아니면(E 등) 게이트 대상."""
    return corp_cls is not None and corp_cls not in LIVE_CORP_CLASSES


# ─────────────────────────────────────────────── 작은 유틸

def now_iso():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def key_id(key):
    """원본 키를 저장하지 않기 위한 지문. 12자리 sha256 프리픽스면 키 몇 개를 구분하는
    데 충분하고, DB 를 봐도 키를 복원할 수 없다."""
    return hashlib.sha256(key.encode()).hexdigest()[:12]


def resolve_keys():
    """DART_API_KEYS(쉼표 구분) 우선, 없으면 기존 단일 DART_API_KEY 로 폴백."""
    raw = os.environ.get("DART_API_KEYS", "")
    keys = [k.strip() for k in raw.split(",") if k.strip()]
    if keys:
        return keys
    single = api.resolve_key() or api.read_env_file(os.path.join(_REPO, ".env.local")).get("DART_API_KEY")
    return [single] if single else []


def rest_get_all(base_query, page_size=1000):
    """PostgREST 기본 max_rows(1000, config.toml) 를 넘는 결과를 offset 페이지네이션으로 전량 수집.
    base_query 는 order= 절을 포함해야 페이지 간 순서가 안정적이다."""
    rows, offset = [], 0
    sep = "&" if "?" in base_query else "?"
    while True:
        chunk = rest("GET", "%s%slimit=%d&offset=%d" % (base_query, sep, page_size, offset))
        rows.extend(chunk)
        if len(chunk) < page_size:
            break
        offset += page_size
    return rows


def insert_ignore(table, rows, on_conflict):
    """이미 있는 (키) 는 건드리지 않고 새 행만 삽입 — seed 재실행이 기존 진행 상태를 안 지운다."""
    for i in range(0, len(rows), 500):
        rest("POST", "%s?on_conflict=%s" % (table, on_conflict), rows[i:i + 500],
             prefer="resolution=ignore-duplicates,return=minimal")


def _progress_filter(corp_code, stage):
    return "corp_code=eq.%s&stage=eq.%s" % (urllib.parse.quote(corp_code), urllib.parse.quote(stage))


# ─────────────────────────────────────────────── 호출 비용 근사

# 실측(로드맵 P-B, 2종목 전 역사 적재) 대비 보정계수. 두 단계만 이론치와 실측치가 벌어진다:
#   - fin: finstate_all() 이 CFS 없으면 OFS 로 폴백 호출을 추가한다(연도별로 다름 — 예측 불가라
#     계수로 흡수). 실측 ~72 / 이론(12년×4reprt) 48 ≈ 1.5
#   - filings: list.json 이 연 100건 넘으면 다음 페이지를 더 부른다(대형주·최근 연도에 흔함).
#     실측 ~30 / 이론(27개년) ≈ 1.1
# items·events·regs·ownership 은 이론식이 실측과 정확히 일치해 계수가 필요 없다(검증됨, 아래
# estimate_stage_calls 주석 참고).
_FIN_OFS_FALLBACK_FACTOR = 1.5
_FILINGS_PAGINATION_FACTOR = 1.1


def _year_span(start, end_inclusive):
    return max(0, end_inclusive - start + 1)


def estimate_stage_calls(stage, since_year):
    """회사 1곳·단계 1개의 예상 API 호출수. dry-run 총량·status ETA 에 쓴다 — 실제 호출은
    전혀 하지 않는다(순수 계산).

    검증: since=2015(FIN_START_DEFAULT 기준), this_year=2026 일 때
      items  = 23종 × (2015..2026 포함 12년)  → 버그 수정 전 값(11년×23=253)과 정확히 일치
      events = 35종 × ceil(12/3)=4창           → 로드맵 실측 "35종×4창=140" 과 정확히 일치
      regs   = 6종 × 1콜                        → 실측 "regs 6" 과 일치
    """
    this_year = dt.date.today().year
    if stage == "company":
        return 1
    if stage == "filings":
        return round(_year_span(since_year, this_year) * _FILINGS_PAGINATION_FACTOR)
    if stage == "fin":
        span = _year_span(max(since_year, ingest.FIN_START_DEFAULT), this_year)
        return round(span * 4 * _FIN_OFS_FALLBACK_FACTOR)
    if stage == "items":
        span = _year_span(max(since_year, ingest.FIN_START_DEFAULT), this_year)
        return span * len(api.REPORT_ITEMS)
    if stage == "events":
        span = _year_span(max(since_year, ingest.FIN_START_DEFAULT), this_year)
        windows = max(1, -(-span // 3))  # 3년 창, 올림
        return windows * len(api.EVENT_ITEMS)
    if stage == "regs":
        return len(api.REGISTRATION_ITEMS)
    if stage == "ownership":
        return 2
    if stage == "docs":
        return None  # 회사별 공시 건수에 의존 — 별도 근사(상태 명령에서 관측 평균 사용)
    raise ValueError(stage)


# ─────────────────────────────────────────────── DART 호출 재시도·쿼터 감지 (몽키패치)
#
# ingest.py 와 dart_api.py 는 그대로 둔다(요구사항). 대신 dart_api.call_json/call_zip 을
# 이 모듈이 감싸서 교체한다 — ingest.py 의 단계 함수들은 `api.call_json(...)` 형태로 매
# 호출마다 모듈 속성을 새로 찾아가므로(캐시된 바인딩이 아님), 여기서 api.call_json 을
# 바꿔치기하면 backfill.py 를 거치지 않고도 ingest.py 내부 호출까지 전부 적용된다.
#
# 재시도 대상은 "전송 계층 실패"(타임아웃·커넥션 리셋·5xx)뿐이다. DART 의 "013 데이터
# 없음"은 dart_api.call_json 이 예외 없이 빈 리스트를 돌려주는 정상 흐름이라 여기 도달조차
# 안 한다 — 재시도 횟수를 태우지 않는다는 요구사항이 이미 만족된다.
#
# 쿼터 소진(020)은 DartError 가 아니라 별도 QuotaExhausted 로 바꿔서 던진다. 이유: ingest.py/
# dart_api.py 안에 `except api.DartError: continue`/`pass` 패턴이 여러 곳 있다(load_report_items,
# load_events, dart_api.registrations/ownership). 020 을 DartError 그대로 두면 이 블록들이
# 조용히 삼켜버려서 "그 항목만 데이터가 없나보다" 하고 다음으로 넘어가 버린다 — 쿼터가 끊긴
# 걸 오케스트레이터가 영영 모르고, 남은 항목이 다 비어있는 채로 단계가 'done' 처리될 뻔했다.


class QuotaExhausted(Exception):
    def __init__(self, key):
        self.key = key
        super().__init__("DART API 키 오늘 한도 소진(status=020): ...%s" % key[-4:])


_orig_call_json = api.call_json
_orig_call_zip = api.call_zip
_on_call = lambda key: None  # noqa: E731  install_patches() 가 교체


def install_patches(on_call=None):
    global _on_call
    if on_call is not None:
        _on_call = on_call
    api.call_json = _patched_call_json
    api.call_zip = _patched_call_zip


def _is_transient_transport_error(exc):
    if isinstance(exc, urllib.error.HTTPError):
        return exc.code >= 500
    if isinstance(exc, urllib.error.URLError):
        return True  # 타임아웃(socket.timeout)도 URLError 계열로 온다
    if isinstance(exc, (socket.timeout, ConnectionResetError, ssl.SSLError, TimeoutError)):
        return True
    return False


def _sleep_backoff(attempt):
    base = min(2 ** attempt, 30)
    time.sleep(base + random.uniform(0, base))  # 지수 백오프 + 지터


def _run_with_retry(attempt_fn, key, max_attempts=5):
    for attempt in range(1, max_attempts + 1):
        try:
            result = attempt_fn()
            _on_call(key)
            return result
        except api.DartError as e:
            _on_call(key)  # 서버가 실제로 응답했으므로 호출 자체는 소비됐다
            if str(e.status) == QUOTA_EXCEEDED_STATUS:
                raise QuotaExhausted(key) from e
            if str(e.status) in _TRANSIENT_DART_STATUSES and attempt < max_attempts:
                _sleep_backoff(attempt)
                continue
            raise
        except Exception as e:
            if _is_transient_transport_error(e) and attempt < max_attempts:
                _sleep_backoff(attempt)
                continue
            raise


def _patched_call_json(key, path, raw=False, **params):
    return _run_with_retry(lambda: _orig_call_json(key, path, raw=raw, **params), key)


def _patched_call_zip(key, path, **params):
    return _run_with_retry(lambda: _orig_call_zip(key, path, **params), key)


# ─────────────────────────────────────────────── 키 풀 (로테이션 + 일일 쿼터)

class KeyPool:
    def __init__(self, keys, budget, quota_date):
        self.keys = keys
        self.budget = budget
        self.date = quota_date
        self.used = {}
        self.exhausted = {}
        self._load()
        self._i = 0

    def _load(self):
        rows = rest("GET", "ingest_api_quota?quota_date=eq.%s&select=key_id,calls_used,exhausted" % self.date)
        by_id = {r["key_id"]: r for r in rows}
        for k in self.keys:
            r = by_id.get(key_id(k), {})
            self.used[k] = r.get("calls_used", 0)
            self.exhausted[k] = bool(r.get("exhausted", False)) or self.used[k] >= self.budget

    def next_key(self):
        n = len(self.keys)
        for _ in range(n):
            k = self.keys[self._i % n]
            self._i += 1
            if not self.exhausted[k]:
                return k
        return None

    def all_exhausted(self):
        return all(self.exhausted[k] for k in self.keys)

    def record_call(self, key, n=1):
        self.used[key] = self.used.get(key, 0) + n
        if self.used[key] >= self.budget:
            self.exhausted[key] = True

    def mark_exhausted(self, key):
        self.exhausted[key] = True

    def flush(self, key=None):
        targets = [key] if key else self.keys
        for k in targets:
            rest("POST", "ingest_api_quota?on_conflict=key_id,quota_date", [{
                "key_id": key_id(k), "quota_date": self.date,
                "calls_used": self.used.get(k, 0), "exhausted": self.exhausted.get(k, False),
                "updated_at": now_iso(),
            }], prefer="resolution=merge-duplicates,return=minimal")


# ─────────────────────────────────────────────── 정상 중단 (Ctrl-C / SIGTERM)

class _Terminated(BaseException):
    pass


def _sigterm_handler(signum, frame):
    raise _Terminated()


def _install_signal_handlers():
    signal.signal(signal.SIGTERM, _sigterm_handler)
    # SIGINT(Ctrl-C)는 파이썬 기본 동작(KeyboardInterrupt)을 그대로 쓴다.


_CURRENT_JOB = {"corp_code": None, "stage": None}


# ─────────────────────────────────────────────── 체크포인트 갱신

def mark_running(corp_code, stage):
    rest("PATCH", "ingest_progress?%s" % _progress_filter(corp_code, stage),
         {"status": "running", "started_at": now_iso(), "updated_at": now_iso()},
         prefer="return=minimal")


def mark_done(corp_code, stage):
    rest("PATCH", "ingest_progress?%s" % _progress_filter(corp_code, stage),
         {"status": "done", "completed_at": now_iso(), "last_error": None, "updated_at": now_iso()},
         prefer="return=minimal")


def mark_pending(corp_code, stage):
    """진행 중이던 작업을 대기로 되돌린다 — 쿼터 소진 재대기열, 중단 시 복구 둘 다 여기로.
    attempts 는 건드리지 않는다(이 회사 데이터의 실패가 아니므로 소모 취급 안 함)."""
    rest("PATCH", "ingest_progress?%s" % _progress_filter(corp_code, stage),
         {"status": "pending", "started_at": None, "updated_at": now_iso()},
         prefer="return=minimal")


def mark_failed(corp_code, stage, err, old_attempts):
    rest("PATCH", "ingest_progress?%s" % _progress_filter(corp_code, stage),
         {"status": "failed", "attempts": old_attempts + 1, "last_error": (err or "")[:2000],
          "started_at": None, "updated_at": now_iso()},
         prefer="return=minimal")


def mark_skipped(corp_code, stage, reason):
    """게이트가 판단해서 아예 시도하지 않은 (회사,단계). done(끝남)도 failed(실패함)도 아닌
    세 번째 종결 상태 — attempts/calls_spent 는 그대로 둔다(이 회사 데이터의 실패가 아니므로).
    last_error 자리를 재사용해 게이트 사유(corp_cls 값)를 남겨 status 가 정직하게 보고하고,
    나중에 판단을 뒤집을 근거를 남긴다."""
    rest("PATCH", "ingest_progress?%s" % _progress_filter(corp_code, stage),
         {"status": "skipped", "last_error": (reason or "")[:2000], "completed_at": now_iso(),
          "started_at": None, "updated_at": now_iso()},
         prefer="return=minimal")


def record_listing_status(corp_code, corp_cls):
    """company 단계가 방금 관측한 raw corp_cls 를 ingest_corps 에 적어둔다 — 이후 이 회사의
    filings/fin/phase2·3 게이트 판단이 이 값을 본다. corp_cls 가 None(company API 실패 등)이면
    NULL 로 남겨 "모름"을 보존한다(게이트 미적용 상태 유지)."""
    rest("PATCH", "ingest_corps?corp_code=eq.%s" % urllib.parse.quote(corp_code),
         {"corp_cls": corp_cls}, prefer="return=minimal")


def reclaim_stale_running():
    """크래시(kill -9 등, 신호를 못 받는 경우)로 running 에 멈춘 행을 나이 기준으로 회수한다.
    정상 종료 경로(Ctrl-C/SIGTERM)는 이미 mark_pending 으로 즉시 되돌리므로, 이건 그 백스톱."""
    cutoff = (dt.datetime.now(dt.timezone.utc) -
              dt.timedelta(minutes=RUNNING_STALE_MINUTES)).isoformat()
    stale = rest_get_all("ingest_progress?status=eq.running&started_at=lt.%s"
                          "&select=corp_code,stage&order=corp_code,stage" % urllib.parse.quote(cutoff))
    for r in stale:
        mark_pending(r["corp_code"], r["stage"])
    if stale:
        print("회수(reclaim): %d분 넘게 running 이던 작업 %d건 → pending" %
              (RUNNING_STALE_MINUTES, len(stale)))
    return len(stale)


# ─────────────────────────────────────────────── seed

def cmd_seed(args):
    keys = resolve_keys()
    if not keys:
        print("DART_API_KEY(S) 없음 — .env.local 또는 환경변수 확인", file=sys.stderr)
        sys.exit(2)
    install_patches()
    root = api.load_corpcodes(keys[0])  # 30일 캐시 — 캐시 히트면 API 호출 0건
    rows = []
    for el in root.iter("list"):
        stock = (el.findtext("stock_code") or "").strip()
        if not stock:
            continue
        rows.append({
            "corp_code": el.findtext("corp_code"),
            "corp_name": (el.findtext("corp_name") or "").strip(),
            "stock_code": stock,
        })
    print("corpCode.xml 파싱 완료 — 상장사(종목코드 보유) 총 %d개" % len(rows))

    ingest.upsert("ingest_corps", rows, on_conflict="corp_code")  # 사명/종목코드 변경 반영

    prog_rows = [{"corp_code": r["corp_code"], "stage": s} for r in rows for s in ingest.STAGES]
    insert_ignore("ingest_progress", prog_rows, on_conflict="corp_code,stage")

    print("큐 등록: 회사 %d개 × 단계 %d개 = 체크포인트 최대 %d행 (기존 진행 상태는 보존, "
          "신규 (회사,단계) 조합만 pending 으로 삽입)" %
          (len(rows), len(ingest.STAGES), len(rows) * len(ingest.STAGES)))


# ─────────────────────────────────────────────── run

def resolve_corp_codes_from_stock(stock_codes):
    q = "ingest_corps?stock_code=in.(%s)&select=corp_code,stock_code" % ",".join(
        urllib.parse.quote(s) for s in stock_codes)
    rows = rest("GET", q)
    found = {r["stock_code"]: r["corp_code"] for r in rows}
    missing = [s for s in stock_codes if s not in found]
    if missing:
        print("경고: 큐(ingest_corps)에 없는 종목코드 무시됨: %s" % ",".join(missing), file=sys.stderr)
    return list(found.values())


def discover_jobs(stages, company_filter, limit, include_skipped=False):
    """대기 중인 (corp_code, stage) 작업을 찾는다. 회사 내부에서는 ingest.STAGES 의 정본
    순서(company→filings→fin→…)를 지킨다 — company 가 companies 테이블에 먼저 있어야
    filings/financial_facts 의 FK(corp_code references companies)가 통과한다.

    include_skipped: True 면 이전에 게이트로 skipped 처리된 행도 다시 대상에 넣는다 —
    --include-delisted 로 게이트를 끄고 돌릴 때 "미래에 한 술어만 바꿔서 un-skip" 하는
    지점이 바로 여기다(상태 목록에 'skipped' 를 넣느냐 마느냐)."""
    corp_filter = None
    if company_filter:
        corp_filter = resolve_corp_codes_from_stock(company_filter)
        if not corp_filter:
            return []

    statuses = "pending,failed,skipped" if include_skipped else "pending,failed"
    q = ("ingest_progress?stage=in.(%s)&status=in.(%s)&attempts=lt.%d"
         "&select=corp_code,stage,attempts&order=corp_code,stage" %
         (",".join(stages), statuses, MAX_JOB_ATTEMPTS))
    if corp_filter is not None:
        q += "&corp_code=in.(%s)" % ",".join(corp_filter)
    rows = rest_get_all(q)

    by_corp, order = {}, []
    for r in rows:
        c = r["corp_code"]
        if c not in by_corp:
            by_corp[c] = {}
            order.append(c)
        by_corp[c][r["stage"]] = r["attempts"]

    jobs = []
    for c in order:
        for s in ingest.STAGES:
            if s in by_corp[c]:
                jobs.append({"corp_code": c, "stage": s, "attempts": by_corp[c][s]})
                if limit and len(jobs) >= limit:
                    return jobs
    return jobs


def fetch_corp_info(corp_codes):
    out, chunk_size = {}, 200  # in.() URL 길이 한계 방지
    for i in range(0, len(corp_codes), chunk_size):
        chunk = corp_codes[i:i + chunk_size]
        q = ("ingest_corps?corp_code=in.(%s)&select=corp_code,corp_name,stock_code,corp_cls"
             "&order=corp_code" % ",".join(chunk))
        for r in rest_get_all(q):
            out[r["corp_code"]] = r
    return out


STAGE_FN = {
    "company":   lambda key, corp, since: ingest.load_company(key, corp),
    "filings":   lambda key, corp, since: ingest.load_filings(key, corp, since),
    "fin":       lambda key, corp, since: ingest.load_financials(key, corp, since),
    "items":     lambda key, corp, since: ingest.load_report_items(key, corp, since),
    "events":    lambda key, corp, since: ingest.load_events(key, corp, since),
    "regs":      lambda key, corp, since: ingest.load_registrations(key, corp, since),
    "ownership": lambda key, corp, since: ingest.load_ownership(key, corp),
    "docs":      lambda key, corp, since: ingest.load_docs(key, corp),
}


def cmd_run(args):
    global MAX_JOB_ATTEMPTS
    MAX_JOB_ATTEMPTS = args.max_attempts
    stages = PHASES[args.phase]
    company_filter = [c.strip() for c in args.companies.split(",")] if args.companies else None

    if not args.dry_run:
        reclaim_stale_running()

    # include_delisted 면 이전에 게이트로 skipped 된 행도 다시 후보에 넣는다 — "한 술어만
    # 바꿔서 un-skip" 이 여기서 일어난다.
    jobs = discover_jobs(stages, company_filter, args.limit, include_skipped=args.include_delisted)
    if not jobs:
        print("대기 중인 작업 없음 (phase %d, 단계 %s) — seed 를 먼저 돌렸는지, 이미 다 끝났는지 확인"
              % (args.phase, ",".join(stages)))
        return

    # corp_cls 는 dry-run 미리보기와 실제 게이트 판단 둘 다에 필요하므로 여기서 한 번만 가져온다.
    corp_codes = sorted({j["corp_code"] for j in jobs})
    corps = fetch_corp_info(corp_codes)

    def _gated(j):
        return (j["stage"] != "company" and not args.include_delisted and
                is_delisted_cls(corps.get(j["corp_code"], {}).get("corp_cls")))

    if args.dry_run:
        by_stage, gated_by_stage = {}, {}
        for j in jobs:
            bucket = gated_by_stage if _gated(j) else by_stage
            bucket[j["stage"]] = bucket.get(j["stage"], 0) + 1
        print("=== DRY RUN — phase %d (%s) === 실제 API 호출 0건" % (args.phase, ",".join(stages)))
        total, total_gated = 0, 0
        for s in stages:
            n = by_stage.get(s, 0)
            gated = gated_by_stage.get(s, 0)
            total_gated += gated
            note = ("  (게이트 제외 %d건, corp_cls Y/K/N 아님)" % gated) if gated else ""
            per = estimate_stage_calls(s, args.since)
            if per is None:
                print("  %-10s 작업 %5d건 × 회사당 가변(공시 건수만큼, docs 단계) = 미정%s" % (s, n, note))
            else:
                sub = n * per
                total += sub
                print("  %-10s 작업 %5d건 × 회사당 약 %4d콜 = %8d콜%s" % (s, n, per, sub, note))
        companies_touched = len({j["corp_code"] for j in jobs})
        print("총 작업(회사×단계): %d건 · 게이트 제외: %d건(0콜) · 대상 회사: %d개" %
              (len(jobs) - total_gated, total_gated, companies_touched))
        print("예상 API 호출수(대략, docs·게이트 제외 회사 제외): %d" % total)
        return

    keys = resolve_keys()
    if not keys:
        print("DART_API_KEY(S) 없음 — .env.local 또는 DART_API_KEYS/DART_API_KEY 확인", file=sys.stderr)
        sys.exit(2)
    today = dt.date.today().isoformat()
    pool = KeyPool(keys, args.budget, today)
    install_patches(on_call=pool.record_call)

    _install_signal_handlers()
    done_n = fail_n = quota_n = skip_n = 0
    try:
        for j in jobs:
            corp_code, stage = j["corp_code"], j["stage"]
            corp = corps.get(corp_code)
            if not corp:
                mark_failed(corp_code, stage, "ingest_corps 에 없는 corp_code", j["attempts"])
                fail_n += 1
                continue

            # 상장상태 게이트: API 콜을 전혀 쓰지 않으므로 쿼터 소진 여부와 무관하게 먼저 처리한다.
            if _gated(j):
                mark_skipped(corp_code, stage, "게이트: corp_cls=%s (Y/K/N 아님 — 상장폐지·비상장 "
                             "추정, --include-delisted 로 재검토 가능)" % corp.get("corp_cls"))
                skip_n += 1
                print("  [게이트skip] %s/%s(%s) — corp_cls=%s" %
                      (corp.get("corp_name", corp_code), stage, corp_code, corp.get("corp_cls")))
                continue

            if pool.all_exhausted():
                print("모든 키가 오늘 한도를 소진했다 — 정상 종료(체크포인트는 그대로이니 내일/키 추가 "
                      "후 이어서 실행 가능)")
                break
            key = pool.next_key()

            # 주의: 여기서 finally 로 _CURRENT_JOB 을 지우면 안 된다 — KeyboardInterrupt/
            # _Terminated 는 BaseException 이라 아래 `except Exception`엔 안 잡히고 그대로
            # 위로 전파되는데, finally 는 그 전파 도중에도 실행되므로 바깥쪽
            # `except (KeyboardInterrupt, _Terminated)` 가 _CURRENT_JOB 을 보기 전에
            # 이미 None 으로 지워져 mark_pending 이 스킵되는 버그가 났었다(실측 재현:
            # SIGINT 로 중단했더니 해당 (회사,단계)가 running 에 그대로 멈춤). 그래서
            # 정상 종료 경로(성공/QuotaExhausted/Exception) 각각에서만 명시적으로 지운다 —
            # 중단으로 여기를 못 지나가면 바깥 핸들러가 여전히 채워진 _CURRENT_JOB 을 보고
            # 되돌릴 수 있다.
            _CURRENT_JOB["corp_code"], _CURRENT_JOB["stage"] = corp_code, stage
            mark_running(corp_code, stage)
            try:
                result = STAGE_FN[stage](key, corp, args.since)
                mark_done(corp_code, stage)
                if stage == "company":
                    # 방금 관측한 corp_cls 를 큐에 적어둔다 — 같은 실행 안에서 뒤따르는
                    # filings/fin 작업(jobs 리스트 순서상 이후에 옴, discover_jobs 가
                    # company→filings→fin 순으로 정렬)이 이 in-memory 갱신을 그대로 보고
                    # 즉시 게이트를 적용한다(재조회 없이).
                    corp_cls = (result or {}).get("corp_cls")
                    record_listing_status(corp_code, corp_cls)
                    corp["corp_cls"] = corp_cls
                done_n += 1
            except QuotaExhausted as e:
                pool.mark_exhausted(e.key)
                pool.flush(e.key)
                mark_pending(corp_code, stage)
                quota_n += 1
                print("  [키소진] %s/%s(%s) — 재대기열 반영, 다음 키로 회전" %
                      (corp.get("corp_name", corp_code), stage, corp_code))
                _CURRENT_JOB["corp_code"], _CURRENT_JOB["stage"] = None, None
                continue
            except Exception as e:
                mark_failed(corp_code, stage, str(e), j["attempts"])
                fail_n += 1
                print("  [실패] %s/%s(%s) — %s" %
                      (corp.get("corp_name", corp_code), stage, corp_code, str(e)[:200]))
            _CURRENT_JOB["corp_code"], _CURRENT_JOB["stage"] = None, None
            pool.flush(key)
    except (KeyboardInterrupt, _Terminated):
        if _CURRENT_JOB["corp_code"]:
            mark_pending(_CURRENT_JOB["corp_code"], _CURRENT_JOB["stage"])
        pool.flush()
        print("\n중단 신호 수신 — 진행 중이던 작업은 pending 으로 복귀, 체크포인트 정상, 이어서 실행 가능")
        sys.exit(130)

    print("완료: done=%d failed=%d 키소진재대기=%d 게이트skip=%d" % (done_n, fail_n, quota_n, skip_n))


# ─────────────────────────────────────────────── status

def _avg_filings_per_company():
    done_corps = rest_get_all("ingest_progress?stage=eq.filings&status=eq.done"
                               "&select=corp_code&order=corp_code")
    n = len(done_corps)
    if not n:
        return None
    filings_rows = rest_get_all("filings?select=corp_code&order=corp_code")
    return len(filings_rows) / n


def cmd_status(args):
    budget = args.budget
    today = dt.date.today().isoformat()
    keys = resolve_keys()

    corp_rows = rest_get_all("ingest_corps?select=corp_code&order=corp_code")
    universe_n = len(corp_rows)
    print("=== 큐 (ingest_corps): %d개 회사 ===" % universe_n)
    if universe_n == 0:
        print("(비어 있음 — 먼저 `backfill.py seed` 실행)")
        return

    # 상장상태 게이트가 뭘 근거로 판단하는지 — company 단계가 관측한 corp_cls 의 생사 split.
    cls_rows = rest_get_all("ingest_corps?select=corp_cls&order=corp_code")
    live_n = sum(1 for r in cls_rows if r.get("corp_cls") in LIVE_CORP_CLASSES)
    dead_n = sum(1 for r in cls_rows if is_delisted_cls(r.get("corp_cls")))
    unknown_n = universe_n - live_n - dead_n
    print("=== 상장상태(ingest_corps.corp_cls, company 단계 관측치) ===")
    print("  live(Y/K/N)=%-6d dead(그 외, 예 E)=%-6d unknown(company 미실행)=%-6d" %
          (live_n, dead_n, unknown_n))

    prog_rows = rest_get_all("ingest_progress?select=stage,status&order=corp_code,stage")
    counts = {}
    for r in prog_rows:
        counts.setdefault(r["stage"], {}).setdefault(r["status"], 0)
        counts[r["stage"]][r["status"]] += 1

    remaining_calls = 0
    total_skipped = 0
    for phase, stages in PHASES.items():
        print("\n[phase %d] %s" % (phase, ",".join(stages)))
        for s in stages:
            c = counts.get(s, {})
            pending, running = c.get("pending", 0), c.get("running", 0)
            done, failed = c.get("done", 0), c.get("failed", 0)
            skipped = c.get("skipped", 0)
            total_skipped += skipped
            print("  %-10s pending=%-6d running=%-6d done=%-6d failed=%-6d skipped=%-6d" %
                  (s, pending, running, done, failed, skipped))
            per = estimate_stage_calls(s, ingest.HISTORY_START)
            if per is not None:
                # skipped 는 게이트가 이미 "안 돈다"고 확정한 것 — 잔여 콜 추정에서 제외한다
                # (이게 이 게이트가 절약하는 콜 수를 status 가 정직하게 반영하는 지점).
                remaining_calls += (pending + running + failed) * per

    if total_skipped:
        print("\n  게이트로 skipped 된 (회사,단계) 총 %d건 — 상장상태 dead 로 판정돼 API 콜 소비 "
              "없이 건너뜀(--include-delisted 로 재검토 가능)" % total_skipped)

    docs_c = counts.get("docs", {})
    docs_left = docs_c.get("pending", 0) + docs_c.get("running", 0) + docs_c.get("failed", 0)
    avg_filings = _avg_filings_per_company()
    if docs_left and avg_filings:
        remaining_calls += round(docs_left * avg_filings)
        print("\n  (docs 단계는 회사당 관측 평균 공시 %.0f건으로 근사해 ETA 에 포함)" % avg_filings)
    elif docs_left:
        print("\n  (docs 단계 %d건 대기 중이지만 아직 filings 완료 회사가 없어 평균을 못 냄 — "
              "ETA 에서 제외)" % docs_left)

    quota_rows = rest("GET", "ingest_api_quota?quota_date=eq.%s&select=key_id,calls_used,exhausted"
                       % today)
    by_id = {r["key_id"]: r for r in quota_rows}
    print("\n=== 오늘(%s) 키별 사용량 (예산 %d/키) ===" % (today, budget))
    if not keys:
        print("  DART_API_KEY(S) 미설정")
    remaining_quota = 0
    for k in keys:
        kid = key_id(k)
        r = by_id.get(kid, {})
        used, exhausted = r.get("calls_used", 0), bool(r.get("exhausted", False))
        print("  key_id=%s  used=%d/%d  exhausted=%s" % (kid, used, budget, exhausted))
        if not exhausted:
            remaining_quota += max(0, budget - used)

    print("\n=== ETA ===")
    print("  잔여 예상 호출수(대략): %d" % remaining_calls)
    print("  오늘 잔여 가용 한도(전 키 합): %d" % remaining_quota)
    if remaining_quota > 0:
        days = -(-remaining_calls // remaining_quota) if remaining_calls else 0
        print("  단순 추정: 매일 이만큼 꾸준히 돌린다면 약 %d '일치' 분량 남음"
              " (재시작 빈도·실제 페이지네이션 편차로 오차 있음)" % days)
    else:
        print("  오늘 가용 한도 없음(키 미설정 또는 전량 소진)")


# ─────────────────────────────────────────────── CLI

def main():
    p = argparse.ArgumentParser(description="OpenDART 전 상장사 배치 백필 오케스트레이터 (P-B 2단계)")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("seed", help="corpCode.xml 에서 상장사 전체를 큐(ingest_corps)에 등록")

    r = sub.add_parser("run", help="대기 중인 (회사,단계) 작업을 처리")
    r.add_argument("--phase", type=int, choices=[1, 2, 3], required=True)
    r.add_argument("--limit", type=int, default=None, help="이번 실행에서 처리할 최대 (회사,단계) 작업 수")
    r.add_argument("--dry-run", action="store_true", help="API 호출 없이 계획·예상 호출수만 출력")
    r.add_argument("--companies", help="쉼표 구분 종목코드(6자리) — 지정 시 이 회사들만 처리")
    r.add_argument("--since", type=int, default=ingest.HISTORY_START)
    r.add_argument("--budget", type=int, default=DEFAULT_DAILY_BUDGET, help="키당 일일 호출 예산")
    r.add_argument("--max-attempts", type=int, default=MAX_JOB_ATTEMPTS,
                    help="이 횟수 이상 실패한 (회사,단계)는 자동 재시도 대상에서 제외")
    r.add_argument("--include-delisted", action="store_true",
                    help="상장상태 게이트를 끄고 corp_cls 가 Y/K/N 이 아닌(상장폐지·비상장 추정) "
                         "회사도 처리 — 이전에 skipped 된 (회사,단계)도 다시 후보에 넣는다. "
                         "기본은 게이트 켜짐(스킵)")

    st = sub.add_parser("status", help="진행 현황·오늘 키 사용량·ETA 요약")
    st.add_argument("--budget", type=int, default=DEFAULT_DAILY_BUDGET)

    args = p.parse_args()
    {"seed": cmd_seed, "run": cmd_run, "status": cmd_status}[args.cmd](args)


if __name__ == "__main__":
    main()
