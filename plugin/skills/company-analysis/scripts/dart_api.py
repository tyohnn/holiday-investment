"""OpenDART API 클라이언트 + 엔드포인트 레지스트리 (순수 표준 라이브러리).

OpenDartReader(FinanceData)의 커버리지를 참조해 stdlib 로 재구현했다.
dart.py(CLI)가 import 한다. 모든 함수는 파싱된 JSON(list[dict]) 또는 bytes 를 반환한다.

레지스트리 구조 덕에 엔드포인트 추가는 한 줄이다. 응답 필드는 그대로 통과시키므로
(generic 렌더링) OpenDART 쪽 필드 변경에도 깨지지 않는다.
"""
import datetime as dt
import io
import json
import os
import re
import time
import urllib.parse
import xml.etree.ElementTree as ET
import zipfile

from _net import http_get

BASE = "https://opendart.fss.or.kr/api"
CACHE_DIR = os.path.expanduser("~/.cache/investment-analyst")
GLOBAL_ENV = os.path.expanduser("~/.config/investment-analyst/env")
_LAST_CALL = [0.0]


def read_env_file(path):
    """KEY=VALUE 파일 파서 (따옴표·공백·주석 허용)."""
    out = {}
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                out[k.strip()] = v.strip().strip("'\"")
    except OSError:
        pass
    return out


def resolve_key(cli_key=None):
    """키 탐색: --api-key > 환경변수 > ./.env.local > ./.env > ~/.config/investment-analyst/env"""
    if cli_key:
        return cli_key
    if os.environ.get("DART_API_KEY"):
        return os.environ["DART_API_KEY"]
    for path in (".env.local", ".env", GLOBAL_ENV):
        key = read_env_file(path).get("DART_API_KEY")
        if key:
            return key
    return None


class DartError(Exception):
    def __init__(self, status, message):
        self.status = status
        super().__init__("%s %s" % (status, message))


_DEFAULT_THROTTLE = float(os.environ.get("DART_MIN_INTERVAL", "0.15"))


def _throttle(min_interval=None):
    """호출 간 최소 간격. 기본 0.15초(분당 제한 대비 여유)지만, 환경변수
    DART_MIN_INTERVAL 로 늘릴 수 있다 — 일일 쿼터를 하루에 고르게 펴야 할 때 쓴다.

    실측(2026-08-23): 10키로 6시간에 256,248콜을 쓰자 21시부터 020(일일 쿼터 초과)이
    쏟아졌고, 소진된 키에 재시도가 몰리며 IP 차단까지 갔다. "키당 2만/일"이 실제로
    집행된다 — 속도가 아니라 **하루 총량**이 벽이다. 총량이 정해져 있으면 빨리 쓰고
    막히는 것보다 24시간에 펴는 쪽이 낫다(020 폭주와 그로 인한 IP 페널티를 피한다)."""
    if min_interval is None:
        min_interval = _DEFAULT_THROTTLE
    wait = _LAST_CALL[0] + min_interval - time.time()
    if wait > 0:
        time.sleep(wait)
    _LAST_CALL[0] = time.time()


def call_json(key, path, raw=False, **params):
    """상태 000이면 list(raw=True면 전체 dict), 013(데이터 없음)이면 []({}) 를 반환한다.

    raw=True 는 total_page 등 메타가 필요한 페이지네이션 호출에서 쓴다.
    """
    _throttle()
    params["crtfc_key"] = key
    url = "%s/%s?%s" % (BASE, path, urllib.parse.urlencode(params))
    d = json.loads(http_get(url).decode("utf-8"))
    status = d.get("status")
    if status == "000":
        return d if raw else d.get("list", [])
    if status == "013":
        return {} if raw else []
    raise DartError(status, d.get("message", ""))


