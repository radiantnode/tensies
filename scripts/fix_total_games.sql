-- Fix total_games in player_stats.
--
-- total_games is never incremented by the telemetry writer — no game-end
-- handler updates it. Recalculate from round_player joined to games
-- (only counting finished games with ended_ts set).
--
-- Usage:
--   docker compose exec -T postgres psql -U tensies < scripts/fix_total_games.sql

BEGIN;

-- Preview
SELECT ps.user_id, COALESCE(u.username, ps.name_last) AS name,
       ps.total_games AS before,
       coalesce(sub.actual, 0) AS after
  FROM player_stats ps
  LEFT JOIN users u ON u.id::text = ps.user_id
  LEFT JOIN (
    SELECT rp.user_id, count(DISTINCT rp.game_code) AS actual
      FROM round_player rp
      JOIN games g ON g.game_code = rp.game_code AND g.ended_ts IS NOT NULL
     GROUP BY rp.user_id
  ) sub ON sub.user_id = ps.user_id
 WHERE ps.total_games IS DISTINCT FROM coalesce(sub.actual, 0)
 ORDER BY sub.actual DESC NULLS LAST;

-- Fix
UPDATE player_stats ps
   SET total_games = coalesce(sub.actual, 0)
  FROM (
    SELECT rp.user_id, count(DISTINCT rp.game_code) AS actual
      FROM round_player rp
      JOIN games g ON g.game_code = rp.game_code AND g.ended_ts IS NOT NULL
     GROUP BY rp.user_id
  ) sub
 WHERE ps.user_id = sub.user_id
   AND ps.total_games IS DISTINCT FROM sub.actual;

\echo ''
\echo 'Done. Rows updated:'

COMMIT;
