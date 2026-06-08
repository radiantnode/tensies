"""Build-pipeline invariants for the production frontend bundle.

Runs the real build (scripts/build_assets.mjs) into dist/ and asserts the
properties the prod serving path depends on: every reference is fingerprinted
and resolvable, the document is bundled (no raw module graph), critical.css is
a separate <link> (never inlined — the CSP forbids inline styles), and every
text asset has a .gz sibling that round-trips. nginx serves dist/ verbatim, so
if these hold the prod frontend is internally consistent.

Run:  python tests/assets_test.py    (requires node; builds dist/ as a side effect)
"""
import gzip
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
STATIC_REF = re.compile(r"/static/[^\"')\s]+")
HASHED = re.compile(r"-[0-9a-f]{8}\.[a-z0-9]+$")

_passed = 0
_failed = 0


def check(cond, label):
    global _passed, _failed
    if cond:
        _passed += 1
        print(f"  PASS  {label}")
    else:
        _failed += 1
        print(f"  FAIL  {label}")


def url_to_path(url: str) -> Path:
    # "/static/js/app-1234abcd.js" -> dist/static/js/app-1234abcd.js
    return DIST / url.lstrip("/")


def main():
    print("Building dist/ (node scripts/build_assets.mjs)…")
    r = subprocess.run(
        ["node", "scripts/build_assets.mjs"], cwd=ROOT,
        capture_output=True, text=True,
    )
    check(r.returncode == 0, "build script exits 0")
    if r.returncode != 0:
        print(r.stderr)
        return _summary()

    index = DIST / "index.html"
    check(index.is_file(), "dist/index.html exists")
    html = index.read_text()

    # ── the document is bundled, not the raw dev module graph ──
    check("modulepreload" not in html, "no modulepreload graph in index.html")
    check('/static/js/app.js"' not in html, "no raw /static/js/app.js reference")
    check(html.count("<script") == 1, "exactly one <script> tag (the bundle)")
    check(re.search(r"/static/js/app-[0-9a-f]{8}\.js", html) is not None,
          "index.html points at the hashed JS bundle")
    check(re.search(r"/static/css/app-[0-9a-f]{8}\.css", html) is not None,
          "index.html points at the hashed CSS bundle")
    check(html.count('rel="stylesheet"') == 2,
          "exactly two stylesheet links (critical + bundle)")

    # ── critical.css stays a separate <link>, never an inline <style> (CSP) ──
    check("<style" not in html, "no inline <style> (CSP style-src 'self')")
    check(re.search(r"/static/css/critical-[0-9a-f]{8}\.css", html) is not None,
          "critical.css served as a fingerprinted <link>")

    # ── every /static reference (html + bundles) is hashed and resolvable ──
    refs = set(STATIC_REF.findall(html))
    for bundle in DIST.glob("static/**/*.js"):
        refs |= set(STATIC_REF.findall(bundle.read_text()))
    for bundle in DIST.glob("static/**/*.css"):
        refs |= set(STATIC_REF.findall(bundle.read_text()))
    refs = {u for u in refs if not u.endswith(".gz")}

    unhashed = sorted(u for u in refs if not HASHED.search(u))
    check(not unhashed, f"all /static references are fingerprinted ({len(refs)} refs)")
    if unhashed:
        print("    un-hashed:", unhashed)

    missing = sorted(u for u in refs if not url_to_path(u).is_file())
    check(not missing, "every referenced asset exists in dist/")
    if missing:
        print("    missing:", missing)

    # ── every text asset has a .gz sibling that round-trips ──
    text_files = [p for p in DIST.rglob("*")
                  if p.suffix in {".js", ".css", ".html", ".svg"} and p.is_file()]
    bad_gz = []
    for p in text_files:
        gz = p.with_name(p.name + ".gz")
        if not gz.is_file() or gzip.decompress(gz.read_bytes()) != p.read_bytes():
            bad_gz.append(str(p.relative_to(DIST)))
    check(not bad_gz, f"every text asset has a matching .gz ({len(text_files)} files)")
    if bad_gz:
        print("    bad/missing .gz:", bad_gz)

    return _summary()


def _summary() -> int:
    print(f"\n{_passed} passed, {_failed} failed")
    return 1 if _failed else 0


if __name__ == "__main__":
    sys.exit(main())
