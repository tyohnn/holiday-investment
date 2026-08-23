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

전제: DART_API_KEY(단일) 또는 DART_API_KEYS(쉼표 구분, 로테이션용)가 설정돼 있다 —
SUPABASE_REST_URL/SUPABASE_SERVICE_KEY 와 마찬가지로 프로세스 환경 > 레포 루트
.env.local 순으로 찾는다(resolve_keys() 참고).
대상 DB 는 SUPABASE_REST_URL/SUPABASE_SERVICE_KEY 로 정해지고(환경변수 > 레포 루트
.env.local > 로컬 기본값), 세 명령 모두 시작하자마자 해석된 대상 호스트를 찍는다 —
로컬 스택을 쓸 거면 그 전에 supabase start 가 떠 있어야 한다.
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


# ─────────────────────────────────────────────── 시장 게이트
#
# 상장상태 게이트가 "죽었냐"를 가른다면 이건 살아 있는 것들 중 "어느 시장이냐"를 고른다. 둘은
# 직교하고 순서대로 겹쳐 적용된다 — 시장 게이트를 켜도 상장폐지 판정은 그대로 살아 있다.
#
# 이런 걸 왜 두느냐: 시장별로 데이터 수확량이 극단적으로 다르다. Phase 1 실측에서 생존 2,756개
# 중 financial_facts 가 0행인 회사가 97개였는데, 그중 88개가 코넥스였다(코넥스 108개의 81.5%.
# 코스피 833개 중 3개, 코스닥 1,815개 중 6개와 비교하면 자릿수가 다르다). 회사당 콜이 비싼
# 단계(phase 2 ≈ 401콜)에서 이런 시장을 통째로 뺄 수 있어야 예산을 어디에 쓸지 고를 수 있다.
#
# 다만 기본값은 전 시장(Y,K,N)이다 — 게이트는 "쓸 수 있게 만들어 둔 손잡이"이지 기본 정책이
# 아니다. 어느 시장을 뺄지는 측정으로 정하는 것이고(단계마다 답이 다를 수 있다 — fin 이 비었다고
# items/events 도 비라는 법은 없다), 기본값을 좁혀두면 그 측정을 안 한 채 굳어버린다.
MARKET_NAMES = {"Y": "코스피", "K": "코스닥", "N": "코넥스"}
ALL_MARKETS = frozenset(LIVE_CORP_CLASSES)

# 게이트 종류 — mark_skipped 사유 문자열의 접두사로 그대로 쓰인다. status 는 이 접두사만 보고
# "어느 필터가 뺐는지"를 되읽는다(사유가 곧 기록이고, 기록이 곧 되돌릴 근거다).
GATE_DELISTED = "상장상태"
GATE_MARKET = "시장"
GATE_PREFIX = "게이트(%s): "


def parse_markets(spec):
    """--markets 값(쉼표 구분 corp_cls)을 집합으로. 오타를 조용히 넘기면 "아무것도 안 도는"
    실행이 되므로(예: 소문자 'y' → 전부 게이트) 알 수 없는 값은 즉시 에러로 끊는다."""
    if spec is None:
        return ALL_MARKETS
    vals = {v.strip().upper() for v in spec.split(",") if v.strip()}
    unknown = vals - ALL_MARKETS
    if unknown:
        raise SystemExit("--markets 값이 잘못됨: %s — 가능한 값은 %s (%s)" %
                         (",".join(sorted(unknown)), ",".join(sorted(ALL_MARKETS)),
                          " ".join("%s=%s" % (k, MARKET_NAMES[k]) for k in sorted(ALL_MARKETS))))
    if not vals:
        raise SystemExit("--markets 가 비었다 — 최소 한 시장은 지정해야 한다")
    return frozenset(vals)


def describe_markets(markets):
    return ",".join("%s(%s)" % (m, MARKET_NAMES[m]) for m in sorted(markets))


def is_market_excluded(corp_cls, markets):
    """살아 있는데 이번 실행이 고른 시장이 아닌 경우. is_delisted_cls 와 같은 규율로 None(모름)은
    절대 True 가 아니고, 애초에 Y/K/N 이 아닌 값은 여기 관할이 아니다(상장상태 게이트 몫)."""
    return corp_cls in LIVE_CORP_CLASSES and corp_cls not in markets


