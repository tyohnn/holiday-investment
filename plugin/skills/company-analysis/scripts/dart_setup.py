"""DART API 키 저장 도우미 — 채팅 붙여넣기(주 경로)와 로컬 HTML 폼(대안) 둘 다 지원.

키는 비밀이므로 원칙을 지킨다:
  - 파일 권한 600 (소유자만 읽기)
  - .gitignore 에 .env.local 자동 등록 (커밋 사고 방지)
  - 저장 확인 출력에는 키를 마스킹해서 보여준다
  - 폼 서버는 127.0.0.1 에만 바인드하고, 1회 제출 후 즉시 종료한다
"""
import http.server
import json
import os
import re
import socket
import stat
import threading
import urllib.parse
import webbrowser

ENV_FILE = ".env.local"
KEY_NAME = "DART_API_KEY"
KEY_RE = re.compile(r"^[0-9a-f]{40}$")


def mask(key):
    return key[:6] + "…" + key[-4:] if len(key) > 12 else "…"


def validate(key):
    """OpenDART 인증키는 40자리 소문자 16진수다. 형식이 다르면 경고만 하고 저장은 허용."""
    return bool(KEY_RE.match(key.strip()))


def ensure_gitignored(env_path):
    """.env.local 이 git에 올라가지 않도록 .gitignore 에 등록한다."""
    root = os.path.dirname(os.path.abspath(env_path)) or "."
    if not os.path.isdir(os.path.join(root, ".git")):
        return None
    gi = os.path.join(root, ".gitignore")
    name = os.path.basename(env_path)
    try:
        existing = open(gi, encoding="utf-8").read() if os.path.exists(gi) else ""
        if re.search(r"^%s\s*$" % re.escape(name), existing, re.M):
            return "이미 등록됨"
        with open(gi, "a", encoding="utf-8") as f:
            if existing and not existing.endswith("\n"):
                f.write("\n")
            f.write("\n# API 키 (커밋 금지)\n%s\n" % name)
        return "추가함"
    except OSError as e:
        return "실패: %s" % e


def save_key(key, env_path=ENV_FILE):
    """.env.local 에 KEY=VALUE 를 쓴다 (기존 다른 키는 보존, 같은 키는 교체)."""
    key = key.strip()
    lines, replaced = [], False
    if os.path.exists(env_path):
        with open(env_path, encoding="utf-8") as f:
            for line in f:
                if line.strip().startswith(KEY_NAME + "="):
                    lines.append("%s=%s\n" % (KEY_NAME, key))
                    replaced = True
                else:
                    lines.append(line)
    if not replaced:
        if lines and not lines[-1].endswith("\n"):
            lines.append("\n")
        lines.append("%s=%s\n" % (KEY_NAME, key))
    with open(env_path, "w", encoding="utf-8") as f:
        f.writelines(lines)
    os.chmod(env_path, stat.S_IRUSR | stat.S_IWUSR)  # 600
    return {"저장": os.path.abspath(env_path), "키": mask(key),
            "형식검증": "정상(40자리 hex)" if validate(key) else "경고: 형식이 예상과 다름 — 오타 확인",
            "권한": "600", "gitignore": ensure_gitignored(env_path) or "git 저장소 아님(생략)"}


# ------------------------------------------------------------------ HTML 폼

