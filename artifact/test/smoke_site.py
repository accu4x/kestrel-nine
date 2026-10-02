"""Headless smoke test of the site edition: python artifact/test/smoke_site.py

Build first (node artifact/build.mjs --site). Needs Python Playwright with Chromium.
Serves artifact/dist/site locally with the _headers rules applied (so the real CSP is enforced),
then checks: no console errors or CSP violations; a fresh profile opens on the prologue, which
leads into Mission 1 and never plays twice; a campaign mission plays to the debrief; save export
and import; the Chronicle's prologue replay; challenge links; a newer deploy reaching an open
page; and, with the server stopped and the network off, a reload still starts the game from the
service worker.
"""
from __future__ import annotations

import fnmatch
import json
import re
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import BrowserContext, Page, sync_playwright

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
    # Files swapped in to stand for a newer deploy: path -> (content type, body). See deploy().
    overrides: dict[str, tuple[str, bytes]] = {}

    def do_GET(self) -> None:
        hit = self.overrides.get(self.path.split("?")[0])
        if not hit:
            super().do_GET()
            return
        self.send_response(200)
        self.send_header("Content-Type", hit[0])
        self.send_header("Content-Length", str(len(hit[1])))
        self.end_headers()
        self.wfile.write(hit[1])

    def send_header(self, keyword: str, value: str) -> None:
        # An old Last-Modified lets the browser's HTTP cache treat every file as fresh for weeks,
        # as a host with no revalidation headers would. Without this the update checks pass or
        # fail by the age of the build. The worker's precache must not read through that cache.
        if keyword == "Last-Modified":
            value = "Mon, 01 Jan 2024 00:00:00 GMT"
        super().send_header(keyword, value)

    def end_headers(self) -> None:
        path = self.path.split("?")[0]
        for pattern, headers in self.rules:
            if fnmatch.fnmatchcase(path, pattern):
                for name, value in headers:
                    self.send_header(name, value)
        super().end_headers()

    def log_message(self, *args: object) -> None:
        pass


def deploy(build: int) -> None:
    """Stand in for a newer deploy: a worker with a new cache name, and an app.js that says
    which build it is (window.K9_SMOKE_BUILD)."""
    site = ROOT / "kestrel-nine"
    worker, swapped = re.subn(r'const CACHE = "[^"]*"', f'const CACHE = "k9-smoke-build-{build}"', (site / "sw.js").read_text(encoding="utf-8"))
    if swapped != 1:
        raise ValueError("sw.js has no cache name to replace")
    app = (site / "app.js").read_text(encoding="utf-8") + f"\nwindow.K9_SMOKE_BUILD = {build};\n"
    Handler.overrides = {
        "/kestrel-nine/sw.js": ("text/javascript", worker.encode()),
        "/kestrel-nine/app.js": ("text/javascript", app.encode()),
    }


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


def heading(page: Page) -> str:
    return page.locator("#console h1").inner_text()


def fly_haul(page: Page, problem_js: str) -> None:
    """From a finished briefing, fly a haul map to its results table. Needs CRT off, so screen
    and world coordinates map linearly."""
    click_text(page, "Begin solo run")
    click_text(page, "Skip to centaur run")
    click_text(page, "Start fresh")
    pts = page.evaluate("""() => {
      const p = %s;
      const r = document.querySelector('.tube canvas').getBoundingClientRect();
      return p.pts.map((q) => [r.left + q.x / K9Render.WW * r.width, r.top + q.y / K9Render.WH * r.height]);
    }""" % problem_js)
    for x, y in pts[1:]:
        page.mouse.click(x, y)
        page.wait_for_timeout(30)
    click_text(page, "File centaur plan")
    page.wait_for_selector("#console table.results")


