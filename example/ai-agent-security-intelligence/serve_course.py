"""Serve this course on loopback and persist learner answers for the local tutor.

Run ``python3 serve_course.py`` (or a platform launcher) from any directory. No third-party packages are used.
This is a single-user development helper, not a production web server.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import NamedTemporaryFile
from threading import Lock
from urllib.parse import unquote, urlsplit
import re
import webbrowser

try:
    import tutor_chat
except ImportError:
    tutor_chat = None


ROOT = Path(__file__).resolve().parent
SUBMISSIONS = ROOT / "learner-submissions"
WRITE_LOCK = Lock()
PAGE_RE = re.compile(r"[a-z0-9][a-z0-9-]{0,79}\Z")
FIELD_RE = re.compile(r"[a-z0-9][a-z0-9-]{0,99}\Z")
MAX_BYTES = 64 * 1024


def allowed_page(page: str) -> bool:
    return bool(PAGE_RE.fullmatch(page)) and any(
        (ROOT / folder / f"{page}.html").is_file()
        for folder in ("lessons", "practice")
    )


def allowed_static(raw_path: str) -> Path | None:
    path = unquote(urlsplit(raw_path).path)
    if path == "/":
        path = "/index.html"
    parts = Path(path.lstrip("/")).parts
    if not parts or any(part in (".", "..") or part.startswith(".") for part in parts):
        return None
    if len(parts) == 1 and parts[0] in ("index.html", "settings.html"):
        pass
    elif len(parts) == 2 and parts[0] in ("lessons", "practice", "reference") and parts[1].endswith(".html"):
        pass
    elif len(parts) >= 2 and parts[0] == "assets" and Path(parts[-1]).suffix.lower() in (".css", ".js", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".woff2"):
        pass
    elif len(parts) == 2 and parts[0] == "media" and Path(parts[-1]).suffix.lower() in (".mp4", ".webm", ".vtt", ".png", ".jpg", ".jpeg", ".webp"):
        pass
    else:
        return None
    target = (ROOT.joinpath(*parts)).resolve()
    if not target.is_relative_to(ROOT) or not target.is_file():
        return None
    return target


class CourseHandler(BaseHTTPRequestHandler):
    server_version = "TeachLocal/1.0"

    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _same_origin(self) -> bool:
        expected = f"http://127.0.0.1:{self.server.server_port}"
        return self.headers.get("Host") == f"127.0.0.1:{self.server.server_port}" and self.headers.get("Origin", expected) == expected

    def do_GET(self) -> None:
        if not self._same_origin():
            self._json(403, {"error": "wrong origin"})
            return
        path = urlsplit(self.path).path
        if tutor_chat and tutor_chat.handle(self, ROOT, path, 'GET'):
            return
        if path == "/api/health":
            self._json(200, {"ok": True, "course": ROOT.name})
            return
        if path.startswith("/api/submissions/"):
            page = path.rsplit("/", 1)[-1]
            if not allowed_page(page):
                self._json(404, {"error": "unknown page"})
                return
            file = SUBMISSIONS / f"{page}.json"
            try:
                if SUBMISSIONS.is_symlink() or file.is_symlink():
                    raise OSError("submission path is a symlink")
                payload = json.loads(file.read_text(encoding="utf-8")) if file.is_file() else {"course": ROOT.name, "page": page, "saved_at": None, "fields": {}}
            except (OSError, ValueError):
                self._json(500, {"error": "saved record unavailable"})
                return
            self._json(200, payload)
            return
        target = allowed_static(self.path)
        if target is None:
            self.send_error(404)
            return
        try:
            body = target.read_bytes()
        except OSError:
            self.send_error(500)
            return
        content_type = "text/vtt" if target.suffix.lower() == ".vtt" else (mimetypes.guess_type(target.name)[0] or "application/octet-stream")
        if content_type.startswith("text/") or target.suffix == ".js":
            content_type += "; charset=utf-8"
        start = 0
        end = len(body) - 1
        ranged = False
        if target.suffix.lower() in (".mp4", ".webm") and self.headers.get("Range"):
            match = re.fullmatch(r"bytes=(\d+)-(\d*)", self.headers["Range"])
            if not match:
                self.send_error(416)
                return
            start = int(match.group(1))
            end = int(match.group(2)) if match.group(2) else end
            if start > end or end >= len(body):
                self.send_error(416)
                return
            ranged = True
        self.send_response(206 if ranged else 200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(end - start + 1))
        if target.suffix.lower() in (".mp4", ".webm"):
            self.send_header("Accept-Ranges", "bytes")
        if ranged:
            self.send_header("Content-Range", f"bytes {start}-{end}/{len(body)}")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body[start:end + 1])

    def do_POST(self) -> None:
        if not self._same_origin():
            self._json(403, {"error": "wrong origin"})
            return
        path = urlsplit(self.path).path
        if tutor_chat and tutor_chat.handle(self, ROOT, path, 'POST'):
            return
        if not path.startswith("/api/submissions/"):
            self._json(404, {"error": "unknown endpoint"})
            return
        page = path.rsplit("/", 1)[-1]
        if not allowed_page(page):
            self._json(404, {"error": "unknown page"})
            return
        if self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower() != "application/json":
            self._json(415, {"error": "JSON required"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 1 <= length <= MAX_BYTES:
                raise ValueError("invalid length")
            incoming = json.loads(self.rfile.read(length))
            fields = incoming["fields"]
            if not isinstance(fields, dict) or len(fields) > 64 or not all(
                isinstance(key, str) and FIELD_RE.fullmatch(key) and isinstance(value, str) and len(value) <= 30000
                for key, value in fields.items()
            ):
                raise ValueError("invalid fields")
        except (ValueError, TypeError, KeyError, UnicodeError):
            self._json(400, {"error": "invalid submission"})
            return
        payload = {
            "course": ROOT.name,
            "page": page,
            "saved_at": datetime.now(timezone.utc).isoformat(),
            "fields": fields,
        }
        temp_path = None
        try:
            with WRITE_LOCK:
                SUBMISSIONS.mkdir(exist_ok=True)
                if SUBMISSIONS.is_symlink() or not SUBMISSIONS.resolve().is_relative_to(ROOT):
                    raise OSError("submission directory outside course")
                with NamedTemporaryFile("w", encoding="utf-8", dir=SUBMISSIONS, prefix=".pending-", suffix=".json", delete=False) as temp:
                    json.dump(payload, temp, ensure_ascii=False, indent=2)
                    temp.flush()
                    os.fsync(temp.fileno())
                    temp_path = Path(temp.name)
                os.replace(temp_path, SUBMISSIONS / f"{page}.json")
        except OSError:
            if temp_path is not None:
                temp_path.unlink(missing_ok=True)
            self._json(500, {"error": "local save failed"})
            return
        self._json(200, {"ok": True, "saved_at": payload["saved_at"]})

    def do_OPTIONS(self) -> None:
        self.send_error(403)


def main() -> None:
    parser = argparse.ArgumentParser(description="Open the course with automatic local answer sync")
    parser.add_argument("--port", type=int, default=0, help="loopback port; 0 chooses a free port")
    parser.add_argument("--no-browser", action="store_true", help="do not open the browser automatically")
    args = parser.parse_args()
    with ThreadingHTTPServer(("127.0.0.1", args.port), CourseHandler) as server:
        url = f"http://127.0.0.1:{server.server_port}/"
        print(f"Course ready: {url}", flush=True)
        print("Answers sync to learner-submissions/. Press Ctrl+C to stop.", flush=True)
        if not args.no_browser:
            webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("Course stopped.")


if __name__ == "__main__":
    main()
