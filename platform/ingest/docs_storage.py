#!/usr/bin/env python3
"""filing_docs.storage_path(Storage 에 이미 올라간 공시 원문 zip) → 섹션 추출 → Storage 객체.

**DART 호출 0건.** ingest.py load_docs() 가 공시 원문 zip 을 이미 Storage
(docs/<corp_code>/<rcept_no>.zip, 버킷 platform-raw)에 통째로 올려뒀다는 전제 위에서 동작한다
— 그래서 관심종목이 늘어도 이 스크립트만 다시 돌리면 되고, DART API 쿼터를 전혀 쓰지 않는다.

섹션 본문은 Postgres(filing_sections)가 아니라 **Storage 객체**
(docs/<corp_code>/<rcept_no>.sections.json.gz, 버킷 platform-raw)로 낸다. 실측 세 가지가
근거다: ① 전 종목이면 484GB(공시 2,086,950건 × 평균 231.6KB) ② fs_content_trgm GIN
인덱스가 본문의 1.9배(912kB→1,744kB) ③ 삼성 10,019건 중 섹션이 의미 있는 정기보고서는
109건(1.1%)뿐 — 나머지는 목차 없는 단문 공시라 "전체" 한 덩어리로만 나온다.

그래서 이 스크립트는 두 겹으로 좁힌다: ① 명시적으로 --corps 로 지정한 회사만(전량 옵션
없음 — 의도적) ② 그 회사 중에서도 **정기보고서(사업/분기/반기보고서)만** — filings.report_nm
에 그 세 단어 중 하나를 포함하는 행만 대상으로 잡는다(비정기 공시는 애초에 목차가 없어
"전체" 한 섹션으로만 나오므로 굳이 Storage 객체를 만들 실익이 없다).

출력은 rcept_no 당 객체 하나를 통째로 덮어쓴다(Storage PUT 이 곧 멱등 교체 —
Postgres 의 delete→insert 스코프 교체와 같은 의미론).

사용법:
    python3 docs_storage.py sections --corps 00760971,00126380
    python3 docs_storage.py sections --corps 00760971 --force   # 이미 추출된 것도 재추출

전제: SUPABASE_REST_URL / SUPABASE_SERVICE_KEY (프로세스 환경 > 레포 루트 .env.local,
ingest.env_setting() 과 동일한 우선순위 — 이 스크립트가 직접 읽지 않고 ingest.py 를 그대로
쓴다). 대상 DB 는 명령 시작 전에 print_target() 이 소리내어 찍는다.

참고 구현: fin_storage.py(Storage 업로드·재시도·서브커맨드 구조, gzip JSON 객체 패턴을 그대로
본떴다 — 그 파일 자체는 수정 대상이 아니다). ingest.storage_upload()/storage_http_retry() 를
그대로 재사용한다(재발명 금지). 섹션 추출 로직(dart_doc.split_sections 등)은 이전에
ingest.load_docs() 안에 있던 것을 그대로 옮겼다 — 매핑을 새로 짓지 않는다.
"""
import argparse
import datetime as dt
import gzip
import io
import json
import os
import sys
import zipfile

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO = os.path.dirname(os.path.dirname(_HERE))
sys.path.insert(0, _HERE)
sys.path.insert(0, os.path.join(_REPO, "plugin", "skills", "company-analysis", "scripts"))
import ingest      # noqa: E402  REST/SERVICE_KEY·rest()/upsert()/Storage 헬퍼·재시도
import dart_doc     # noqa: E402  split_sections()·is_note_section()·is_biz_section() — 단일 소스

# 정기보고서만 대상으로 잡는다 — DART report_nm 에 이 중 하나를 포함하는 공시만
# (예: "사업보고서 (2025.12)", "분기보고서 (2026.03)", "[기재정정]반기보고서 (2025.06)").
# DB 쿼리(or=... ilike 임베디드 필터)로 거르면 statement timeout 이 나서(아래 pending_docs
# 참고) Python 쪽에서 거른다 — urllib.parse 는 더 이상 이 필터 조립에 쓰이지 않는다.
_REGULAR_REPORT_TERMS = ("사업보고서", "분기보고서", "반기보고서")


def _iso_now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


# ─────────────────────────────────────────────── 대상 조회

