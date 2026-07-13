#!/usr/bin/env python3
"""Capture each distinct Tensies screen for one commit, for the per-screen
design-progression timelapse.

Usage: capture_screens.py <url> <root_outdir> <index> <screens_csv>

Writes <root_outdir>/<screen>/frame_<index:04d>.png for each screen it can
actually reach. `screens_csv` is the subset to attempt for this commit (the
orchestrator gates screens by their first-existence commit). Anything not
reached is simply skipped, so that commit is absent from that screen's video.

Screens: landing join lobby checkin board menu win lose profile postgame

Driven by button text + stable ids so it survives the markup/protocol drift
across the project's history (same approach as play.py).
"""
import os
import sys
import time
from playwright.sync_api import sync_playwright

URL = sys.argv[1].rstrip("/")
ROOT = sys.argv[2]
IDX = int(sys.argv[3])
SCREENS = set(sys.argv[4].split(",")) if len(sys.argv) > 4 else set()
HERO_CODE = "MICHS"  # seeded post-game detail game
PROFILE_USER = "Mich"

DEVICE = dict(
    viewport={"width": 440, "height": 956},
    device_scale_factor=3,
    is_mobile=True,
    has_touch=True,
    user_agent=("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) "
                "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"),
    geolocation={"latitude": 29.7589, "longitude": -95.3677, "accuracy": 20},
    permissions=["geolocation"],
    locale="en-US",
)

JS_FIND_BTN = """(re) => {
  const els=[...document.querySelectorAll('button, a, .btn, [role=button], [onclick]')];
  return !!els.find(e => e.offsetParent!==null && new RegExp(re,'i').test((e.textContent||'').trim()));
}"""
JS_CLICK = """(re)=>{const els=[...document.querySelectorAll('button,a,.btn,[role=button],[onclick]')];
  const e=els.find(x=>x.offsetParent!==null && new RegExp(re,'i').test((x.textContent||'').trim()));
  if(e){e.click();return true} return false;}"""
JS_CODE = """() => { const el=document.querySelector('#lobby-code');
  const t=el?(el.textContent||'').trim():''; return /^[A-Z]{5}$/.test(t)?t:''; }"""
JS_GAME_VISIBLE = """() => { const g=document.querySelector('#game');
  return !!(g && getComputedStyle(g).display!=='none' && g.offsetParent!==null); }"""
JS_DO_ROLL = """() => { const b=[...document.querySelectorAll('button,.btn,[onclick]')]
  .find(x=>x.offsetParent!==null && /roll/i.test((x.textContent||'').trim()) && !x.disabled);
  if(!b) return false; b.click(); return true; }"""
JS_OVERLAY = """() => { const el=document.querySelector('#winner-overlay');
  if(!el) return false; const cs=getComputedStyle(el);
  return el.open===true || (cs.display!=='none' && cs.visibility!=='hidden' && el.offsetWidth>0); }"""
JS_VISIBLE = """(sel) => { const el=document.querySelector(sel);
  if(!el) return false; const cs=getComputedStyle(el);
  return cs.display!=='none' && cs.visibility!=='hidden' && el.offsetParent!==null && el.offsetWidth>0; }"""
JS_HAS_TEXT = """(t) => (document.body ? document.body.innerText : '').toLowerCase().includes(t.toLowerCase())"""

NO_OUTLINE = """(() => { const css='*{outline:none !important;-webkit-tap-highlight-color:transparent !important}';
  const add=()=>{const s=document.createElement('style');s.textContent=css;(document.head||document.documentElement).appendChild(s);};
  if(document.head||document.documentElement) add(); document.addEventListener('DOMContentLoaded', add); })();"""

done = []


def outpath(screen):
    d = os.path.join(ROOT, screen)
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, f"frame_{IDX:04d}.png")


def snap(page, screen):
    try:
        page.evaluate("() => { const a=document.activeElement; if (a && a.blur) a.blur(); }")
    except Exception:
        pass
    try:
        page.screenshot(path=outpath(screen))
        done.append(screen)
        return True
    except Exception:
        return False


