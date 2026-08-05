#!/usr/bin/env python3
"""financial_facts 오프라인 복원 — data/raw 에 남은 DART 원본 응답으로 재적재한다.

왜 필요한가
───────────
매핑 결함 두 개가 ingest.py 에서 고쳐졌지만(20260803000001 / 20260803000002), 고침은
**앞으로의 적재에만** 적용된다. 이미 들어간 916개사 5,548,404행은 여전히

  (1) account_detail 이 전부 NULL — 자본변동표(SCE)의 가로축(자본금/자본잉여금/
      이익잉여금/비지배지분…)이 통째로 유실됐고, 그 결과 서로 다른 셀들이 완전
      중복으로 보여 667,039행이 접혀 사라졌다.
  (2) amount_prev_q / amount_cum / amount_prev_cum 이 전부 NULL — 분기·반기 플로우
      행의 전기동분기·누적 금액을 받고도 읽지 않았다.

두 값 모두 DART 응답에는 있었고, 그 응답이 data/raw/<corp_code>/fin_<year>_<reprt>.json
에 그대로 남아 있다. 그래서 **DART API 호출 0건**으로 복원할 수 있다.

핵심 역학 — 왜 upsert 가 아니라 스코프 교체인가
───────────────────────────────────────────
고쳐진 매핑이 만드는 행은 옛 행과 natural_key(생성 컬럼, 전 컬럼 해시)가 **다르다**
(account_detail 이 NULL → 값). 그래서 순수 upsert 는 옛 행을 그대로 둔 채 새 행을
옆에 쌓는다 — 복원이 아니라 2배 오염이다. replace_scope 가 (corp_code, bsns_year,
reprt_code) 로 먼저 DELETE 하고 INSERT 하기 때문에 이것이 '교체'가 된다.
ingest.write_fin_scope() 가 정확히 그 경로이고, 이 스크립트는 그 함수를 그대로 부른다.

fs_div 는 어디서 오나
────────────────────
DART 는 fs_div(CFS/OFS)를 요청 파라미터로만 받고 응답 행에는 싣지 않는다. 그래서
raw 파일만으로는 알 수 없다. DB 의 기존 스코프가 그 값을 이미 들고 있으므로 거기서
읽는다(= `inventory` 서브커맨드가 만드는 스냅샷). DB 에 행이 없는 스코프는 fs_div 를
지어낼 수 없으므로 **건너뛰고 보고한다** — 조용히 CFS 로 가정하면 별도재무제표 회사의
데이터가 연결로 둔갑한다.

멱등성·재개
──────────
* 스코프 단위 delete→insert 이므로 같은 스코프를 몇 번 돌려도 결과가 같다(이중 삽입 없음).
* 완료 스코프는 data/restore-fin-progress.jsonl 에 한 줄씩 append 된다(fsync). 재실행하면
  그 파일을 읽어 건너뛴다. 파일을 지우면 전량 재실행이고, 그래도 결과는 같다.
* 중단(Ctrl-C/SIGTERM)은 진행 중 스코프만 미완료로 남고, 재실행이 그 스코프를 다시
  통째로 교체한다.

사용법
─────
    python3 restore_fin_from_raw.py inventory          # DB 스코프 스냅샷 생성(읽기 전용)
    python3 restore_fin_from_raw.py coverage           # 디스크 vs DB 대조 리포트
    python3 restore_fin_from_raw.py run --corps 00126380,00164779   # 표본 복원
    python3 restore_fin_from_raw.py run --workers 6                 # 전량 복원
"""
import argparse
import datetime as dt
import json
import os
import re
import sys
import threading
import time

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
import ingest as I  # noqa: E402  매핑·쓰기 경로를 그대로 재사용한다(사본 금지)

RAW_DIR = os.path.abspath(os.path.join(_HERE, "..", "data", "raw"))
STATE_DIR = os.path.abspath(os.path.join(_HERE, "..", "data"))
INVENTORY = os.path.join(STATE_DIR, "restore-fin-inventory.json")
PROGRESS = os.path.join(STATE_DIR, "restore-fin-progress.jsonl")

FIN_RE = re.compile(r"^fin_(\d{4})_(\d{5})\.json$")


# ─────────────────────────────────────────────── 인벤토리 (DB 읽기 전용)

