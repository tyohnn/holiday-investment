#!/usr/bin/env python3
"""financial_facts ↔ Supabase Storage 반출·복원·검증 — 운영 도구(시험이 아니라 실제 경로).

storage_trial.py(커밋 1461c2d)가 잰 숫자를 바탕으로 실제 반출/복원/검증 경로를 만든다.
그 파일은 계측 기록으로 남기고 **수정하지 않는다** — 여기서는 모듈로 import 해 재사용한다:
FACT_COLS(17개, id·natural_key 제외) · Decimal-세이프 dumps()/loads() · svc_headers() ·
_storage_base() · 객체 경로 규약(`fin/<corp_code>.json.gz`, 버킷 `platform-raw`).

restore_fin_from_raw.py 의 스코프 교체 근거(왜 upsert 가 아니라 delete→insert 인가: 매핑이
바뀌면 natural_key 가 달라져 옛 행 옆에 새 행이 쌓인다)를 그대로 따른다 — 여기서는 회사
전체가 스코프다(회사당 객체 하나이므로 replace 단위도 corp_code 전체).

★ 지문(fingerprint): 이 모듈에 정의된 corp_fingerprint() 단 하나만 존재한다. 반출 쪽
(export, DB 원본에서)과 대조 쪽(verify, DB·스테이징 양쪽에서) 모두 이 함수를 그대로
부른다 — 두 벌로 갈라지면 검증이 아무것도 증명하지 못한다는 게 이 작업의 전제다.

서브커맨드:
  export  --corps <code,...> | --all [--force]
          DB → gzip JSON 업로드 + fin_archive 매니페스트(natural_key_fingerprint 포함) 기록.
          이미 같은 행수로 반출된 회사는 건너뛴다(재개 가능성의 근거는 fin_archive) —
          --force 로 강제 재반출.
  restore --corps <code,...> [--into TABLE]
          Storage 객체를 읽어 지정 테이블에 스코프(전체 corp_code) 교체로 적재한다.
          --into 기본값은 financial_facts_restore_check(스테이징) — financial_facts 를
          기본값으로 두지 않는다(설계 제약: 실수로 원본을 덮어쓰는 게 기본 동작이면 안 됨).
  verify  --corps <code,...> [--against TABLE]
          financial_facts 와 스테이징 테이블의 (행수, natural_key 지문)을 대조하고
          fin_archive.verified_status 를 갱신한다.

전제: SUPABASE_REST_URL / SUPABASE_SERVICE_KEY (프로세스 환경 > 레포 루트 .env.local,
ingest.env_setting() 과 동일한 우선순위 — 이 스크립트가 직접 읽지 않고 ingest.py 를 그대로
쓴다). 대상 DB 는 명령 시작 전에 print_target() 이 소리내어 찍는다.
"""
import argparse
import datetime as dt
import gzip
import hashlib
import os
import sys
import time

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
import ingest                    # noqa: E402  REST/SERVICE_KEY·rest()·재시도 상수·print_target
import backfill                  # noqa: E402  rest_get_all() 오프셋 페이지네이션
import storage_trial as ST       # noqa: E402  FACT_COLS·Decimal-세이프 dumps/loads·svc_headers

BUCKET = ST.BUCKET
PREFIX = ST.PREFIX
FACT_COLS = ST.FACT_COLS
# 반출 payload 에서 natural_key 는 빠져야 하지만(설계 제약 1), 지문 계산에는 필요하다 —
# 그래서 DB 조회 시점에는 natural_key 를 같이 긁고, 업로드 직전에만 벗겨낸다(두 번 긁지
# 않는다 — 13.9M행 규모에서 왕복을 두 배로 만들 이유가 없다).
FETCH_COLS = FACT_COLS + ["natural_key"]
FETCH_SELECT = ",".join(FETCH_COLS)


# ─────────────────────────────────────────────── ★ 지문 — 함수 하나만 존재한다

def corp_fingerprint(natural_keys):
    """한 회사의 natural_key 전체를 문자열로 정렬해 이어붙인 뒤 sha256 hexdigest.

    natural_key 자체가 (id 를 뺀 전 17컬럼)의 sha256 이므로(20260803000002), 이 지문이
    같으면 두 집합의 모든 행·모든 컬럼이 같다는 뜻이다 — 값 비교를 파이썬에서 다시 구현할
    필요가 없다. export(DB 원본)와 verify(DB·스테이징 양쪽) 가 전부 이 함수 하나를 부른다.
    """
    return hashlib.sha256(",".join(sorted(natural_keys)).encode()).hexdigest()