def call_zip_raw(key, path, **params):
    """zip 응답의 원본 바이트를 압축 해제 없이 그대로 반환한다.

    call_zip() 이 이 위에 얹힌다 — 압축을 풀면서 원본 바이트를 버리면(이전 구현) Storage 에
    원문을 그대로 올려야 하는 호출부(ingest.py load_docs, P-A Phase 3)가 손해를 본다. 이
    함수는 그런 호출부를 위한 진입점이고, 기존 call_zip() 호출부는 아래에서 그대로 유지된다.
    """
    _throttle()
    params["crtfc_key"] = key
    url = "%s/%s?%s" % (BASE, path, urllib.parse.urlencode(params))
    return http_get(url, timeout=60)


class ZipFiles(dict):
    """call_zip() 의 반환값 — {파일명: bytes} dict 이면서, 원본 zip 전체 바이트를 .raw 에
    함께 싣는다. dict 서브클래스라 기존 호출부(sorted(files)·files[name]·len(files))는
    수정 없이 그대로 동작한다 — .raw 는 새 호출부(ingest.py load_docs)만 읽는다."""
    raw = b""


def call_zip(key, path, **params):
    """zip 응답(원본 문서·corpCode)을 {파일명: bytes} 로 반환한다(+ .raw 에 원본 zip 바이트).

    call_zip_raw() 로 원본 바이트를 받은 뒤 압축을 푼다 — 이렇게 하면 backfill.py 가
    monkeypatch 하는 대상(api.call_zip)이 그대로이므로, 재시도·쿼터 감지(backfill.py 의
    _patched_call_zip)가 이 함수를 쓰는 모든 호출부(load_corpcodes·document_raw·ingest.py
    load_docs 등)에 계속 적용된다.
    """
    raw = call_zip_raw(key, path, **params)
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            files = ZipFiles((n, z.read(n)) for n in z.namelist())
    except zipfile.BadZipFile:
        # zip 이 아니면 오류 응답 — XML 본문에서 status 를 뽑아 그 코드로 던진다.
        #
        # ★ 예전엔 무조건 status="ZIP" 으로 던져서, 020(사용한도 초과)이 쿼터 소진으로
        #   인식되지 못했다. backfill 의 _run_with_retry 는 status 를 보고 QuotaExhausted
        #   로 승격하는데 "ZIP" 은 그 분기를 못 타고, load_docs 는 그걸 "원문 없는 공시"
        #   취급해 실패 기록만 남기고 계속 때렸다 — 한도에 닿은 키로 020 을 수만 건
        #   쌓다가 IP 차단까지 간 경로가 이것이다(2026-08-23·24·25 실측).
        body = raw[:300].decode("utf-8", "replace")
        m = re.search(r"<status>\s*(\d+)\s*</status>", body)
        raise DartError(m.group(1) if m else "ZIP", body)
    files.raw = raw
    return files


# ---------------------------------------------------------------- corp codes

def load_corpcodes(key):
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache = os.path.join(CACHE_DIR, "corpcode.xml")
    if not (os.path.exists(cache) and
            dt.datetime.now().timestamp() - os.path.getmtime(cache) < 30 * 86400):
        files = call_zip(key, "corpCode.xml")
        xml_bytes = files[sorted(files)[0]]
        with open(cache, "wb") as f:
            f.write(xml_bytes)
    return ET.parse(cache).getroot()


def find_corp(key, name):
    """상장사(종목코드 보유) 이름 일치 → 부분 일치 순. (corp, 후보들) 반환."""
    root = load_corpcodes(key)
    name_norm = name.replace(" ", "")
    exact, partial = [], []
    for el in root.iter("list"):
        cname = (el.findtext("corp_name") or "").strip()
        stock = (el.findtext("stock_code") or "").strip()
        if not stock:
            continue
        item = {"corp_code": el.findtext("corp_code"), "corp_name": cname, "stock_code": stock}
        cnorm = cname.replace(" ", "")
        if cnorm == name_norm or stock == name_norm:
            exact.append(item)
        elif name_norm in cnorm:
            partial.append(item)
    if exact:
        return exact[0], exact + partial
    if len(partial) == 1:
        return partial[0], partial
    return None, partial


