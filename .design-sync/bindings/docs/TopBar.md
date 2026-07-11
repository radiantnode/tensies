---
category: Chrome
---

# TopBar

The branded top bar: dice logo + "Tensies" wordmark + hamburger. Pre-game screens use it alone; the game screen passes a PlayersBar as children.

```tsx
<TopBar username="michael" />
<TopBar>
  <PlayersBar>…</PlayersBar>
</TopBar>
```
