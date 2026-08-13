---
category: Game
---

# Die

One 3-D bone-ivory die — a CSS cube with six pip faces, rotated so `value` faces front. `matched` marks it locked on the round target (same ivory material by design — matched-ness reads positionally; the pink accent lives on RoundTarget); `tumbling` runs a roll animation.

```tsx
<Die value={4} />
<Die value={6} matched />
<Die value={2} tumbling="a" />
```