def cmd_inventory(args):
    """financial_facts 전량을 키셋으로 훑어 (corp, year, reprt) → (행수, fs_div 분포) 를 만든다.

    PostgREST 는 집계(count/group by)를 막아뒀고(PGRST123) max-rows 가 1000 이라, 스코프
    목록을 얻는 방법은 id 키셋 전량 스캔뿐이다. 5.5M 행에 약 7분, 쓰기는 전혀 없다.
    """
    I.print_target()
    scopes, last_id, n, t0 = {}, 0, 0, time.time()
    while True:
        page = I.rest("GET", "financial_facts?select=id,corp_code,bsns_year,reprt_code,fs_div"
                             "&id=gt.%d&order=id&limit=1000" % last_id)
        if not page:
            break
        for r in page:
            k = "%s|%s|%s" % (r["corp_code"], r["bsns_year"], r["reprt_code"])
            e = scopes.setdefault(k, [0, {}])
            e[0] += 1
            e[1][r["fs_div"]] = e[1].get(r["fs_div"], 0) + 1
        last_id, n = page[-1]["id"], n + len(page)
        if n % 500000 == 0:
            print("  %d행 · 스코프 %d · %.0fs" % (n, len(scopes), time.time() - t0), flush=True)
        if len(page) < 1000:
            break
    os.makedirs(STATE_DIR, exist_ok=True)
    with open(INVENTORY, "w") as f:
        json.dump({"taken_at": dt.datetime.now(dt.timezone.utc).isoformat(),
                   "rows": n, "scopes": scopes}, f)
    print("총 %d행 · 스코프 %d · %.0fs → %s" % (n, len(scopes), time.time() - t0, INVENTORY))


def load_inventory():
    if not os.path.exists(INVENTORY):
        sys.exit("인벤토리 없음 — 먼저 `restore_fin_from_raw.py inventory` 를 돌려라: %s" % INVENTORY)
    return json.load(open(INVENTORY))


# ─────────────────────────────────────────────── 디스크 스캔

def disk_scopes():
    """{(corp, year, reprt): 경로} — data/raw 의 fin_<year>_<reprt>.json 전량."""
    out = {}
    for corp in sorted(os.listdir(RAW_DIR)):
        d = os.path.join(RAW_DIR, corp)
        if not os.path.isdir(d):
            continue
        for fn in os.listdir(d):
            m = FIN_RE.match(fn)
            if m:
                out[(corp, int(m.group(1)), m.group(2))] = os.path.join(d, fn)
    return out


def parse_key(k):
    c, y, r = k.split("|")
    return (c, int(y), r)


# ─────────────────────────────────────────────── 커버리지 리포트

def cmd_coverage(args):
    inv = load_inventory()
    db = {parse_key(k): v for k, v in inv["scopes"].items()}
    disk = disk_scopes()
    db_corps = {k[0] for k in db}
    disk_corps = {k[0] for k in disk}

    missing = sorted(set(db) - set(disk))          # DB 에 있는데 디스크에 없음 → 오프라인 복원 불가
    extra = sorted(set(disk) - set(db))            # 디스크에만 있음 → fs_div 미상, 건너뜀
    mixed = sorted(k for k, v in db.items() if len(v[1]) > 1)

    print("=== 커버리지 (인벤토리 %s) ===" % inv["taken_at"])
    print("DB   : 회사 %d · 스코프 %d · 행 %d" % (len(db_corps), len(db), inv["rows"]))
    print("디스크: 회사 %d · 스코프 %d" % (len(disk_corps), len(disk)))
    print("\nDB 에 있으나 디스크에 raw 없음(오프라인 복원 불가): 스코프 %d · 회사 %d"
          % (len(missing), len({k[0] for k in missing})))
    for k in missing[:40]:
        print("   - %s %s/%s (DB %d행)" % (k[0], k[1], k[2], db[k][0]))
    if len(missing) > 40:
        print("   … 외 %d건" % (len(missing) - 40))
    print("\nDB 에 없는 회사 (raw 만 있음): %d개 — %s"
          % (len(disk_corps - db_corps), ",".join(sorted(disk_corps - db_corps)[:20])))
    print("디스크에만 있는 스코프(fs_div 미상 → 복원 대상 제외): %d" % len(extra))
    print("한 스코프에 fs_div 가 섞인 경우: %d" % len(mixed))
    for k in mixed[:20]:
        print("   - %s %s/%s → %s" % (k[0], k[1], k[2], db[k][1]))
    todo = sorted(set(db) & set(disk))
    print("\n복원 대상: 스코프 %d · 회사 %d · 현재 DB 행 %d"
          % (len(todo), len({k[0] for k in todo}), sum(db[k][0] for k in todo)))


# ─────────────────────────────────────────────── 진행 상태 (append-only JSONL)