def waitfor(page, js, ms=6000, arg=None):
    t0 = time.time()
    while (time.time() - t0) * 1000 < ms:
        try:
            r = page.evaluate(js, arg) if arg is not None else page.evaluate(js)
            if r:
                return r
        except Exception:
            pass
        time.sleep(0.12)
    return None


def click_re(page, re, ms=5000):
    if not waitfor(page, JS_FIND_BTN, ms, re):
        return False
    try:
        return bool(page.evaluate(JS_CLICK, re))
    except Exception:
        return False


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        hc = browser.new_context(**DEVICE)
        gc = browser.new_context(**DEVICE)
        hc.add_init_script(NO_OUTLINE)
        gc.add_init_script(NO_OUTLINE)

        # The sandbox blocks the capture browser's direct egress to the profile-
        # photo CDN, so fulfil cdn1.simmons.cloud image requests from a local
        # copy (MICH_PHOTO) — the profile/post-game avatars then render as in
        # production instead of a broken/placeholder image.
        photo_path = os.environ.get("MICH_PHOTO", "")
        if photo_path and os.path.exists(photo_path):
            with open(photo_path, "rb") as fh:
                _photo = fh.read()

            def _route_cdn(route):
                route.fulfill(status=200, content_type="image/webp", body=_photo)

            hc.route("https://cdn1.simmons.cloud/**", _route_cdn)
            gc.route("https://cdn1.simmons.cloud/**", _route_cdn)

        host = hc.new_page()
        guest = gc.new_page()

        def want(s):
            return s in SCREENS

        # ---- landing ----
        try:
            host.goto(URL + "/", wait_until="commit", timeout=20000)
        except Exception:
            pass
        waitfor(host, JS_FIND_BTN, 7000, "create|play|start|new game")
        time.sleep(0.4)
        if want("landing"):
            snap(host, "landing")

        # ---- join (modern: #join-sheet dialog; v2 era: #join screen; older: inline code input) ----
        if want("join"):
            (_click_sel(host, "#show-join-btn") or _click_sel(host, "#join-btn")
             or click_re(host, "join with code|join a game|^join", 3000))
            ok = waitfor(host,
                "()=>{for(const s of ['#join-sheet','#join']){const el=document.querySelector(s);"
                "if(el){const cs=getComputedStyle(el); if(el.open===true||(cs.display!=='none'&&el.offsetWidth>0))return true;}}"
                "return !!(document.querySelector('#code-input')&&document.querySelector('#code-input').offsetParent!==null);}",
                4000)
            time.sleep(0.5)
            if ok:
                snap(host, "join")
            _click_sel(host, "#join-close")
            try:
                host.goto(URL + "/", wait_until="commit", timeout=15000)
                waitfor(host, JS_FIND_BTN, 5000, "create")
            except Exception:
                pass

        # ---- create -> lobby ----
        need_game = any(want(s) for s in ("lobby", "places", "board", "menu", "win", "lose"))
        code = ""
        if need_game:
            click_re(host, "create")
            code = waitfor(host, JS_CODE, 9000) or ""
            time.sleep(0.6)
            if want("lobby"):
                snap(host, "lobby")

            # ---- places check-in sheet ----
            if want("places"):
                if _click_sel(host, "#checkin-btn") or click_re(host, "check.?in", 2500):
                    if waitfor(host,
                               "()=>{const d=document.querySelector('#places-sheet');"
                               "return !!(d && (d.open===true || getComputedStyle(d).display!=='none'));}",
                               8000):
                        waitfor(host,
                                "()=>document.querySelectorAll('#places-list > *, #places-sheet li, #places-sheet .places-row').length>=2",
                                12000)
                        time.sleep(2.2)
                        snap(host, "places")
                        _click_sel(host, "#places-close")
                        time.sleep(0.3)

            # ---- guest joins for a 2-player game ----
            if code and any(want(s) for s in ("board", "menu", "win", "lose")):
                try:
                    guest.goto(URL + "/", wait_until="commit", timeout=20000)
                except Exception:
                    pass
                waitfor(guest, JS_FIND_BTN, 6000, "create|join")
                click_re(guest, "join")
                time.sleep(0.4)
                _fill(guest, "#code-input", code)
                for nsel in ("#join-name-input", "#name-input"):
                    if _fill(guest, nsel, "Rival"):
                        break
                try:
                    guest.press("#code-input", "Enter")
                except Exception:
                    pass
                click_re(guest, "^join$|join game", 1500)
                time.sleep(1.0)

            # ---- start -> board ----
            if any(want(s) for s in ("board", "menu", "win", "lose")):
                click_re(host, "start")
                waitfor(host, JS_GAME_VISIBLE, 9000)
                waitfor(guest, JS_GAME_VISIBLE, 9000)
                time.sleep(0.9)
                if want("board"):
                    snap(host, "board")

                # ---- menu ----
                if want("menu"):
                    if (_click_sel(host, "#game-menu-btn") or _click_sel(host, ".game-menu-btn")
                            or click_re(host, "menu|☰", 1500)):
                        opened = waitfor(host,
                            "()=>{const m=document.querySelector('#game-menu,.game-menu,.menu,dialog[open]');"
                            "if(!m) return false; if(m.getAttribute&&m.getAttribute('aria-hidden')==='false') return true;"
                            "const cs=getComputedStyle(m); return cs.display!=='none'&&cs.visibility!=='hidden'&&m.offsetWidth>0;}",
                            3000)
                        time.sleep(0.5)
                        if opened:
                            snap(host, "menu")
                        _click_sel(host, "#game-menu-btn")  # close
                        time.sleep(0.3)

                # ---- win / lose ----
                if any(want(s) for s in ("win", "lose")):
                    for _ in range(2):
                        try:
                            guest.evaluate(JS_DO_ROLL)
                        except Exception:
                            pass
                        time.sleep(0.4)
                    won = False
                    for i in range(80):
                        try:
                            host.evaluate(JS_DO_ROLL)
                        except Exception:
                            pass
                        time.sleep(0.55)
                        if host.evaluate(JS_OVERLAY):
                            won = True
                            break
                    if not won:
                        won = bool(waitfor(host, JS_OVERLAY, 4000))
                    if want("win") and won:
                        snap(host, "win")
                    if want("lose"):
                        waitfor(guest, JS_OVERLAY, 3500)
                        snap(guest, "lose")

        # ---- profile (public /@Mich) ----
        if want("profile"):
            try:
                host.goto(f"{URL}/@{PROFILE_USER}", wait_until="networkidle", timeout=20000)
            except Exception:
                pass
            waitfor(host, JS_HAS_TEXT, 6000, PROFILE_USER)
            time.sleep(1.6)
            snap(host, "profile")

        # ---- postgame (public /games/MICHS) ----
        if want("postgame"):
            try:
                host.goto(f"{URL}/games/{HERO_CODE}", wait_until="networkidle", timeout=20000)
            except Exception:
                pass
            waitfor(host, JS_HAS_TEXT, 6000, "round")
            time.sleep(1.4)
            snap(host, "postgame")

        browser.close()
        print(f"{IDX:04d}\t{','.join(sorted(set(done))) or 'NONE'}")
        sys.exit(0)


def _click_sel(page, sel):
    try:
        if page.locator(sel).count() and page.locator(sel).first.is_visible():
            page.locator(sel).first.click(timeout=2000)
            return True
    except Exception:
        pass
    return False


def _fill(page, sel, val):
    try:
        if page.locator(sel).count() and page.locator(sel).first.is_visible():
            page.fill(sel, val, timeout=1500)
            return True
    except Exception:
        pass
    return False


if __name__ == "__main__":
    main()