def gate_reason(stage, corp_cls, markets, include_delisted):
    """이 (단계, corp_cls)를 어떤 게이트가 막는지 — 막지 않으면 None.

    company 단계는 어떤 게이트도 적용받지 않는다: corp_cls 를 관측하는 게 바로 그 단계라서,
    게이트를 걸면 자기가 판단 근거를 만드는 걸 자기가 막는 순환이 된다.

    상장상태를 시장보다 먼저 본다 — 상장폐지 회사에 "코넥스라서 뺐다"고 적으면 사유가 거짓이 된다."""
    if stage == "company":
        return None
    if not include_delisted and is_delisted_cls(corp_cls):
        return (GATE_PREFIX % GATE_DELISTED) + (
            "corp_cls=%s (Y/K/N 아님 — 상장폐지·비상장 추정, --include-delisted 로 재검토 가능)"
            % corp_cls)
    if is_market_excluded(corp_cls, markets):
        return (GATE_PREFIX % GATE_MARKET) + (
            "corp_cls=%s(%s) — 이번 실행 대상 시장 %s 에 없음(--markets 를 넓혀 재검토 가능)"
            % (corp_cls, MARKET_NAMES.get(corp_cls, "?"), ",".join(sorted(markets))))
    return None


def gate_kind(reason):
    """mark_skipped 로 저장된 사유 문자열에서 게이트 종류를 되읽는다 — status 가 skipped 를
    필터별로 쪼개 보고하기 위한 역함수. 접두사 규약을 벗어난 옛 행은 None(=미분류)."""
    for kind in (GATE_DELISTED, GATE_MARKET):
        if (reason or "").startswith(GATE_PREFIX % kind):
            return kind
    return None


# ─────────────────────────────────────────────── 작은 유틸

def now_iso():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def key_id(key):
    """원본 키를 저장하지 않기 위한 지문. 12자리 sha256 프리픽스면 키 몇 개를 구분하는
    데 충분하고, DB 를 봐도 키를 복원할 수 없다."""
    return hashlib.sha256(key.encode()).hexdigest()[:12]


def resolve_keys():
    """DART_API_KEYS(쉼표 구분) 우선, 없으면 단일 DART_API_KEY 로 폴백 — 우선순위는 ingest.py 의
    env_setting() 과 동일하게 프로세스 환경 > 레포 루트 .env.local 이고, 두 이름 모두에 대해
    이 순서를 지킨다: 프로세스 환경 DART_API_KEYS > .env.local DART_API_KEYS > 프로세스 환경
    DART_API_KEY > .env.local DART_API_KEY > dart_api.resolve_key() (CWD 기준 .env/.env.local,
    전역 설정까지 보는 최후 수단 — 기존 동작 보존용)."""
    raw = ingest.env_setting("DART_API_KEYS", "")
    keys = [k.strip() for k in raw.split(",") if k.strip()]
    if keys:
        return keys
    single = ingest.env_setting("DART_API_KEY", None) or api.resolve_key()
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

    def _roll_to_today(self):
        """self.date 는 프로세스 시작 시각에 고정된다 — 실행이 자정을 넘기면 그 뒤로도
        어제 날짜의 quota row 에 계속 쓰고 읽는다. 그러면 (a) 오늘자 사용량이 원장에
        전혀 안 남고 (b) 어제 exhausted=True 로 잡힌 키가 오늘도 영원히 소진 상태로
        남는다(리로드가 없으므로). next_key()/all_exhausted() 진입 시마다 실제 날짜와
        비교해, 바뀌었으면 오늘 날짜의 quota row 를 다시 읽어(대개 비어 있으므로 예산이
        자연히 리셋된다) used/exhausted 를 갈아 끼운다. 실측(2026-08-06→07): 이 리로드가
        없어 19시간 넘게 돈 프로세스의 사용량 전량이 어제 날짜 행에 쌓였다."""
        today = dt.date.today().isoformat()
        if today != self.date:
            self.date = today
            self.used = {}
            self.exhausted = {}
            self._load()

    def next_key(self):
        self._roll_to_today()
        n = len(self.keys)
        for _ in range(n):
            k = self.keys[self._i % n]
            self._i += 1
            if not self.exhausted[k]:
                return k
        return None

    def all_exhausted(self):
        self._roll_to_today()
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


