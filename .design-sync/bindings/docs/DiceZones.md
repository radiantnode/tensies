---
category: Game
---

# DiceZones

The player's board: unmatched dice scattered loose on the left, matched dice collected right with casual tilts. Parent must have a height.

```tsx
<div style={{height: 420, display: 'flex', flexDirection: 'column'}}>
  <DiceZones unmatched={[2,5,1,3,6,4]} matched={[6,6,6,6]} target={6} />
</div>
```