def _iso_now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


# ─────────────────────────────────────────────── 전송 계층 재시도
#
# ST.http() 는 HTTPError 를 이미 잡아 (status, body) 로 돌려준다(예외로 새지 않는다) —
# 그래서 5xx/429 재시도는 상태코드를 보고 판단해야 한다. 네트워크가 통째로 사라지는
# 경우(DNS 실패·연결 거부·타임아웃)는 예외로 새므로 ingest._is_retryable_rest_error() 를
# 그대로 재사용해 판단한다. 상수(10회·300초 상한)도 ingest.py 그대로 — 이 노트북에서
# 몇 시간짜리 실행을 죽인 전례가 있는 바로 그 문제(DNS 조회 실패)라 같은 견고성이 필요하다.

def http_retry(method, url, body=None, headers=None, raw=False):
    for attempt in range(1, ingest._REST_MAX_ATTEMPTS + 1):
        try:
            status, text, elapsed = ST.http(method, url, body, headers, raw=raw)
        except Exception as e:
            if ingest._is_retryable_rest_error(e) and attempt < ingest._REST_MAX_ATTEMPTS:
                ingest._sleep_backoff(attempt)
                continue
            raise
        if (status >= 500 or status == 429) and attempt < ingest._REST_MAX_ATTEMPTS:
            ingest._sleep_backoff(attempt)
            continue
        return status, text, elapsed
    raise RuntimeError("unreachable")  # 루프는 항상 return 또는 raise 로 빠진다


def count_rows_retry(corp_code):
    """ST.count_rows() 는 Content-Range 헤더를 직접 읽어야 해서(ST.http() 는 헤더를
    버린다) http_retry 로 감쌀 수 없다 — 함수 자체를 재시도 루프로 감싼다."""
    for attempt in range(1, ingest._REST_MAX_ATTEMPTS + 1):
        try:
            return ST.count_rows(corp_code)
        except Exception as e:
            if ingest._is_retryable_rest_error(e) and attempt < ingest._REST_MAX_ATTEMPTS:
                ingest._sleep_backoff(attempt)
                continue
            raise


# ─────────────────────────────────────────────── DB 읽기 (Decimal-세이프, natural_key 포함)

def fetch_facts_with_key(corp_code, page_size=1000):
    """ST.fetch_facts() 와 같은 오프셋 페이지네이션·Decimal 파싱 규약이되 natural_key 컬럼을
    얹는다(지문 계산용, payload 에는 안 들어간다) — backfill.rest_get_all() 을 못 쓰는 이유는
    그게 표준 json.loads 를 써서 amount 의 소수 스케일을 float 로 떨어뜨리기 때문이다."""
    rows, offset = [], 0
    base = "%s/financial_facts?corp_code=eq.%s&select=%s&order=id" % (
        ingest.REST, corp_code, FETCH_SELECT)
    while True:
        url = "%s&limit=%d&offset=%d" % (base, page_size, offset)
        status, txt, _ = http_retry("GET", url, headers=ST.svc_headers())
        if status != 200:
            raise RuntimeError("PostgREST GET financial_facts %s: %s" % (status, txt[:300]))
        chunk = ST.loads(txt)
        rows.extend(chunk)
        if len(chunk) < page_size:
            break
        offset += page_size
    return rows


def fetch_natural_keys(table, corp_code):
    """natural_key 는 순수 텍스트라 Decimal 문제가 없다 — backfill.rest_get_all() 그대로
    재사용(ingest.rest() 의 재시도를 그냥 물려받는다)."""
    rows = backfill.rest_get_all(
        "%s?select=natural_key&corp_code=eq.%s&order=id" % (table, corp_code))
    return [r["natural_key"] for r in rows]


# ─────────────────────────────────────────────── PostgREST 쓰기 (Decimal-세이프)
#
# ingest.rest()/replace_scope() 를 그대로 쓸 수 없는 이유: 그 경로는 json.dumps() 로 바디를
# 만드는데, 표준 json 인코더는 decimal.Decimal 을 직렬화하지 못한다(설계 제약 2 — amount 의
# -14.11 같은 소수 스케일을 지키려면 Decimal 로 왕복해야 한다). storage_trial.dumps() 는
# Decimal 을 JSON 숫자 리터럴 텍스트 그대로 박아 넣는 수제 인코더라 이 문제가 없다 — 그래서
# 쓰기 바디는 ST.dumps() 로 만들고, 전송(HTTP 왕복·재시도)만 이 함수가 새로 얹는다.

