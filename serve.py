#!/usr/bin/env python3
"""本地服务器：静态页面 + 编辑页(edit.html)的保存接口。

python3 serve.py 然后打开 http://localhost:8123

- 静态文件带 Cache-Control: no-store，改完代码刷新即生效
- POST /api/save 只接受写入 data/shows.json 和 data/events.json（白名单），
  只监听 127.0.0.1。线上（GitHub Pages）没有这个接口，编辑页保存会失败——
  编辑本来就只在本地做，改完 git push 上线。
"""
import json
from functools import partial
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

PORT = 8123
ROOT = Path(__file__).resolve().parent
# 可写文件白名单：名字 → (路径, 顶层类型)
SAVABLE = {
    "shows": (ROOT / "data" / "shows.json", list),
    "events": (ROOT / "data" / "events.json", list),
    "site": (ROOT / "data" / "site.json", dict),
    "venues": (ROOT / "data" / "venues.json", list),
}


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        if self.path != "/api/save":
            return self.send_error(404)
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length))
            target, kind = SAVABLE[payload["file"]]
            data = payload["data"]
            assert isinstance(data, kind)
        except Exception:
            return self.send_error(400, "bad request")
        target.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        body = b'{"ok": true}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", PORT), partial(Handler, directory=str(ROOT)))
    print(f"→ http://localhost:{PORT}  （编辑页 /edit.html，Ctrl+C 停止）")
    server.serve_forever()
