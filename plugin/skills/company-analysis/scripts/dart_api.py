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
_LAST_CALL = [0.0]


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


def call_json(key, path, **params):
    """상태 000이면 list(또는 전체 dict), 013(데이터 없음)이면 [] 를 반환한다."""
    _throttle()
    params["crtfc_key"] = key
    url = "%s/%s?%s" % (BASE, path, urllib.parse.urlencode(params))
    d = json.loads(http_get(url).decode("utf-8"))
    status = d.get("status")
    if status == "000":
        return d.get("list", d)
    if status == "013":
        return []
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
    "타법인출자": ("otrCprInvstmntSttus.json", "지주·SOTP 계산 입력"),
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
    return call_json(key, "company.json", corp_code=corp_code)


def filings(key, corp_code, days):
    end = dt.date.today()
    bgn = end - dt.timedelta(days=days)
    rows, page = [], 1
    while True:
        d = call_json(key, "list.json", corp_code=corp_code,
                      bgn_de=bgn.strftime("%Y%m%d"), end_de=end.strftime("%Y%m%d"),
                      page_no=page, page_count=100)
        if isinstance(d, list):
            break  # 013
        rows.extend(d.get("list", []))
        if page >= int(d.get("total_page", 1)):
            break
        page += 1
    return rows, bgn, end


def finstate_all(key, corp_code, year, reprt="11011", fs_div="CFS"):
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
    files = call_zip(key, "document.xml", rcept_no=rcept_no)
    name = sorted(files)[0]
    raw = files[name]
    for enc in ("utf-8", "cp949", "euc-kr"):
        try:
            return name, raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return name, raw.decode("utf-8", "replace")
