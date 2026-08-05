#!/usr/bin/env python3
"""financial_facts → Supabase Storage 시험 반출(trial export) — 측정용, 이관 아님.

무엇을 재나. `financial_facts` 는 DB 5,486 MB 중 4,374 MB(80%)를 혼자 쓴다. 이 원본은
"한 회사 상세"를 그릴 때만 통째로 읽히고, 회사를 가로지르는 건 파생 집합(회사당 ~240행)
뿐이다. 그래서 계획은 원본→Storage, 파생→DB 다. 이 스크립트는 그 계획을 실행하기 전에
**숫자를 만든다** — 압축비·객체 크기·왕복 지연·DB 절감량·왕복 무결성.

절대 안 하는 것: DELETE 없음, DROP 없음, 테이블 재작성 없음, DART API 호출 없음.
financial_facts 와 ingest_corps 를 READ 하고 Storage 에 WRITE 할 뿐이다.

전제: SUPABASE_REST_URL / SUPABASE_SERVICE_KEY (프로세스 환경 > 레포 루트 .env.local).
ingest.py 의 rest()/rest_get_all() 을 그대로 쓴다(재발명 금지 — 페이지네이션 규약이 한 곳).

사용:
  python3 platform/ingest/storage_trial.py bucket            # 비공개 버킷 생성 + 상태 확인
  python3 platform/ingest/storage_trial.py select            # 표본 추출 → 대상 30개사 선정
  python3 platform/ingest/storage_trial.py export            # 읽기 → gzip → 업로드 + 계측
  python3 platform/ingest/storage_trial.py report            # 통계·지연·왕복 무결성 보고
  python3 platform/ingest/storage_trial.py probe             # 보안 점검(자격증명별 상태코드)

probe 는 SUPABASE_ANON_KEY 가 환경에 있으면 anon 키 점검(목록·객체 GET)까지 돌린다.
Storage 접근통제는 storage.objects 의 RLS 라서 테이블 잠금 마이그레이션
(20260802000005/000006)이 덮지 못한다 — 별도로 확인해야 하는 이유가 이것이다.
"""
import argparse
import decimal
import gzip
import hashlib
import io
import json
import os
import random
import statistics
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO = os.path.dirname(os.path.dirname(_HERE))
sys.path.insert(0, _HERE)
import ingest                    # noqa: E402  REST/SERVICE_KEY·rest()·SSL 컨텍스트 재사용
import backfill                  # noqa: E402  rest_get_all() 오프셋 페이지네이션 재사용

BUCKET = os.environ.get("TRIAL_BUCKET", "platform-raw")
PREFIX = "fin"
STATE_DIR = os.path.join(_HERE, "..", "data", "storage-trial")

# id 와 natural_key 는 반출에서 뺀다.
#   - id          : identity 대리키. 정보를 담지 않고, 복원 시 어차피 새로 발급된다.
#   - natural_key : GENERATED ALWAYS ... STORED 컬럼(마이그레이션 20260803000002). 나머지
#                   전 컬럼의 sha256 이라 파생 가능하며, 애초에 INSERT 로 넣을 수 없다.
# 즉 둘을 빼는 건 선택이 아니라 복원 경로가 요구하는 형태다(둘을 넣으면 복원이 실패한다).
FACT_COLS = ["corp_code", "bsns_year", "reprt_code", "fs_div", "sj_div",
             "account_id", "account_nm", "amount", "amount_prev", "amount_prev2",
             "ord", "currency", "rcept_no", "account_detail",
             "amount_prev_q", "amount_cum", "amount_prev_cum"]
SELECT = ",".join(FACT_COLS)

# DB 실측 총량 — 절감액 환산의 분모. pg_total_relation_size 기준(인덱스 포함).
DB_TABLE_MB = 4374.0
DB_TOTAL_ROWS = 13920062
DB_BYTES_PER_ROW = DB_TABLE_MB * 1024 * 1024 / DB_TOTAL_ROWS
TOTAL_CORPS = 2659


# ─────────────────────────────────────────────── HTTP (상태코드까지 돌려주는 얇은 층)

def _storage_base():
    return ingest.REST.replace("/rest/v1", "/storage/v1")


