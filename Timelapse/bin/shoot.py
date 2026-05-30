#!/usr/bin/env python3
"""Load the app, drive to the game board, screenshot (simple "board" mode).

Usage: shoot.py <url> <out.png> [width height]

Drives by button *text* (Create / Start) because those labels are stable
across all 80 commits even as ids/markup changed. Always writes a screenshot
so a frame is never missing; exits 0 only if the board was actually reached.
"""
import sys
from playwright.sync_api import sync_playwright

url = sys.argv[1]
out = sys.argv[2]
W = int(sys.argv[3]) if len(sys.argv) > 3 else 760
H = int(sys.argv[4]) if len(sys.argv) > 4 else 1180

DRIVE = r"""
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const vis = el => el && el.offsetParent !== null;
  const findBtn = re => [...document.querySelectorAll('button, .btn, a, [onclick]')]
        .find(e => vis(e) && re.test((e.textContent || '').trim()));
  const wait = async (fn, ms=6000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const r = fn(); if (r) return r; await sleep(120); }
    return null;
  };
  const create = await wait(() => findBtn(/create/i));
  if (!create) return 'no-create';
  create.click();
  const start = await wait(() => findBtn(/^start|start game/i));
  if (!start) return 'no-start';
  start.click();
  const board = await wait(() => {
    const g = document.querySelector('#game');
    return g && getComputedStyle(g).display !== 'none' ? g : null;
  });
  if (!board) return 'no-board';
  await sleep(900);
  return 'board';
}
"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
    ctx = browser.new_context(viewport={"width": W, "height": H}, device_scale_factor=2)
    page = ctx.new_page()
    status = "nav-fail"
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=20000)
        status = page.evaluate(DRIVE)
    except Exception as e:
        status = f"exc:{e}"
    page.screenshot(path=out)
    browser.close()
    print(f"{status}\t{out}")
    sys.exit(0 if status == "board" else 2)
