# Installable PWA — "Add to Home Screen" & full-screen web app

Tensies is an installable **Progressive Web App**. Added to the home screen it
launches **standalone** — its own task, full screen, no browser chrome, portrait
locked — so it looks and feels like a native app. This document covers the two
halves of that: the **standalone/full-screen plumbing** (manifest + meta tags +
safe-area layout) and the **install UX** that nudges users to add it (the
landing banner and the animated walkthrough).

Mobile-only, like the rest of the app — none of this renders on desktop.

---

## TL;DR

| Piece | Where |
|---|---|
| Web-app manifest (`display: standalone`, portrait, icons, colors) | `static/manifest.webmanifest` |
| iOS/Android meta tags (apple-mobile-web-app-*, theme-color, viewport-fit) | `static/index.html` `<head>` |
| Safe-area (notch / home-indicator) layout | `env(safe-area-inset-*)` across `critical.css`, `shell.css`, `menu.css`, `game.css`, `overlays.css` |
| Install detection + orchestration | `static/js/a2hs.js` |
| Animated walkthrough overlay | `static/js/components/a2hs-guide.js` + `static/css/a2hs.css` |
| Landing banner | `static/js/components/landing-screen.js` (`#mountInstallBanner`) |
| Nav-menu "Add to Home Screen" entry | `static/js/components/nav-menu.js` (`#mountInstallEntry`) |
| Boot wiring (`setupInstall()`) | `static/js/app.js` |
| Pixel baselines | `.claude/skills/frontend-rewrite/harness/a2hs.spec.js` |

---

## Part 1 — Standalone / full-screen ("web app")

### The manifest

`static/manifest.webmanifest`, linked from `<head>` via
`<link rel="manifest">`:

```json
{
  "id": "/", "start_url": "/", "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#1a0e08",
  "theme_color": "#1a0e08",
  "icons": [ …192, 512, 512-maskable… ]
}
```

- **`display: standalone`** — a home-screen launch runs in its own window/task
  with no address bar or tabs. On Android this is what makes the install
  eligible; on iOS it pairs with the apple-* meta tags below.
- **`orientation: portrait`** — locks orientation **for the installed PWA**.
  (In a browser tab there is no real web orientation lock — see the rotate
  overlay note below.)
- **`background_color`/`theme_color`** — the splash/letterbox and system UI
  tint, matched to the bar-top palette (`#1a0e08`).
- **maskable icon** — `icon-512-maskable.png` lets Android crop the icon to the
  launcher's shape without clipping the dice.

### iOS / Android meta tags (`static/index.html`)

iOS Safari does not read most of the manifest, so the standalone behavior is
driven by Apple meta tags:

| Tag | Effect |
|---|---|
| `apple-mobile-web-app-capable = yes` | iOS launches standalone (no Safari chrome) |
| `apple-mobile-web-app-status-bar-style = black-translucent` | content extends **under** the status bar; we reclaim that space with safe-area padding |
| `apple-mobile-web-app-title = Tensies` | the home-screen label |
| `apple-touch-icon` (`apple-touch-icon-180.png`) | the iOS home-screen icon |
| `mobile-web-app-capable = yes` | the standards/Android equivalent |
| `theme-color = #1a0e08` | Android status-bar tint |
| `viewport … viewport-fit=cover` | lets the page paint into the notch/safe areas (required for the insets to be non-zero) |

### Safe-area layout (notch + home indicator)

Because the status bar is **translucent** and `viewport-fit=cover` lets us paint
edge-to-edge, every screen pads itself out of the unsafe zones with
`env(safe-area-inset-*)`. Key spots:

- `critical.css` — `html` is sized `100% + safe-area-top + safe-area-bottom` and
  `body` is pulled up by `-safe-area-bottom`, so the bar-top background fills the
  whole device including behind the status bar and home indicator. The loading
  screen pads top/bottom by the insets.
- `shell.css` / `menu.css` — the top bar and nav menu pad `safe-area-inset-top`
  and paint an opaque shield behind the status-bar zone so scrolled content
  never bleeds through the clock/signal area.
- `game.css` / `lobby.css` / `overlays.css` — bottom controls and overlays pad
  `safe-area-inset-bottom` to clear the home indicator.

> Net effect: in standalone mode the app is genuinely full-bleed (wood
> background to all four edges) while text and controls stay inside the safe
> area. The same CSS is harmless in a normal browser tab, where the insets
> resolve to `0`.

### Orientation: the manifest locks, the web can't

The manifest's `orientation: portrait` only binds an **installed** PWA. In a
plain browser tab there is no web API to lock orientation on iOS, so a
landscape phone gets the pure-CSS **rotate overlay** (`#rotate-overlay` in
`index.html`, styled in `critical.css` under a `max-height` landscape media
query) asking the user to rotate back. It paints with no JS, like the loading
screen.

---

## Part 2 — The install UX

Apple gives iOS Safari **no install prompt or API** — the only path is the
Share sheet's "Add to Home Screen", which is unintuitive and undiscoverable.
Android Chrome *does* fire `beforeinstallprompt` (one-tap native install). So
the UX scales the hand-holding to how unintuitive the platform is.

