"""공용 HTTP 헬퍼 — SSL 인증서 미설치 환경(macOS python.org 파이썬 등) 폴백 포함.

순수 표준 라이브러리. 스크립트들이 같은 디렉토리에서 import 한다.
"""
import os
import ssl
import sys
import urllib.request

_UA = "Mozilla/5.0 (investment-analyst-plugin)"
_CA_PATHS = ["/etc/ssl/cert.pem", "/etc/ssl/certs/ca-certificates.crt"]


def _contexts():
    yield None  # 기본 (인증서 정상 설치 환경)
    for p in _CA_PATHS:
        if os.path.exists(p):
            yield ssl.create_default_context(cafile=p)
    # 마지막 수단: 검증 생략 (공개 read-only 데이터 전용) — 경고를 남긴다
    ctx = ssl._create_unverified_context()
    ctx._insecure_fallback = True
    yield ctx


def http_get(url, timeout=20):
    """URL을 GET 해서 bytes 를 반환한다. SSL 인증서 문제는 시스템 CA → 비검증 순으로 폴백."""
    last_err = None
    for ctx in _contexts():
        try:
            req = urllib.request.Request(url, headers={"User-Agent": _UA})
            if ctx is None:
                data = urllib.request.urlopen(req, timeout=timeout).read()
            else:
                if getattr(ctx, "_insecure_fallback", False):
                    print("[경고] SSL 인증서 검증을 생략하고 요청함: %s" % url, file=sys.stderr)
                data = urllib.request.urlopen(req, timeout=timeout, context=ctx).read()
            return data
        except ssl.SSLError as e:
            last_err = e
            continue
        except urllib.error.URLError as e:
            if isinstance(getattr(e, "reason", None), ssl.SSLError):
                last_err = e
                continue
            raise
    raise last_err