def pending_docs(corp_code, force):
    """이 회사의 filing_docs 중 Storage 원문이 있는(=Phase 3 로 이미 올라간) **정기보고서**
    행만 받는다. filing_docs 자체에는 corp_code·report_nm 컬럼이 없다.

    2026-08-26: 임베디드 `filings!inner(...)` 조인은 공시가 많은 회사(삼성증권 00104856 등)에서
    PostgREST statement timeout 이 난다. filings 를 corp_code 로 페이지한 뒤 rcept_no in (...)
    으로 filing_docs 를 받는 두 단계로 바꾼다 — 조인 없이 동등비교만 쓴다.
    report_nm 필터는 계속 Python 쪽에서 건다."""
    periodic = []
    offset = 0
    while True:
        page = ingest.rest("GET",
            "filings?select=rcept_no,report_nm&corp_code=eq.%s"
            "&order=rcept_no&limit=1000&offset=%d" % (corp_code, offset))
        if not page:
            break
        for r in page:
            nm = r.get("report_nm") or ""
            if any(term in nm for term in _REGULAR_REPORT_TERMS) and "제출기한연장" not in nm:
                periodic.append(r)
        if len(page) < 1000:
            break
        offset += 1000
    if not periodic:
        return []

    wanted = {r["rcept_no"]: r["report_nm"] for r in periodic}
    docs, offset = [], 0
    rcepts = list(wanted)
    # PostgREST in() 는 URL 길이 한도가 있어 200개씩 끊는다.
    for i in range(0, len(rcepts), 200):
        chunk = rcepts[i:i + 200]
        force_filter = "" if force else "&sections_extracted_at=is.null"
        page = ingest.rest("GET",
            "filing_docs?select=rcept_no,storage_path,status"
            "&rcept_no=in.(%s)&status=eq.ok&storage_path=not.is.null%s"
            "&limit=200" % (",".join(chunk), force_filter))
        for d in page or []:
            d["filings"] = {"corp_code": corp_code, "report_nm": wanted.get(d["rcept_no"], "")}
            docs.append(d)
    return docs


# ─────────────────────────────────────────────── 추출

def extract_one(row, corp_code):
    """Storage 에서 원문 zip 다운로드 → 대표 파일 압축 해제 → 섹션 분할 → 섹션 배열을
    gzip JSON 으로 Storage 에 업로드(docs/<corp_code>/<rcept_no>.sections.json.gz, PUT 자체가
    멱등 교체) → filing_docs.n_sections/sections_extracted_at 갱신. 반환: 추출된 섹션 수.

    필드명·content 형식(마크다운 텍스트, 표는 `| … |` 행)은 기존 filing_sections 테이블
    스키마와 동일하게 유지한다 — apps/web 의 렌더러(filing-section-md.tsx)와
    packages/schema 의 FilingSection 이 그 형식에 의존하므로, 여기서 새 포맷을 발명하면
    웹 쪽을 함께 고쳐야 하는데 그건 이 스크립트의 책임이 아니다(AGENTS.md 설계 제약)."""
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

    payload = json.dumps(sec_rows, ensure_ascii=False).encode("utf-8")
    gz = gzip.compress(payload, compresslevel=9, mtime=0)
    obj_path = "docs/%s/%s.sections.json.gz" % (corp_code, rcept)
    up_status, up_text = ingest.storage_upload(obj_path, gz, "application/gzip")
    if up_status not in (200, 201):
        raise RuntimeError("Storage 업로드 실패 %s: %s" % (up_status, str(up_text)[:300]))

    # sections_extracted_at 은 "이 rcept_no 에서 섹션 추출을 실행한 시각" 이라는 기존 의미를
    # 그대로 쓴다 — 저장 위치가 테이블에서 Storage 객체로 바뀌었을 뿐 실행 여부·시각의
    # 의미는 그대로다. --force 없이 재실행할 때 이미 처리한 rcept_no 를 건너뛰는 것도
    # 여전히 이 컬럼이 한다(pending_docs 의 force_filter). n_sections 도 같은 이유로 유지.
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
        try:
            rows = pending_docs(cc, args.force)
        except Exception as e:  # 회사 하나의 조회 실패(예: PostgREST statement timeout)로
            # 워커 전체가 죽어 남은 회사를 통째로 잃는 것을 막는다 — 2026-08-25 실측
            # (368개사 병렬 배치 중 8워커 중 5개가 이걸로 죽었다). 기록하고 다음 회사로.
            failed += 1
            print("  [%d/%d] %s 대상 조회 실패, 건너뜀: %s" % (i, len(corps), cc, str(e)[:200]),
                  flush=True)
            continue
        print("  [%d/%d] %s 대상 %d건" % (i, len(corps), cc, len(rows)), flush=True)
        for j, row in enumerate(rows, 1):
            try:
                n = extract_one(row, cc)
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
