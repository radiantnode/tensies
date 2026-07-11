---
category: Game
---

# PlayerCard

A players-bar mini card: name, "you" badge, wins chip, dice-progress bar. `hot` = opponent at 7+ matched (red); `disconnected` dims.

```tsx
<PlayerCard name="Dapper Badger" wins={2} matched={7} hot />
<PlayerCard name="You" isMe wins={3} matched={4} leading />
```
