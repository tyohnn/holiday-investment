#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cursor Cloud Runtime Secrets → gitignored .env.local.

세션 시작 때 환경변수로 주입된 시크릿을 레포가 기대하는 두 파일에 쓴다.

  <repo>/.env.local              ingest.py · backfill.py · dart_api.py
  <repo>/apps/web/.env.local     db.ts · screen.py · 런북 grep

값은 절대 출력하지 않는다. 이미 있는 다른 키는 보존하고, 같은 키만 교체한다.

Cursor Secrets 탭에 넣을 이름 (타입이 Runtime Secret):

  DART_API_KEYS                 10개를 쉼표로 이은 한 줄  (권장)
  DART_API_KEY_1 .. _10         위가 없을 때 번호로 모은다
  DART_API_KEY                  단일 키 폴백 (dart_api.py)
  SUPABASE_REST_URL             https://<ref>.supabase.co/rest/v1
  SUPABASE_SERVICE_KEY          서비스 롤 (없으면 REST 만 기록)
  NEXT_PUBLIC_SUPABASE_URL      없으면 REST 호스트에서 유도
  TOSS_INVESTMENT_API_KEY
  TOSS_INVESTMENT_API_SECRET
"""
from __future__ import annotations

import argparse
import os
import re
import stat
import sys

REDACTED = re.compile(r"^\[REDACTED\]$", re.I)
REST_SUFFIX = "/rest/v1"


def _repo_root():
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(here, ".."))


def _clean(value):
    if value is None:
        return None
    v = str(value).strip().strip("\"'")
    if not v or REDACTED.match(v):
        return None
    return v


def _env(name):
    return _clean(os.environ.get(name))


def dart_keys():
    """DART_API_KEYS(쉼표) > DART_API_KEY_1..10 > DART_API_KEY."""
    raw = _env("DART_API_KEYS")
    if raw:
        return [k.strip() for k in raw.split(",") if k.strip() and not REDACTED.match(k.strip())]
    numbered = []
    for i in range(1, 11):
        k = _env("DART_API_KEY_%d" % i) or _env("DART_API_KEYS_%d" % i)
        if k:
            numbered.append(k)
    if numbered:
        return numbered
    single = _env("DART_API_KEY")
    return [single] if single else []


def supabase_urls():
    rest = _env("SUPABASE_REST_URL")
    public = _env("NEXT_PUBLIC_SUPABASE_URL")
    if rest:
        rest = rest.rstrip("/")
        if not rest.endswith(REST_SUFFIX):
            rest = rest + REST_SUFFIX
        if not public:
            public = rest[: -len(REST_SUFFIX)] or None
    elif public:
        public = public.rstrip("/")
        rest = public + REST_SUFFIX
    return rest, public


def collect():
    """기록할 KEY=VALUE. 값이 있는 것만."""
    out = {}
    keys = dart_keys()
    if keys:
        out["DART_API_KEYS"] = ",".join(keys)
        out["DART_API_KEY"] = keys[0]
    rest, public = supabase_urls()
    if rest:
        out["SUPABASE_REST_URL"] = rest
    if public:
        out["NEXT_PUBLIC_SUPABASE_URL"] = public
    svc = _env("SUPABASE_SERVICE_KEY")
    if svc:
        out["SUPABASE_SERVICE_KEY"] = svc
    for name in ("TOSS_INVESTMENT_API_KEY", "TOSS_INVESTMENT_API_SECRET"):
        v = _env(name)
        if v:
            out[name] = v
    return out, len(keys)


def upsert(path, mapping):
    lines = []
    seen = set()
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            for line in f:
                raw = line.rstrip("\n")
                if not raw.strip() or raw.lstrip().startswith("#") or "=" not in raw:
                    lines.append(raw)
                    continue
                key = raw.split("=", 1)[0].strip()
                if key in mapping:
                    lines.append("%s=%s" % (key, mapping[key]))
                    seen.add(key)
                else:
                    lines.append(raw)
    for key, value in mapping.items():
        if key not in seen:
            lines.append("%s=%s" % (key, value))
    text = "\n".join(lines)
    if text and not text.endswith("\n"):
        text += "\n"
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(text)
    os.chmod(tmp, stat.S_IRUSR | stat.S_IWUSR)
    os.replace(tmp, path)
    os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--root", default=_repo_root(), help="레포 루트")
    p.add_argument("--strict", action="store_true",
                   help="필수 키가 없으면 exit 1 (start 기본은 경고만)")
    args = p.parse_args()
    mapping, n_dart = collect()
    targets = [
        os.path.join(args.root, ".env.local"),
        os.path.join(args.root, "apps", "web", ".env.local"),
    ]
    if mapping:
        for path in targets:
            upsert(path, mapping)
    written = sorted(mapping)
    missing = [name for name in (
        "DART_API_KEYS", "SUPABASE_REST_URL",
        "TOSS_INVESTMENT_API_KEY", "TOSS_INVESTMENT_API_SECRET",
    ) if name not in mapping]
    # DART 는 번호 키로도 채워질 수 있음
    if n_dart:
        missing = [m for m in missing if m != "DART_API_KEYS"]
    print("sync-runtime-env: wrote %s → %s" % (
        ",".join(written) or "(nothing)",
        " ".join(os.path.relpath(t, args.root) for t in targets)))
    if n_dart:
        print("sync-runtime-env: DART keys %d" % n_dart)
    if missing:
        print("sync-runtime-env: missing %s" % ",".join(missing), file=sys.stderr)
        if args.strict:
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
