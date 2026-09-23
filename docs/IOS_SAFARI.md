# iOS Safari: the toolbar strip, the status bar, and the shell

*Work of 2026-09-20 and 21 on branch `ios-safari-gotchas`. Measured in the iOS 27
simulator (iPhone 17, 3x screenshots, pixel values) by a reviewer session on Michael's Mac,
following the `ios-safari-gotchas` skill; built and self-verified on elite01. Every number
below is a measurement, not an impression.*

## The short version

Tensies had two iOS Safari faults Michael could see and one he could not.

1. **The page stopped dead at the fold on every scrolling screen.** Profile, changelog,
   nearby, sign-in, game detail and the nav menu all ended in a flat band behind Safari's
   bottom toolbar instead of running under its glass the way ordinary web pages do.
2. **The status bar was the wrong colour on the landing**, a brown that matched nothing on
   the page.
3. Three smaller things headless browsers cannot show: edge fades that painted a frame
   behind a fling, scroll reads that misfired at the end of a rubber-band, and CSS
   transitions that WebKit parks at their start when a state is set before first paint.

All three are fixed on `main` once this branch merges. The first one took the whole
investigation, because it was not where it looked.

## The rule, measured

iOS Safari decides **once, at first paint**, whether it keeps painting the page behind its
bottom toolbar ("overdraw") or cuts the page off at the layout viewport and fills the
strip with one colour ("flat fill"). The decision is a **ratchet**:

- A `position: fixed` or `position: sticky` box **sized to the dynamic viewport**
  (`inset: 0`, `100dvh`) flips the page to flat fill, and **nothing after that gets it
  back** for the life of the page load. Two seconds of the box is enough. Removing it
  afterwards changes nothing. Navigating in-app to a screen with no such box changes
  nothing.
- The same box at **`100lvh`**, or taller, does **not** trigger it.
- `html { overflow: hidden }` does not. A `visibility: hidden` fixed box does not. A modal
  `<dialog>`'s backdrop does not, on the lvh shell.

This was settled on eight minimal pages, each a magenta ground with striped filler that
applied one construct for two seconds, removed it, and scrolled mid-page
(`/p/min/<name>` when `PROBE_PATHS` is set):

| construct                             | strip           | verdict          |
|---------------------------------------|-----------------|------------------|
| none                                  | stripes through | overdraw (control) |
| sticky, 100dvh                        | flat, 294px     | ratchet (control)  |
| `body` fixed inset:0, 2s              | flat, 294px     | **ratchet**        |
| `body` fixed inset:0, 8s              | flat, 294px     | **ratchet**        |
| child fixed inset:0 at 100dvh         | flat, 294px     | **ratchet**        |
| child fixed at 100lvh                 | stripes through | no                 |
| child fixed at 100lvh + 120px         | stripes through | no                 |
| `html` overflow hidden                | stripes through | no                 |

**Why it hid so well.** Tensies booted every route on the fixed shell, `body { position:
fixed; inset: 0 }`, with the loading splash inside it. The decision was taken before any
scrolling screen existed. Three rounds of ablating the scrolling screens themselves
(the tint strip, the blur, the sticky header, its overhang, the overscroll lock, the ink
rings, the hidden menu, the viewport-sized floors, the web-app metas, `viewport-fit`,
`maximum-scale`, touch-action, text-size-adjust) moved nothing, because none of them was
the cause. The skill's own advice, *build up from minimal pages rather than down from the
app*, is what found it.

## What changed

Commits on `ios-safari-gotchas`, oldest first. The changelog refresh (`16e6098`) rides
along because it was already deployed.

