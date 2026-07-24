"""기업/산업별 manifest.json — 수집·분석 이력의 단일 상태 파일 (순수 stdlib).

왜 필요한가:
  1. 증분 수집 — 공시 최종접수번호를 기억해 다음엔 그 이후만 가져온다 (트래커의 전제)
  2. 정정 감지 — 사업연도별 접수번호가 바뀌면 기재정정이다. 어느 해가 정정됐는지 특정된다
  3. 추정의 갱신 — 과거 분석의 적정주가·진입가·판정을 갖고 있어 "무엇이 왜 달라졌나"를 쓴다
  4. 재수집 판단 — 파일 mtime이 아니라 명시적 커버기간으로 판정한다

위치: <리서치>/기업/<종목>/manifest.json (자료/ 의 형제)
"""
import datetime as dt
import json
import os

FILENAME = "manifest.json"


def path_for(root):
    return os.path.join(root, FILENAME)


def find_root(any_path):
    """자료/ 하위 경로에서 기업 루트(자료의 부모)를 찾는다. 못 찾으면 None."""
    p = os.path.abspath(any_path)
    if os.path.isfile(p):
        p = os.path.dirname(p)
    for _ in range(6):
        if os.path.basename(p) == "자료":
            return os.path.dirname(p)
        if os.path.exists(os.path.join(p, FILENAME)):
            return p
        parent = os.path.dirname(p)
        if parent == p:
            break
        p = parent
    return None


def load(root):
    try:
        with open(path_for(root), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


def save(root, data):
    os.makedirs(root, exist_ok=True)
    data["최종갱신"] = dt.date.today().isoformat()
    with open(path_for(root), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return path_for(root)


def identity(data, corp, profile=None):
    """종목 식별 정보를 기록한다 (매번 재조회하지 않도록 캐시)."""
    data["종목"] = corp["corp_name"]
    data["티커"] = corp["stock_code"]
    data["corp_code"] = corp["corp_code"]
    if profile and isinstance(profile, dict):
        cls = {"Y": "KOSPI", "K": "KOSDAQ", "N": "KONEX"}.get(profile.get("corp_cls"))
        if cls:
            data["시장"] = cls
        for src, dst in [("induty_code", "업종코드"), ("acc_mt", "결산월"),
                         ("est_dt", "설립일"), ("ceo_nm", "대표자")]:
            if profile.get(src):
                data[dst] = profile[src]
    return data


def record(data, key, info):
    """수집 항목 하나를 기록한다. info 에 최종수집일을 자동으로 붙인다."""
    data.setdefault("수집", {})
    info = dict(info)
    info["최종수집"] = dt.date.today().isoformat()
    data["수집"][key] = info
    return data


def detect_amendments(data, year_to_rcept, label="재무제표"):
    """사업연도별 접수번호를 비교해 기재정정을 감지하고 정정이력에 남긴다.

    year_to_rcept: {"2024": "20250314000123", ...}
    반환: 새로 감지된 정정 목록
    """
    prev = (data.get("수집", {}).get("재무", {}) or {}).get("연도별접수번호", {})
    found = []
    for year, rcept in sorted(year_to_rcept.items()):
        old = prev.get(year)
        if old and rcept and old != rcept:
            entry = {"감지일": dt.date.today().isoformat(),
                     "대상": "%s %s" % (label, year),
                     "이전접수번호": old, "새접수번호": rcept,
                     "메모": "기재정정 — 해당 연도 수치가 바뀌었을 수 있다. 원문 대조 필요"}
            data.setdefault("정정이력", []).append(entry)
            found.append(entry)
    return found


def record_analysis(root, entry):
    """분석 리포트 1건을 이력에 추가한다 (같은 일자·모드면 교체)."""
    data = load(root)
    hist = data.setdefault("분석", [])
    hist[:] = [h for h in hist
               if not (h.get("일자") == entry.get("일자") and h.get("모드") == entry.get("모드"))]
    hist.append(entry)
    hist.sort(key=lambda h: (h.get("일자", ""), h.get("모드", "")))
    save(root, data)
    return data


def record_tracking(root, 주제, 파일, 줄수=None):
    """트래킹 문서 1건을 등록·갱신한다."""
    data = load(root)
    items = data.setdefault("트래킹", [])
    items[:] = [t for t in items if t.get("파일") != 파일]
    entry = {"주제": 주제, "파일": 파일, "최종갱신": dt.date.today().isoformat()}
    if 줄수 is not None:
        entry["줄수"] = 줄수
    items.append(entry)
    items.sort(key=lambda t: t.get("파일", ""))
    save(root, data)
    return data
