#!/usr/bin/env python3
"""Drive a full 2-player round and capture a gameplay arc for one commit.

Usage: play.py <url> <outdir> <index>

One Playwright process drives TWO browser contexts (host = winner,
guest = loser) against a single server, then writes 8 frames (always —
best-effort, never missing):

  frame_<idx>_0.png  loading / first paint
  frame_<idx>_1.png  landing
  frame_<idx>_2.png  lobby (2 players)
  frame_<idx>_3.png  fresh board 0/10
  frame_<idx>_4.png  after first roll
  frame_<idx>_5.png  mid progression
  frame_<idx>_6.png  WIN  (host's winner overlay)
  frame_<idx>_7.png  LOSS (guest's view of the same moment)

Everything is driven by stable selectors (#lobby-code, #code-input,
#winner-overlay) and button text, which survive the markup/protocol drift
across the project's history.
"""
import sys
import time
from playwright.sync_api import sync_playwright

URL = sys.argv[1]
OUTDIR = sys.argv[2]
IDX = int(sys.argv[3])
PREFIX = f"{OUTDIR}/frame_{IDX:03d}_"

# iPhone 17 Pro Max: 440x956 CSS pts @ DPR 3 -> 1320x2868 native px, 6.9".
# Captured as a real mobile context so the page renders its true phone layout.
DEVICE = dict(
    viewport={"width": 440, "height": 956},
    device_scale_factor=3,
    is_mobile=True,
    has_touch=True,
    user_agent=(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
    ),
)

JS_FIND_BTN = """(re) => {
  const els=[...document.querySelectorAll('button, a, .btn, [role=button], [onclick]')];
  return els.find(e => e.offsetParent!==null && new RegExp(re,'i').test((e.textContent||'').trim()));
}"""

JS_CODE = """() => {
  const el=document.querySelector('#lobby-code');
  const t=el ? (el.textContent||'').trim() : '';
  return /^[A-Z]{5}$/.test(t) ? t : '';
}"""

JS_GAME_VISIBLE = """() => {
  const g=document.querySelector('#game');
  return !!(g && getComputedStyle(g).display!=='none' && g.offsetParent!==null);
}"""

JS_DO_ROLL = """() => {
  const b=[...document.querySelectorAll('button, .btn, [onclick]')]
    .find(x => x.offsetParent!==null && /roll/i.test((x.textContent||'').trim()) && !x.disabled);
  if(!b) return false;
  b.click();
  return true;
}"""

JS_OVERLAY = """() => {
  const el=document.querySelector('#winner-overlay');
  if(!el) return false;
  const cs=getComputedStyle(el);
  return el.open===true || (cs.display!=='none' && cs.visibility!=='hidden' && el.offsetWidth>0);
}"""


# Suppress focus rings / tap highlights — driving the game by clicks leaves a
# full-viewport .screen element focused, which paints an amber WebKit focus ring
# around the whole frame under the mobile/iOS-UA context.
NO_OUTLINE = """
(() => {
  const css = '*{outline:none !important;-webkit-tap-highlight-color:transparent !important}';
  const add = () => {
    const s = document.createElement('style');
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  };
  if (document.head || document.documentElement) add();
  document.addEventListener('DOMContentLoaded', add);
})();
"""


def snap(page, step):
    try:
        page.evaluate("() => { const a=document.activeElement; if (a && a.blur) a.blur(); }")
    except Exception:
        pass
    try:
        page.screenshot(path=f"{PREFIX}{step}.png")
    except Exception:
        pass


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
        page.evaluate(
            "(re)=>{const els=[...document.querySelectorAll('button,a,.btn,[role=button],[onclick]')];"
            "const e=els.find(x=>x.offsetParent!==null && new RegExp(re,'i').test((x.textContent||'').trim()));"
            "if(e)e.click();}",
            re,
        )
        return True
    except Exception:
        return False


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        host_ctx = browser.new_context(**DEVICE)
        guest_ctx = browser.new_context(**DEVICE)
        host_ctx.add_init_script(NO_OUTLINE)
        guest_ctx.add_init_script(NO_OUTLINE)
        host = host_ctx.new_page()
        guest = guest_ctx.new_page()
        status = []

        # 0. loading / first paint
        try:
            host.goto(URL, wait_until="commit", timeout=20000)
        except Exception as e:
            status.append(f"goto:{e}")
        time.sleep(0.25)
        snap(host, 0)

        # 1. landing
        waitfor(host, JS_FIND_BTN, 6000, "create")
        snap(host, 1)

        # create game
        click_re(host, "create")
        code = waitfor(host, JS_CODE, 8000)
        status.append(f"code={code}")

        # guest joins
        if code:
            try:
                guest.goto(URL, wait_until="commit", timeout=20000)
            except Exception:
                pass
            waitfor(guest, JS_FIND_BTN, 6000, "create")
            click_re(guest, "join")  # reveal join form / screen
            time.sleep(0.4)
            try:
                guest.fill("#code-input", code, timeout=4000)
            except Exception:
                pass
            for nsel in ("#join-name-input", "#name-input"):
                try:
                    if guest.locator(nsel).count() and guest.locator(nsel).first.is_visible():
                        guest.fill(nsel, "Rival", timeout=1500)
                        break
                except Exception:
                    pass
            try:
                guest.press("#code-input", "Enter")
            except Exception:
                pass
            click_re(guest, "^join$|join game", 1500)  # fallback submit

        # 2. lobby (host) — wait until 2nd player shows, then snap
        time.sleep(1.2)
        snap(host, 2)

        # start
        click_re(host, "start")
        waitfor(host, JS_GAME_VISIBLE, 8000)
        waitfor(guest, JS_GAME_VISIBLE, 8000)
        time.sleep(0.8)
        snap(host, 3)  # 3. fresh board

        # guest rolls a couple times so its board looks played (will still lose)
        for _ in range(2):
            try:
                guest.evaluate(JS_DO_ROLL)
            except Exception:
                pass
            time.sleep(0.4)

        # 4..6 host rolls until win
        won = False
        snapped4 = snapped5 = False
        for i in range(70):
            try:
                host.evaluate(JS_DO_ROLL)
            except Exception:
                pass
            time.sleep(0.55)  # > MIN_ROLL_INTERVAL, lets the reveal play
            if not snapped4:
                snap(host, 4)
                snapped4 = True  # after first roll
            if host.evaluate(JS_OVERLAY):
                won = True
                break
            if not snapped5 and i >= 6:
                snap(host, 5)
                snapped5 = True  # mid progression
        if not snapped4:
            snap(host, 4)
        if not snapped5:
            snap(host, 5)

        # 6. WIN overlay (host)
        if not won:
            won = bool(waitfor(host, JS_OVERLAY, 4000))
        snap(host, 6)
        status.append("won" if won else "no-win")

        # 7. LOSS (guest) — same moment, loser's screen
        waitfor(guest, JS_OVERLAY, 3500)
        snap(guest, 7)

        browser.close()
        print(f"{IDX:03d}\t{'OK' if won else 'PARTIAL'}\t{'; '.join(status)}")
        sys.exit(0 if won else 2)


if __name__ == "__main__":
    main()