| commit    | change |
|-----------|--------|
| `eae9c6e` | Probe paths: `/p/<tokens>/<route>` serves the app with `html[data-probe]` stamped server-side, gated on `PROBE_PATHS`. Safari caches its decisions **per URL path**, so every variant needs its own path. |
| `438e24c` | Edge fades driven from `requestAnimationFrame` while moving, asymmetric release; the rubber-band clamped out of scroll reads; a `[data-boot]` transition guard on every screen commit. |
| `55dd40d` | `theme-color` is the floor `#080401`, not the old brown `#1a0e08`. |
| `acd7b2c` | Every route boots in document-scroll mode (`html.doc-scroll` in the served shell), so the splash paints in flow. Fixed direct loads of every scrolling screen. |
| `0e5b2ae` | **The shell moves off `body` and onto `main`, at `calc(100lvh + inset-bottom)` with the extra padded off the bottom.** The staged and dissolving screens, the pause and round-result overlays and the rotate guard take the same shape. Fixed the in-app path. |
| the rest  | Probe tokens and the minimal pages, all inert without `html[data-probe]`. |

**Geometry is unchanged where lvh equals dvh** (Chrome, the Hubble wall): the padding is
zero and the shell is the old one byte for byte. Measured through the prod bundle on both
shells: Start 782–826, ROLL 736–824, top bar 133, mat 214–584; the non-host pause message
centred at 446. The pixel harness passes the same 41 it passed before.

## The status bar

Two different mechanisms, neither the blur the skill blamed on another site:

- **Landing:** the fixed video layer at the top defeats the sample and Safari falls back
  to `theme-color`. The brown Michael saw, `(26,14,8)`, was exactly that. On a fresh path
  the sample actually **succeeds** (`(12,6,2)`, dark, from the video), so what he was
  seeing was a per-path cached answer from an older load. The floor `theme-color` makes
  the fallback harmless either way.
- **Scrolling screens:** the sticky header defeats the sample and Safari reads the floor
  `(8,4,1)` through the translucent header stack. Painting the header a solid colour makes
  Safari sample that instead: a `#0000ff` header read `(0,0,255)`. **Left on the floor by
  choice**, since near-black under a near-black page is what the eye expects; a tinted
  header is one CSS rule away if Michael ever wants it.

## The measurement ledger

Each round, every path fresh (Safari's per-path cache reset by a distinct path or
`simctl erase`). Strip = colour at the bottom of the left margin and its height in device
pixels; magenta means the page's loud probe ground is painting through the chrome.

**Round 1, the app as it was.** Landing: status `(26,14,8)` (theme-color), strip flat
`(8,5,1)` 383px. Every scrolling screen: status `(8,4,1)`, strip flat `(8,5,1)` ~306px.
Ablating the tint strip, the blur, the sticky header: all still flat. `nosticky` made the
status-bar sample succeed on the changelog.

**Round 2.** Overscroll lock, header overhang, viewport floors, ink rings, hidden menu, all
seven at once: all still flat at `y=1500`. Loud-colour status probes showed the landing
sample succeeding on any fresh path.

**Round 3.** Both-axis overscroll, touch-action, text-size-adjust, the measuring element,
the manifest and Apple metas, `viewport-fit=cover`, `maximum-scale`, all seven at once:
still flat. One stray shot caught the loading splash and read the other mode: the clue.

**Round 4, `docfirst`.** Serving `html.doc-scroll` from the first byte flipped every direct
load: changelog `(135,2,131)` at 270px, profile `(92,2,87)`, game detail `(255,0,255)`,
nearby and sign-in `(204,0,204)`. Seven for seven. But landing → nearby and landing → menu
in-app stayed flat even after a doc-first boot.

**Round 5, `bodyfree` / `htmlfree`.** Body static with `main` at `inset: 0`: still flat.
So the shell was the ratchet, but not because of `body` specifically.

**Round 6, the minimal pages.** The table above.

**Round 7, `shelllvh`.** Landing → nearby `(204,0,204)` 294px, landing → menu
`(204,0,204)` 294px, both magenta under the toolbar for the first time; with the join
sheet's backdrop up first, `(111,2,107)`. The shell became the default.

## Final pass on plain paths