class Progress:
    """완료 스코프 기록. 한 줄 = 한 스코프, append + flush + fsync 로 크래시에 견딘다."""

    def __init__(self, path):
        self.path = path
        self.done = set()
        if os.path.exists(path):
            for line in open(path):
                line = line.strip()
                if not line:
                    continue
                try:
                    r = json.loads(line)
                except ValueError:
                    continue  # 크래시로 잘린 마지막 줄 — 그 스코프는 다시 돌린다(교체라 무해)
                self.done.add((r["corp"], r["year"], r["reprt"]))
        self._f = open(path, "a")
        self._lock = threading.Lock()

    def mark(self, key, n_rows, n_before):
        with self._lock:
            self._f.write(json.dumps({"corp": key[0], "year": key[1], "reprt": key[2],
                                      "rows": n_rows, "was": n_before,
                                      "at": dt.datetime.now(dt.timezone.utc).isoformat()}) + "\n")
            self._f.flush()
            os.fsync(self._f.fileno())
            self.done.add(key)


# ─────────────────────────────────────────────── 복원 실행

def cmd_run(args):
    I.print_target()
    inv = load_inventory()
    db = {parse_key(k): v for k, v in inv["scopes"].items()}
    disk = disk_scopes()

    todo = sorted(set(db) & set(disk))
    if args.corps:
        want = {c.strip() for c in args.corps.split(",")}
        todo = [k for k in todo if k[0] in want]
    if args.limit:
        todo = todo[:args.limit]

    prog = Progress(PROGRESS)
    pending = [k for k in todo if k not in prog.done]
    print("복원 대상 스코프 %d (완료기록 %d건 건너뜀) · 워커 %d"
          % (len(pending), len(todo) - len(pending), args.workers))
    if args.dry_run:
        print("DRY RUN — 쓰기 없음")
        return

    counters = {"ok": 0, "rows": 0, "err": 0}
    lock = threading.Lock()
    t0 = time.time()
    idx = {"i": 0}

    def worker():
        while True:
            with lock:
                if idx["i"] >= len(pending):
                    return
                k = pending[idx["i"]]
                idx["i"] += 1
            corp, year, reprt = k
            try:
                rows = json.load(open(disk[k], encoding="utf-8"))
                fsdiv = max(db[k][1].items(), key=lambda kv: kv[1])[0]  # 스코프 내 최빈 fs_div
                n = I.write_fin_scope(corp, year, reprt, fsdiv, rows)
                prog.mark(k, n, db[k][0])
                with lock:
                    counters["ok"] += 1
                    counters["rows"] += n
            except Exception as e:  # noqa: BLE001 — 한 스코프 실패가 전체를 세우면 안 된다
                with lock:
                    counters["err"] += 1
                print("  [실패] %s %s/%s — %s" % (corp, year, reprt, str(e)[:300]), flush=True)
            with lock:
                done = counters["ok"] + counters["err"]
                if done % 200 == 0:
                    el = time.time() - t0
                    rate = done / el if el else 0
                    print("  %d/%d 스코프 · %d행 · 실패 %d · %.1f/s · 남은 %.0f분"
                          % (done, len(pending), counters["rows"], counters["err"], rate,
                             (len(pending) - done) / rate / 60 if rate else 0), flush=True)

    threads = [threading.Thread(target=worker, daemon=True) for _ in range(args.workers)]
    for t in threads:
        t.start()
    try:
        for t in threads:
            t.join()
    except KeyboardInterrupt:
        print("\n중단 — 완료 스코프는 %s 에 기록됨. 같은 명령으로 이어서 실행 가능." % PROGRESS)
        sys.exit(130)
    print("완료: 스코프 %d · 삽입 %d행 · 실패 %d · %.1f분"
          % (counters["ok"], counters["rows"], counters["err"], (time.time() - t0) / 60))


def main():
    p = argparse.ArgumentParser(description="financial_facts 를 data/raw 로 오프라인 복원 (DART 호출 0건)")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("inventory", help="DB 스코프 스냅샷 생성 (읽기 전용, 약 7분)")
    sub.add_parser("coverage", help="디스크 vs DB 대조 리포트")
    r = sub.add_parser("run", help="복원 실행")
    r.add_argument("--corps", help="쉼표 구분 corp_code — 지정 시 이 회사들만")
    r.add_argument("--limit", type=int, help="처리할 최대 스코프 수")
    r.add_argument("--workers", type=int, default=6)
    r.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    {"inventory": cmd_inventory, "coverage": cmd_coverage, "run": cmd_run}[args.cmd](args)


if __name__ == "__main__":
    main()