def http(method, url, body=None, headers=None, raw=False):
    """상태코드·본문을 항상 돌려준다(예외로 삼키지 않는다). 보안 점검은 '몇 번이 떴나'가
    곧 결과이므로 4xx/5xx 를 정상 반환값으로 받아야 한다."""
    h = dict(headers or {})
    req = urllib.request.Request(url, data=body, headers=h, method=method)
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=120, context=ingest._SSL_CTX) as resp:
            data = resp.read()
            return resp.status, data if raw else data.decode("utf-8", "replace"), time.time() - t0
    except urllib.error.HTTPError as e:
        data = e.read()
        return e.code, data if raw else data.decode("utf-8", "replace"), time.time() - t0


def svc_headers(extra=None):
    h = {"apikey": ingest.SERVICE_KEY, "Authorization": "Bearer %s" % ingest.SERVICE_KEY}
    h.update(extra or {})
    return h


# ─────────────────────────────────────────────── JSON 정밀도
#
# numeric 컬럼을 float 로 파싱하면 왕복에서 값이 바뀔 수 있다(2^53 초과 정수·소수 스케일).
# Decimal 로 받아 문자열 그대로 다시 뱉는다 — 반출본은 PostgREST 가 준 숫자 표기를 보존한다.

def _enc_val(v):
    """numeric 을 float 로 떨어뜨리지 않는다. 표준 json 인코더는 float 서브클래스도 C 경로에서
    float.__repr__ 로 찍어버려서 원본 표기를 못 지킨다(실측: amount 에 -14.11 같은 소수 스케일이
    실제로 있다). 행이 평평한 dict 뿐이므로 값 인코딩만 직접 잡으면 끝난다 — Decimal 은
    parse_float 가 받은 원문 그대로를 str() 로 되돌려준다."""
    if v is None:
        return "null"
    if v is True or v is False:
        return "true" if v else "false"
    if isinstance(v, decimal.Decimal):
        return str(v)
    if isinstance(v, int):
        return str(v)                      # Python int 는 임의 정밀도 — 2^53 초과도 안전
    if isinstance(v, str):
        return json.dumps(v, ensure_ascii=False)
    raise TypeError("직렬화 불가 타입: %r (%r)" % (type(v), v))


def _row_json(row, sort_keys=False):
    items = sorted(row.items()) if sort_keys else list(row.items())
    return "{%s}" % ",".join("%s:%s" % (json.dumps(k, ensure_ascii=False), _enc_val(v))
                             for k, v in items)


def dumps(rows):
    return "[%s]" % ",".join(_row_json(r) for r in rows)


def loads(txt):
    return json.loads(txt, parse_float=decimal.Decimal)


def canonical_digest(rows):
    """정렬된 행에 대한 안정 다이제스트. 키 순서·행 순서에 의존하지 않게 정규화한 뒤 sha256."""
    lines = sorted(_row_json(r, sort_keys=True) for r in rows)
    h = hashlib.sha256()
    for ln in lines:
        h.update(ln.encode("utf-8"))
        h.update(b"\n")
    return h.hexdigest()


# ─────────────────────────────────────────────── 읽기

def count_rows(corp_code):
    """Prefer: count=exact → Content-Range 헤더의 총계만 읽는다(행 본문은 안 받는다)."""
    url = "%s/financial_facts?corp_code=eq.%s&select=corp_code&limit=1" % (ingest.REST, corp_code)
    req = urllib.request.Request(url, headers=svc_headers({"Prefer": "count=exact",
                                                           "Range-Unit": "items"}),
                                 method="GET")
    with urllib.request.urlopen(req, timeout=120, context=ingest._SSL_CTX) as resp:
        cr = resp.headers.get("Content-Range", "")
        resp.read()
    return int(cr.split("/")[-1]) if "/" in cr else 0


def fetch_facts(corp_code, page_size=1000):
    """한 회사의 financial_facts 전량. backfill.rest_get_all 과 같은 오프셋 페이지네이션
    규약이되, numeric 정밀도 때문에 Decimal 파서를 물려야 해서 여기서 한 겹 더 쓴다."""
    rows, offset = [], 0
    base = "%s/financial_facts?corp_code=eq.%s&select=%s&order=id" % (
        ingest.REST, corp_code, SELECT)
    while True:
        url = "%s&limit=%d&offset=%d" % (base, page_size, offset)
        status, txt, _ = http("GET", url, headers=svc_headers())
        if status != 200:
            raise RuntimeError("PostgREST %s: %s" % (status, txt[:300]))
        chunk = loads(txt)
        rows.extend(chunk)
        if len(chunk) < page_size:
            break
        offset += page_size
    return rows


# ─────────────────────────────────────────────── 명령: bucket

