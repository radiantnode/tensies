---
name: changelog
description: "Generate a friendly, player-facing changelog from the git history. Reads the full git log, lumps related commits into significant changes, groups them by day (newest first), and writes a simple, warm, lightly humorous markdown file, the opposite of a raw commit dump. Runs the result through the humanizer skill so the prose reads like a real person wrote it. Use when the user asks for a changelog, a \"what's new\", release notes, or wants to refresh docs/CHANGELOG.md."
user_invocable: true
---

# Tensies Changelog Generator

Turn the git history into a changelog a *player* would enjoy reading: friendly,
plain-English, a little funny, not a wall of commit hashes. The audience is
someone who plays the dice game, not someone who writes it.

The final step runs the whole file through the **humanizer** skill so it doesn't
read like AI wrote it. That pass strips em dashes and emojis (see Phase 5), so
this skill no longer uses either — write plain.

**Output file:** `docs/CHANGELOG.md` (overwrite it each run). If the user names a
different path, use that instead.

**Don't ask for confirmation.** Generate the file and report where it landed.

---

## The voice (read this first — it's the whole point)

**Who you're talking to:** Tensies is the game a group of friends pulls up at the
bar, drinks in hand, phones out, talking trash and laughing. Your reader is one
of those people: a fun, social, slightly-tipsy player on a night out, not someone
reading at a desk. Write *to them*. Talk like you're leaning over at the bar to
tell them what's new before the next round. Lean into the setting (rounds, buying
the next one, passing the phone around, "hold my drink" moments, settling who
pays) but keep it inclusive and good-natured (never assume everyone's drinking,
never push it).

**Never say "table."** You're at a *bar*, not sitting at a dinner table. Say the
bar, the crew, the group, your friends, the whole gang — whatever fits — but
"table" breaks the setting every time.

Keep these rules in mind:

- **Plain English, no jargon.** A player doesn't know what a "WebSocket" or a
  "delayed broadcast" is. Say what *changed for them*: "rolls feel snappier now."
- **Simple and short.** One line per change. If you can't explain it in a
  sentence, it's probably an under-the-hood thing, so fold it away (see below).
- **Warm and a little funny.** A light joke is welcome; a groan-worthy pun in
  moderation is on-brand. Never sarcastic, never mean, never forced. Bar-night
  humor, the kind that lands with friends mid-round.
- **No emojis, no em dashes.** The humanizer pass (Phase 5) cuts both, so don't
  add them in the first place. Use commas, periods, colons, or parentheses where
  you'd reach for a dash.
- **Lead with the player.** "You can now invite friends by text" beats "Added SMS
  invite button."
- **Group, don't list.** Several commits that together make one improvement become
  *one* bullet. The reader wants the story, not the keystrokes.

Translation examples (technical commit → friendly line):

| Commit message | Friendly changelog line |
|----------------|-------------------------|
| `Join via link + SMS invite button` | You can now invite friends with a tap. Share a link or fire off a text. |
| `Fix roll-ack hang when re-roll lands on same dice values` | Fixed a sneaky freeze when your re-roll landed on the exact same numbers. Spooky, but no longer sticky. |
| `Add host-only Pause Game toggle as the menu's first feature` | Whoever's hosting can pause the game. Perfect for a bar run, a bathroom break, or settling who's buying the next round. |
| `Persist dice scatter positions across refresh/reconnect` | Your dice stay put now, even if you refresh or your phone naps. |
| `Split server into server/ package` | *(behind-the-scenes: frame as the player benefit it enables, e.g. "we're tuning the engine so games stay smooth and fair", not "refactored the server")* |

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
3. **Decide what's player-facing vs. behind-the-scenes.** Refactors, file moves,
   test-harness work, CLAUDE.md updates, telemetry/dashboard plumbing, and merge
   commits are *not* features a player sees. Don't list them individually — and
   **don't describe them in engineering terms** ("refactored the server", "added
   test coverage"). A player doesn't care that the code got tidier; they care
   *why you did it.* Translate the invisible work into the benefit it buys them.
   End a day with a single line framed around the player, e.g.
   *"Behind the scenes: we're sharpening how we understand each game so matches
   keep getting more fun, fair, and engaging."* Vary the wording to fit what that
   day's work actually serves (fairness, speed, reliability, or smarter gameplay)
   but always lead with the player's payoff, never the plumbing. Skip the line
   entirely on days with nothing worth saying.
