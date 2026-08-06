#!/usr/bin/env python3
"""filing_docs.storage_path(Storage 에 이미 올라간 공시 원문 zip) → filing_sections 추출.

**DART 호출 0건.** ingest.py load_docs() 가 공시 원문 zip 을 이미 Storage
(docs/<corp_code>/<rcept_no>.zip, 버킷 platform-raw)에 통째로 올려뒀다는 전제 위에서 동작한다
— 그래서 관심종목이 늘어도 이 스크립트만 다시 돌리면 되고, DART API 쿼터를 전혀 쓰지 않는다.

섹션 본문(filing_sections)은 전 종목이 아니라 **관심종목만** DB 에 넣는다(전 종목이면
공시 2,086,950건 × 평균 231.6KB ≈ 484GB 로 물리적으로 불가능하다, platform/로드맵.md 참고).
그래서 이 스크립트는 명시적으로 --corps 로 지정한 회사만 처리한다(전량 옵션 없음 — 의도적).

적재는 rcept_no 단위 스코프 교체(delete→insert) — ingest.load_docs() 가 예전에 쓰던
replace_scope("filing_sections", {"rcept_no": ...}) 와 같은 의미론이다.

사용법:
    python3 docs_storage.py sections --corps 00760971,00126380
    python3 docs_storage.py sections --corps 00760971 --force   # 이미 추출된 것도 재추출

전제: SUPABASE_REST_URL / SUPABASE_SERVICE_KEY (프로세스 환경 > 레포 루트 .env.local,
ingest.env_setting() 과 동일한 우선순위 — 이 스크립트가 직접 읽지 않고 ingest.py 를 그대로
쓴다). 대상 DB 는 명령 시작 전에 print_target() 이 소리내어 찍는다.

참고 구현: fin_storage.py(Storage 다운로드·재시도·서브커맨드 구조를 그대로 본떴다 — 그
파일 자체는 수정 대상이 아니다). 세션 추출 로직(dart_doc.split_sections 등)은 이전에
ingest.load_docs() 안에 있던 것을 그대로 옮겼다 — 매핑을 새로 짓지 않는다.
"""
import argparse
import datetime as dt
import io
import os
import sys
import zipfile

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO = os.path.dirname(os.path.dirname(_HERE))
sys.path.insert(0, _HERE)
sys.path.insert(0, os.path.join(_REPO, "plugin", "skills", "company-analysis", "scripts"))
import ingest      # noqa: E402  REST/SERVICE_KEY·rest()/upsert()/replace_scope()·Storage 헬퍼·재시도
import dart_doc     # noqa: E402  split_sections()·is_note_section()·is_biz_section() — 단일 소스


def _iso_now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


# ─────────────────────────────────────────────── 대상 조회

def pending_docs(corp_code, force):
    """이 회사의 filing_docs 중 Storage 원문이 있는(=Phase 3 로 이미 올라간) 행만 corp_code
    로 걸러 받는다. filing_docs 자체에는 corp_code 컬럼이 없다(rcept_no 로만 filings 를
    참조) — filings 를 통해 PostgREST 임베딩으로 조인해 거른다. ingest.load_docs() 가
    filing_docs 기존행을 거를 때 쓰는 것과 같은 패턴이고, 호스티드에서 실측 확인했다
    (filing_docs?select=...,filings!inner(corp_code)&filings.corp_code=eq.<code> → HTTP 200)."""
    force_filter = "" if force else "&sections_extracted_at=is.null"
    rows, offset = [], 0
    while True:
        page = ingest.rest("GET",
            "filing_docs?select=rcept_no,storage_path,status,filings!inner(corp_code)"
            "&filings.corp_code=eq.%s&status=eq.ok&storage_path=not.is.null%s"
            "&order=rcept_no&limit=1000&offset=%d" % (corp_code, force_filter, offset))
        rows.extend(page)
        if len(page) < 1000:
            break
        offset += 1000
    return rows


# ─────────────────────────────────────────────── 추출

def extract_one(row):
    """Storage 에서 zip 다운로드 → 대표 파일 압축 해제 → 섹션 분할 → filing_sections 스코프
    교체 → filing_docs.n_sections/sections_extracted_at 갱신. 반환: 추출된 섹션 수."""
    rcept = row["rcept_no"]
    status, data = ingest.storage_download(row["storage_path"])
    if status != 200:
        raise RuntimeError("Storage GET 실패 %s: %s"
                            % (status, (data[:200].decode("utf-8", "replace")
                                        if isinstance(data, bytes) else str(data)[:200])))
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        main_name = sorted(z.namelist())[0]
        raw = z.read(main_name)
    text = ingest.api.decode_kr(raw)  # dart_api.decode_kr — ingest.py 가 이미 `import dart_api as api`
    sections = dart_doc.split_sections(text)
    sec_rows = [{
        "rcept_no": rcept, "sec_no": n, "title": title[:300],
        "content": body[:5_000_000],
        "is_note": dart_doc.is_note_section(title),
        "is_biz": dart_doc.is_biz_section(title),
    } for n, (title, body) in enumerate(sections, 1)]
    ingest.replace_scope("filing_sections", {"rcept_no": "eq.%s" % rcept}, sec_rows)
    ingest.upsert("filing_docs", [{
        "rcept_no": rcept, "n_sections": len(sec_rows), "sections_extracted_at": _iso_now(),
    }], on_conflict="rcept_no")
    return len(sec_rows)


# ─────────────────────────────────────────────── 명령: sections

def cmd_sections(args):
    ingest.print_target()
    corps = [c.strip() for c in args.corps.split(",") if c.strip()]
    ok = failed = 0
    total_sections = 0
    for i, cc in enumerate(corps, 1):
        rows = pending_docs(cc, args.force)
        print("  [%d/%d] %s 대상 %d건" % (i, len(corps), cc, len(rows)), flush=True)
        for j, row in enumerate(rows, 1):
            try:
                n = extract_one(row)
                ok += 1
                total_sections += n
            except Exception as e:  # 개별 rcept_no 실패는 기록만 하고 계속(전체를 막지 않는다)
                failed += 1
                print("    ! %s 실패: %s" % (row["rcept_no"], str(e)[:200]))
            if j % 100 == 0:
                print("    …%d/%d (섹션 누적 %d)" % (j, len(rows), total_sections), flush=True)
    print("\n섹션 추출 완료: 성공 %d · 실패 %d · 섹션 %d (대상 회사 %d)"
          % (ok, failed, total_sections, len(corps)))
    return 1 if failed else 0


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("sections",
                       help="Storage 의 공시 원문 zip → filing_sections 추출 (DART 호출 0건)")
    s.add_argument("--corps", required=True, help="쉼표 구분 corp_code (관심종목만 — 전량 옵션 없음)")
    s.add_argument("--force", action="store_true", help="이미 추출된 rcept_no 도 재추출")
    s.set_defaults(func=cmd_sections)

    args = p.parse_args()
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
