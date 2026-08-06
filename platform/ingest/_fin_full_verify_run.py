#!/usr/bin/env python3
"""financial_facts 전량 Storage 반출 + 청크 단위 전수 대조 — 1회성 운영 스크립트.

fin_storage.py(export/restore/verify)를 서브프로세스로 호출해 재사용하고, 대조는 DB 내부
대칭차집합 SQL(`supabase db query --linked`)을 1차 방법으로 쓴다(13.9M행을 네트워크로
끌어올 필요가 없다). 일부 청크는 fin_storage.py verify(파이썬 natural_key 지문 비교)로도
돌려 두 방법이 같은 답을 내는지 교차 확인한다.

디스크 제약: 스테이징(financial_facts_restore_check)에 한 번에 다 넣지 않는다. chunks.txt
(회사코드 CSV, 줄당 1청크)를 미리 만들어(plan_chunks.py) 청크당 restore → 대조 →
TRUNCATE 순으로 처리한다. 상태는 state.json 에 청크별로 기록해 재개 가능하게 한다.

사용:
  python3 _fin_full_verify_run.py --chunks-file <path> [--cross-check 0,1,17] [--start-at N]
"""
import argparse
import datetime as dt
import json
import os
import subprocess
import sys
import time

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
import ingest  # noqa: E402

SUPABASE_BIN = os.path.expanduser("~/.local/share/supabase/supabase")
STATE_PATH = os.path.join(_HERE, "..", "data", "storage-trial", "full_verify_state.json")


def sh_supabase_sql(sql, timeout=170):
    """supabase db query --linked 로 SQL 실행, JSON 파싱해 rows 리스트 반환.
    CLI 자체 상한이 ~120s 라 문서화돼 있다 — 우리 쪽 타임아웃은 여유를 더 준다."""
    env = dict(os.environ)
    env["PATH"] = os.path.dirname(SUPABASE_BIN) + ":" + env.get("PATH", "")
    cmd = [SUPABASE_BIN, "db", "query", "--linked", sql, "--output", "json"]
    for attempt in range(1, 4):
        try:
            p = subprocess.run(cmd, cwd=os.path.join(_HERE, ".."), capture_output=True,
                                text=True, timeout=timeout, env=env)
        except subprocess.TimeoutExpired:
            print("    [SQL] 타임아웃(attempt %d) — 재시도" % attempt, flush=True)
            continue
        if p.returncode != 0:
            print("    [SQL] 실패(attempt %d) rc=%d stderr=%s" % (attempt, p.returncode, p.stderr[-500:]),
                  flush=True)
            if attempt < 3:
                time.sleep(5)
                continue
            raise RuntimeError("supabase db query 실패: %s" % p.stderr[-800:])
        out = p.stdout.strip()
        try:
            data = json.loads(out)
        except json.JSONDecodeError:
            print("    [SQL] JSON 파싱 실패, 원문: %s" % out[:500], flush=True)
            if attempt < 3:
                time.sleep(5)
                continue
            raise
        return data.get("rows", [])
    raise RuntimeError("unreachable")


def run_py(args_list, timeout=3600):
    cmd = [sys.executable, os.path.join(_HERE, "fin_storage.py")] + args_list
    t0 = time.time()
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    dt_s = time.time() - t0
    print(p.stdout, end="")
    if p.stderr.strip():
        print("STDERR:", p.stderr[-2000:], file=sys.stderr)
    return p.returncode, dt_s


def load_state():
    if os.path.exists(STATE_PATH):
        with open(STATE_PATH) as f:
            return json.load(f)
    return {"chunks": {}}


def save_state(state):
    tmp = STATE_PATH + ".tmp"
    with open(tmp, "w") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    os.replace(tmp, STATE_PATH)


