# Bug-report prompt template

The fastest bug fixes in the transcripts all had one thing in common: you handed
over the *discriminating clue* up front ("the bug only happens with the prod
build"). The slowest ones withheld it — not on purpose, you just hadn't isolated
it yet. This template asks for it explicitly, so if you know it, it's captured,
and if you don't, the empty slot tells Claude to go find it before guessing.

```
Bug: <what you see vs what you expect>

Where: <screen / component / endpoint>

It only happens when (fill any you know — leave blank if unknown):
- Build:     dev / prod / both / unknown
- Browser:   Chromium / Safari / Firefox / all / unknown
- Players:   solo / 2+ / unknown
- Auth:      anonymous / signed-in / unknown
- Device:    simulator / real phone / unknown
- Timing:    always / intermittent / only when fast / unknown

I suspect: <a recent change / a specific file / "no idea">

Do: reproduce it first (don't fix what you haven't seen fail). Find the exact
change that caused it and WHY, then propose the fix. If you can't reproduce it,
tell me what condition you're missing.
```

## Notes

- The "only happens when" block is the whole point. A single filled row
  ("prod build") routinely turns a multi-attempt spiral into a one-shot fix.
- "reproduce it first" is your own rule ("reproduce the bug so you can see for
  yourself") — it's here so you don't have to retype it.
- If two fixes fail, invoke the **debug-loop** skill — it forces the
  environment-diff step before a third attempt.
```
```