### Detection — `static/js/a2hs.js`

```
getPlatform() → 'ios' | 'android' | null
```

- **`ios`** — iPhone/iPad UA (incl. iPadOS reporting a touch-Mac), Safari only
  (Chrome/Firefox/Edge on iOS — CriOS/FxiOS/EdgiOS — return `null`; they can't
  add to the home screen).
- **`android`** — Android UA.
- **`null`** — desktop, in-app browsers, or **already installed**
  (`isStandalone()` via `display-mode: standalone` / `navigator.standalone`).

Everything below is gated on `getPlatform()` being non-null, so nothing renders
on desktop or when the app is already installed. `setupInstall()` (called once
in `app.js`) captures Android's `beforeinstallprompt` into a deferred prompt and
listens for `appinstalled` to tear the offer down.

### Entry points

1. **Landing banner** — a dismissible top, smart-banner-style strip
   ("Add to Home Screen / Faster launch, full screen & more"). Mounted by
   `landing-screen.js::#mountInstallBanner()` when `shouldOfferInstall()`
   (platform present, not already dismissed). The landing header slides below it
   (its height is measured into `--a2hs-banner-h`); it hides while the nav menu
   is open. **It never auto-opens a modal.**
2. **Nav-menu entry** — a permanent "Add to Home Screen" item
   (`nav-menu.js::#mountInstallEntry()`), gated on `getPlatform()`. Always opens
   the walkthrough as a "show me how" escape hatch.

### The primary action — `requestInstall()`

The banner CTA runs `requestInstall()`, which is platform-smart:

| Situation | Behavior |
|---|---|
| **Android, native prompt captured** | Fires Chrome's one-tap install dialog directly (`triggerNativeInstall()`) — **no walkthrough**, nothing to teach. |
| **Android, no prompt** (Firefox, in-app browser, criteria not met) | Falls back to the ⋮-menu walkthrough. |
| **iOS** | Always the walkthrough (no install API exists). |

The nav-menu entry always calls `openGuide()` (the walkthrough), regardless.

### The walkthrough — `<a2hs-guide>`

A body-level `<dialog>` (`a2hs-guide.js` + `a2hs.css`) with a CSS/SVG phone
mockup that cross-fades through synced steps, with **progress dots** under the
phone and a caption that swaps to the active step. Inert (no box) until opened
via the `a2hs-open` document event.

- **iOS (4 steps):** Tap **Share** → Choose **Add to Home Screen** (with a
  "swipe up if you don't see it" hint, since the row is often below the fold) →
  Tap **Add** → Open **Tensies** from your Home Screen. The mockup reproduces the
  real Safari chrome (floating bar, share sheet, the Add-to-Home-Screen
  confirmation card), an iOS **status bar + Dynamic Island** showing the user's
  **real local time**, and the phone screen showing an actual signed-in landing
  screenshot (`static/images/landing-mich.webp`) scaled to fit.
- **Android (3 steps):** Tap the **⋮ menu** → Choose **Install app** → Tap
  **Install**. When a native prompt is available the overlay also shows an
  **Install Tensies** button that fires it.

Respects `prefers-reduced-motion` (no auto-advance); the dots are tappable so
every step is reachable without animation.

### Dismissal

`dismissBanner()` persists to `localStorage` (`tensies_a2hs_dismissed`); the
banner won't re-offer once closed (or once `appinstalled` fires). The nav-menu
entry ignores this — it's always available.

---

## Dev override & testing

A **localhost-only** query param forces a platform so the gated UI can be driven
in a desktop browser or Playwright without spoofing the whole user-agent:

```
http://localhost:8888/?a2hs=ios
http://localhost:8888/?a2hs=android
```

(`a2hs.js::forcedPlatform()` only honors it on `localhost`/`127.0.0.1`.)

Pixel baselines for the banner and the four iOS steps live in
`.claude/skills/frontend-rewrite/harness/a2hs.spec.js`. They drive the UI via
the `?a2hs=ios` override, pin the clock (so the mock status bar is byte-stable),
and freeze each step by clicking its progress dot. Regenerate with:

```bash
cd .claude/skills/frontend-rewrite/harness
TENSIES_URL=http://localhost:8888 npx playwright test a2hs.spec.js --update-snapshots
```

---

## Gotchas

- **iOS standalone has no JS install hook.** You cannot detect "did the user
  add it?" beyond `navigator.standalone` once they relaunch from the icon. The
  walkthrough is purely instructional.
- **Android's native prompt is one-shot-ish.** After `prompt()` the deferred
  event is consumed; a second banner tap falls through to the walkthrough.
- **`black-translucent` means content paints under the status bar** — always pad
  new top-edge UI with `env(safe-area-inset-top)` or it'll sit under the clock.
- **The landing screenshot is a static asset.** `landing-mich.webp` is a real
  capture (signed in as "Mich", with a top safe-area inset baked in). If the
  landing design changes, regenerate it; it won't update automatically.
