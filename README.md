# Tensies

A real-time multiplayer dice game you can play anywhere, even when you forget the dice. Built on a barstool. See [`docs/CHANGELOG.md`](docs/CHANGELOG.md) for the story.

## Getting started

This repo uses a git **submodule** (the [humanizer](https://github.com/blader/humanizer) writing skill, vendored under `.claude/skills/humanizer/`). Clone with submodules so the skill comes down with the code:

```bash
git clone --recurse-submodules <repo-url>
```

Already cloned without `--recurse-submodules`? Pull the submodule in:

```bash
git submodule update --init --recursive
```

If `.claude/skills/humanizer/` is empty, that's the step you're missing — run it and the skill reappears.

## Running the server

```bash
docker compose up -d          # start (auto-reloads on file changes)
docker compose logs -f        # tail server logs
docker compose down           # stop
```

The web app is on **port 8888**; the Grafana viewer is on **port 8889**.

## More docs

- [Architecture & contributor guide](CLAUDE.md)
- [Docs index](docs/README.md) — telemetry, feedback, and test-run logs
- [Changelog](docs/CHANGELOG.md)

## Updating the humanizer submodule

To pull the latest upstream humanizer:

```bash
git submodule update --remote .claude/skills/humanizer
git add .claude/skills/humanizer && git commit -m "Bump humanizer submodule"
```
