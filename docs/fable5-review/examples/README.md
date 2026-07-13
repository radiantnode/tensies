# Examples — a working toolkit

Drop-in hooks, skills, prompt templates, and scripts referenced by
[../09-getting-the-most-from-claude.md](../09-getting-the-most-from-claude.md).
Everything here is complete and runnable, not pseudocode. Adopt piecemeal — none
of it depends on the rest.

```
examples/
├── settings.hooks.json     # hooks + statusLine block to merge into .claude/settings.json
├── CLAUDE-additions.md     # 3–4 rules to paste into the project CLAUDE.md
├── hooks/
│   ├── protect-main.sh     # PreToolUse(Bash): block commit/push on main  [BLOCKING]
│   ├── invariant-guard.sh  # PreToolUse(Edit|Write): surface the invariant for load-bearing files  [advisory]
│   ├── fast-check.sh        # PostToolUse(Edit|Write): ruff the file just edited  [BLOCKING on lint error]
│   └── session-catchup.sh  # SessionStart: print branch/dirty/last-test/open-PRs into context
├── skills/
│   ├── ship/SKILL.md        # branch → lint → commit → push → PR → wait for CI
│   └── debug-loop/SKILL.md  # reproduce-first; after 2 failed fixes, diff the environment
├── prompts/
│   ├── kickoff.md           # feature kickoff template (vision + fence + verification tier)
│   └── bug-report.md        # bug template with the "only happens when" discriminator block
└── scripts/
    ├── statusline.sh        # custom status line: model · branch · last-test-age · dev-stack dot
    └── codename.py          # bar-themed release codename suggestions (skips used names)
```

## Install

```bash
# From the repo root. Copy into the project's .claude/ (or ~/.claude for global).
mkdir -p .claude/hooks .claude/scripts .claude/skills
cp docs/fable5-review/examples/hooks/*.sh       .claude/hooks/
cp docs/fable5-review/examples/scripts/*        .claude/scripts/
cp -r docs/fable5-review/examples/skills/*      .claude/skills/
chmod +x .claude/hooks/*.sh .claude/scripts/*.sh

# Then merge the "hooks" and "statusLine" keys from settings.hooks.json into
# .claude/settings.json by hand (or with jq -s '.[0] * .[1]' if you prefer).
```

Reload Claude Code (or start a new session) so the hooks and status line take
effect. `/hooks` shows what's registered; `/statusline` re-reads the config.

## Notes & caveats

- **Dependencies:** the shell hooks use `jq` and `git`; `session-catchup.sh` and
  the `ship` skill use `gh` (degrade silently if it's absent). `codename.py` is
  pure stdlib Python 3.
- **Hook output contracts vary by Claude Code version.** `protect-main.sh` and
  `fast-check.sh` use exit-code 2 (block + feed stderr to Claude) — stable and
  widely supported. `invariant-guard.sh` emits `hookSpecificOutput.additionalContext`
  JSON for a *non-blocking* nudge; if your version doesn't honor that on
  PreToolUse, the file's trailing comment shows the one-line switch to a blocking
  form. Test with `/hooks` after installing.
- **Start small.** If you adopt only one thing, make it `protect-main.sh` (turns
  a rule into an impossibility) and `session-catchup.sh` (kills most repeat
  "what's the state" questions). Add the rest as they prove useful.
- **These are examples, not gospel.** Tune the invariant list, the protected
  branches (`TENSIES_PROTECTED_BRANCHES`), and the codename pool to taste.