def rest_write(method, path, body_bytes=None, prefer=None):
    url = "%s/%s" % (ingest.REST, path)
    headers = ST.svc_headers({"Content-Type": "application/json"})
    if prefer:
        headers["Prefer"] = prefer
    status, text, _ = http_retry(method, url, body_bytes, headers)
    if status >= 300:
        raise RuntimeError("PostgREST %s %s → %s: %s" % (method, path, status, text[:400]))
    return text


def replace_scope_decimal(table, corp_code, rows):
    """설계 제약 3 — 스코프(회사 전체) 교체. ingest.replace_scope() 와 같은 delete→insert
    의미론이지만 Decimal-세이프 바디가 필요해 얇게 재구현한다(필터·on_conflict·500행 배치
    분할은 그 함수의 형태를 그대로 뗐다 — 로직을 새로 지어내지 않는다)."""
    rest_write("DELETE", "%s?corp_code=eq.%s" % (table, corp_code))
    for i in range(0, len(rows), 500):
        chunk = rows[i:i + 500]
        body = ST.dumps(chunk).encode("utf-8")
        rest_write("POST", "%s?on_conflict=natural_key" % table, body,
                   prefer="resolution=merge-duplicates,return=minimal")
    return len(rows)


def get_archive_row(corp_code):
    rows = ingest.rest("GET", "fin_archive?corp_code=eq.%s&select=*" % corp_code)
    return rows[0] if rows else None


# ─────────────────────────────────────────────── 명령: export

def cmd_export(args):
    ingest.print_target()
    if args.all:
        corps = [c["corp_code"] for c in
                 backfill.rest_get_all("companies?select=corp_code&order=corp_code")]
    else:
        corps = [c.strip() for c in args.corps.split(",") if c.strip()]
    base = ST._storage_base()
    ok = skipped = failed = 0
    for i, cc in enumerate(corps, 1):
        try:
            n = count_rows_retry(cc)
        except Exception as e:
            print("  [%d/%d] %s 행수 조회 실패 — 건너뜀: %s" % (i, len(corps), cc, str(e)[:200]))
            failed += 1
            continue
        if n == 0:
            print("  [%d/%d] %s financial_facts 0행 — 반출할 것 없음" % (i, len(corps), cc))
            skipped += 1
            continue
        prev = get_archive_row(cc)
        if not args.force and prev and prev.get("row_count") == n:
            print("  [%d/%d] %s 이미 반출됨(행수 %d 동일) — 건너뜀(--force 로 재반출)"
                  % (i, len(corps), cc, n))
            skipped += 1
            continue
        t0 = time.time()
        rows = fetch_facts_with_key(cc)
        natural_keys = [r["natural_key"] for r in rows]
        payload_rows = [{k: v for k, v in r.items() if k != "natural_key"} for r in rows]
        fp = corp_fingerprint(natural_keys)
        raw = ST.dumps(payload_rows).encode("utf-8")
        gz = gzip.compress(raw, compresslevel=9, mtime=0)
        path = "%s/%s.json.gz" % (PREFIX, cc)
        status, txt, _ = http_retry(
            "POST", "%s/object/%s/%s" % (base, BUCKET, path), gz,
            ST.svc_headers({"Content-Type": "application/gzip", "x-upsert": "true",
                            "Cache-Control": "max-age=3600"}))
        if status not in (200, 201):
            print("  [%d/%d] %s 업로드 실패 %s: %s" % (i, len(corps), cc, status, str(txt)[:300]))
            failed += 1
            continue
        manifest = {
            "corp_code": cc, "storage_path": path, "row_count": len(rows),
            "natural_key_fingerprint": fp, "object_bytes": len(gz),
            "uncompressed_bytes": len(raw), "archived_at": _iso_now(),
            "verified_status": "archived", "verified_at": None,
        }
        ingest.upsert("fin_archive", [manifest], on_conflict="corp_code")
        ok += 1
        print("  [%2d/%d] %s %6d행 raw %8d → gz %7d (%.2f×) %.1fs 지문 %s"
              % (i, len(corps), cc, len(rows), len(raw), len(gz),
                 len(raw) / max(len(gz), 1), time.time() - t0, fp[:12]), flush=True)
    print("\n반출 완료: 성공 %d · 건너뜀 %d · 실패 %d (대상 %d)" % (ok, skipped, failed, len(corps)))
    return 1 if failed else 0