def sql_lit_list(corp_codes):
    # corp_code 는 DART 발급 8자리 숫자 문자열이라는 게 전제(스키마·플러그인 전역 관례) —
    # SQL 문자열에 그대로 꽂아 넣기 전에 그 전제를 실측 검증한다(주입 방어, 데이터 소스는
    # DB 조회 결과라 신뢰할 수 없는 입력으로 취급).
    for c in corp_codes:
        if not (isinstance(c, str) and c.isdigit()):
            raise ValueError("corp_code 형식 이상 — 중단: %r" % (c,))
    return "(" + ",".join("'%s'" % c for c in corp_codes) + ")"


def check_staging_size():
    rows = sh_supabase_sql(
        "select pg_total_relation_size('financial_facts_restore_check'::regclass) as b, "
        "(select count(*) from financial_facts_restore_check) as n;")
    return rows[0]["b"], rows[0]["n"]


def symmetric_diff_check(corp_csv_list):
    scope = sql_lit_list(corp_csv_list)
    rows = sh_supabase_sql(f"""
      select count(*) as sym_diff from (
        (select corp_code, natural_key from financial_facts where corp_code in {scope}
         except
         select corp_code, natural_key from financial_facts_restore_check)
        union all
        (select corp_code, natural_key from financial_facts_restore_check
         except
         select corp_code, natural_key from financial_facts where corp_code in {scope})
      ) t;
    """)
    return int(rows[0]["sym_diff"])


def row_count_mismatch_check(corp_csv_list):
    scope = sql_lit_list(corp_csv_list)
    rows = sh_supabase_sql(f"""
      select coalesce(a.corp_code, b.corp_code) as corp_code,
             coalesce(a.n, 0) as db_n, coalesce(b.n, 0) as staging_n
      from (select corp_code, count(*) n from financial_facts
            where corp_code in {scope} group by corp_code) a
      full outer join
           (select corp_code, count(*) n from financial_facts_restore_check
            group by corp_code) b
      on a.corp_code = b.corp_code
      where coalesce(a.n,0) <> coalesce(b.n,0);
    """)
    return rows


def truncate_staging():
    sh_supabase_sql("truncate table financial_facts_restore_check;")


