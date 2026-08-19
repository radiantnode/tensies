---
name: Tensies — Brass & Enamel
description: A real-time dice game rendered as hardware in a bar — brass, dark vitreous enamel, oxblood leather, smoked glass, on the commissioned imagery.
colors:
  neon-accent: "#ff4d6d"
  bar-black: "#1a0e08"
  ink-brass: "#4a2c08"
  ink-seal: "#3d2a09"
  title-cream: "#fbf0da"
  name-bright: "#fdf1d6"
  cream: "#f2e2c4"
  body: "#d3bd9a"
  body-em: "#f2dcb0"
  legend: "#bd9d6f"
  muted: "#a8906a"
  dim: "#9c8158"
  faint: "#8d7550"
  faintest: "#7d6544"
  wordmark-gold: "#f4dfae"
  burger: "#e0c288"
  chip: "#c0a377"
  secondary-text: "#bda27a"
  field-text: "#f4e7cf"
  placeholder: "#b09a78"
  stat-gold: "#e6c288"
  tag: "#c6a878"
  coin-mark: "#c2a476"
  correction: "#e2cba3"
  refusal: "#e8cd90"
  alarm-vermilion: "#e0503a"
  alarm-deep: "#a52d14"
  tick: "#e2b96e"
  hairline: "rgba(226, 183, 110, .16)"
  lip: "rgba(255, 247, 220, .9)"
  lip-dark: "rgba(96, 60, 16, .8)"
  seat: "rgba(44, 27, 9, .75)"
  ground-row: "rgba(8, 4, 1, .34)"
  ground-stat: "rgba(8, 4, 1, .38)"
  ground-chip: "rgba(10, 5, 2, .42)"
  ground-secondary: "rgba(26, 15, 7, .5)"
  ground-well: "rgba(12, 7, 3, .6)"
typography:
  display:
    fontFamily: "Besley, Georgia, 'Times New Roman', serif"
    fontSize: "1.32rem"
    fontWeight: 700
    lineHeight: 1.16
    letterSpacing: "0"
  body:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "0.02em"
  label:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "0.56rem"
    fontWeight: 800
    letterSpacing: "0.24em"
  wordmark:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 800
    letterSpacing: "0.2em"
  stat:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 800
    lineHeight: 1
  stamp:
    fontFamily: "Rye, serif"
    fontSize: "2rem"
    fontWeight: 400
    letterSpacing: "0.1em"
rounded:
  md: "12px"
  mat: "8px"
  die: "10px"
  seal: "14px"
  thread: "2px"
  coin: "50%"
  pill: "999px"
spacing:
  board-inset: "20px"
  screen-inline: "1.5rem"
  screen-block: "2rem"
  list-gap: "8px"
  row-pad: "9px 11px"
  field-pad: "0.88rem 1rem"
components:
  button-primary:
    backgroundColor: "var(--brush), var(--brass)"
    textColor: "{colors.ink-brass}"
    rounded: "{rounded.md}"
    padding: "0.86rem 1rem"
  button-primary-disabled:
    backgroundColor: "var(--brass-off)"
    textColor: "#3a2a12"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.ground-secondary}"
    textColor: "{colors.secondary-text}"
    rounded: "{rounded.md}"
    padding: "0.86rem 1rem"
  input-well:
    backgroundColor: "{colors.ground-well}"
    textColor: "{colors.field-text}"
    rounded: "{rounded.md}"
    padding: "{spacing.field-pad}"
  back-chip:
    backgroundColor: "{colors.ground-chip}"
    textColor: "{colors.chip}"
    rounded: "{rounded.coin}"
    size: "36px"
  roll-coin:
    backgroundColor: "var(--brush), var(--brass)"
    textColor: "#5c3a0c"
    rounded: "{rounded.coin}"
    size: "88px"
---

# Design System: Tensies — Brass & Enamel