_CURRENT_JOB = {"corp_code": None, "stage": None, "calls_before": None}


# ─────────────────────────────────────────────── 체크포인트 갱신

def mark_running(corp_code, stage):
    rest("PATCH", "ingest_progress?%s" % _progress_filter(corp_code, stage),
         {"status": "running", "started_at": now_iso(), "updated_at": now_iso()},
         prefer="return=minimal")


def mark_done(corp_code, stage, calls_spent):
    """calls_spent 는 "이번 시도" 소비량이다(누적 아님, "직전 시도" 의미론 — 근거는
    20260803000003 마이그레이션 및 이 값을 계산하는 cmd_run 쪽 주석 참고). 재시도로 부풀려진
    합계가 아니라 "이 단계가 한 번 성공하는 데 드는 비용"을 그대로 반영해야 회사별 분포
    (min/median/max) 측정에 쓸 수 있다."""
    rest("PATCH", "ingest_progress?%s" % _progress_filter(corp_code, stage),
         {"status": "done", "completed_at": now_iso(), "last_error": None,
          "calls_spent": calls_spent, "updated_at": now_iso()},
         prefer="return=minimal")


def mark_pending(corp_code, stage, calls_spent=None):
    """진행 중이던 작업을 대기로 되돌린다 — 쿼터 소진 재대기열, 중단 시 복구 둘 다 여기로.
    attempts 는 건드리지 않는다(이 회사 데이터의 실패가 아니므로 소모 취급 안 함).
    calls_spent: 이번(중단된) 시도가 실제로 쓴 호출수를 아는 호출자만 넘긴다(cmd_run 안,
    스냅샷/델타 계산 가능한 경로). None 이면 필드 자체를 PATCH 에서 뺀다 — 크래시 회수
    (reclaim_stale_running) 처럼 이번 시도의 소비량을 모르는 경로가 기존 값을 0 으로
    지워버리지 않게 하기 위함(직전 시도 의미론이라도 "모른다"를 "0 이다"로 덮어쓰면 안 된다)."""
    payload = {"status": "pending", "started_at": None, "updated_at": now_iso()}
    if calls_spent is not None:
        payload["calls_spent"] = calls_spent
    rest("PATCH", "ingest_progress?%s" % _progress_filter(corp_code, stage), payload,
         prefer="return=minimal")


