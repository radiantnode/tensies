-- Re-attribute all telemetry from old anonymous PIDs to a registered user account.
--
-- Requires two parameters:
--   old_name  — the display name the player used before signing up (e.g. 'Fluffy Walrus')
--   target_id — the registered user's UUID from the users table
--
-- Usage:
--   docker compose exec postgres psql -U tensies \
--     -v old_name="'Fluffy Walrus'" \
--     -v target_id="'a1b2c3d4-...'" \
--     -f /app/scripts/reattribute_user.sql
--
-- What it does:
--   1. Finds all old anonymous PIDs that played under old_name (via sessions.name + player_stats.name_last)
--   2. Merges player_stats rows into one under target_id (summing counters, keeping best records)
--   3. Updates round_player, sessions, events, and rounds to point at target_id
--   4. Prints a summary of what changed

\echo ''
\echo '=== Re-attributing' :old_name '→' :target_id '==='
\echo ''

BEGIN;

-- Verify the target user exists.
CREATE TEMP TABLE _target AS
SELECT id::text AS user_id, username
  FROM users
 WHERE id::text = trim(both '''' from :'target_id');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _target) THEN
    RAISE EXCEPTION 'No user found with id %', current_setting('target_id', true);
  END IF;
END $$;

-- Find all old PIDs that played under the old display name.
CREATE TEMP TABLE _old_pids (old_pid text PRIMARY KEY);

INSERT INTO _old_pids (old_pid)
SELECT DISTINCT s.user_id
  FROM sessions s
  JOIN _target t ON true
 WHERE lower(s.name) = lower(trim(both '''' from :'old_name'))
   AND s.user_id IS NOT NULL
   AND s.user_id <> t.user_id
ON CONFLICT DO NOTHING;

INSERT INTO _old_pids (old_pid)
SELECT ps.user_id
  FROM player_stats ps
  JOIN _target t ON true
 WHERE lower(ps.name_last) = lower(trim(both '''' from :'old_name'))
   AND ps.user_id <> t.user_id
ON CONFLICT DO NOTHING;

-- Also include the legacy_pid from the users table (the PID at signup time).
INSERT INTO _old_pids (old_pid)
SELECT u.legacy_pid
  FROM users u
  JOIN _target t ON u.id::text = t.user_id
 WHERE u.legacy_pid IS NOT NULL
   AND u.legacy_pid <> t.user_id
ON CONFLICT DO NOTHING;

\echo 'Old PIDs found:'
SELECT * FROM _old_pids;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _old_pids) THEN
    RAISE NOTICE 'No old PIDs found — nothing to re-attribute.';
  END IF;
END $$;

-- 1. Merge player_stats: fold old rows into the canonical one.
INSERT INTO player_stats (user_id, name_last, first_seen_ts, last_seen_ts)
SELECT t.user_id, t.username, now(), now()
  FROM _target t
 WHERE NOT EXISTS (SELECT 1 FROM player_stats WHERE user_id = t.user_id)
ON CONFLICT DO NOTHING;

UPDATE player_stats
   SET total_rolls          = player_stats.total_rolls          + agg.total_rolls,
       total_wins           = player_stats.total_wins           + agg.total_wins,
       total_rounds         = player_stats.total_rounds         + agg.total_rounds,
       total_games          = player_stats.total_games          + agg.total_games,
       total_sessions       = player_stats.total_sessions       + agg.total_sessions,
       total_reconnects     = player_stats.total_reconnects     + agg.total_reconnects,
       total_time_played_ms = player_stats.total_time_played_ms + agg.total_time_played_ms,
       fastest_win_ms       = LEAST(player_stats.fastest_win_ms, agg.fastest_win_ms),
       fastest_win_rolls    = LEAST(player_stats.fastest_win_rolls, agg.fastest_win_rolls),
       longest_session_ms   = GREATEST(player_stats.longest_session_ms, agg.longest_session_ms),
       first_seen_ts        = LEAST(player_stats.first_seen_ts, agg.first_seen_ts),
       last_seen_ts         = GREATEST(player_stats.last_seen_ts, agg.last_seen_ts),
       name_last            = (SELECT username FROM _target)
  FROM (
    SELECT sum(total_rolls) AS total_rolls, sum(total_wins) AS total_wins,
           sum(total_rounds) AS total_rounds, sum(total_games) AS total_games,
           sum(total_sessions) AS total_sessions, sum(total_reconnects) AS total_reconnects,
           sum(total_time_played_ms) AS total_time_played_ms,
           min(fastest_win_ms) AS fastest_win_ms, min(fastest_win_rolls) AS fastest_win_rolls,
           max(longest_session_ms) AS longest_session_ms,
           min(first_seen_ts) AS first_seen_ts, max(last_seen_ts) AS last_seen_ts
      FROM player_stats
     WHERE user_id IN (SELECT old_pid FROM _old_pids)
  ) agg
 WHERE player_stats.user_id = (SELECT user_id FROM _target);

DELETE FROM player_stats WHERE user_id IN (SELECT old_pid FROM _old_pids);

-- 2. round_player
UPDATE round_player SET user_id = (SELECT user_id FROM _target)
 WHERE user_id IN (SELECT old_pid FROM _old_pids);

-- 3. sessions
UPDATE sessions SET user_id = (SELECT user_id FROM _target)
 WHERE user_id IN (SELECT old_pid FROM _old_pids);

-- 4. events
UPDATE events SET user_id = (SELECT user_id FROM _target)
 WHERE user_id IN (SELECT old_pid FROM _old_pids);

-- 5. rounds (winner attribution)
UPDATE rounds SET winner_user_id = (SELECT user_id FROM _target)
 WHERE winner_user_id IN (SELECT old_pid FROM _old_pids);

-- Summary
\echo ''
\echo '=== Done ==='
SELECT t.username,
       t.user_id,
       (SELECT count(*) FROM _old_pids) AS old_pids_merged,
       ps.total_games, ps.total_wins, ps.total_rolls,
       ps.fastest_win_ms, ps.total_time_played_ms
  FROM _target t
  LEFT JOIN player_stats ps ON ps.user_id = t.user_id;

DROP TABLE _old_pids;
DROP TABLE _target;

COMMIT;
