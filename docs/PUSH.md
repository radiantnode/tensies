# Web Push notifications

Browser push via the standard [Web Push protocol](https://web.dev/articles/push-notifications-overview)
with VAPID. Self-hosted — no third-party service. This is the **framework**: a
signed-in account can subscribe, and you can send a notification to any account
from a script. Game-event triggers (e.g. "your turn") are a later, additive step.

## How it fits together

```
browser ──subscribe──▶ POST /push/subscribe ──▶ push_subscriptions (Postgres)
                                                        │
  scripts/send_push.py ──▶ server.push.send_to_user ────┘──▶ push service ──▶ device
```

- **`server/push.py`** — the single send path (`send_to_user`) + subscription
  storage. Both the HTTP routes and the CLI call it.
- **`server/push_routes.py`** — `GET /push/vapid-public-key`,
  `POST /push/subscribe`, `POST /push/unsubscribe` (the last two are JWT-authed).
- **`static/sw.js`** — service worker (served at `/sw.js`, root scope) that
  renders the notification and handles clicks.
- **`static/js/push.js`** — client opt-in (permission → subscribe → save). Fired
  best-effort on load from `app.js`; no-ops unless signed in and push is enabled.
- **`migrations/008_push_subscriptions.sql`** — one row per browser/device,
  keyed to `users.id`.

Only **signed-in accounts** can receive pushes — a subscription is owned by a
`users.id`. Anonymous players have no persistent identity to target.

## Setup

1. **Generate a VAPID keypair:**

   ```bash
   python scripts/gen_vapid.py
   ```

   Paste the printed `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`
   into your `.env` and set `PUSH_ENABLED=1`. The private key is a secret — keep
   it out of git.

2. **Restart the app** so it picks up the new env (`docker compose up -d`).

3. **Subscribe a device:** open the app, sign in, and allow notifications when
   prompted. The client subscribes automatically on load.

## Sending

```bash
# by username or by users.id UUID
python scripts/send_push.py --user alice --title "Your turn" --body "Tap to roll"
python scripts/send_push.py --user 5f3a... --title "Hi" --body "Test" --url /ABCDE

# inside the stack:
docker compose exec web python scripts/send_push.py --user alice \
    --title "Your turn" --body "Tap to roll"
```

`--url` is the path opened when the notification is clicked (default `/`). The
command prints how many of the account's subscriptions accepted the push; dead
ones (the browser unsubscribed) are pruned automatically.

## Notes & caveats

- **iOS** only delivers web push when the PWA is **installed to the home screen**
  (Add to Home Screen), per Apple. Desktop Chrome/Firefox and Android Chrome
  work directly in the browser.
- Push is **off by default**. With `PUSH_ENABLED` unset or the VAPID keys
  missing, `/push/vapid-public-key` returns 503 and the client opt-in quietly
  does nothing.
- Metrics: `tensies_push_sent_total`, `tensies_push_failed_total{reason}`,
  `tensies_push_pruned_total`.
