---
category: Overlays
---

# GameMenu

The in-game host menu: Pause/Resume toggle with sliding switch, live pause status (countdown + who's missing), and the danger End Game item. Fills its nearest positioned ancestor.

```tsx
<div style={{position: 'relative', height: 500}}>
  <GameMenu paused remaining="54:07" waitingOn="Waiting on Salty Walrus…" />
</div>
```
