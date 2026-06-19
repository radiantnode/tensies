-- Fix total_rounds in player_stats.
--
-- total_rounds was only incremented on round wins (same handler as total_wins),
-- so it equals total_wins instead of total rounds participated. Recalculate
-- from round_player which has a row per player per round.
--
-- Usage:
--   docker compose exec -T postgres psql -U tensies < scripts/fix_total_rounds.sql

BEGIN;

-- Preview
SELECT ps.user_id, ps.name_last,
       ps.total_rounds AS before,
       coalesce(rp.actual, 0) AS after,
       ps.total_wins
  FROM player_stats ps
  LEFT JOIN (
    SELECT user_id, count(*) AS actual FROM round_player GROUP BY user_id
  ) rp ON rp.user_id = ps.user_id
 WHERE ps.total_rounds <> coalesce(rp.actual, 0)
 ORDER BY rp.actual DESC NULLS LAST;

-- Fix
UPDATE player_stats ps
   SET total_rounds = coalesce(sub.actual, 0)
  FROM (
    SELECT user_id, count(*) AS actual FROM round_player GROUP BY user_id
  ) sub
 WHERE ps.user_id = sub.user_id
   AND ps.total_rounds <> sub.actual;

\echo ''
\echo 'Done. Rows updated:'
-- (UPDATE count is printed by psql automatically)

COMMIT;