def mark_failed(corp_code, stage, err, old_attempts, calls_spent):
    rest("PATCH", "ingest_progress?%s" % _progress_filter(corp_code, stage),
         {"status": "failed", "attempts": old_attempts + 1, "last_error": (err or "")[:2000],
          "calls_spent": calls_spent, "started_at": None, "updated_at": now_iso()},
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


def _safe_checkpoint(label, fn, *args, **kwargs):
    """체크포인트/쿼터 기록(mark_*, pool.flush)이 ingest.rest() 의 재시도까지 다 쓰고도
    실패하면, 그 예외를 cmd_run 루프 밖으로 흘려보내지 않는다.

    실제로 이랬다 — mark_failed 안에서 DNS 조회가 실패해 PATCH 자체가 못 나갔고, 재시도가
    없던 그 예외가 루프를 통째로 죽여서 몇 시간짜리 실행이 끝나버렸다(해당 작업은 DB 에
    running 으로 멈춘 채). rest() 에 재시도를 넣은 지금도 마지막 시도까지 다 실패할 여지는
    남는다(장시간 절전, DNS 설정 붕괴처럼 backoff 상한보다 오래가는 단절) — 그 경우 한 번
    더 감싸서 시도해봐야 소용없다(이미 여러 번 실패한 뒤이므로).

    그래서 여기서 예외를 삼키고 루프를 계속 돌게 한다. 대신:
      1) 조용히 넘기지 않는다 — 어떤 기록이 왜 유실됐는지 stderr 에 크게 찍는다.
      2) mark_running 이후의 실패라면 그 (회사,단계) 행은 DB 에 running 으로 남는데, 이건
         reclaim_stale_running() 이 원래 위해 있는 상황이다 — RUNNING_STALE_MINUTES 뒤
         다음 실행이 자동으로 pending 회수 → 재시도(각 단계는 스코프 교체라 재실행해도
         안전, ingest.py 모듈 docstring의 멱등성 설계 참고). 데이터가 아니라 "이번 시도의
         기록"만 유실되므로 체크포인트 자체는 (지연될지언정) 무결하다.
    반환값 False 는 호출부가 굳이 분기할 필요는 없지만(현재는 안 쓴다), 테스트에서 성공
    여부를 확인할 수 있게 남겨둔다."""
    try:
        fn(*args, **kwargs)
        return True
    except Exception as e:
        print("  [기록 실패] %s — rest() 재시도 소진 후에도 실패, running 으로 남을 수 있음"
              "(다음 실행의 reclaim_stale_running 이 %d분 후 회수): %s" %
              (label, RUNNING_STALE_MINUTES, str(e)[:300]), file=sys.stderr)
        return False


def record_listing_status(corp_code, corp_cls):
    """company 단계가 방금 관측한 raw corp_cls 를 ingest_corps 에 적어둔다 — 이후 이 회사의
    filings/fin/phase2·3 게이트 판단이 이 값을 본다. corp_cls 가 None(company API 실패 등)이면
    NULL 로 남겨 "모름"을 보존한다(게이트 미적용 상태 유지)."""
    rest("PATCH", "ingest_corps?corp_code=eq.%s" % urllib.parse.quote(corp_code),
         {"corp_cls": corp_cls}, prefer="return=minimal")


def reclaim_stale_running(corp_filter=None):
    """크래시(kill -9 등, 신호를 못 받는 경우)로 running 에 멈춘 행을 나이 기준으로 회수한다.
    정상 종료 경로(Ctrl-C/SIGTERM)는 이미 mark_pending 으로 즉시 되돌리므로, 이건 그 백스톱.

    corp_filter: --companies 로 회사를 분할해 여러 run 을 병렬로 돌릴 때, 자기 파티션
    밖의 running 을 회수하면 **다른 살아있는 프로세스의 진행 중 작업을 뺏는다**(대형사
    docs 잡은 30분을 훌쩍 넘긴다 — 삼성 실측 1시간+). 그래서 파티션이 지정된 run 은
    자기 회사들만 회수한다. 필터 없는 단독 run 은 종전대로 전역 회수(백스톱 원의미)."""
    cutoff = (dt.datetime.now(dt.timezone.utc) -
              dt.timedelta(minutes=RUNNING_STALE_MINUTES)).isoformat()
    stale = rest_get_all("ingest_progress?status=eq.running&started_at=lt.%s"
                          "&select=corp_code,stage&order=corp_code,stage" % urllib.parse.quote(cutoff))
    if corp_filter is not None:
        allowed = set(corp_filter)
        stale = [r for r in stale if r["corp_code"] in allowed]
    for r in stale:
        mark_pending(r["corp_code"], r["stage"])
    if stale:
        print("회수(reclaim): %d분 넘게 running 이던 작업 %d건 → pending%s" %
              (RUNNING_STALE_MINUTES, len(stale),
               "  (파티션 내 한정)" if corp_filter is not None else ""))
    return len(stale)


# ─────────────────────────────────────────────── seed

def cmd_seed(args):
    ingest.print_target()
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
    # in.() 을 URL 하나에 다 넣으면 대량 파티션(1,877개 ≈ 13KB)에서 URL 이 서버 한계에
    # 잘려 뒤쪽 코드가 조용히 "없음" 처리된다 — 병렬 파티션 첫 가동에서 실측된 사고.
    # fetch_corp_info 와 같은 200개 청크 규약을 쓴다.
    found = {}
    for i in range(0, len(stock_codes), 200):
        chunk = stock_codes[i:i + 200]
        q = "ingest_corps?stock_code=in.(%s)&select=corp_code,stock_code" % ",".join(
            urllib.parse.quote(s) for s in chunk)
        for r in rest("GET", q):
            found[r["stock_code"]] = r["corp_code"]
    missing = [s for s in stock_codes if s not in found]
    if missing:
        print("경고: 큐(ingest_corps)에 없는 종목코드 무시됨: %s" % ",".join(missing), file=sys.stderr)
    return list(found.values())


def discover_jobs(stages, company_filter):
    """대기 중인 (corp_code, stage) 작업을 찾는다. 회사 내부에서는 ingest.STAGES 의 정본
    순서(company→filings→fin→…)를 지킨다 — company 가 companies 테이블에 먼저 있어야
    filings/financial_facts 의 FK(corp_code references companies)가 통과한다.

    이전에 게이트로 skipped 된 행도 항상 후보에 넣고 status 를 같이 실어 보낸다. 그 행을 실제로
    다시 돌릴지는 호출부가 지금 설정으로 다시 게이트를 물려보고 정한다 — 여전히 막히면 조용히
    빠지고, 안 막히면(--include-delisted 를 켰거나 --markets 를 넓혔거나) 그대로 돈다. 게이트
    종류가 둘로 늘면서 "어떤 플래그가 어떤 skipped 를 되살리는가"를 여기서 열거하는 건 유지가
    안 된다 — 되살림 조건은 게이트 술어 자신이어야 한다(gate_reason 하나만 보면 되도록)."""
    corp_filter = None
    if company_filter:
        corp_filter = resolve_corp_codes_from_stock(company_filter)
        if not corp_filter:
            return []

    q = ("ingest_progress?stage=in.(%s)&status=in.(pending,failed,skipped)&attempts=lt.%d"
         "&select=corp_code,stage,status,attempts&order=corp_code,stage" %
         (",".join(stages), MAX_JOB_ATTEMPTS))
    if corp_filter is not None:
        q += "&corp_code=in.(%s)" % ",".join(corp_filter)
    rows = rest_get_all(q)

    by_corp, order = {}, []
    for r in rows:
        c = r["corp_code"]
        if c not in by_corp:
            by_corp[c] = {}
            order.append(c)
        by_corp[c][r["stage"]] = r

    jobs = []
    for c in order:
        for s in ingest.STAGES:
            if s in by_corp[c]:
                r = by_corp[c][s]
                jobs.append({"corp_code": c, "stage": s, "attempts": r["attempts"],
                             "status": r["status"]})
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
    ingest.print_target()
    MAX_JOB_ATTEMPTS = args.max_attempts
    stages = PHASES[args.phase]
    company_filter = [c.strip() for c in args.companies.split(",")] if args.companies else None
    markets = parse_markets(args.markets)
    print("대상 시장: %s%s" % (describe_markets(markets),
                              "  (상장상태 게이트 해제됨)" if args.include_delisted else ""))

    if not args.dry_run:
        # --companies 파티션 run 은 자기 회사만 회수한다 (병렬 run 의 진행 중 작업 보호).
        reclaim_stale_running(resolve_corp_codes_from_stock(company_filter)
                              if company_filter else None)

    jobs = discover_jobs(stages, company_filter)
    if not jobs:
        print("대기 중인 작업 없음 (phase %d, 단계 %s) — seed 를 먼저 돌렸는지, 이미 다 끝났는지 확인"
              % (args.phase, ",".join(stages)))
        return

    # corp_cls 는 dry-run 미리보기와 실제 게이트 판단 둘 다에 필요하므로 여기서 한 번만 가져온다.
    corp_codes = sorted({j["corp_code"] for j in jobs})
    corps = fetch_corp_info(corp_codes)

    def _gate(j):
        return gate_reason(j["stage"], corps.get(j["corp_code"], {}).get("corp_cls"),
                           markets, args.include_delisted)

    # 이미 skipped 인데 지금 설정으로도 여전히 막히는 행은 아예 목록에서 뺀다 — 같은 판단을 다시
    # 적어봐야 PATCH 만 늘고(생존 외 1,222개 × 단계 수) 로그만 시끄럽다. 게이트를 넓혀서
    # 되살아난 것과 애초에 대기 중이던 것만 남는다.
    jobs = [j for j in jobs if not (j["status"] == "skipped" and _gate(j))]
    if args.limit:
        jobs = jobs[:args.limit]
    revived_n = sum(1 for j in jobs if j["status"] == "skipped")
    if revived_n:
        print("게이트가 넓어져 다시 후보가 된 skipped 작업: %d건" % revived_n)
    if not jobs:
        print("대기 중인 작업 없음 — 남은 건 전부 현재 게이트(시장 %s%s)에 막힌 skipped 다"
              % (",".join(sorted(markets)), "" if args.include_delisted else " + 상장상태"))
        return

    if args.dry_run:
        by_stage, gated_by_stage = {}, {}
        for j in jobs:
            kind = gate_kind(_gate(j))
            if kind:
                gated_by_stage.setdefault(j["stage"], {}).setdefault(kind, 0)
                gated_by_stage[j["stage"]][kind] += 1
            else:
                by_stage[j["stage"]] = by_stage.get(j["stage"], 0) + 1
        print("=== DRY RUN — phase %d (%s) === 실제 API 호출 0건" % (args.phase, ",".join(stages)))
        total, total_gated = 0, 0
        for s in stages:
            n = by_stage.get(s, 0)
            g = gated_by_stage.get(s, {})
            gated = sum(g.values())
            total_gated += gated
            note = ("  (게이트 제외 %d건: %s)" %
                    (gated, ", ".join("%s %d건" % (k, v) for k, v in sorted(g.items())))) if gated else ""
            per = estimate_stage_calls(s, args.since)
            if per is None:
                print("  %-10s 작업 %5d건 × 회사당 가변(공시 건수만큼, docs 단계) = 미정%s" % (s, n, note))
            else:
                sub = n * per
                total += sub
                print("  %-10s 작업 %5d건 × 회사당 약 %4d콜 = %8d콜%s" % (s, n, per, sub, note))
        companies_touched = len({j["corp_code"] for j in jobs if not _gate(j)})
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
                # 큐에 없는 corp_code — 잡을 시작조차 못 했으므로 소비한 콜은 0 이다.
                _safe_checkpoint("mark_failed %s/%s" % (corp_code, stage),
                                 mark_failed, corp_code, stage,
                                 "ingest_corps 에 없는 corp_code", j["attempts"], 0)
                fail_n += 1
                continue

            # 게이트(상장상태·시장): API 콜을 전혀 쓰지 않으므로 쿼터 소진 여부와 무관하게 먼저 처리한다.
            reason = _gate(j)
            if reason:
                mark_skipped(corp_code, stage, reason)
                skip_n += 1
                print("  [게이트skip/%s] %s/%s(%s) — corp_cls=%s" %
                      (gate_kind(reason), corp.get("corp_name", corp_code), stage, corp_code,
                       corp.get("corp_cls")))
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
            # calls_spent 스냅샷/델타: 이 잡은 한 번에 하나만 돈다(cmd_run 루프가 순차 실행),
            # 그 사이 pool.used 총합의 증가분은 전부 이 잡이 낸 호출뿐이다 — 잡에 넘겨진
            # key 하나만 합산해도 되지만(어차피 STAGE_FN 은 그 key 로만 호출한다), 풀 전체를
            # 합산해도 결과는 같고 "이 key 만 써야 한다"는 가정에 덜 의존해 더 안전하다.
            calls_before = sum(pool.used.values())
            _CURRENT_JOB["corp_code"], _CURRENT_JOB["stage"], _CURRENT_JOB["calls_before"] = (
                corp_code, stage, calls_before)
            mark_running(corp_code, stage)
            try:
                result = STAGE_FN[stage](key, corp, args.since)
                calls_spent = sum(pool.used.values()) - calls_before
                _safe_checkpoint("mark_done %s/%s" % (corp_code, stage),
                                  mark_done, corp_code, stage, calls_spent)
                if stage == "company":
                    # 방금 관측한 corp_cls 를 큐에 적어둔다 — 같은 실행 안에서 뒤따르는
                    # filings/fin 작업(jobs 리스트 순서상 이후에 옴, discover_jobs 가
                    # company→filings→fin 순으로 정렬)이 이 in-memory 갱신을 그대로 보고
                    # 즉시 게이트를 적용한다(재조회 없이).
                    corp_cls = (result or {}).get("corp_cls")
                    _safe_checkpoint("record_listing_status %s" % corp_code,
                                      record_listing_status, corp_code, corp_cls)
                    corp["corp_cls"] = corp_cls
                done_n += 1
            except QuotaExhausted as e:
                calls_spent = sum(pool.used.values()) - calls_before
                pool.mark_exhausted(e.key)
                _safe_checkpoint("pool.flush(quota) %s" % key_id(e.key), pool.flush, e.key)
                _safe_checkpoint("mark_pending %s/%s" % (corp_code, stage),
                                  mark_pending, corp_code, stage, calls_spent)
                quota_n += 1
                print("  [키소진] %s/%s(%s) — 재대기열 반영, 다음 키로 회전" %
                      (corp.get("corp_name", corp_code), stage, corp_code))
                _CURRENT_JOB["corp_code"], _CURRENT_JOB["stage"], _CURRENT_JOB["calls_before"] = (
                    None, None, None)
                continue
            except Exception as e:
                calls_spent = sum(pool.used.values()) - calls_before
                _safe_checkpoint("mark_failed %s/%s" % (corp_code, stage),
                                  mark_failed, corp_code, stage, str(e), j["attempts"], calls_spent)
                fail_n += 1
                print("  [실패] %s/%s(%s) — %s" %
                      (corp.get("corp_name", corp_code), stage, corp_code, str(e)[:200]))
            _CURRENT_JOB["corp_code"], _CURRENT_JOB["stage"], _CURRENT_JOB["calls_before"] = (
                None, None, None)
            _safe_checkpoint("pool.flush %s" % key_id(key), pool.flush, key)
    except (KeyboardInterrupt, _Terminated):
        if _CURRENT_JOB["corp_code"]:
            calls_spent = sum(pool.used.values()) - (_CURRENT_JOB["calls_before"] or 0)
            _safe_checkpoint("mark_pending %s/%s" % (_CURRENT_JOB["corp_code"], _CURRENT_JOB["stage"]),
                              mark_pending, _CURRENT_JOB["corp_code"], _CURRENT_JOB["stage"], calls_spent)
        _safe_checkpoint("pool.flush(all)", pool.flush)
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
    ingest.print_target()
    budget = args.budget
    today = dt.date.today().isoformat()
    keys = resolve_keys()

    corp_rows = rest_get_all("ingest_corps?select=corp_code&order=corp_code")
    universe_n = len(corp_rows)
    print("=== 큐 (ingest_corps): %d개 회사 ===" % universe_n)
    if universe_n == 0:
        print("(비어 있음 — 먼저 `backfill.py seed` 실행)")
        return

    markets = parse_markets(args.markets)

    # 게이트가 뭘 근거로 판단하는지 — company 단계가 관측한 corp_cls 의 생사·시장 split.
    cls_rows = rest_get_all("ingest_corps?select=corp_code,corp_cls&order=corp_code")
    cls_by_corp = {r["corp_code"]: r.get("corp_cls") for r in cls_rows}
    live_n = sum(1 for v in cls_by_corp.values() if v in LIVE_CORP_CLASSES)
    dead_n = sum(1 for v in cls_by_corp.values() if is_delisted_cls(v))
    unknown_n = universe_n - live_n - dead_n
    print("=== 상장상태(ingest_corps.corp_cls, company 단계 관측치) ===")
    print("  live(Y/K/N)=%-6d dead(그 외, 예 E)=%-6d unknown(company 미실행)=%-6d" %
          (live_n, dead_n, unknown_n))
    by_market = {}
    for v in cls_by_corp.values():
        if v in LIVE_CORP_CLASSES:
            by_market[v] = by_market.get(v, 0) + 1
    print("  live 시장별: %s" % "  ".join(
        "%s(%s)=%d%s" % (m, MARKET_NAMES[m], by_market.get(m, 0), "" if m in markets else " [제외]")
        for m in sorted(ALL_MARKETS)))
    print("=== 이번 리포트가 가정한 시장 필터: %s (--markets 로 변경) ===" % describe_markets(markets))

    prog_rows = rest_get_all("ingest_progress?select=corp_code,stage,status&order=corp_code,stage")
    counts, out_of_market = {}, {}
    for r in prog_rows:
        counts.setdefault(r["stage"], {}).setdefault(r["status"], 0)
        counts[r["stage"]][r["status"]] += 1
        # 아직 안 끝난 작업 중 "지금 --markets 로는 안 돌 것" — ETA 에서 빼야 정직하다.
        if (r["status"] in ("pending", "running", "failed") and r["stage"] != "company"
                and is_market_excluded(cls_by_corp.get(r["corp_code"]), markets)):
            out_of_market[r["stage"]] = out_of_market.get(r["stage"], 0) + 1

    # skipped 를 어느 게이트가 만들었는지 — 사유 문자열의 접두사로 되읽는다(gate_kind).
    skipped_rows = rest_get_all("ingest_progress?status=eq.skipped&select=stage,last_error"
                                 "&order=corp_code,stage")
    skipped_by_kind = {}
    for r in skipped_rows:
        k = gate_kind(r.get("last_error")) or "미분류"
        skipped_by_kind.setdefault(r["stage"], {}).setdefault(k, 0)
        skipped_by_kind[r["stage"]][k] += 1

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
            kinds = skipped_by_kind.get(s, {})
            detail = ("  [%s]" % ", ".join("%s %d" % (k, v) for k, v in sorted(kinds.items()))) if kinds else ""
            oom = out_of_market.get(s, 0)
            oom_note = ("  (그중 %d건은 현재 --markets 대상 밖 — 아래 ETA 에서 제외)" % oom) if oom else ""
            print("  %-10s pending=%-6d running=%-6d done=%-6d failed=%-6d skipped=%-6d%s%s" %
                  (s, pending, running, done, failed, skipped, detail, oom_note))
            per = estimate_stage_calls(s, ingest.HISTORY_START)
            if per is not None:
                # skipped 는 게이트가 이미 "안 돈다"고 확정한 것 — 잔여 콜 추정에서 제외한다
                # (이게 이 게이트가 절약하는 콜 수를 status 가 정직하게 반영하는 지점).
                # 시장 필터로 빠질 것(out_of_market)도 같은 이유로 뺀다 — 아직 pending 이지만
                # 이 필터로 도는 한 절대 콜을 안 쓴다.
                remaining_calls += max(0, pending + running + failed - oom) * per

    if total_skipped:
        print("\n  게이트로 skipped 된 (회사,단계) 총 %d건 — API 콜 소비 없이 건너뜀. "
              "상장상태 게이트는 --include-delisted, 시장 게이트는 --markets 를 넓혀 재검토 가능"
              % total_skipped)

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
    r.add_argument("--markets", default=None,
                    help="처리할 시장(corp_cls) 쉼표 구분 — Y=코스피, K=코스닥, N=코넥스. "
                         "기본은 전 시장(Y,K,N)이라 지정 안 하면 동작이 바뀌지 않는다. 예: "
                         "--markets Y,K 는 코넥스를 skipped 로 남기고 건너뛴다(상장상태 게이트와 "
                         "겹쳐서 적용되며, 나중에 --markets 를 넓혀 다시 돌리면 되살아난다)")

    st = sub.add_parser("status", help="진행 현황·오늘 키 사용량·ETA 요약")
    st.add_argument("--budget", type=int, default=DEFAULT_DAILY_BUDGET)
    st.add_argument("--markets", default=None,
                    help="이 시장 필터로 돌린다고 가정하고 잔여 콜·ETA 를 계산 (기본 Y,K,N)")

    args = p.parse_args()
    {"seed": cmd_seed, "run": cmd_run, "status": cmd_status}[args.cmd](args)


if __name__ == "__main__":
    main()
