-- Tensies telemetry schema
-- All events go into `events` (partitioned by month, retained forever).
-- Rollup tables are upserted by the writer for fast dashboard queries.
-- `live_*` tables hold one row per active thing for the live dashboard.

-- ─────────────────────────────────────────────────────────────────────
-- Event firehose (partitioned monthly)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
    id          BIGSERIAL,
    ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
    game_code   TEXT,
    round_num   INT,
    user_id     TEXT,
    session_id  TEXT,
    type        TEXT NOT NULL,
    seq         BIGINT,
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (id, ts)
) PARTITION BY RANGE (ts);

-- Bootstrap partitions for the current and next month so inserts work
-- on first startup. A periodic task adds future partitions.
DO $$
DECLARE
    cur_start DATE := date_trunc('month', now())::date;
    cur_end   DATE := (date_trunc('month', now()) + interval '1 month')::date;
    nxt_start DATE := cur_end;
    nxt_end   DATE := (date_trunc('month', now()) + interval '2 months')::date;
    cur_name  TEXT := 'events_' || to_char(cur_start, 'YYYY_MM');
    nxt_name  TEXT := 'events_' || to_char(nxt_start, 'YYYY_MM');
BEGIN
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF events FOR VALUES FROM (%L) TO (%L)',
        cur_name, cur_start, cur_end
    );
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF events FOR VALUES FROM (%L) TO (%L)',
        nxt_name, nxt_start, nxt_end
    );
END $$;

CREATE INDEX IF NOT EXISTS events_ts_desc          ON events (ts DESC);
CREATE INDEX IF NOT EXISTS events_game_seq         ON events (game_code, seq);
CREATE INDEX IF NOT EXISTS events_user_ts          ON events (user_id, ts DESC);
CREATE INDEX IF NOT EXISTS events_session_ts       ON events (session_id, ts DESC);
CREATE INDEX IF NOT EXISTS events_type_ts          ON events (type, ts DESC);
CREATE INDEX IF NOT EXISTS events_payload_gin      ON events USING GIN (payload jsonb_path_ops);

-- ─────────────────────────────────────────────────────────────────────
-- Historical rollups
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS games (
    game_code       TEXT PRIMARY KEY,
    host_user_id    TEXT,
    started_ts      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_ts        TIMESTAMPTZ,
    player_count    INT NOT NULL DEFAULT 0,
    peak_players    INT NOT NULL DEFAULT 0,
    round_count     INT NOT NULL DEFAULT 0,
    total_rolls     BIGINT NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'lobby',  -- lobby|playing|ended
    end_reason      TEXT
);
CREATE INDEX IF NOT EXISTS games_started ON games (started_ts DESC);
CREATE INDEX IF NOT EXISTS games_status ON games (status);

CREATE TABLE IF NOT EXISTS rounds (
    game_code       TEXT NOT NULL,
    round_num       INT NOT NULL,
    target          INT NOT NULL,
    winner_user_id  TEXT,
    started_ts      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_ts        TIMESTAMPTZ,
    duration_ms     BIGINT,
    total_rolls     BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (game_code, round_num)
);
CREATE INDEX IF NOT EXISTS rounds_started ON rounds (started_ts DESC);
CREATE INDEX IF NOT EXISTS rounds_winner ON rounds (winner_user_id);

CREATE TABLE IF NOT EXISTS round_player (
    game_code               TEXT NOT NULL,
    round_num               INT NOT NULL,
    user_id                 TEXT NOT NULL,
    rolls                   INT NOT NULL DEFAULT 0,
    matched_at_end          INT NOT NULL DEFAULT 0,
    time_to_first_match_ms  BIGINT,
    avg_dt_between_rolls_ms BIGINT,
    fastest_dt_ms           BIGINT,
    slowest_dt_ms           BIGINT,
    PRIMARY KEY (game_code, round_num, user_id)
);
CREATE INDEX IF NOT EXISTS round_player_user ON round_player (user_id);