def main() -> int:
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}/kestrel-nine/"
    errors: list[str] = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch()

        def fresh_profile(width: int = 1280, height: int = 800) -> tuple[BrowserContext, Page]:
            c = browser.new_context(viewport={"width": width, "height": height}, accept_downloads=True)
            p = c.new_page()
            p.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            p.on("pageerror", lambda e: errors.append(str(e)))
            return c, p

        ctx, page = fresh_profile()
        page.goto(base)
        page.wait_for_selector("#console button")
        check("default-src 'self'" in (page.evaluate("fetch(location.href).then(r => r.headers.get('content-security-policy'))") or ""), "CSP header served")
        # ready never rejects, so a broken worker would hang the test; bound it instead.
        ready = page.evaluate("Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise((r) => setTimeout(() => r(false), 10000))])")
        check(ready, "service worker installs within 10 s")
        if not ready:
            browser.close()
            return 1
        page.reload()
        page.wait_for_selector("#console button")
        check(page.evaluate("!!navigator.serviceWorker.controller"), "service worker controls the page")
        manifest = page.evaluate("fetch('manifest.webmanifest').then(r => r.json())")
        check(manifest["start_url"] == "/kestrel-nine/" and manifest["display"] == "standalone", "manifest start_url and display")
        # First launch: the prologue, still there after the reload above because nothing was chosen.
        check(heading(page) == "Prologue", "a fresh profile opens on the prologue")
        if SHOTS:
            page.wait_for_timeout(600)
            page.screenshot(path=str(SHOTS / "site-prologue.png"))

        # Taking the helm opens mission 1 at Bay 7; then the mission to the debrief. CRT off for fly_haul.
        page.click("#btn-crt")
        check(run_dialog_to(page, "Begin solo run"), "prologue and brief dialog reach the solo run")
        said = page.locator("#console .dialog .said").all_inner_texts()
        check(heading(page) == "Cold Start" and said[0].startswith("AUGMENTED INTERFACE v3.7") and not any("LOADER 0.9" in s for s in said), "taking the helm opens mission 1's briefing at Bay 7")
        check(any("ASK FOR WINTER" in s for s in said) and "You asked. So. I’m Winter." in said, "Winter's lines are intact")
        fly_haul(page, "(() => { const d = K9Content.CAMPAIGN[0]; return K9Engine.TYPES.haul.generate(d.seed, d.params); })()")
        check(run_dialog_to(page, "Copy result"), "debrief dialog finishes and shows the result card")
        check(page.locator("#console .sharecard").inner_text().rstrip().endswith("https://play.latentmirror.com/kestrel-nine/"), "result card carries the play URL")
        icons = page.locator("#console a.btn.icon")
        check([icons.nth(i).get_attribute("aria-label") for i in range(icons.count())] == ["Share on Mastodon", "Share on Bluesky", "Share on X"], "the share icons carry spoken names")
        check(page.locator("#console button", has_text="Start at the beginning").count() == 0, "no way back to the prologue from a debrief once it has played")
        if SHOTS:
            page.screenshot(path=str(SHOTS / "site-debrief.png"))
        page.reload()
        page.wait_for_selector("#console button")
        check(page.locator("#console button", has_text="Campaign: Cold Start").count() == 1, "a reload after the prologue opens the title screen")
        if SHOTS:
            page.screenshot(path=str(SHOTS / "site-title.png"))

        # Records: the Centaur Index bars render under the CSP; save export and import.
        click_text(page, "Records")
        check(page.locator(".bar-fill").count() == 3 and "width" in (page.locator(".bar-fill").first.get_attribute("style") or ""), "index bars have widths")
        with page.expect_download() as dl:
            click_text(page, "Export save")
        check(dl.value.suggested_filename == "kestrel-nine-save.json", "export filename")
        save = json.loads(Path(dl.value.path()).read_text(encoding="utf-8"))
        check(save["app"] == "kestrel-nine" and save["v"] == 1 and "c1" in save["progress"]["done"] and save["progress"].get("prologue") is True, "export content")
        bad = dict(save, app="other")
        page.set_input_files("#save-file", files=[{"name": "bad.json", "mimeType": "application/json", "buffer": json.dumps(bad).encode()}])
        page.wait_for_selector("#console [role=status]")
        check("not a Kestrel Nine save" in page.locator("#console [role=status]").inner_text(), "bad save rejected")
        save["progress"]["rep"]["union"] = 7
        page.set_input_files("#save-file", files=[{"name": "ok.json", "mimeType": "application/json", "buffer": json.dumps(save).encode()}])
        page.wait_for_selector("text=Import this save?")
        click_text(page, "Replace my progress")
        check("UNION +7" in page.locator("#st-rep").inner_text(), "import applied after confirm")

        # Replay from the Chronicle: back to the Chronicle at the end, progress untouched.
        page.click("#btn-home")
        click_text(page, "Chronicle")
        before = page.evaluate("localStorage.getItem('k9.progress')")
        click_text(page, "Replay the prologue")
        check(heading(page) == "Prologue", "the Chronicle replays the prologue")
        check(run_dialog_to(page, "Replay the prologue"), "the replay ends back on the Chronicle")
        check(heading(page) == "The history of the reach" and page.evaluate("localStorage.getItem('k9.progress')") == before, "a replay changes no progress")

        # Challenge links.
        page.goto(base + "?c=HAUL-M-7F3A")
        page.wait_for_selector("#console h1")
        check(heading(page) == "Arcade haul M", "challenge link opens the arcade seed")
        check("?" not in page.url, "challenge query cleared from the address bar")
        page.goto(base + "?c=%3Cscript%3E")
        page.wait_for_selector("#console button")
        check(page.locator("#console button", has_text="Campaign: Cold Start").count() == 1, "bad challenge code ignored")

        # The fifth job. Its challenge code opens it, and it is flown entirely from the console:
        # name a target, turn the guns up, file the plan, and the debrief replays the fight.
        page.goto(base + "?c=ENGA-M-7F3A")
        page.wait_for_selector("#console h1")
        check(heading(page) == "Arcade engagement M", "an engagement challenge link opens the fight")
        check(run_dialog_to(page, "Begin solo run") and any(s.startswith("CONTACT") for s in page.locator("#console .dialog .said").all_inner_texts()), "the briefing names the contact")
        click_text(page, "Begin solo run")
        click_text(page, "Skip to centaur run")
        click_text(page, "Start fresh")
        page.click("#eg-add-0")
        check(page.evaluate("document.activeElement.id") == "eg-drop-0" and page.locator("#console .aims li").count() == 1, "adding a target lists it and keeps keyboard focus on it")
        page.click("#eg-guns-up")
        check(page.evaluate("document.activeElement.id") == "eg-guns-up", "the plan editor keeps keyboard focus on the control just used")
        click_text(page, "File centaur plan")
        page.wait_for_selector("#console table.results")
        check(run_dialog_to(page, "Copy result") and "seed ENGA-M-7F3A" in page.locator("#console .sharecard").inner_text(), "the engagement debrief shows its result card")
        page.click("#btn-home")

        # A fresh profile that skips the prologue lands in mission 1 and never sees it again.
        ctx2, skipper = fresh_profile()
        skipper.goto(base)
        skipper.wait_for_selector("#console h1")
        click_text(skipper, "Skip prologue")
        check(heading(skipper) == "Cold Start", "skipping the prologue opens mission 1's briefing")
        skipper.reload()
        skipper.wait_for_selector("#console button")
        check(skipper.locator("#console button", has_text="Campaign: Cold Start").count() == 1, "a reload after skipping opens the title screen")
        ctx2.close()

        # HOME during the first-launch prologue counts as a skip. This profile has seen the prologue
        # by the flag alone (no mission done), so it also shows an import never un-sees it.
        ctx4, homer = fresh_profile()
        homer.goto(base)
        homer.wait_for_selector("#console h1")
        homer.click("#btn-home")
        check(homer.locator("#console button", has_text="Campaign: Cold Start").count() == 1, "HOME during the prologue opens the title screen")
        homer.reload()
        homer.wait_for_selector("#console button")
        check(homer.locator("#console button", has_text="Campaign: Cold Start").count() == 1, "a reload after HOME does not reopen the prologue")
        click_text(homer, "Records")
        for label, progress in (("prologue: false", {"prologue": False, "rep": {"union": 1}}), ("no prologue key", {"rep": {"union": 2}})):
            blank = {"app": "kestrel-nine", "v": 1, "progress": progress}
            homer.set_input_files("#save-file", files=[{"name": "blank.json", "mimeType": "application/json", "buffer": json.dumps(blank).encode()}])
            homer.wait_for_selector("text=Import this save?")
            click_text(homer, "Replace my progress")
            stored = homer.evaluate("JSON.parse(localStorage.getItem('k9.progress'))")
            check(stored["rep"]["union"] == progress["rep"]["union"] and stored.get("prologue") is True, f"importing a save with {label} keeps the prologue seen")
        homer.reload()
        homer.wait_for_selector("#console button")
        check(homer.locator("#console button", has_text="Campaign: Cold Start").count() == 1, "a reload after those imports opens the title screen")
        ctx4.close()

        # A fresh profile on a challenge link plays the seed; its debrief offers the prologue.
        ctx3, guest = fresh_profile()
        guest.goto(base + "?c=HAUL-M-7F3A")
        guest.wait_for_selector("#console h1")
        check(heading(guest) == "Arcade haul M", "a challenge link skips the prologue on a fresh profile")
        guest.click("#btn-crt")
        run_dialog_to(guest, "Begin solo run")
        fly_haul(guest, "K9Engine.TYPES.haul.generate('arcade-7F3A', K9Engine.SIZES.haul.M)")
        check(run_dialog_to(guest, "Start at the beginning"), "the challenge debrief offers Start at the beginning")
        click_text(guest, "Start at the beginning")
        check(heading(guest) == "Prologue", "Start at the beginning opens the prologue")
        ctx3.close()

        # Tablet layout. Upright (a 4:3 iPad under its status bar) the whole title screen fits, so
        # no row of buttons falls off the bottom. Sideways, a long console stays on the screen.
        fits = """() => {
          const buttons = [...document.querySelectorAll('#console button')];
          const lowest = Math.max(...buttons.map((b) => b.getBoundingClientRect().bottom));
          return { lowest, consoleBottom: document.querySelector('.console').getBoundingClientRect().bottom,
            page: document.scrollingElement.scrollHeight, screen: innerHeight };
        }"""
        ctx5, upright = fresh_profile(810, 1060)
        upright.goto(base)
        upright.wait_for_selector("#console h1")
        upright.click("#btn-home")
        m = upright.evaluate(fits)
        check(m["lowest"] <= m["screen"] and m["page"] <= m["screen"], "upright tablet: the title screen fits without scrolling")
        ctx5.close()
        ctx6, sideways = fresh_profile(1024, 748)
        sideways.goto(base)
        sideways.wait_for_selector("#console h1")
        sideways.click("#btn-home")
        click_text(sideways, "Chronicle")
        m = sideways.evaluate(fits)
        check(m["consoleBottom"] <= m["screen"] and m["page"] <= m["screen"], "sideways tablet: a long console stays on the screen")
        ctx6.close()

        # A newer deploy reaches a page that is already open: the app looks for one when it comes
        # back to the foreground. On the title screen it reloads into the new build at once.
        foreground = "document.dispatchEvent(new Event('visibilitychange'))"
        title_button = page.locator("#console button", has_text="Campaign: Cold Start")
        reload_button = page.locator("#console button", has_text="Reload to update")
        deploy(2)
        with page.expect_navigation(timeout=20000):
            page.evaluate(foreground)
        page.wait_for_selector("#console button")
        check(page.evaluate("window.K9_SMOKE_BUILD") == 2 and title_button.count() == 1 and reload_button.count() == 0, "a new build reloads the title screen into itself")

        # On any other screen it leaves the player alone and offers the reload on the title screen.
        deploy(3)
        click_text(page, "Records")
        page.evaluate("window.k9Mark = 1; navigator.serviceWorker.addEventListener('controllerchange', () => { window.k9Changed = true; })")
        page.evaluate(foreground)
        # A function, not an expression: the page's CSP forbids the eval an expression would need.
        page.wait_for_function("() => window.k9Changed === true", timeout=20000)
        check(page.evaluate("window.k9Mark") == 1 and heading(page) == "The tally" and page.evaluate("window.K9_SMOKE_BUILD") == 2, "a new build does not reload a screen in use")
        page.click("#btn-home")
        check(reload_button.count() == 1, "the title screen then offers the reload")
        with page.expect_navigation(timeout=20000):
            reload_button.click()
        page.wait_for_selector("#console button")
        check(page.evaluate("window.K9_SMOKE_BUILD") == 3 and reload_button.count() == 0, "reloading opens the new build")
        check("c1" in page.evaluate("JSON.parse(localStorage.getItem('k9.progress')).done"), "progress survives the update")

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