def cmd_bucket(args):
    ingest.print_target()
    base = _storage_base()
    body = json.dumps({"name": BUCKET, "id": BUCKET, "public": False}).encode()
    st, txt, _ = http("POST", base + "/bucket", body,
                      svc_headers({"Content-Type": "application/json"}))
    print("버킷 생성 POST /bucket → %s %s" % (st, txt[:200]))
    st, txt, _ = http("GET", "%s/bucket/%s" % (base, BUCKET), headers=svc_headers())
    print("버킷 조회 GET  /bucket/%s → %s %s" % (BUCKET, st, txt[:300]))
    return 0


def cmd_probe(args):
    """보안 점검 — 같은 두 동작(목록·객체)을 자격증명만 바꿔가며 때리고 상태코드를 남긴다."""
    ingest.print_target()
    base = _storage_base()
    sel = _load(os.path.join(STATE_DIR, "export.json"), {})
    known = (sel.get("objects") or [{}])[0].get("path") or "%s/00126380.json.gz" % PREFIX
    list_body = json.dumps({"prefix": PREFIX + "/", "limit": 5}).encode()
    probes = [
        ("service · list", "POST", "%s/object/list/%s" % (base, BUCKET), list_body,
         svc_headers({"Content-Type": "application/json"})),
        ("service · get object", "GET", "%s/object/%s/%s" % (base, BUCKET, known), None,
         svc_headers()),
        ("no-key · list", "POST", "%s/object/list/%s" % (base, BUCKET), list_body,
         {"Content-Type": "application/json"}),
        ("no-key · get object", "GET", "%s/object/%s/%s" % (base, BUCKET, known), None, {}),
        ("public URL(무인증) · get object", "GET",
         "%s/object/public/%s/%s" % (base, BUCKET, known), None, {}),
        ("bogus key · list", "POST", "%s/object/list/%s" % (base, BUCKET), list_body,
         {"apikey": "not-a-real-key", "Authorization": "Bearer not-a-real-key",
          "Content-Type": "application/json"}),
    ]
    anon = os.environ.get("SUPABASE_ANON_KEY")
    if anon:
        probes += [
            ("anon · list", "POST", "%s/object/list/%s" % (base, BUCKET), list_body,
             {"apikey": anon, "Authorization": "Bearer " + anon,
              "Content-Type": "application/json"}),
            ("anon · get object", "GET", "%s/object/%s/%s" % (base, BUCKET, known), None,
             {"apikey": anon, "Authorization": "Bearer " + anon}),
        ]
    else:
        print("  (SUPABASE_ANON_KEY 미설정 — anon 키 점검은 건너뜀)")
    for label, method, url, body, headers in probes:
        st, txt, _ = http(method, url, body, headers, raw=True)
        if isinstance(txt, bytes):
            shown = txt[:120].decode("utf-8", "replace") if len(txt) < 400 else "<%d bytes>" % len(txt)
        else:
            shown = txt[:120]
        print("  %-28s → HTTP %s  %s" % (label, st, shown.replace("\n", " ")))
    return 0


# ─────────────────────────────────────────────── 명령: select

def _save(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1, default=str)


def _load(path, default=None):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def cmd_select(args):
    """표본 → 선정. 층화(시장 Y/K/N) 후 각 층에서 무작위 표본의 행수를 세고, 행수 분위수를
    따라 고르게 뽑는다. '많은 회사·적은 회사'를 의도적으로 섞으라는 요구를 재현 가능한
    절차로 옮긴 것(시드 고정)."""
    ingest.print_target()
    random.seed(args.seed)
    corps = backfill.rest_get_all("ingest_corps?select=corp_code,corp_name,corp_cls"
                                  "&corp_cls=in.(Y,K,N)&order=corp_code")
    by_cls = {}
    for c in corps:
        by_cls.setdefault(c["corp_cls"], []).append(c)
    print("생존 상장사: " + " ".join("%s=%d" % (k, len(v)) for k, v in sorted(by_cls.items())))

    sample_n = {"Y": args.sample_y, "K": args.sample_k, "N": args.sample_n_konex}
    pick_n = {"Y": 12, "K": 12, "N": 6}
    sampled, chosen = [], []
    for cls in ("Y", "K", "N"):
        pool = by_cls.get(cls, [])
        take = random.sample(pool, min(sample_n[cls], len(pool)))
        counted = []
        for i, c in enumerate(take, 1):
            n = count_rows(c["corp_code"])
            counted.append(dict(c, rows=n))
            if i % 20 == 0:
                print("  %s 표본 %d/%d" % (cls, i, len(take)), flush=True)
        counted.sort(key=lambda r: r["rows"])
        sampled.extend(counted)
        nonzero = [r for r in counted if r["rows"] > 0]
        k = pick_n[cls]
        # 분위수 균등 추출 — 최소·최대를 포함하도록 양끝을 붙인다.
        idxs = sorted({int(round(j * (len(nonzero) - 1) / (k - 1))) for j in range(k)})
        chosen.extend(nonzero[i] for i in idxs)
    out = {"seed": args.seed, "sampled": sampled, "chosen": chosen}
    _save(os.path.join(STATE_DIR, "selection.json"), out)
    print("\n선정 %d개사:" % len(chosen))
    for c in chosen:
        print("  %s %-24s %s %7d행" % (c["corp_code"], c["corp_name"][:24], c["corp_cls"], c["rows"]))
    return 0