<!-- Recorded from the shipped build (branch brass-and-enamel, 2026-08-19), direction
"Brass & Enamel", seed 92e7aa3d. The direction contract is the comment block at the top
of static/css/critical.css. The authoritative design record — reasons, rejected
alternatives, owner-pinned constraints — is .impeccable/surfaces/static-index-html.md,
.impeccable/mocks/CANON.md, and the sidecars in .impeccable/mocks/*.json. This file
records the system the build actually follows; cite those for why. -->

## Overview

**Creative North Star: "Hardware in a Bar"**

The interface is not a screen laid over a bar photograph — it is the bar's own
hardware: struck brass you press, dark vitreous enamel you read against, oxblood
leather you set dice on, smoked glass the room shows through. Everything sits ON
the commissioned imagery, never replacing it; a transparent surface has nothing
opaque behind it. The system in one paragraph (from the locked record in
critical.css): brass is ONLY for things you press (plus the struck Roll Trust
seal); content is quiet on faint grounds; fields are dark recessed wells with no
gold rim; glass shows the bar through; nothing glows — brass is lit by its edges.

Density is a phone table-top: one hand, one thumb, one primary action per screen.
Voice splits in two registers: the product speaks Besley cream on dark enamel;
instruments (Roll Trust, the radar, machine status) speak widened Archivo
small-caps — furniture versus apparatus. Confirmed rejections, all observed in
the shipped CSS: no glows or halos anywhere, no gradient-clipped text, no accent
focus rings, no blank-disc or silhouette avatars, no ad-hoc z-indices.

**Key Characteristics:**
- Physical materials, physically lit: brass carries a struck lip, a dark under-lip, and a seat shadow — never an outer bloom.
- One gold voice per surface: the pressable thing is bright; everything else steps back into faint translucent grounds.
- Two typographic registers: Besley (display, letter-spacing 0) and Archivo (everything else, width axis at 106–118% for legends).
- Depth is recession, not elevation: wells, bays, and mats are cut INTO the surface with inset shadows.
- A four-step error ladder that reserves its only saturated red for one event in the entire app.

## Colors

A single warm column — cream through gold through umber into bar-black — with one
neon pink and one vermilion, each confined to a single literal referent.

### Primary
- **Keeper Gold** (`--brass`: `linear-gradient(180deg, #f8d379 0%, #e6ba6a 55%, #c69540 100%)`, always painted under `--brush`, the five-mottled-pool + hairline-grain stack; locked in `gold.json`): the pressable metal. Primary buttons, the 88px Roll coin, the account coin ring, the assay seal. **Brass is only for things you press, plus the struck Roll Trust seal** — nothing informational is gold-plated.
- **Polished Gold** (`--brass-hot`): the nearly-there progress state — brighter polished gold, never pink.
- **Doused Brass** (`--brass-off`: `#7d6136 → #57411f`): disabled brass. Same hue, no light — lit lip gone, seat gone, plate flat in its recess.
- **Brass Ink** (#4a2c08): lettering engraved on gold, with a `0 1px 0` cream relief highlight (raised, never cut).

### Secondary
- **Dark Vitreous Enamel** (`--enamel-face` / `--enamel-coin`: radial `#33200f → #100804` under a cream top-light): the target die, the action rings, coin centres — the readable dark object gold sits against.
- **Oxblood Leather** (the mat, game.css: radial `#4a2117 → #230d0a` with cross-grain and a stitch line inset 5px): the one leather surface; dice set aside land on it.
- **Amber Rule** (`--rule-amber`: an amber hairline brightening to `rgba(255,203,110,.85)` at centre): the closing rule under menu and pre-game headers — the only boundary those bars get.

### Tertiary
- **Neon Pink** (#ff4d6d, `--color-accent`): legitimate ONLY where something is literally neon — the logo mark and the sign in the landing video. It styles no shipped UI element.
- **Vermilion** (#e0503a, with #a52d14 deep): exactly ONE use in the app — a Roll Trust verification failure (the voided seal's strike-bar and the `is-fail` verdict line, game-detail.css). Never for a bad code, a rate limit, or a full table.

### Neutral
The ink ramp, brightest to quietest — all warm, all on dark grounds:
- **Title Cream** (#fbf0da): Besley display headings.
- **Cream** (#f2e2c4): row names, control labels; the body default on `<body>`.
- **Body** (#d3bd9a) with **Body Emphasis** (#f2dcb0): running prose and its bolds.
- **Legend** (#bd9d6f) → **Muted** (#a8906a) → **Dim** (#9c8158) → **Faint** (#8d7550) → **Faintest** (#7d6544): small-caps legends, metadata, stat labels, asides, step instructions — a five-step descent used consistently across surfaces.
- **Wordmark Gold** (#f4dfae): TENSIES — solid warm gold, never gradient-clipped.
- **Grounds** (`--ground-row` .34 → `--ground-well` .6): near-black translucent washes (`rgba(8,4,1,…)` family). Content rows, stat tiles, chips, and wells take a ground and at most one faint inset hairline — no rims.

### Named Rules
**The Pressable Brass Rule.** Keeper gold appears only on controls you press — plus the struck Roll Trust seal, which is a mark of assay, not a control. If it isn't pressed and isn't the seal, it isn't brass.

**The One Neon Rule.** #ff4d6d appears only where the depicted object is literally neon (the logo mark, the sign in the landing video). It is never a UI accent.

**The Error Ladder Rule.** (alarm.json) Four registers, in order: *correction* — cream (#e2cba3), text alone, you mistyped; *refusal* — the identical form in amber (#e8cd90), the house is not serving you right now (including the terminal "Tab closed" frame); *unknown* — the unstruck disc, present but not asserting; *alarm* — vermilion, exactly one use in the app: a Roll Trust failure.

**The Quiet Ground Rule.** Content sits on faint translucent grounds with no rims. A brighter state is a brighter *edge* (the inset hairline steps up), never a border, a fill, or a halo.

## Typography

**Display Font:** Besley (variable 400–900, with Georgia fallback) — a Clarendon revival out of the whiskey-label tradition. Display roles ONLY.
**Body Font:** Archivo (variable, weight 100–900, width 62–125%) — body, buttons, legends, scores, all data. The width axis is the point: legends are WIDENED (118%), not just tracked.
**Stamp Faces:** Rye (the engraved game code, panels, banner) and Yellowtail (the script watermark) — confined to the lobby stamp (stamp.css, owner-pinned) and the game-detail code.

**Character:** A whiskey label read by candlelight: a slab-serif voice for what the house says, a widened grotesque for what the instruments say. Every text on imagery carries a black text-shadow (`--shadow-text` / `--shadow-text-lg`) — legibility comes from ink and shadow, never from a glow.

### Hierarchy
- **Display / Screen Title** (Besley 700, 1.32rem, 1.16, letter-spacing 0, #fbf0da): screen headings; sizes are binding per `type-lock.json`. Larger Besley moments (winner name, overlays, sheets) keep letter-spacing 0.
- **Wordmark** (Archivo 800, 1.2rem, 0.2em, stretch 118%, uppercase, #f4dfae): TENSIES in the lockup — owner-pinned geometry: 40px mark, −10px overlap, z-index 2.
- **Legend / Section Label** (Archivo 800, 0.56rem, 0.24em, stretch 118%, uppercase, #bd9d6f): the small-caps register for section labels, round labels (0.26em on the board), dividers, and step legends.
- **Body** (Archivo 600, ~0.9–1.05rem, 1.45–1.5, 0.02em, #d3bd9a): running prose and messages.
- **Data / Stat** (Archivo 700–800, tabular-nums, stretch 106–112%): scores, counts, countdowns, stat-tile numerals (#e6c288), instrument status lines.
- **Code** (ui-monospace 700, 1.5rem, 0.42em tracked, uppercase) for code *entry*; Rye 2rem 0.1em (#f0d9a6) for the code *displayed* as an artifact.

### Named Rules
**The Besley-Zero Rule.** Besley is always set at letter-spacing 0, at every size. Tracking belongs to Archivo's legend register, and width belongs to Archivo's stretch axis.

**The Tabular Figures Rule.** Every numeral that can change — wins, counts, timers, distances, roll counts — is `font-variant-numeric: tabular-nums`. Numbers never reflow their row.

**The No-Clip Rule.** No gradient-clipped text anywhere in the app. Gold lettering is a solid warm ink (#f4dfae) with shadow; brass lettering is engraved ink with a one-pixel cream relief.

## Layout

Mobile-only, one column, thumb-first — validated at 390×844 @2×. `<body>` is
`position: fixed; inset: 0` with all scrolling internal to screens; every screen
is a full-height flex column (`.screen.active`) with `overflow: hidden`, and
scrollable regions (player list, changelog, places list) wear the 24px
scroll-fade edge mask (controls.css) instead of showing scrollbars. Safe-area
insets are added *outside* design paddings — e.g. the board's roll area keeps one
20px inset on both edges with `env(safe-area-inset-bottom)` added below it,
never folded in (owner-pinned, board.json).

Rhythm is tight and consistent: 20px screen inline padding on data surfaces,
`2rem 1.5rem` on centred bodies, 7–8px gaps between rows, 12px radius on every
rectangular container. The board runs on one variable: `--die-size: 52px` (46px
under 600px viewport height) sizes table dice, mat dice, and the target die
alike — table and mat dice are always ONE size (owner-pinned). Landscape phones
(≤500px tall) get the full-screen rotate lockout, never a reflow. On the Hubble
wall (`html[data-hubble]`) every backdrop-filter goes flat and its scrim takes a
step more ink — a performance fallback, not a second design.

**The Named Z Rule.** Every stacking layer has one named token on the `--z-*`
scale in critical.css (scrim −1 → content 1 → chip 6 → chrome 10 → banner 12 →
menu 20 → chrome-over-menu 22 → dissolve 60 → guard 1000); ad-hoc z numbers are
forbidden. Modal `<dialog>`s live in the browser top layer, outside the scale.
Screen scrims paint on `::before` at `--z-scrim` so screen roots never become
stacking contexts (see .impeccable/handoff/LAYERING.md).

## Elevation & Depth

Depth is *recession*, not elevation. The dominant shadow direction is inset:
fields are wells cut into the surface (`inset 0 3px 7px` black), the Roll Trust
bay is recessed darker than its page, the mat sinks with `inset 0 -9px 18px`.
The only things that rise are brass objects — and they rise by being *struck*,
not by glowing: a lit top lip, a dark bottom lip, a seat shadow beneath, and a
soft black drop. Text sits on imagery via black text-shadows. There is no
ambient glow, no halo, no `box-shadow` bloom anywhere in the shipped system.

### Shadow Vocabulary
- **The struck edge** (`--edge-struck`: `inset 0 1.5px 0 var(--lip), inset 0 -1.5px 0 var(--lip-dark), 0 2px 0 var(--seat), 0 8px 20px rgba(0,0,0,.6)`): the brass button treatment. Scales up on the Roll coin (2px lips, `0 3px 0` seat) and down on the account coin (0.5px lips).
- **The well** (`inset 0 3px 7px rgba(0,0,0,.8)` + a faint inset hairline + `0 1px 0` cream under-light): inputs, threads, scan bays.
- **The ground hairline** (`inset 0 0 0 1px rgba(226,183,110,.16–.42)`): the one permitted edge on rows, tiles, chips, and rings; state brightens its alpha.
- **Text shadows** (`--shadow-text: 0 1px 4px rgba(0,0,0,.9)`, `--shadow-text-lg: 0 2px 10px`): every string over imagery.
- **Drop seats** (`drop-shadow`/`0 …px 26px rgba(0,0,0,.6–.85)`): the logo mark and free-standing objects are seated by a plain black drop, never a colored one.

### Named Rules
**The Lit-by-Edges Rule.** Nothing glows. Brass is lit by its edges: a lit state or an active ring is a brighter lip and rim hairline — never an outer bloom, halo, or animated sweep.

**The Dimmer-Not-Different Rule.** Disabled brass keeps its HUE and loses its LIGHT (`--brass-off`, flat in its recess, no lit lip, no seat). Never desaturate — that reads as a different metal, not a dimmer one.

**The Masked-Stop Rule.** A backdrop-filter surface that must stop is MASKED (`mask-image` to transparent), never faded — the blur is not clipped by the element's own background, so fading only the colour leaves the blur ending on a hard seam. The board top bar is the canonical case.

**The Two Boundaries Rule.** Menus and pre-game headers add nothing of their own — the screen scrim runs unbroken beneath them and the amber rule is their only boundary. The board bar is frosted and dissolves via its mask into the table, with no rule. Two treatments, one reason each: do not unify them.

## Shapes

Rectangles are gently rounded at one radius (12px, `--radius-md`) — buttons,
fields, rows, tiles, dialogs. The instruments are circles: the Roll coin, action
rings, account coins, avatar seats, back chips, the radar, the assay seal.
Brass circles carry a turned inner line (an inset ring ~4–6px in from the edge),
as a struck coin has. The signed-in pill is a full capsule (999px). Departures
are physical: the mat at 8px with its stitch line inset 5px, dice at 10px, the
trust bay at 14px. Objects that are "set down" sit at slight angles — the target
die at −8deg, mat dice with per-slot jitter (±1px, ±2–6deg) so they read as
placed by hand, not gridded. Hairline geometry is honest: the radar's brass is
masked to a TRUE RING — the middle is genuinely glass and the bar shows through.

**The Struck Monogram Rule.** A player with no photo gets a struck monogram —
their initial in Besley (#caa66f, ~47% of the disc) on the warm seat gradient —
never a blank disc, never an enlarged silhouette. The seat (`.avatar-seat`,
shell.css) is the single shared implementation; consumers set only size.

## Components

### Buttons
- **Shape:** gently rounded (12px); block buttons max out at 400px.
- **Primary** (`.btn-primary`): keeper gold — `var(--brush), var(--brass)` — with the struck edge, engraved brass ink (#4a2c08) with cream relief, Archivo 800 at stretch 106%, `0.86rem 1rem` padding. Always paint `--brush` over `--brass` so every brass site carries the whole keeper stack (mottled pools + hairline grain).
- **Active:** the object seats — `translateY(1px)` (2px on the Roll coin) with the seat shadow shortening. No color change.
- **Disabled:** `--brass-off` per the Dimmer-Not-Different Rule; secondary disabled is opacity .45.
- **Secondary** (`.btn-secondary`): steps well back — `--ground-secondary` wash, muted text (#bda27a), sentence weight 600, stretch 100%, one faint brass inset hairline. "The other option", never a second primary.
- **Round action rings** (`.lobby-action`, 56px): one fine brass hairline (alpha .42) on a dark enamel disc — quick secondary taps. Lit/armed state brightens rim to .75 and top lip to .28; deliberately no bloom.

### Inputs / Fields
- **Style:** a dark recessed well (`--ground-well`) with NO border and NO gold rim; deep inset black shadow, a .09-alpha inset hairline, a 1px cream under-light. Centred, 600-weight field text (#f4e7cf).
- **Focus:** brightens the well's own hairline (.09 → .22) — never an accent ring.
- **Error:** a field that produced a correction DIMS its own edge (.09 → .04) — the quietest possible "this one" pointer. It never takes the alarm colour. Message text follows the Error Ladder (cream correction, amber refusal).
- **Code entry:** monospace, 0.42em tracked, uppercase, with matching text-indent to stay optically centred.

### Cards / Containers
- **Rows** (players, standings, venues): `--ground-row` wash, 12px radius, a .045-alpha inset top-light, `9px 11px` padding, 7–8px stack gap. Leaders brighten (seat ring to .3, name to cream) — no gold.
- **Stat tiles:** `--ground-stat`, .16 hairline, gold tabular numerals (#e6c288) over 0.46rem dim small-caps labels.
- **The trust bay** (signature container): recessed radial ground darker than the page, deep inset shadows, 14px radius, its assay seal breaking the top edge — the object announces the area, so nothing is labelled.

### Navigation
- **Top bar:** one shared title row everywhere (shell.css). Pre-game/menu bars are transparent with the amber closing rule; the board bar is frosted (blur(4px), .62→.5 scrim) and masked to nothing per the Masked-Stop Rule. The lockup is owner-pinned; the hamburger is three 19×1.5px burger-gold lines that fold to an X.
- **Signed-in pill** (`.header-username`): capsule, dark well ground, one flat rim; the 24px account coin is the only gold on it. The pill is the row's only flexible item, so it truncates and the lockup cannot be pushed. On the board, the account mark appears ALONE — 24px, no handle, not pressable (board-signedin.json).
- **Back chip** (`.btn-back`): navigation, not an action — the quietest thing on the screen. A 36px dark disc, inset hairline (.1), muted chevron (#c0a377).

### The Brass Thread (signature)
The app's ONE progress mark (`.thread`): a 132×3px dark channel with a brass
fill — shared by the loading screen, round-result countdown, pause cap, and A2HS
steps. Indeterminate is a 46% brass sweep (1.4s ease-in-out); under
reduced-motion it reads as a settled 46% fill, never an empty channel. The Roll
Trust scan bay is its instrument cousin (a warm sweep, paused mid-pose during
transitions).

### The Assay Seal (signature)
The Roll Trust seal (`.gd-seal`): 52px struck brass, one object, three states —
struck (passed), *unstruck* (saturate .4 / brightness .7 — present but not
asserting), and *voided*: the same disc with a vermilion strike-bar rotated
−24deg on top, the glyph dimmed beneath so the bar is unambiguously on top.
Vermilion's one appearance in the app.

### Dice (signature)
3-D CSS dice: warm ivory bone faces (`radial #fbf7ef → #e2d4bd`, keyed to the
bar photo's upper-left light) with drilled dark pips; the enamel target die
inverts this (dark face, gold pips). Mat dice are the SAME dice — same size,
same pips — only the contact shadow tightens.

## Do's and Don'ts

### Do:
- **Do** paint every brass site as `background: var(--brush), var(--brass)` and give it the struck edge — the keeper stack travels whole.
- **Do** put content on `--ground-*` washes with at most one faint inset hairline; brighten the hairline (not the fill) for state.
- **Do** set Besley at letter-spacing 0 and widen Archivo legends to 118% stretch at 0.24em; use tabular-nums on every mutable numeral.
- **Do** mask a backdrop-filter surface that must stop (`mask-image` to transparent), and give every `html[data-hubble]` blur a flat fallback with a step more ink.
- **Do** take z-index only from the named `--z-*` scale, paint screen scrims on `::before` at `--z-scrim`, and check LAYERING.md before adding a stacking context.
- **Do** use the struck monogram (Besley initial on the seat gradient) whenever a player has no photo.
- **Do** climb the error ladder in order — cream correction, amber refusal, unstruck disc — and reserve vermilion for a Roll Trust failure alone.

### Don't:
- **Don't** let anything glow: no halos, blooms, outer color shadows, animated sweeps on brass, or glowing focus rings. A lit state is a brighter edge.
- **Don't** gradient-clip text, anywhere. The wordmark is solid #f4dfae.
- **Don't** put brass on anything that isn't pressed (the assay seal is the sole exception), and don't gold-rim a field — fields are dark wells.
- **Don't** desaturate disabled brass — swap to `--brass-off` (same hue, less light).
- **Don't** use #ff4d6d outside a literal neon object, or #e0503a outside the Roll Trust failure.
- **Don't** unify the two header boundaries: menus keep the amber rule; the board keeps its masked fade.
- **Don't** "fix" the mat's stitch line (game.css) or the radar's rings (nearby.css) as grid-background artifacts — they are the world's own devices (a stitched leather edge; a measurement dial) and are sanctioned. Detectors flag both; both are false positives.
- **Don't** restyle `stamp.css` (owner-pinned; it still consumes the legacy `--color-text*` aliases kept for it) or extend this system into `widget.css` piecemeal — the widget is an uncomped surface still on the old system, pending its own pass.