# ------------------------------------------------------------- 레지스트리

REPRT = {"연간": "11011", "1Q": "11013", "반기": "11012", "3Q": "11014"}

# 정기보고서 주요정보 (DS002): 항목명 → (API 경로, 방법론 메모)
REPORT_ITEMS = {
    "배당": ("alotMatter.json", "배당 성향·수익률 — 판정 참고"),
    "증자": ("irdsSttus.json", "증자(감자) 이력 — 지분 희석"),
    "자기주식": ("tesstkAcqsDspsSttus.json", "자사주 취득·처분 현황"),
    "최대주주": ("hyslrSttus.json", "지배구조 — 오너 지분"),
    "최대주주변동": ("hyslrChgSttus.json", "지배구조 변동 이력"),
    "소액주주": ("mrhlSttus.json", "유통 물량 감각"),
    "임원": ("exctvSttus.json", "친인척 임원 유입 점검(문화 3신호)"),
    "직원": ("empSttus.json", "인원·평균연봉 — 문화 판별 대용 지표"),
    "임원전체보수": ("hmvAuditAllSttus.json", "보수 총액"),
    "개인별보수": ("indvdlByPay.json", "5억 이상 개인별 보수"),
    "타법인출자": ("otrCprInvstmntSttus.json", "지주·SOTP 계산 입력 — 투자자산의 정형 부분"),
    "감사의견": ("accnutAdtorNmNdAdtOpinion.json", "감사인·감사의견 — 비적정이면 즉시 경계"),
    # ↓ 풀 커버리지 확장 (2026-07-25) — 부채 만기 구조·자금 사용처(사풍 검증)·감사 계약
    "조건부자본증권미상환": ("cndlCaplScritsNrdmpBlce.json", "조건부자본증권 잔액"),
    "회사채미상환": ("cprndNrdmpBlce.json", "회사채 잔액 — 부채 만기 구조"),
    "단기사채미상환": ("srtpdPsndbtNrdmpBlce.json", "단기사채 잔액"),
    "기업어음미상환": ("entrprsBilScritsNrdmpBlce.json", "기업어음 잔액"),
    "채무증권발행실적": ("detScritsIsuAcmslt.json", "채무증권 발행 이력"),
    "사모자금사용": ("prvsrpCptalUseDtls.json", "사모 조달자금 사용내역 — 발표 vs 실사용(사풍)"),
    "공모자금사용": ("pssrpCptalUseDtls.json", "공모 조달자금 사용내역 — 발표 vs 실사용(사풍)"),
    "미등기임원보수": ("unrstExctvMendngSttus.json", "미등기임원 보수"),
    "사외이사변동": ("outcmpnyDrctrNdChangeSttus.json", "사외이사 구성·변동"),
    "감사용역계약": ("adtServcCnclsSttus.json", "감사 보수·시간"),
    "비감사용역계약": ("accnutAdtorNonAdtServcCnclsSttus.json", "감사인 비감사용역 — 독립성 점검"),
}