*Pending: the reviewer runs every screen on an erased device once the Mac has the memory
for the simulator. Fill in below.*

| path | status bar | strip | verdict |
|------|-----------|-------|---------|
| `/` | | | |
| `/changelog` | | | |
| `/@Mich` | | | |
| `/games/VLAWL` | | | |
| `/signin` | | | |
| `/welcome` | | | |
| `/nearby` | | | |
| landing → menu | | | |
| lobby | | | |
| board | | | |

Michael's own check on a phone, since the erased simulator cannot open a WebSocket:
https://tensies.app/p/x-create/ (lobby, Start pinned at the bottom) and
https://tensies.app/p/x-create-start/ (board, ROLL at the bottom, no rubber-band).

## Decisions left to Michael

- **`PROBE_PATHS`.** On in prod for the pass; off afterwards. The route stays in the code
  behind the flag (a measuring aid worth keeping for the next iOS release) unless he wants
  it stripped.
- **The doc-scroll status bar** stays the floor colour. See above.
- **The pixel harness** has 13 failing board tests that predate this branch: the baselines
  are from 2026-08-21 and the board's dice layout changed on 08-23 and 09-03. They want a
  recapture (`npm run baseline` in the harness against the design stack), not a fix.

## The probe tooling, for next time

With `PROBE_PATHS=1`, `/p/<tokens>/<route>` serves the app under its own URL path with
`html[data-probe="<tokens>"]` from the first byte; tokens are hyphen-joined and the router
keeps the prefix on every in-app navigation. `probe.js`, `critical.css` (utilities layer)
and `routes.py` hold them:

- **Reading:** `loud` (magenta canvas, media hidden: the only reliable tell between the
  two strip modes), `hold` (keep the splash), `y<px>` (land mid-page), `floor` (loud
  `theme-color`), `hdrbg` (blue header).
- **Reaching screens without touch:** `create`, `start`, `autojoin` on a `/<CODE>` link,
  `navnearby`, `navmenu`, `navjoin`.
- **Ablations kept as no-ops** so old paths still resolve.
- **`/p/min/<construct>`:** the minimal ratchet pages, with `none` and `sticky` as the
  negative and positive controls.

Rules that cost the most time: Safari caches per **path**, never probe by query string;
the simulator has no touch and no scroll, hence the flow tokens; a freshly erased device
loads slowly and blocks on per-site location prompts; and read the strip with a loud
ground under the fold, because the app's own floor is the same colour as the fallback fill
and the two modes look identical without it.


## Addendum, 2026-09-22: the board's own ratchet, and its limit

*iOS 27 simulator (iPhone 17), same rig as above. A second pass, on the game board
specifically, using a live fixed-element census plus a from-page-load sticky log — any
fixed/sticky box whose height lands at the dynamic viewport gets a permanent line — built
because the trigger was gone by the time anyone could look at it.*

**Found the trigger.** `.game-screen`'s own `max-block-size: 100%` — unrelated to any of
the above, there for a normal layout reason — resolves against the SMALL/dynamic viewport
for a `position: fixed` box. While `.game-screen` is `.staging`/`.dissolving` (the staged
reveal, §7's own construct, already sized to a safe `100lvh`) it's also fixed, and the cap
silently clamped it back to exactly `100dvh` for the few frames every "Start Game" takes —
a fixed box at the dynamic viewport's height, live long enough to flip Safari into
flat-fill for the rest of the page's life. Fixed with `max-block-size: none` on those two
states only. `nav-menu` had the identical latent shape (`position: fixed`, inheriting a
bare `inset: 0` with no height override) — harmless only because `visibility: hidden` kept
it out of layout while closed; hardened the same way before its first open could trip it.

**The board's own strip stays flat — by design, not oversight.** On the fixed-shell
screens, once past the layout viewport (page 714 here), *painted* content — a
`background-image`, an `<img>`, a gradient, `backdrop-filter` blur, even a playing or
paused `<video>` — does not paint, regardless of the element's own box size. Ruled out,
each measured on-device before moving to the next: `html`'s own `overflow: hidden` vs
`visible`; `html` sized taller than the viewport (894px, overflow still hidden); `#game-bg`'s
own box height; the art as an `<img>` instead of a background-image; the art on a
`::before` instead of `#game-bg` itself; a frozen intro `<video>` standing in for the still.
A plain *solid* colour is the one thing confirmed to reach the full box every time. Don't
re-attempt a CSS-only fix here without new evidence — the board's table art ending at 714
with flat ground below is prod's existing behaviour.

**The landing and lobby fixes hold.** The landing scrim is `position: fixed` on the same
box as `.bg-video` (never bare `inset: 0`), so overscroll no longer exposes raw video past
either one's edge. `.bg-video` itself gets a bottom mask-image fade (its last 40px to
transparent) — the lobby's veil is `position: absolute` and stops at the dvh line same as
everything else painted there, so the mask is what keeps the video from showing raw under
the toolbar, not the veil's own reach.