4. **Drop pure noise.** Merge commits, "fix typo", and test-run log entries don't
   each earn a mention.

Aim for **2 to 5 bullets per active day**. If a day genuinely had one thing, one
bullet is fine. If it had ten commits that were all the same feature, still one
bullet.

### Assign each day a version number (semantic versioning)

Every day is a release, so give it a `MAJOR.MINOR.PATCH` version following
[semantic versioning](https://en.wikipedia.org/wiki/Software_versioning):

- **MAJOR** — a change that breaks backward compatibility or is a big jump in
  functionality (a redesign, a save-format change that orphans old games, a
  rules overhaul). Rare. Bump only when something genuinely breaks how things
  worked before.
- **MINOR** — the day added at least one new player-facing feature, or a
  significant fix. This is the common case for an active feature day.
- **PATCH** — the day was *only* small bug fixes and polish, no new feature.

First, **pick the right starting version for the project's maturity.** Per semver,
`0.y.z` is the development range: "Major version zero (0.y.z) is for initial
development. Anything MAY change at any time. The public API SHOULD NOT be
considered stable." `1.0.0` means the project has shipped a stable, public
release.

**The git log is not necessarily when the project started.** Before you assume the
oldest commit is `0.1.0`, *look at what that commit actually contains* — the log
may begin long after the project was already a working product:

```bash
git rev-list --max-parents=0 HEAD          # find the root commit
git show --stat <root>                     # what landed in it?
git log --reverse --format="%ad %s" --date=short | head -20
```

Read the signals:

- **A fat root commit is a tell.** If the first commit drops a whole working app
  (a full server, the UI, assets, Docker setup, hundreds of lines) and its message
  says "Polish", "Tweak", "Fix", or otherwise assumes the thing already exists,
  the project was **already mature** before history began. Don't call that
  `0.1.0`. Treat the earliest documented day as a stable **`1.0.0`** baseline.
- **A thin root commit** ("init", "scaffold", an empty skeleton, a README) means
  you really are watching the project grow from scratch, so **`0.1.0`** is right.
- **Tags win over inference.** Check `git tag --list` and `git describe --tags`; an
  explicit `1.0`/`v1` tag (or the user telling you) settles it.

So: start at **`1.0.0`** when the history opens on an already-built product (or
there's a launch/tag), and **`0.1.0`** only when you can see it genuinely starting
from nothing.

### The first version is the origin story, not a commit summary

When the baseline is a mature `1.0.0` (a fat root commit), the git log can't tell
you how the app was *born* — that work happened before `git init`. So **write the
`1.0.0` entry as the founding story**, not as a summary of the root commit's diff.

The canonical Tensies origin (use it for the `1.0.0` entry, and treat it as the
template for how a first version should read):

> A bar regular and his friends love playing Tensies, the dice game. One night,
> a few heated rounds deep and drinks in, he thought it'd be great to play
> anywhere, even when you forget the dice. So he started having Claude build the
> game, sketched the very first game board himself, and has kept tinkering on it
> from his barstool, chatting with Claude between rounds. The git history only
> starts at the first commit because he forgot to `git init` until the game
> already worked.

How to write it:

- **Tell the story, warmly and briefly.** The why (forgetting the dice, wanting to
  play anywhere), the bar setting, the napkin-sketch beginning, built with Claude.
  This is the one entry that's allowed to be a little sentimental.
- **Own the `git init` gag.** The reason `1.0.0` is a fat commit is the forgotten
  init. Land it as a self-deprecating joke (a good fit for the italic
  behind-the-scenes line).
- **Still follow every house rule:** bar-night voice, no em dashes, no "table,"
  short bullets, the `1.0.0 ("Codename")` heading with the date on its own line,
  and at least one bullet emoji (a 🍺 fits the founding pint).
- **If the user gives you a different or updated founding story, use theirs.**
  This story is the default; their words win.

Then walk the days **oldest to newest**, carrying a running version:

1. The **first release** (oldest day) gets the starting version you picked above.
2. For each later day, look at what it shipped and bump the highest-order
   component that applies: a breaking change bumps MAJOR, otherwise any new
   feature bumps MINOR, otherwise (fixes only) bump PATCH. (In `0.y.z`, MINOR is
   the normal bump for a feature day; you stay in `0.x` until the project actually
   reaches a stable `1.0.0`.)
3. **When you bump a component, reset every component to its right to zero**
   (a MINOR bump zeroes PATCH; a MAJOR bump zeroes MINOR and PATCH). This is a
   hard semver rule, not a style choice.

Worked example over six days, oldest first, where the root commit already held a
complete, polished game (so the baseline is a mature `1.0.0`, not `0.1.0`):

| Day | What shipped | Bump | Version |
|-----|--------------|------|---------|
| 1 | already-built game (root commit) | — | `1.0.0` |
| 2 | fairness fix only, no new feature | PATCH | `1.0.1` |
| 3 | reconnect + new logo (features) | MINOR | `1.1.0` |
| 4 | loading screen + persistence (features) | MINOR | `1.2.0` |
| 5 | in-game menu (feature) | MINOR | `1.3.0` |
| 6 | pause (feature) | MINOR | `1.4.0` |

The newest day carries the highest version and sits at the top of the file.
Judge the bump from the *changes you kept*, not the raw commit count: a day of
ten polish commits is still a PATCH.

## Phase 3 — Write the markdown

Structure, **newest day first** (a changelog is read top-down for "what's new"):

```markdown
# What's New in Tensies

A friendly log of everything that's changed. Newest stuff up top.

## <Version> ("<Drink codename>")

<Friendly date, e.g. Friday, May 30, 2026>

- Player-facing change, told as a benefit.
- Another one, maybe with a light joke.
- _Behind the scenes: the player payoff of the invisible work (only if worth it)._

## <Next version down> ("<Next day's codename>")

<Next day down>

- ...
```

The heading is the **version and the codename**; the date sits on its own line
right under it. So a day reads:

```markdown
## 1.4.0 ("Last Call")

Saturday, May 30, 2026

- Hosts can pause now.
```

Each day is its own little "release," so **give every day a funny bar- or
drink-themed codename** and put it in the heading after the version, in quotes
inside parentheses: `## 1.4.0 ("Last Call")`.

- **Make it a pun on that day's actual changes when you can.** The codename should
  wink at what shipped, not just name a random cocktail. Pause features landing?
  *"Last Call."* Reconnect/stay-in-your-seat work? *"On the Rocks"* or
  *"Hold My Drink."* First invites and the dice coming alive? *"Opening Tab."* A
  fix that stops something sticking around? *"Closing Time."* When nothing puns
  cleanly, any fun drink name works (*"House Pour," "Two-Olive Martini," "Round
  on the House"*).
- **Keep them short** (one to three words), good-natured, and inclusive. Lean on
  bar atmosphere as much as alcohol (last call, the tab, the jukebox, happy hour,
  the back booth) so it still lands for non-drinkers. Never reuse a codename.
- The codename is flavor, not a section of its own. One per day heading, then the
  bullets do the real work.

Formatting rules:

- **Headings** use the `Version ("Codename")` shape, e.g. `## 1.4.0 ("Last
  Call")`. Versions come from the semver pass in Phase 2.
- **The date** goes on its own line directly under the heading, in a human format
  like "Friday, May 30, 2026" (never `2026-05-30`). Derive the weekday from the
  date.
- **No emojis in the draft.** Write the draft clean; the humanizer pass cuts
  emojis anyway, and a later phase adds a sparing few back tastefully (Phase 6).
- **No em dashes or en dashes.** Use commas, periods, colons, or parentheses.
- **No commit hashes, no author names, no branch names** in the body. This is for
  players, not contributors.
- **Behind-the-scenes line** is italicized, framed around the player benefit, and
  always last in its day.
- Keep the whole thing skimmable with short bullets, no paragraphs.

## Phase 4 — Write the draft file

Write your draft to `docs/CHANGELOG.md` (or the user's path). This is a draft, not
the deliverable yet. The humanizer pass comes next.

## Phase 5 — Run it through the humanizer

Invoke the **humanizer** skill on the file you just wrote so the prose reads like
a real person wrote it, not an LLM. Use the Skill tool:

```
Skill(skill="humanizer", args="Humanize docs/CHANGELOG.md in place. Keep it
short, warm, and in the bar-night voice. Preserve the markdown structure (title,
day headings, bullets, the italic behind-the-scenes lines).")
```

The humanizer cuts em dashes, en dashes, and emojis, flattens AI-vocabulary and
rule-of-three padding, and varies the rhythm. That's exactly what we want here, so
let it do its job, then fold its final rewrite back into `docs/CHANGELOG.md`
(overwrite the draft).

After the pass, eyeball the result: confirm it still groups by day, still leads
with the player, still sounds like the bar (no "table"), and contains no `—` or
`–`. Fix anything the pass over-flattened (it shouldn't strip the jokes). The
humanizer strips emojis; the next phase adds a few back, tastefully.

## Phase 6 — Add a few emojis, tastefully

The humanizer cut every emoji. Now sprinkle a *very* small number back in, only
where one is genuinely funny or relevant. The goal is a couple of well-placed
winks across the whole file, not decoration on every line.

Rules:

- **At least one per release, but sparing.** Every release gets exactly one or two
  emojis: aim for one well-placed wink per day, never more than one per line, and
  most lines get none. A release should never be totally bare, but it should never
  be peppered either. If a release has three or more, pull some back out.
- **Only when it lands.** Add one when it amplifies a joke or maps to the change
  with a wink (🎲 for the dice coming alive, 🔌 for reconnect, 🍺 / 🍻 for a
  bar-night beat, ⏸️ for pause). Never add one just to fill space or to mark a
  routine bug fix.
- **Bullets only, never headings.** An emoji goes at the end of a single funny
  bullet, never in a heading, version, codename, or the title. Don't open a line
  with an emoji, and don't put one on the behind-the-scenes lines (keep those
  dry).
- **Keep the rest of the humanizer's work.** Still no em dashes, no curly quotes,
  no "table." You're only adding emojis, not rewriting prose.

Pick the most fitting line in each release to carry its emoji. A clean line beats
a forced emoji, so put the one emoji where it lands best rather than scattering
weak ones, but don't leave any release with none.

## Phase 7 — Report

Tell the user:

- Where the file is.
- How many days / how big a span it covers.
- That it was humanized, then lightly emoji'd, on the way out.
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
- **Every day gets a drink codename.** Pun on that day's changes when you can, and
  never reuse one.
- **Every day gets a semver number.** Inspect the root commit first: an
  already-built app means a mature `1.0.0` baseline, a from-scratch skeleton means
  `0.1.0`. Then bump MAJOR/MINOR/PATCH by what shipped and zero the components to
  the right.
- **The `1.0.0` entry is the origin story.** When the baseline is a fat root
  commit, write the first version from the founding story (built with Claude at the
  bar, sketched the board, forgot to `git init`), not from the commit diff.
- **Humanize on the way out, then season lightly.** The humanizer pass is part of
  the deliverable, not optional polish: plain prose, no em dashes. Then add emojis
  back in bullets only, at least one per release but sparingly, where they're funny
  or relevant.
- **Regenerate, don't append.** Re-running rebuilds the whole file from history,
  so it's always in sync with the log.