# ─────────────────────────────────────────────── 명령: export

def cmd_export(args):
    ingest.print_target()
    sel = _load(os.path.join(STATE_DIR, "selection.json"))
    if not sel:
        raise SystemExit("selection.json 이 없다 — select 를 먼저 돌려라")
    base = _storage_base()
    objects = []
    for i, c in enumerate(sel["chosen"], 1):
        cc = c["corp_code"]
        t0 = time.time()
        rows = fetch_facts(cc)
        t_read = time.time() - t0
        payload = dumps(rows).encode("utf-8")
        t1 = time.time()
        gz = gzip.compress(payload, compresslevel=9, mtime=0)
        t_gzip = time.time() - t1
        path = "%s/%s.json.gz" % (PREFIX, cc)
        st, txt, t_up = http("POST", "%s/object/%s/%s" % (base, BUCKET, path), gz,
                             svc_headers({"Content-Type": "application/gzip",
                                          "x-upsert": "true",
                                          "Cache-Control": "max-age=3600"}))
        if st not in (200, 201):
            raise RuntimeError("업로드 실패 %s: %s" % (st, txt[:300]))
        objects.append({"corp_code": cc, "corp_name": c["corp_name"], "corp_cls": c["corp_cls"],
                        "rows": len(rows), "raw_bytes": len(payload), "gz_bytes": len(gz),
                        "path": path, "digest": canonical_digest(rows),
                        "t_read": round(t_read, 3), "t_gzip": round(t_gzip, 3),
                        "t_upload": round(t_up, 3)})
        print("  [%2d/%d] %s %-20s %6d행 raw %8d → gz %7d (%.2f×) 읽기 %.1fs 업로드 %.2fs"
              % (i, len(sel["chosen"]), cc, c["corp_name"][:20], len(rows), len(payload),
                 len(gz), len(payload) / max(len(gz), 1), t_read, t_up), flush=True)
    _save(os.path.join(STATE_DIR, "export.json"), {"bucket": BUCKET, "objects": objects})
    return 0


# ─────────────────────────────────────────────── 명령: report

def _stats(vals):
    return {"min": min(vals), "median": statistics.median(vals),
            "mean": statistics.mean(vals), "max": max(vals)}


def _mb(b):
    return b / 1024.0 / 1024.0