**Shipped (2026-09-23): the board bounces on an inner scroller, root stays hidden.** The
2026-09-22 lead above (`#game-bg` in-flow, `position: absolute`) turned out to be the right
half of the answer, not a dead end — the piece missing then was that the board had left the
fixed shell entirely by the time this landed (see "The lobby and board leave the fixed
shell" above), which resolved the fresh-path ratchet the old probe never could: with
nothing on the page `position: fixed` at exactly the dynamic viewport any more, a fresh
`landing → lobby → Start` overdraws behind the toolbar the same as a reconnect does. That
raised the real question this addendum's title used to pose as still-open: `#game-bg`
in-flow paints behind the toolbar, confirmed on-device — but only while `<html>` never
overscrolls at all. iOS will not rubber-band a root whose overflow is hidden, so bounce and
art-behind-the-toolbar were mutually exclusive **via the root** — every attempt to give the
root both at once (verified on-device: pull-down held with no movement, no pull-to-refresh
spinner, the art static) failed the same way.

A second idea — leave the root scrollable-but-exactly-`svh` (so it still bounces) and let
`::before` art painted on `.game-screen.active` reach past the clip edge via
`overflow-clip-margin`, avoiding the root question altogether — was checked before writing
any of it: `CSS.supports('overflow-clip-margin', '10px')` and the `content-box <length>`
form both report `false` on iOS 27 (confirmed against Safari/605.1.15 in Playwright's
WebKit, then against the property directly on-device). Not shipped; nothing to fall back to
there but the property arriving in a future release.

**What shipped instead moves the bounce, not the art.** `<html>` stays `overflow: hidden`
the whole time the board is active (critical.css, `html.doc-scroll:has(.game-screen.active)`)
— the precondition for `#game-bg`'s in-flow art to paint behind the toolbar, confirmed
holding at rest with the change in place. `.game-screen` itself becomes the thing that
bounces: a real vertical scroll container with exactly 1px of scrollable overflow (an
absolutely positioned `::after` spacer, not a resized flex child — flex children in this
column use `min-block-size: 0` specifically so they can shrink to absorb exactly this kind
of forced spacer, which is why it isn't one), block-size `100lvh` with `padding-block-end`
holding the content box at the same `100svh` every child was already laid out against, so
nothing moved at rest. iOS does rubber-band this inner scroller even with the root frozen
— device-verified in both directions (a held pull-down sits at a steady positive offset,
revealing the table, not a gap; a held pull-up sits at a steady negative offset the same
way; both spring back on release) — which was the open question this addendum used to end
on. `game-screen.js` corrects the deliberate 1px drift back to 0 once things are actually
at rest — never mid-touch, never for a value outside the legal scroll range, both checked
together, because an earlier version that skipped either guard cancelled the bounce itself
a frame after it started. The lobby and landing were not touched: they keep the ordinary
root bounce this file describes above.
