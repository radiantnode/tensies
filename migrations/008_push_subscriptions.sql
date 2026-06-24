-- Web Push (VAPID) subscriptions, one row per browser/device per account.
-- A user may have several (phone, laptop, …); the endpoint is globally unique
-- and is what the Push API addresses. p256dh + auth are the client's encryption
-- keys (base64url) needed to encrypt each payload. Dead subscriptions are pruned
-- by the sender on a 404/410 from the push service. ON DELETE CASCADE drops a
-- user's subscriptions when the account is removed.
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id            BIGSERIAL PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint      TEXT NOT NULL UNIQUE,
    p256dh        TEXT NOT NULL,
    auth          TEXT NOT NULL,
    user_agent    TEXT,
    created_ts    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_ts  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
    ON push_subscriptions (user_id);