def cmd_report(args):
    ingest.print_target()
    exp = _load(os.path.join(STATE_DIR, "export.json"))
    if not exp:
        raise SystemExit("export.json 이 없다 — export 를 먼저 돌려라")
    objs = sorted(exp["objects"], key=lambda o: o["gz_bytes"])
    base = _storage_base()

    raw = [o["raw_bytes"] for o in objs]
    gz = [o["gz_bytes"] for o in objs]
    rows = [o["rows"] for o in objs]
    ratio = [o["raw_bytes"] / o["gz_bytes"] for o in objs]

    print("\n== 압축 ==")
    print("  JSON 원문 합계 %.1f MB → gzip 합계 %.1f MB · 종합 압축비 %.2f×"
          % (_mb(sum(raw)), _mb(sum(gz)), sum(raw) / sum(gz)))
    r = _stats(ratio)
    print("  회사별 압축비 min %.2f× / median %.2f× / mean %.2f× / max %.2f×"
          % (r["min"], r["median"], r["mean"], r["max"]))

    print("\n== 객체 크기(gzip) ==")
    s = _stats(gz)
    for k in ("min", "median", "mean", "max"):
        print("  %-6s %10.1f KB" % (k, s[k] / 1024.0))
    bytes_per_row = sum(gz) / float(sum(rows))
    print("  gzip 바이트/행 %.1f B (표본 %d개사 %d행)"
          % (bytes_per_row, len(objs), sum(rows)))
    proj_by_row = bytes_per_row * DB_TOTAL_ROWS
    proj_by_corp = statistics.mean(gz) * TOTAL_CORPS
    print("  전사 투영: 행 기준 %.2f GB (%d행 × %.1f B) / 회사평균 기준 %.2f GB (%d사)"
          % (proj_by_row / 1024 ** 3, DB_TOTAL_ROWS, bytes_per_row,
             proj_by_corp / 1024 ** 3, TOTAL_CORPS))

    print("\n== DB 측 비교(같은 30개사) ==")
    db_bytes = sum(rows) * DB_BYTES_PER_ROW
    print("  DB 실측 바이트/행 %.1f B (테이블 총 %.0f MB / %d행, 인덱스 포함)"
          % (DB_BYTES_PER_ROW, DB_TABLE_MB, DB_TOTAL_ROWS))
    print("  30개사 %d행 → DB %.1f MB vs Storage %.1f MB (%.1f× 절감)"
          % (sum(rows), _mb(db_bytes), _mb(sum(gz)), db_bytes / sum(gz)))

    print("\n== 왕복 지연 ==")
    med_obj = objs[len(objs) // 2]
    max_obj = objs[-1]
    for label, o in (("중앙값 객체", med_obj), ("최대 객체", max_obj)):
        gets, gunz, parses = [], [], []
        for _ in range(args.repeat):
            st, data, t = http("GET", "%s/object/%s/%s" % (base, BUCKET, o["path"]),
                               headers=svc_headers(), raw=True)
            assert st == 200, (st, data[:200])
            gets.append(t)
            t0 = time.time(); plain = gzip.decompress(data); gunz.append(time.time() - t0)
            t0 = time.time(); parsed = loads(plain.decode("utf-8")); parses.append(time.time() - t0)
        print("  %s %s(%s) %d행 · gz %.1f KB" %
              (label, o["corp_code"], o["corp_name"], o["rows"], o["gz_bytes"] / 1024.0))
        print("     GET %.0f ms (min %.0f / max %.0f, n=%d) · gunzip %.0f ms · JSON parse %.0f ms"
              " · 합계 %.0f ms"
              % (statistics.median(gets) * 1000, min(gets) * 1000, max(gets) * 1000, args.repeat,
                 statistics.median(gunz) * 1000, statistics.median(parses) * 1000,
                 (statistics.median(gets) + statistics.median(gunz)
                  + statistics.median(parses)) * 1000))

    print("\n== 왕복 무결성(Storage 객체 vs PostgREST 재조회) ==")
    for o in objs[:1] + [objs[len(objs) // 2]] + [objs[-1]]:
        st, data, _ = http("GET", "%s/object/%s/%s" % (base, BUCKET, o["path"]),
                           headers=svc_headers(), raw=True)
        obj_rows = loads(gzip.decompress(data).decode("utf-8"))
        db_rows = fetch_facts(o["corp_code"])
        d_obj, d_db = canonical_digest(obj_rows), canonical_digest(db_rows)
        print("  %s %-18s 객체 %d행 / DB %d행 · %s"
              % (o["corp_code"], o["corp_name"][:18], len(obj_rows), len(db_rows),
                 "일치" if (d_obj == d_db and len(obj_rows) == len(db_rows)) else "★불일치★"))
        print("     digest(object) %s" % d_obj)
        print("     digest(db)     %s" % d_db)
    return 0


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("bucket").set_defaults(func=cmd_bucket)
    sub.add_parser("probe").set_defaults(func=cmd_probe)
    s = sub.add_parser("select")
    s.add_argument("--seed", type=int, default=20260805)
    s.add_argument("--sample-y", type=int, default=80)
    s.add_argument("--sample-k", type=int, default=110)
    s.add_argument("--sample-n-konex", type=int, default=40)
    s.add_argument("--n", type=int, default=30)
    s.set_defaults(func=cmd_select)
    sub.add_parser("export").set_defaults(func=cmd_export)
    r = sub.add_parser("report")
    r.add_argument("--repeat", type=int, default=5)
    r.set_defaults(func=cmd_report)
    args = p.parse_args()
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
