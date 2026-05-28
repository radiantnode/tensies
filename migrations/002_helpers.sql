-- Helper view: dice value distribution (last 1h), used by fairness panel.
-- Counts only newly-rolled dice (rolled_values) so locked dice don't skew it.
CREATE OR REPLACE VIEW v_dice_roll_distribution AS
SELECT
    (val.value)::int AS face,
    count(*)         AS rolls
FROM events e,
     LATERAL jsonb_array_elements_text(coalesce(e.payload->'rolled_values', '[]'::jsonb)) val
WHERE e.type = 'roll'
  AND e.ts > now() - interval '1 hour'
GROUP BY face
ORDER BY face;

-- Helper: rolling roll-rate per game (recent activity)
CREATE OR REPLACE VIEW v_recent_rolls AS
SELECT
    game_code,
    date_trunc('second', ts) AS bucket,
    count(*)                 AS rolls
FROM events
WHERE type = 'roll'
  AND ts > now() - interval '5 minutes'
GROUP BY 1, 2;

-- Helper: per-game stream of (seq, user_id, matched) for the round timeline.
CREATE OR REPLACE VIEW v_game_roll_timeline AS
SELECT
    game_code,
    round_num,
    seq,
    user_id,
    (payload->>'matched')::int       AS matched,
    (payload->>'round_roll_num')::int AS round_roll_num,
    (payload->>'dt_ms')::bigint       AS dt_ms,
    ts
FROM events
WHERE type = 'roll';
