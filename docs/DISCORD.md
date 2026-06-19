# Discord integration

Tensies can publish a **single live-updating card per game** to a Discord
channel (e.g. an internal `#operations` channel). One message is posted when a
game starts, edited in place as rounds are won, and finalised with standings
when the game ends — no spam of one-message-per-event.

It's **off by default** and entirely optional: when disabled (or misconfigured)
the notifier simply never starts, and gameplay is untouched either way.

## What gets published

| Game moment | Card behaviour |
|-------------|----------------|
| Game starts | **Posts** a card: code, host, player count, round/target. |
| Round won   | **Edits** the card: scoreboard (wins per player), current round + target. |
| Game ends   | **Edits** to the final card: 🏆 standings, rounds, total rolls, duration, then stops tracking it. |

Edits are coalesced over a short window so a burst of events becomes a single
API call, keeping well under Discord's per-channel rate limit.

## Setup

### 1. Create a bot and get its token

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
   → **New Application** → name it (e.g. "Tensies Ops").
2. **Bot** tab → **Reset Token** → copy the token. This is the value for
   `DISCORD_BOT_TOKEN`. Treat it like a password — it's not committed to git.
3. No privileged gateway intents are required (the notifier only *sends*, it
   doesn't read messages).

### 2. Invite the bot to your server

Under **OAuth2 → URL Generator**, tick the `bot` scope and these permissions:

- **View Channel**
- **Send Messages**
- **Embed Links**

Open the generated URL, pick your server, authorise. Then make sure the bot's
role can see/post in the target channel.

### 3. Get the channel id

In Discord, enable **Settings → Advanced → Developer Mode**, then right-click
the target channel → **Copy Channel ID**. This is `DISCORD_CHANNEL_ID`.

### 4. Configure Tensies

Set these env vars (e.g. in `.env` / `.env.prod`, which are gitignored):

```bash
DISCORD_ENABLED=1
DISCORD_BOT_TOKEN=your-bot-token        # secret — keep out of git
DISCORD_CHANNEL_ID=123456789012345678
```

The docker-compose files already forward these to the `web` service, so a
`docker compose up -d` (or prod equivalent) picks them up. On boot you'll see
`discord notifier started  channel=…` in the logs; a misconfiguration logs a
single warning and disables the feature without affecting the game.

## How it works (for maintainers)

- `server/discord.py` is a **bus subscriber**, a sibling of the Grafana Live
  pusher (`server/telemetry/live.py`). It reads the same in-process event
  stream (`game_started`, `round_won`, `game_ended`) — no gameplay code is
  touched, and `emit()` stays fire-and-forget.
- It uses the **bot REST API** (`POST`/`PATCH /channels/{id}/messages`) with an
  `Authorization: Bot …` header — no gateway connection, since v1 only sends.
  Reactions / threads / slash-commands would be a clean additive step later.
- Per-game state — the card's `message_id` and the running win tally — lives in
  **Redis** (`discord:card:{code}`), updated with atomic `HSET`/`HINCRBY` just
  like `gamestore`. This keeps it correct across instances (no sticky sessions,
  so a game's events can land on different instances) and lets the final
  standings survive the game's deletion from Redis.
- Failures are swallowed and counted via the `tensies_discord_messages_total`
  and `tensies_discord_failures_total` Prometheus metrics. A `429` honours the
  returned `retry_after`.

### Configuration reference

| Env var | Default | Meaning |
|---------|---------|---------|
| `DISCORD_ENABLED` | `0` | Master switch for the notifier. |
| `DISCORD_BOT_TOKEN` | — | Bot token (secret). Required when enabled. |
| `DISCORD_CHANNEL_ID` | — | Target channel id. Required when enabled. |
| `DISCORD_API_BASE` | `https://discord.com/api/v10` | API base; override only for testing. |
