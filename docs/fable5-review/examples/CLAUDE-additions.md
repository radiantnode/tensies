# Suggested additions to the project CLAUDE.md

Three short additions to `CLAUDE.md`'s "Working agreement" that turn the most
expensive recurring lessons into standing rules. Paste whichever you like; each
is written to match the file's existing voice.

---

**Declare the verification tier at the start of design work.** For any visual or
frontend task, the *first* exchange should fix how it'll be checked — "iterate
with me watching the browser; no harness, no screenshots until I say locked" vs.
"this design is final, re-baseline the pixel harness." Don't reach for the
pixel harness or screenshots during live iteration; that's for locked designs
and re-baselining only. When in doubt, ask which tier — once, up front.

---

**Two failed fixes → stop and diff the environment.** If two attempts at the
same bug both fail, do not try a third. Stop and enumerate what differs between
where it works and where it breaks (browser, dev-vs-prod build, player count,
single-vs-multi-instance, simulator-vs-real-phone, anonymous-vs-signed-in,
behind-a-proxy). Name the axes you can't determine — those are what to ask about.
Every stubborn bug here has resolved on an environment fact, usually one only the
human could see. (See the `debug-loop` skill.)

---

**Prod-smoke frontend changes before calling them done.** Dev serves raw ES
modules; prod serves the esbuild bundle from nginx, and the two paths diverge —
several bugs (a prod-only CSS bug, a module missing from the bundle) surfaced
days late because only dev was checked. For any `static/` change, do a 60-second
prod-mode boot + load before merge, not just the dev check. (The full
`/test-game` prod pass is the heavyweight version; this is the quick one.)

---

**Optional — memory hygiene.** When you finish a task that turned up a
non-obvious, durable fact (a load-bearing invariant, a workflow preference, a
gotcha that isn't in the code), write it to a memory file before ending the
turn — don't wait to be asked. Conversely, when a memory file names a file,
flag, or function, verify it still exists before acting on it; several memories
predate two frontend rewrites.