# 주요사항보고서 (DS005): 항목명 → API 경로. 풀 커버리지 (2026-07-25 확장, 36종).
EVENT_ITEMS = {
    "유상증자결정": "piicDecsn.json",
    "무상증자결정": "fricDecsn.json",
    "유무상증자결정": "pifricDecsn.json",
    "감자결정": "crDecsn.json",
    "전환사채발행결정": "cvbdIsDecsn.json",
    "신주인수권부사채발행결정": "bdwtIsDecsn.json",
    "교환사채발행결정": "exbdIsDecsn.json",
    "자기주식취득결정": "tsstkAqDecsn.json",
    "자기주식처분결정": "tsstkDpDecsn.json",
    "소송제기": "lwstLg.json",
    # 자기주식 신탁
    "자기주식신탁계약체결결정": "tsstkAqTrctrCnsDecsn.json",
    "자기주식신탁계약해지결정": "tsstkAqTrctrCcDecsn.json",
    # 영업·자산 양수도
    "영업양수결정": "bsnInhDecsn.json",
    "영업양도결정": "bsnTrfDecsn.json",
    "유형자산양수결정": "tgastInhDecsn.json",
    "유형자산양도결정": "tgastTrfDecsn.json",
    "타법인주식양수결정": "otcprStkInvscrInhDecsn.json",
    "타법인주식양도결정": "otcprStkInvscrTrfDecsn.json",
    "주권관련사채권양수결정": "stkrtbdInhDecsn.json",
    "주권관련사채권양도결정": "stkrtbdTrfDecsn.json",
    "자산양수도기타풋백옵션": "astInhtrfEtcPtbkOpt.json",
    # 구조 개편
    "회사합병결정": "cmpMgDecsn.json",
    "회사분할결정": "cmpDvDecsn.json",
    "회사분할합병결정": "cmpDvmgDecsn.json",
    "주식교환이전결정": "stkExtrDecsn.json",
    # 위기 신호
    "부도발생": "dfOcr.json",
    "영업정지": "bsnSp.json",
    "회생절차개시신청": "ctrcvsBgrq.json",
    "해산사유발생": "dsRsOcr.json",
    "채권은행관리절차개시": "bnkMngtPcbg.json",
    "채권은행관리절차중단": "bnkMngtPcsp.json",
    # 해외 상장
    "해외상장결정": "ovLstDecsn.json",
    "해외상장폐지결정": "ovDlstDecsn.json",
    "해외상장": "ovLst.json",
    "해외상장폐지": "ovDlst.json",
}

# 증권신고서 (DS006): 항목명 → API 경로. 유증·합병의 상세 조건 (지분 희석 분석 직결).
REGISTRATION_ITEMS = {
    "지분증권": "estkRs.json",
    "채무증권": "bdRs.json",
    "합병": "mgRs.json",
    "분할": "dvRs.json",
    "주식교환이전": "extrRs.json",
    "증권예탁증권": "stkdpRs.json",
}

# 재무지표 (fnlttSinglIndx) 분류코드
INDEX_CLASSES = {"수익성": "M210000", "안정성": "M220000", "성장성": "M230000", "활동성": "M240000"}


# ------------------------------------------------------------- 고수준 호출

def company(key, corp_code):
    # company.json 은 list 없이 최상위 필드로 응답한다 → raw 로 dict 전체를 받는다
    d = call_json(key, "company.json", raw=True, corp_code=corp_code)
    return d if isinstance(d, dict) else {}


def filings(key, corp_code, days):
    end = dt.date.today()
    bgn = end - dt.timedelta(days=days)
    rows, page = [], 1
    while True:
        d = call_json(key, "list.json", raw=True, corp_code=corp_code,
                      bgn_de=bgn.strftime("%Y%m%d"), end_de=end.strftime("%Y%m%d"),
                      page_no=page, page_count=100)
        if not d:
            break  # 013 데이터 없음
        rows.extend(d.get("list", []))
        if page >= int(d.get("total_page", 1) or 1):
            break
        page += 1
    return rows, bgn, end


def finstate_all(key, corp_code, year, reprt="11011", fs_div="CFS"):
    """전 계정 재무제표. fs_div 는 요청 파라미터일 뿐 응답에는 없으므로 필터에 쓰지 않는다.

    연결(CFS)이 없으면 별도(OFS)로 폴백한다. 반환: (rows, 실제사용_fs_div)
    """
    rows = call_json(key, "fnlttSinglAcntAll.json", corp_code=corp_code,
                     bsns_year=str(year), reprt_code=reprt, fs_div=fs_div)
    if not rows and fs_div == "CFS":
        rows = call_json(key, "fnlttSinglAcntAll.json", corp_code=corp_code,
                         bsns_year=str(year), reprt_code=reprt, fs_div="OFS")
        return rows, "OFS"
    return rows, fs_div


