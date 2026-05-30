---
name: changelog
description: "Generate a friendly, player-facing changelog from the git history. Reads the full git log, lumps related commits into significant changes, groups them by day (newest first), and writes a simple, warm, lightly humorous markdown file — the opposite of a raw commit dump. Use when the user asks for a changelog, a \"what's new\", release notes, or wants to refresh docs/CHANGELOG.md."
user_invocable: true
---

# Tensies Changelog Generator

Turn the git history into a changelog a *player* would enjoy reading — friendly,
plain-English, a little funny, not a wall of commit hashes. The audience is
someone who plays the dice game, not someone who writes it.

**Output file:** `docs/CHANGELOG.md` (overwrite it each run). If the user names a
different path, use that instead.

**Don't ask for confirmation.** Generate the file and report where it landed.

---

## The voice (read this first — it's the whole point)

The changelog should sound like a friendly human telling a friend what got better
this week. Keep these rules in mind:

- **Plain English, no jargon.** A player doesn't know what a "WebSocket" or a
  "delayed broadcast" is. Say what *changed for them*: "rolls feel snappier now."
- **Simple and short.** One line per change. If you can't explain it in a
  sentence, it's probably an under-the-hood thing — fold it away (see below).
- **Warm and a little funny.** A light joke is welcome; a groan-worthy pun in
  moderation is on-brand. Never sarcastic, never mean, never forced.
- **Emojis sparingly.** At most one per day heading, and only where it genuinely
  adds something. A changelog peppered with 🎉🚀✨ on every line reads like spam.
  When in doubt, leave it out.
- **Lead with the player.** "You can now invite friends by text" beats "Added SMS
  invite button."
- **Group, don't list.** Several commits that together make one improvement become
  *one* bullet. The reader wants the story, not the keystrokes.

Translation examples (technical commit → friendly line):

| Commit message | Friendly changelog line |
|----------------|-------------------------|
| `Join via link + SMS invite button` | You can now invite friends with a tap — share a link or fire off a text. |
| `Fix roll-ack hang when re-roll lands on same dice values` | Fixed a sneaky freeze when your re-roll landed on the exact same numbers. Spooky, but no longer sticky. |
| `Add host-only Pause Game toggle as the menu's first feature` | Hosts can now pause the game — perfect for snack breaks and "wait, who's winning?" moments. |
| `Persist dice scatter positions across refresh/reconnect` | Your dice stay put now, even if you refresh or your phone naps. |
| `Split server into server/ package` | *(under-the-hood — tidied the engine room, nothing to see on screen)* |

---

## Phase 1 — Gather the history

Pull the full log, oldest to newest, with the author date, short hash, and subject:

```bash
git log --reverse --date=short --format="%ad|%h|%s"
```

If the user asks for a partial range (e.g. "since last week", "for v2"), add
`--since=…` / `--until=…` or a `<tag>..HEAD` range. By default, cover **all**
history.

If you need more than the subject line to understand a change (the subject is
cryptic, or you want to confirm what a cluster of commits actually did), read the
body or the diff stat:

```bash
git show <hash> --stat
git log <hash> -1 --format="%b"
```

Don't over-research — most subjects are self-explanatory. Dig only when a change
looks significant but the one-liner is opaque.

## Phase 2 — Group by day, then lump into significant changes

1. **Bucket commits by calendar day** (the `%ad` date). Each day is a section.
2. **Within each day, cluster related commits into a handful of significant
   changes.** A "significant change" is a theme a player would notice, not a
   single commit. For example, five commits that build the pause feature
   (`Add pause toggle`, `Show paused screen`, `Keep paused games alive`,
   `Harden pause…`, `Pause menu polish`) collapse into **one** bullet about
   pausing — maybe with a sub-note if the polish is worth calling out.
3. **Decide what's player-facing vs. under-the-hood.** Refactors, file moves,
   test-harness work, CLAUDE.md updates, telemetry/dashboard plumbing, and merge
   commits are *not* features a player sees. Don't list them individually.
   Instead, end a day with a single light line when there was real invisible work,
   e.g. *"Under the hood: tidied up the codebase and beefed up the test suite."*
   Skip the line entirely on days that were purely internal with nothing fun to
   say.
4. **Drop pure noise.** Merge commits, "fix typo", and test-run log entries don't
   each earn a mention.

Aim for **2–5 bullets per active day**. If a day genuinely had one thing, one
bullet is fine. If it had ten commits that were all the same feature, still one
bullet.

## Phase 3 — Write the markdown

Structure, **newest day first** (a changelog is read top-down for "what's new"):

```markdown
# What's New in Tensies 🎲

A friendly log of everything that's changed. Newest stuff up top.

## <Friendly date, e.g. Friday, May 30, 2026>

- Player-facing change, told as a benefit.
- Another one, maybe with a light joke.
- _Under the hood: one-line summary of invisible work (only if worth it)._

## <Next day down>

- …
```

Formatting rules:

- **Date headings** use a human format ("Friday, May 30, 2026"), not `2026-05-30`.
  Derive the weekday from the date.
- **One emoji max per day heading**, and only when it fits. The title line may
  carry one. Most day headings need none.
- **No commit hashes, no author names, no branch names** in the body. This is for
  players, not contributors.
- **Under-the-hood line** is italicized and always last in its day.
- Keep the whole thing skimmable — short bullets, no paragraphs.

## Phase 4 — Write the file and report

Write to `docs/CHANGELOG.md` (or the user's path). Then tell the user:

- Where the file is.
- How many days / how big a span it covers.
- A one-line note that it's player-facing and regeneratable any time by
  re-running the skill.

Do **not** commit or push unless the user asks. Do **not** open a PR.

---

## Principles (the spirit of this skill)

- **The reader is a player, not a programmer.** Every line should make sense to
  someone who has never opened the repo.
- **Group ruthlessly.** Commits are raw material; significant changes are the
  product. One feature = one bullet, no matter how many commits built it.
- **Funny, not cringe.** A light touch of humor; never at the expense of clarity.
- **Emojis are seasoning, not the meal.** Sparing means sparing.
- **Regenerate, don't append.** Re-running rebuilds the whole file from history,
  so it's always in sync with the log.