# ─────────────────────────────────────────────── 명령: restore

def cmd_restore(args):
    ingest.print_target()
    corps = [c.strip() for c in args.corps.split(",") if c.strip()]
    target = args.into
    if target == "financial_facts":
        print("!! --into financial_facts — 원본 테이블에 쓴다. 호출자가 그 위험을 이해하고"
              " 명시적으로 선택했다고 간주한다(기본값이 아니므로 실수로는 여기 못 온다).")
    base = ST._storage_base()
    ok = failed = 0
    for i, cc in enumerate(corps, 1):
        arch = get_archive_row(cc)
        path = arch["storage_path"] if arch else "%s/%s.json.gz" % (PREFIX, cc)
        status, data, _ = http_retry("GET", "%s/object/%s/%s" % (base, BUCKET, path),
                                     headers=ST.svc_headers(), raw=True)
        if status != 200:
            shown = data[:200].decode("utf-8", "replace") if isinstance(data, bytes) else data
            print("  [%d/%d] %s Storage GET 실패 %s: %s — 건너뜀"
                  % (i, len(corps), cc, status, shown))
            failed += 1
            continue
        rows = ST.loads(gzip.decompress(data).decode("utf-8"))
        n = replace_scope_decimal(target, cc, rows)
        ok += 1
        print("  [%d/%d] %s → %s 로 %d행 적재" % (i, len(corps), cc, target, n), flush=True)
    print("\n복원 완료: 성공 %d · 실패 %d (대상 %d) → %s" % (ok, failed, len(corps), target))
    return 1 if failed else 0


# ─────────────────────────────────────────────── 명령: verify

def cmd_verify(args):
    ingest.print_target()
    corps = [c.strip() for c in args.corps.split(",") if c.strip()]
    against = args.against
    results = []
    for cc in corps:
        db_keys = fetch_natural_keys("financial_facts", cc)
        st_keys = fetch_natural_keys(against, cc)
        db_fp, st_fp = corp_fingerprint(db_keys), corp_fingerprint(st_keys)
        match = len(db_keys) == len(st_keys) and db_fp == st_fp
        status = "verified" if match else "failed"
        ingest.rest("PATCH", "fin_archive?corp_code=eq.%s" % cc,
                    {"verified_status": status, "verified_at": _iso_now()})
        results.append((cc, len(db_keys), len(st_keys), db_fp, st_fp, match))
        print("  %s DB %6d행 / %s %6d행 · %s"
              % (cc, len(db_keys), against, len(st_keys), "일치" if match else "★불일치★"),
              flush=True)

    print("\n%-10s %8s %10s %-18s %-18s %s"
          % ("corp_code", "DB행", "스테이징행", "DB지문", "스테이징지문", "일치"))
    for cc, ndb, nst, dfp, sfp, m in results:
        print("%-10s %8d %10d %-18s %-18s %s"
              % (cc, ndb, nst, dfp[:16], sfp[:16], "OK" if m else "★MISMATCH★"))
    n_bad = sum(1 for r in results if not r[5])
    print("\n검증 %d개사 · 불일치 %d개사" % (len(results), n_bad))
    return 1 if n_bad else 0


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    e = sub.add_parser("export", help="DB → gzip JSON → Storage 업로드 + fin_archive 매니페스트")
    g = e.add_mutually_exclusive_group(required=True)
    g.add_argument("--corps", help="쉼표 구분 corp_code")
    g.add_argument("--all", action="store_true", help="companies 전량 대상")
    e.add_argument("--force", action="store_true",
                   help="fin_archive 에 이미 같은 행수로 반출된 회사도 다시 반출")
    e.set_defaults(func=cmd_export)

    r = sub.add_parser("restore", help="Storage 객체 → 지정 테이블 스코프 교체 적재")
    r.add_argument("--corps", required=True, help="쉼표 구분 corp_code")
    r.add_argument("--into", default="financial_facts_restore_check",
                   help="기본값 스테이징(financial_facts_restore_check). "
                        "financial_facts 를 주면 원본에 쓴다.")
    r.set_defaults(func=cmd_restore)

    v = sub.add_parser("verify", help="financial_facts vs 스테이징 대조 + fin_archive 갱신")
    v.add_argument("--corps", required=True, help="쉼표 구분 corp_code")
    v.add_argument("--against", default="financial_facts_restore_check",
                   help="대조 대상 테이블(기본 financial_facts_restore_check)")
    v.set_defaults(func=cmd_verify)

    args = p.parse_args()
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