PAGE = """<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>DART API 키 설정</title><style>
:root{color-scheme:light dark}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:640px;
margin:0 auto;padding:2.5rem 1.5rem;line-height:1.6}
h1{font-size:1.4rem;margin-bottom:.3rem} .sub{opacity:.7;margin-top:0;font-size:.95rem}
ol{background:rgba(127,127,127,.1);padding:1rem 1rem 1rem 2.2rem;border-radius:8px;font-size:.93rem}
input{width:100%;padding:.7rem;font-size:1rem;font-family:ui-monospace,monospace;
border:1px solid rgba(127,127,127,.5);border-radius:6px;background:transparent;color:inherit}
button{margin-top:.8rem;padding:.7rem 1.4rem;font-size:1rem;border:0;border-radius:6px;
background:#2563eb;color:#fff;cursor:pointer}button:hover{background:#1d4ed8}
.msg{margin-top:1rem;padding:.8rem;border-radius:6px;display:none}
.ok{background:rgba(34,197,94,.15)}.err{background:rgba(239,68,68,.15)}
code{background:rgba(127,127,127,.15);padding:.1rem .35rem;border-radius:4px}
</style></head><body>
<h1>DART API 키 설정</h1>
<p class="sub">전자공시 원본 데이터를 가져오려면 무료 인증키가 필요합니다.</p>
<ol>
<li><a href="https://opendart.fss.or.kr/uss/umt/EgovMberInsertView.do" target="_blank">OpenDART 가입</a>
 — <b>개인회원</b>으로 신청하세요 (기업회원은 IP 등록이 필요해 불편합니다)</li>
<li>메일로 받은 40자리 인증키를 아래에 붙여넣으세요</li>
</ol>
<form id="f"><input id="k" placeholder="예: 0123456789abcdef0123456789abcdef01234567"
 autocomplete="off" spellcheck="false" autofocus>
<button type="submit">저장</button></form>
<div id="m" class="msg"></div>
<p class="sub" style="margin-top:1.5rem">저장 위치: <code>__ENV__</code> ·
권한 600 · <code>.gitignore</code> 자동 등록</p>
<script>
document.getElementById('f').onsubmit = async (e) => {
  e.preventDefault();
  const k = document.getElementById('k').value.trim(), m = document.getElementById('m');
  if (!k) return;
  const r = await fetch('/save', {method:'POST', headers:{'Content-Type':'application/json'},
                                  body: JSON.stringify({key:k})});
  const d = await r.json();
  m.style.display='block';
  m.className = 'msg ' + (d.ok ? 'ok' : 'err');
  m.textContent = d.ok ? '저장 완료 (' + d.결과.키 + ') — 이 창을 닫고 터미널로 돌아가세요.'
                       : ('실패: ' + (d.error||''));
  if (d.ok) document.getElementById('f').style.display='none';
};
</script></body></html>"""


def serve_form(env_path=ENV_FILE, port=0, open_browser=True):
    """127.0.0.1 에 1회용 폼 서버를 띄우고, 제출을 받으면 저장 후 종료한다."""
    result = {}
    done = threading.Event()

    class Handler(http.server.BaseHTTPRequestHandler):
        def _send(self, code, body, ctype="application/json; charset=utf-8"):
            data = body if isinstance(body, bytes) else body.encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if urllib.parse.urlparse(self.path).path != "/":
                return self._send(404, "not found", "text/plain")
            self._send(200, PAGE.replace("__ENV__", os.path.abspath(env_path)),
                       "text/html; charset=utf-8")

        def do_POST(self):
            if urllib.parse.urlparse(self.path).path != "/save":
                return self._send(404, json.dumps({"ok": False, "error": "not found"}))
            length = int(self.headers.get("Content-Length", 0))
            try:
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                key = (payload.get("key") or "").strip()
                if not key:
                    raise ValueError("빈 키")
                info = save_key(key, env_path)
            except (ValueError, json.JSONDecodeError, OSError) as e:
                return self._send(400, json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False))
            result.update(info)
            self._send(200, json.dumps({"ok": True, "결과": info}, ensure_ascii=False))
            done.set()

        def log_message(self, *a):
            pass  # 조용히

    srv = http.server.HTTPServer(("127.0.0.1", port), Handler)
    host, real_port = srv.server_address[0], srv.server_address[1]
    url = "http://%s:%d/" % (host, real_port)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    print(json.dumps({"ok": True, "폼주소": url,
                      "안내": "브라우저에서 키를 붙여넣고 저장을 누르세요 (5분 내). 취소하려면 Ctrl+C."},
                     ensure_ascii=False))
    if open_browser:
        try:
            webbrowser.open(url)
        except Exception:
            pass
    try:
        got = done.wait(timeout=300)
    except KeyboardInterrupt:
        got = False
    srv.shutdown()
    if not got:
        print(json.dumps({"ok": False, "error": "시간 초과 또는 취소 — 키가 저장되지 않았다"},
                         ensure_ascii=False))
        return None
    return result


def find_free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]
