"""Headless smoke test of the site edition: python artifact/test/smoke_site.py

Build first (node artifact/build.mjs --site). Needs Python Playwright with Chromium.
Serves artifact/dist/site locally with the _headers rules applied (so the real CSP is enforced),
then checks: no console errors or CSP violations; a campaign mission plays to the debrief; save
export and import; challenge links; and, with the server stopped and the network off, a reload
still starts the game from the service worker.
"""
from __future__ import annotations

import fnmatch
import json
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

ROOT = Path(__file__).resolve().parents[1] / "dist" / "site"
SHOTS = Path(sys.argv[1]) if len(sys.argv) > 1 else None


def load_headers() -> list[tuple[str, list[tuple[str, str]]]]:
    rules: list[tuple[str, list[tuple[str, str]]]] = []
    for line in (ROOT / "_headers").read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if not line[0].isspace():
            rules.append((line.strip(), []))
        else:
            name, _, value = line.strip().partition(":")
            rules[-1][1].append((name.strip(), value.strip()))
    return rules


class Handler(SimpleHTTPRequestHandler):
    rules = load_headers()

    def end_headers(self) -> None:
        path = self.path.split("?")[0]
        for pattern, headers in self.rules:
            if fnmatch.fnmatchcase(path, pattern):
                for name, value in headers:
                    self.send_header(name, value)
        super().end_headers()

    def log_message(self, *args: object) -> None:
        pass


def check(cond: bool, msg: str) -> None:
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        check.failed = True  # type: ignore[attr-defined]


check.failed = False  # type: ignore[attr-defined]


def click_text(page: Page, text: str) -> None:
    page.locator("#console button", has_text=text).first.click()


def run_dialog_to(page: Page, until: str, limit: int = 300) -> bool:
    for _ in range(limit):
        if page.locator("#console button", has_text=until).count():
            return True
        cont = page.locator("#btn-continue")
        choice = page.locator("#console .choices button")
        if choice.count():
            choice.first.click()
        elif cont.count():
            cont.first.click()
        page.wait_for_timeout(40)
    return False


def main() -> int:
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}/kestrel-nine/"
    errors: list[str] = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1280, "height": 800}, accept_downloads=True)
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        page.goto(base)
        page.wait_for_selector("#console button")
        check("default-src 'self'" in (page.evaluate("fetch(location.href).then(r => r.headers.get('content-security-policy'))") or ""), "CSP header served")
        page.evaluate("navigator.serviceWorker.ready")
        page.reload()
        page.wait_for_selector("#console button")
        check(page.evaluate("!!navigator.serviceWorker.controller"), "service worker controls the page")
        manifest = page.evaluate("fetch('manifest.webmanifest').then(r => r.json())")
        check(manifest["start_url"] == "/kestrel-nine/" and manifest["display"] == "standalone", "manifest start_url and display")
        if SHOTS:
            page.screenshot(path=str(SHOTS / "site-title.png"))

        # Campaign mission 1 to the debrief. CRT off so screen and world coordinates map linearly.
        page.click("#btn-crt")
        click_text(page, "Campaign: Cold Start")
        page.locator("#console .mission button").first.click()
        check(run_dialog_to(page, "Begin solo run"), "brief dialog reaches the solo run")
        click_text(page, "Begin solo run")
        click_text(page, "Skip to centaur run")
        click_text(page, "Start fresh")
        pts = page.evaluate("""() => {
          const d = K9Content.CAMPAIGN[0], p = K9Engine.TYPES.haul.generate(d.seed, d.params);
          const r = document.querySelector('.tube canvas').getBoundingClientRect();
          return p.pts.map((q) => [r.left + q.x / K9Render.WW * r.width, r.top + q.y / K9Render.WH * r.height]);
        }""")
        for x, y in pts[1:]:
            page.mouse.click(x, y)
            page.wait_for_timeout(30)
        click_text(page, "File centaur plan")
        page.wait_for_selector("#console table.results")
        check(run_dialog_to(page, "Copy result"), "debrief dialog finishes and shows the result card")
        check(page.locator("#console .sharecard").inner_text().rstrip().endswith("https://play.latentmirror.com/kestrel-nine/"), "result card carries the play URL")
        if SHOTS:
            page.screenshot(path=str(SHOTS / "site-debrief.png"))

        # Records: the Centaur Index bars render under the CSP; save export and import.
        page.click("#btn-home")
        click_text(page, "Records")
        check(page.locator(".bar-fill").count() == 3 and "width" in (page.locator(".bar-fill").first.get_attribute("style") or ""), "index bars have widths")
        with page.expect_download() as dl:
            click_text(page, "Export save")
        check(dl.value.suggested_filename == "kestrel-nine-save.json", "export filename")
        save = json.loads(Path(dl.value.path()).read_text(encoding="utf-8"))
        check(save["app"] == "kestrel-nine" and save["v"] == 1 and "c1" in save["progress"]["done"], "export content")
        bad = dict(save, app="other")
        page.set_input_files("#save-file", files=[{"name": "bad.json", "mimeType": "application/json", "buffer": json.dumps(bad).encode()}])
        page.wait_for_selector("#console [role=status]")
        check("not a Kestrel Nine save" in page.locator("#console [role=status]").inner_text(), "bad save rejected")
        save["progress"]["rep"]["union"] = 7
        page.set_input_files("#save-file", files=[{"name": "ok.json", "mimeType": "application/json", "buffer": json.dumps(save).encode()}])
        page.wait_for_selector("text=Import this save?")
        click_text(page, "Replace my progress")
        check("UNION +7" in page.locator("#st-rep").inner_text(), "import applied after confirm")

        # Challenge links.
        page.goto(base + "?c=HAUL-M-7F3A")
        page.wait_for_selector("#console h1")
        check(page.locator("#console h1").inner_text() == "Arcade haul M", "challenge link opens the arcade seed")
        check("?" not in page.url, "challenge query cleared from the address bar")
        page.goto(base + "?c=%3Cscript%3E")
        page.wait_for_selector("#console button")
        check(page.locator("#console button", has_text="Campaign: Cold Start").count() == 1, "bad challenge code ignored")

        # Offline start: server gone, network off.
        server.shutdown()
        ctx.set_offline(True)
        page.reload()
        page.wait_for_selector("#console button", timeout=10000)
        check(page.locator("#console button", has_text="Campaign: Cold Start").count() == 1, "offline reload starts the game")
        check(page.evaluate("document.querySelector('.tube canvas') !== null"), "offline: the vector display is present")
        if SHOTS:
            page.screenshot(path=str(SHOTS / "site-offline.png"))
        browser.close()

    real = errors
    check(not real, f"no console errors ({len(real)})")
    for e in real:
        print("   ", e[:200])
    return 1 if check.failed else 0  # type: ignore[attr-defined]


if __name__ == "__main__":
    sys.exit(main())