def mark_verified(corp_codes):
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    scope = ",".join(corp_codes)
    ingest.rest("PATCH", "fin_archive?corp_code=in.(%s)" % scope,
                {"verified_status": "verified", "verified_at": now})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chunks-file", required=True)
    ap.add_argument("--cross-check", default="", help="쉼표 구분 청크 인덱스(0-based), python 지문도 병행")
    ap.add_argument("--start-at", type=int, default=0)
    args = ap.parse_args()

    ingest.print_target()

    with open(args.chunks_file) as f:
        chunk_lines = [ln.strip() for ln in f if ln.strip()]
    chunks = [ln.split(",") for ln in chunk_lines]
    cross_check_idx = set(int(x) for x in args.cross_check.split(",") if x.strip())

    state = load_state()
    print(f"총 청크 {len(chunks)}개, 이미 완료: {sum(1 for v in state['chunks'].values() if v.get('done'))}")

    for i, corps in enumerate(chunks):
        if i < args.start_at:
            continue
        key = str(i)
        if state["chunks"].get(key, {}).get("done"):
            print(f"[청크 {i}] 이미 완료 — 건너뜀")
            continue

        print(f"\n===== 청크 {i+1}/{len(chunks)} (회사 {len(corps)}개) =====", flush=True)
        t_chunk0 = time.time()

        # 1) export (idempotent — 이미 같은 행수로 반출된 회사는 fin_storage.py 가 자체적으로 건너뜀)
        rc, dt_export = run_py(["export", "--corps", ",".join(corps)], timeout=1800)
        if rc != 0:
            print(f"[청크 {i}] export 실패 — 중단"); sys.exit(1)

        # 2) restore into staging
        rc, dt_restore = run_py(
            ["restore", "--corps", ",".join(corps), "--into", "financial_facts_restore_check"],
            timeout=1800)
        if rc != 0:
            print(f"[청크 {i}] restore 실패 — 중단"); sys.exit(1)

        # 3) 스테이징 크기 실측
        staging_bytes, staging_rows = check_staging_size()
        staging_mb = staging_bytes / 1024 / 1024
        print(f"[청크 {i}] 스테이징 크기: {staging_mb:.1f} MB ({staging_rows}행)", flush=True)
        if staging_bytes > 1024 * 1024 * 1024:
            print(f"!! 청크 {i} 스테이징이 1GB 초과({staging_mb:.1f}MB) — 즉시 중단, 청크 크기 재산정 필요")
            sys.exit(2)

        # 4) SQL 대칭차 대조
        sym_diff = symmetric_diff_check(corps)
        mismatches = row_count_mismatch_check(corps)
        sql_ok = (sym_diff == 0 and not mismatches)
        print(f"[청크 {i}] SQL 대칭차={sym_diff} 행수불일치회사={len(mismatches)}", flush=True)
        if mismatches:
            print(f"!!! 청크 {i} 행수 불일치: {mismatches}")

        # 5) 교차 확인(선택된 청크만): python 지문 경로
        python_result = None
        python_ok = True
        if i in cross_check_idx:
            rc, dt_verify = run_py(
                ["verify", "--corps", ",".join(corps), "--against", "financial_facts_restore_check"],
                timeout=1800)
            python_ok = (rc == 0)
            python_result = "OK(rc=0)" if python_ok else "MISMATCH(rc=%d)" % rc
            print(f"[청크 {i}] 교차확인(python 지문) 결과: {python_result}, SQL 결과 일치 여부: "
                  f"{'일치' if python_ok == sql_ok else '★불일치★ — 두 방법이 다른 답을 냄'}", flush=True)

        overall_ok = sql_ok and python_ok

        # 6) fin_archive 표시(교차확인 청크는 fin_storage.py verify 가 이미 표시했음 — 그래도
        #    SQL 결과가 pass 인데 python 경로를 안 돈 청크는 여기서 직접 표시)
        if overall_ok and i not in cross_check_idx:
            mark_verified(corps)
            print(f"[청크 {i}] fin_archive verified_status='verified' 로 표시 ({len(corps)}개사)")
        elif overall_ok and i in cross_check_idx:
            print(f"[청크 {i}] fin_archive 는 fin_storage.py verify 가 이미 표시함")
        else:
            print(f"!!! 청크 {i} 대조 실패(SQL={sql_ok}, python={python_ok}) — "
                  f"fin_archive 미표시, 스테이징 보존(조사 필요)")
            state["chunks"][key] = {
                "done": False, "corps": corps, "sym_diff": sym_diff,
                "mismatches": mismatches, "python_result": python_result,
                "note": "MISMATCH — 조사 필요, 스테이징 안 비움",
            }
            save_state(state)
            print("중단합니다 — 불일치를 먼저 조사하세요.")
            sys.exit(3)

        # 7) 스테이징 비우기
        truncate_staging()
        after_bytes, after_rows = check_staging_size()
        print(f"[청크 {i}] TRUNCATE 후 스테이징: {after_bytes} bytes, {after_rows}행")

        elapsed = time.time() - t_chunk0
        state["chunks"][key] = {
            "done": True, "corps_count": len(corps), "rows": staging_rows,
            "staging_mb": round(staging_mb, 1), "sym_diff": sym_diff,
            "cross_checked": i in cross_check_idx, "python_result": python_result,
            "elapsed_s": round(elapsed, 1),
            "export_s": round(dt_export, 1), "restore_s": round(dt_restore, 1),
            "finished_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        }
        save_state(state)
        print(f"[청크 {i}] 완료. 소요 {elapsed:.1f}s (export {dt_export:.1f}s, restore {dt_restore:.1f}s)",
              flush=True)

    print("\n전체 청크 처리 완료.")


if __name__ == "__main__":
    main()
