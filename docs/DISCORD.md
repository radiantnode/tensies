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
| `DISCORD_PUBLIC_KEY` | — | App public key — verifies interaction signatures. Required for slash commands. |
| `DISCORD_APPLICATION_ID` | — | App id — registers commands + sends interaction follow-ups. Required for slash commands. |
| `DISCORD_GUILD_ID` | — | Server id — registers `/verify` to that guild instantly. Required for slash commands. |

## Slash commands — `/verify`

`/verify` returns the [Roll Trust](ROLL_TRUST.md) verification for a game: it
re-derives every drand-backed roll from the public beacon and reports how many
check out, with a per-player breakdown. You run it **inside a game's thread**,
and it replies in that thread.

### How it ties to a game

When a game ends, the notifier opens a thread on the game card titled
`Roll Trust — {code}`. In Discord, a thread started from a message shares that
message's id, and the bot keeps a durable `message_id → game_code` map in Redis.
So when you type `/verify` in the thread, the interaction arrives with
`channel_id` equal to the card's message id, which resolves straight to the
game — no arguments needed. (You can also start the thread yourself on any game
card; same result.)

### Transport

Slash commands arrive as **signed HTTP POSTs** to `POST /discord/interactions`
(not the gateway), so any instance behind the load balancer can serve any
interaction — same stateless model as the rest of Tensies. The endpoint verifies
Discord's Ed25519 signature on every request, ACKs Discord's ping, and for
`/verify` it defers (the beacon fetch can exceed Discord's 3-second budget) then
edits the response in-thread with the result.

### Setup

1. **Developer Portal → General Information**: copy **Public Key** →
   `DISCORD_PUBLIC_KEY`, and **Application ID** → `DISCORD_APPLICATION_ID`.
2. **Server id**: right-click your server → **Copy Server ID** (Developer Mode
   on) → `DISCORD_GUILD_ID`. Guild registration is instant; the app registers
   `/verify` on boot (look for `discord /verify registered to guild …`).
3. **Interactions endpoint URL**: on the Developer Portal **General Information**
   page, set **Interactions Endpoint URL** to
   `https://<your-host>/discord/interactions`. Discord probes it with a signed
   ping (and a deliberately bad signature) and will only save the URL if the app
   answers correctly — which it does once `DISCORD_PUBLIC_KEY` is set and the app
   is reachable over public HTTPS.
4. **Permissions**: the auto-created thread needs **Create Public Threads** (and
   **Send Messages in Threads**); add them to the bot's invite if missing. If the
   bot lacks them, `/verify` still works — just start the thread on the card
   yourself. (Posting the `/verify` reply needs no extra permission; it goes out
   under the interaction token.)

Slash commands are enabled only when `DISCORD_PUBLIC_KEY`,
`DISCORD_APPLICATION_ID`, and `DISCORD_GUILD_ID` are all set. Roll Trust data
comes from the telemetry event log, so `/verify` needs `TELEMETRY_ENABLED=1` and
`ENABLE_DRAND_ROLLING=1` on the games being verified.

> **Local dev note:** Discord must reach `/discord/interactions` over public
> HTTPS, so the live round-trip needs a deploy or a tunnel (e.g. cloudflared) —
> `localhost` won't work. The signature, dispatch, and Roll Trust logic are all
> unit-testable without Discord.
