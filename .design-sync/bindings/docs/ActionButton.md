---
category: Controls
---

# ActionButton

A circular quick-action with caption below — the Copy Link / Share / Play / Check In row. Compose several inside `<div className="lobby-actions">`.

```tsx
<div className="lobby-actions">
  <ActionButton label="Copy Link"><svg className="btn-icon" …/></ActionButton>
  <ActionButton label="Play" audio><EqIcon /></ActionButton>
</div>
```
Icons are inline SVGs sized by `.btn-icon` (24×24 viewBox, `stroke="currentColor"`).