CREATE TABLE IF NOT EXISTS player_stats (
    user_id                  TEXT PRIMARY KEY,
    name_last                TEXT,
    total_rolls              BIGINT NOT NULL DEFAULT 0,
    total_wins               BIGINT NOT NULL DEFAULT 0,
    total_rounds             BIGINT NOT NULL DEFAULT 0,
    total_games              BIGINT NOT NULL DEFAULT 0,
    total_sessions           BIGINT NOT NULL DEFAULT 0,
    total_reconnects         BIGINT NOT NULL DEFAULT 0,
    fastest_win_ms           BIGINT,
    fastest_win_rolls        INT,
    longest_session_ms       BIGINT,
    total_time_played_ms     BIGINT NOT NULL DEFAULT 0,
    first_seen_ts            TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_ts             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS player_stats_wins ON player_stats (total_wins DESC);
CREATE INDEX IF NOT EXISTS player_stats_rolls ON player_stats (total_rolls DESC);
CREATE INDEX IF NOT EXISTS player_stats_last_seen ON player_stats (last_seen_ts DESC);

CREATE TABLE IF NOT EXISTS sessions (
    session_id       TEXT PRIMARY KEY,
    user_id          TEXT,
    name             TEXT,
    connected_ts     TIMESTAMPTZ NOT NULL DEFAULT now(),
    disconnected_ts  TIMESTAMPTZ,
    duration_ms      BIGINT,
    end_reason       TEXT,
    total_rolls      INT NOT NULL DEFAULT 0,
    games_joined     INT NOT NULL DEFAULT 0,
    peer             TEXT,
    user_agent       TEXT
);
CREATE INDEX IF NOT EXISTS sessions_connected ON sessions (connected_ts DESC);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);

CREATE TABLE IF NOT EXISTS connections (
    session_id        TEXT PRIMARY KEY,
    peer              TEXT,
    opened_ts         TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_ts         TIMESTAMPTZ,
    close_reason      TEXT,
    messages_in       BIGINT NOT NULL DEFAULT 0,
    messages_out      BIGINT NOT NULL DEFAULT 0,
    bytes_in          BIGINT NOT NULL DEFAULT 0,
    bytes_out         BIGINT NOT NULL DEFAULT 0,
    last_ping_rtt_ms  DOUBLE PRECISION,
    user_agent        TEXT
);
CREATE INDEX IF NOT EXISTS connections_opened ON connections (opened_ts DESC);

-- ─────────────────────────────────────────────────────────────────────
-- Live tables (one row per active thing; updated on every event)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_games (
    game_code         TEXT PRIMARY KEY,
    started_ts        TIMESTAMPTZ NOT NULL DEFAULT now(),
    status            TEXT NOT NULL DEFAULT 'lobby',
    target            INT,
    round_num         INT NOT NULL DEFAULT 1,
    player_count      INT NOT NULL DEFAULT 0,
    rolls_this_round  INT NOT NULL DEFAULT 0,
    total_rolls       BIGINT NOT NULL DEFAULT 0,
    last_roll_ts      TIMESTAMPTZ,
    leader_user_id    TEXT,
    leader_name       TEXT,
    leader_matched    INT NOT NULL DEFAULT 0,
    host_user_id      TEXT,
    updated_ts        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS live_games_updated ON live_games (updated_ts DESC);

CREATE TABLE IF NOT EXISTS live_players (
    game_code        TEXT NOT NULL,
    user_id          TEXT NOT NULL,
    name             TEXT,
    matched          INT NOT NULL DEFAULT 0,
    rolls_this_round INT NOT NULL DEFAULT 0,
    total_rolls      INT NOT NULL DEFAULT 0,
    wins             INT NOT NULL DEFAULT 0,
    last_roll_ts     TIMESTAMPTZ,
    is_disconnected  BOOLEAN NOT NULL DEFAULT FALSE,
    joined_ts        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (game_code, user_id)
);
CREATE INDEX IF NOT EXISTS live_players_game ON live_players (game_code);

CREATE TABLE IF NOT EXISTS live_sessions (
    session_id        TEXT PRIMARY KEY,
    user_id           TEXT,
    name              TEXT,
    connected_ts      TIMESTAMPTZ NOT NULL DEFAULT now(),
    game_code         TEXT,
    last_message_ts   TIMESTAMPTZ,
    last_ping_rtt_ms  DOUBLE PRECISION,
    peer              TEXT
);
CREATE INDEX IF NOT EXISTS live_sessions_user ON live_sessions (user_id);
CREATE INDEX IF NOT EXISTS live_sessions_game ON live_sessions (game_code);
