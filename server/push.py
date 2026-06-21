"""Web Push (VAPID) — the send path + subscription storage.

The single source of truth for delivering a browser push notification to an
account. Both the HTTP layer (server/push_routes.py) and the CLI
(scripts/send_push.py) call `send_to_user`, so there's one code path to reason
about.

A "user" here is a WebAuthn account (users.id UUID). Each account may have
several subscriptions (one per browser/device); a push fans out to all of them.
The `pywebpush` call is blocking (it does the ECDH/HKDF payload encryption and a
synchronous HTTPS POST), so it's run in a thread to keep the event loop free —
this is fire-and-forget plumbing, never on a gameplay hot path.

Failures never raise to the caller: a 404/410 means the browser unsubscribed and
the row is pruned; anything else is logged + metered and the other devices still
get their push.
"""
import asyncio
import json
import logging

from pywebpush import WebPushException, webpush

from server import db
from server.config import (
    PUSH_ENABLED,
    VAPID_PRIVATE_KEY,
    VAPID_PUBLIC_KEY,
    VAPID_SUBJECT,
)
from server.telemetry import metrics

log = logging.getLogger("tensies.push")


def is_configured() -> bool:
    """True when push is enabled AND a VAPID keypair is present."""
    return bool(PUSH_ENABLED and VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)


def public_key() -> str | None:
    """The VAPID public key the client needs to subscribe (None when off)."""
    return VAPID_PUBLIC_KEY if is_configured() else None


# ─── Subscription storage ───────────────────────────────────────────────────

async def save_subscription(
    user_id: str, subscription: dict, user_agent: str | None = None
) -> None:
    """Upsert one browser PushSubscription against an account.

    `subscription` is the raw object from `pushManager.subscribe().toJSON()`:
        {"endpoint": "...", "keys": {"p256dh": "...", "auth": "..."}}
    The endpoint is unique, so re-subscribing the same browser re-points the row
    at the (possibly new) owner and refreshes the keys.
    """
    endpoint = subscription["endpoint"]
    keys = subscription.get("keys", {})
    p256dh = keys["p256dh"]
    auth = keys["auth"]
    async with db.pool().acquire() as con:
        await con.execute(
            """
            INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (endpoint) DO UPDATE
               SET user_id = EXCLUDED.user_id,
                   p256dh = EXCLUDED.p256dh,
                   auth = EXCLUDED.auth,
                   user_agent = EXCLUDED.user_agent,
                   last_used_ts = now()
            """,
            user_id,
            endpoint,
            p256dh,
            auth,
            user_agent,
        )


async def delete_subscription(endpoint: str) -> None:
    """Remove a subscription by endpoint (client-initiated unsubscribe)."""
    async with db.pool().acquire() as con:
        await con.execute(
            "DELETE FROM push_subscriptions WHERE endpoint = $1", endpoint
        )


# ─── Sending ────────────────────────────────────────────────────────────────

def _vapid_claims() -> dict:
    return {"sub": VAPID_SUBJECT}


def _send_one(sub: dict, payload: str) -> None:
    """Blocking single-subscription send (runs in a worker thread)."""
    webpush(
        subscription_info=sub,
        data=payload,
        vapid_private_key=VAPID_PRIVATE_KEY,
        vapid_claims=_vapid_claims(),
    )


async def send_to_user(
    user_id: str,
    title: str,
    body: str,
    url: str | None = None,
) -> int:
    """Push a notification to every subscription an account has.

    Returns the number of subscriptions that accepted the push. Dead ones
    (404/410) are pruned; other failures are logged + metered without raising.
    """
    if not is_configured():
        log.warning("push not configured (PUSH_ENABLED + VAPID keys) — nothing sent")
        return 0

    async with db.pool().acquire() as con:
        rows = await con.fetch(
            "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1",
            user_id,
        )
    if not rows:
        log.info("push  user=%s  no subscriptions", user_id)
        return 0

    payload = json.dumps({"title": title, "body": body, "url": url or "/"})
    delivered = 0
    for row in rows:
        sub = {
            "endpoint": row["endpoint"],
            "keys": {"p256dh": row["p256dh"], "auth": row["auth"]},
        }
        try:
            await asyncio.to_thread(_send_one, sub, payload)
            delivered += 1
            metrics.push_sent_total.inc()
        except WebPushException as e:
            status = getattr(e.response, "status_code", None)
            if status in (404, 410):
                await delete_subscription(row["endpoint"])
                metrics.push_pruned_total.inc()
                log.info("push  pruned dead subscription  status=%s", status)
            else:
                metrics.push_failed_total.labels(reason=str(status or "error")).inc()
                log.warning("push  send failed  status=%s  %s", status, e)
        except Exception as e:  # noqa: BLE001 — never let a bad send escape
            metrics.push_failed_total.labels(reason="exception").inc()
            log.warning("push  unexpected send error: %s", e)

    if delivered:
        async with db.pool().acquire() as con:
            await con.execute(
                "UPDATE push_subscriptions SET last_used_ts = now() WHERE user_id = $1",
                user_id,
            )
    log.info("push  user=%s  delivered=%d/%d", user_id, delivered, len(rows))
    return delivered
