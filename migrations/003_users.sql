-- User accounts and WebAuthn credential storage.

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        TEXT NOT NULL,
    username_lower  TEXT NOT NULL UNIQUE,
    created_ts      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_ts   TIMESTAMPTZ NOT NULL DEFAULT now(),
    legacy_pid      TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS users_username_lower ON users (username_lower);
CREATE INDEX IF NOT EXISTS users_created ON users (created_ts DESC);

CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id   BYTEA NOT NULL UNIQUE,
    public_key      BYTEA NOT NULL,
    sign_count      BIGINT NOT NULL DEFAULT 0,
    transports      TEXT[],
    created_ts      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_ts    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webauthn_creds_user ON webauthn_credentials (user_id);
CREATE INDEX IF NOT EXISTS webauthn_creds_cred_id ON webauthn_credentials (credential_id);
