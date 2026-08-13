# Tensies UI — build conventions

Tensies is a **mobile-only, dark-on-dark** design language for a real-time dice game: warm candlelit browns, a shimmering gold CTA, pink accents, bone-ivory 3-D dice. Design every screen as a **390px-wide phone column**; desktop layouts are out of character.

## Setup

No provider is required — components style themselves from the shipped CSS. Two rules matter:

1. **Dark surface always.** The shipped CSS paints `html` with `var(--color-bg)` (deep brown `#1a0e08`). Never place components on white; panels sit on `var(--color-bg)` or `var(--color-panel-screen)`.
2. **Fixed shell, inner scroll.** The app body is a fixed, non-scrolling viewport (`position: fixed; overflow: hidden` in the shipped CSS). Screens are full-height flex columns (`.screen.active`); scrolling happens *inside* containers like `ScreenBody` (`.screen-body`) or `PlayerList` (`.player-list`), never on the page.

## Styling idiom: components first, then tokens + classes

Reach for the exported components before raw markup. For your own layout glue, use the design tokens — never hard-coded colors:

| Tokens | Values |
|---|---|
| Colors | `--color-accent` (pink), `--color-success`, `--color-bg`, `--color-panel`, `--color-panel-screen`, `--color-field`, `--color-raised`, `--color-raised-hover`, `--color-border`, `--color-border-strong`, `--color-text`, `--color-text-warm`, `--color-text-muted`, `--color-text-label`, `--color-amber` |
| Type | `--font-family-heading` (EB Garamond — all headings), `--font-family-base` (Inter — body/UI). Rye + Yellowtail load too but belong **only** inside the LobbyStamp artwork |
| Misc | `--radius-md` (12px), `--shadow-text`, `--shadow-text-lg` |

Useful shipped classes for glue markup: `screen-title` (+`has-back`), `section-label`, `form-stack`, `field-hint` / `field-hint-link`, `error-msg`, `or-divider`, `lobby-actions` (row wrapping `ActionButton`s), `btn btn-primary|btn-secondary btn-block`, `loading-msg`, `sr-only`. One gold `btn-primary` per screen; everything else is `btn-secondary`.

## Where the truth lives

- `styles.css` → `_ds_bundle.css` — the app's real stylesheets, concatenated in cascade-layer order (`reset, tokens, elements, components, utilities`). Read it before inventing a style; the class you need probably exists.
- `components/<group>/<Name>/<Name>.prompt.md` — per-component usage, props, and composition examples.

## Idiomatic screen

```tsx
import { TopBar, ScreenBody, ScreenTitle, FormStack, FieldHint, TextInput, Button, OrDivider, ErrorMsg } from 'tensies-ui';

<div className="screen active" style={{ background: 'var(--color-panel-screen)', maxWidth: 390 }}>
  <TopBar username="michael" />
  <ScreenBody>
    <ScreenTitle>Good evening, Michael</ScreenTitle>
    <FormStack>
      <FieldHint>Play with any name, or <a className="field-hint-link" href="/signin">sign up</a> to keep your stats.</FieldHint>
      <TextInput placeholder="Your name" maxLength={20} />
      <Button block>Create Game</Button>
      <OrDivider />
      <ErrorMsg />
    </FormStack>
  </ScreenBody>
</div>
```

Game boards compose `TopBar` (with `PlayersBar` children) + `RoundStatus` + `DiceZones` + `RollButton`; overlays (`WinnerOverlay`, `PauseOverlay`, `Sheet`) are `<dialog>`s that paint their own full-viewport dim. Player names in copy are adjective-animal ("Dapper Badger"); game codes are 5 uppercase letters ("KQZXV").