def indicators(key, corp_code, year, reprt="11011"):
    out = {}
    for label, code in INDEX_CLASSES.items():
        rows = call_json(key, "fnlttSinglIndx.json", corp_code=corp_code,
                         bsns_year=str(year), reprt_code=reprt, idx_cl_code=code)
        if rows:
            out[label] = rows
    return out


def report_item(key, corp_code, item, year, reprt="11011"):
    path, _memo = REPORT_ITEMS[item]
    return call_json(key, path, corp_code=corp_code, bsns_year=str(year), reprt_code=reprt)


def events(key, corp_code, days):
    end = dt.date.today()
    bgn = end - dt.timedelta(days=days)
    out = {}
    for label, path in EVENT_ITEMS.items():
        try:
            rows = call_json(key, path, corp_code=corp_code,
                             bgn_de=bgn.strftime("%Y%m%d"), end_de=end.strftime("%Y%m%d"))
        except DartError:
            continue  # 일부 항목 미지원 기업 — 조용히 넘어간다
        if rows:
            out[label] = rows
    return out


def registrations(key, corp_code, days):
    """증권신고서(DS006) — 응답이 group 배열로 묶여 오는 경우를 평탄화한다."""
    end = dt.date.today()
    bgn = end - dt.timedelta(days=days)
    out = {}
    for label, path in REGISTRATION_ITEMS.items():
        try:
            d = call_json(key, path, raw=True, corp_code=corp_code,
                          bgn_de=bgn.strftime("%Y%m%d"), end_de=end.strftime("%Y%m%d"))
        except DartError:
            continue
        if not d:
            continue
        rows = list(d.get("list", []))
        for g in d.get("group", []):
            title = g.get("title", "")
            for r in g.get("list", []):
                r = dict(r)
                r["_group"] = title
                rows.append(r)
        if rows:
            out[label] = rows
    return out


def ownership(key, corp_code):
    out = {}
    try:
        rows = call_json(key, "majorstock.json", corp_code=corp_code)
        if rows:
            out["대량보유(5%)"] = rows
    except DartError:
        pass
    try:
        rows = call_json(key, "elestock.json", corp_code=corp_code)
        if rows:
            out["임원·주요주주 소유보고"] = rows
    except DartError:
        pass
    return out


def document(key, rcept_no):
    """공시 원본(zip) → 파일명 오름차순 첫 문서의 텍스트. (제목 추출은 dart.py 몫)"""
    name, raw = document_raw(key, rcept_no)
    return name, decode_kr(raw)


def document_raw(key, rcept_no):
    """공시 원본(zip)의 대표 파일을 (파일명, bytes) 로 반환. 전체가 필요하면 call_zip 직접."""
    files = call_zip(key, "document.xml", rcept_no=rcept_no)
    name = sorted(files)[0]
    return name, files[name]


def decode_kr(raw):
    for enc in ("utf-8", "cp949", "euc-kr"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "replace")


def latest_periodic(key, corp_code, kinds=("사업보고서", "반기보고서", "분기보고서")):
    """최근 2년 정기공시에서 kinds 우선순위로 최신 보고서를 찾는다. (rcept_no, report_nm)"""
    end = dt.date.today()
    bgn = end - dt.timedelta(days=730)
    rows = call_json(key, "list.json", corp_code=corp_code, pblntf_ty="A",
                     bgn_de=bgn.strftime("%Y%m%d"), end_de=end.strftime("%Y%m%d"),
                     page_no=1, page_count=100)
    for kind in kinds:
        for r in rows:  # list API는 최신순
            if kind in r.get("report_nm", ""):
                return r.get("rcept_no"), r.get("report_nm")
    return None, None
