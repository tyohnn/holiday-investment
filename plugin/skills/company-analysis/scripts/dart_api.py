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


def _throttle(min_interval=0.15):
    """분당 1,000회 제한에 한참 못 미치게 예의상 간격을 둔다."""
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


def call_zip(key, path, **params):
    """zip 응답(원본 문서·corpCode)을 {파일명: bytes} 로 반환한다."""
    _throttle()
    params["crtfc_key"] = key
    url = "%s/%s?%s" % (BASE, path, urllib.parse.urlencode(params))
    raw = http_get(url, timeout=60)
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            return {n: z.read(n) for n in z.namelist()}
    except zipfile.BadZipFile:
        # zip 이 아니면 오류 응답 — 메시지를 그대로 올린다
        raise DartError("ZIP", raw[:300].decode("utf-8", "replace"))


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
}

# 주요사항보고서 (DS005): 항목명 → API 경로. 자금조달·지배구조 이벤트 중심.
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
