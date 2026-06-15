"""Drains the bus and writes events + rollups to Postgres.

Runs as a single background task. Batches inserts every ~250 ms or 500
events, whichever first. Rollup tables and live_* tables are upserted
inside the same transaction as the event-log insert so dashboards always
see consistent state.
"""
import asyncio
import json
import logging
import time

from server.telemetry import metrics, store
from server.telemetry.bus import bus

log = logging.getLogger("tensies.writer")

BATCH_MAX = 500
BATCH_INTERVAL_S = 0.25
_task: asyncio.Task | None = None


async def start() -> None:
    global _task
    q = bus.subscribe(maxsize=20_000)
    _task = asyncio.create_task(_run(q), name="telemetry.writer")


async def stop() -> None:
    if _task is not None:
        _task.cancel()
        try:
            await _task
        except (asyncio.CancelledError, Exception):
            pass


async def _run(q: asyncio.Queue) -> None:
    while True:
        try:
            metrics.telemetry_queue_depth.labels(subscriber="writer").set(q.qsize())
            batch = await _drain(q)
            if not batch:
                continue
            metrics.telemetry_batch_size.observe(len(batch))
            t0 = time.monotonic()
            try:
                await _flush(batch)
            except Exception:
                log.exception("writer batch flush failed (%d events)", len(batch))
            metrics.telemetry_write_seconds.observe(time.monotonic() - t0)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("writer loop error")
            await asyncio.sleep(0.5)


async def _drain(q: asyncio.Queue) -> list[dict]:
    try:
        first = await asyncio.wait_for(q.get(), timeout=BATCH_INTERVAL_S)
    except asyncio.TimeoutError:
        return []
    batch = [first]
    deadline = time.monotonic() + BATCH_INTERVAL_S
    while len(batch) < BATCH_MAX:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break
        try:
            batch.append(await asyncio.wait_for(q.get(), timeout=remaining))
        except asyncio.TimeoutError:
            break
    return batch


async def _flush(batch: list[dict]) -> None:
    pool = store.pool()
    rows = [_event_row(ev) for ev in batch]
    async with pool.acquire() as con, con.transaction():
        await con.executemany(
            """
            INSERT INTO events (ts, game_code, round_num, user_id, session_id, type, seq, payload)
            VALUES (to_timestamp($1 / 1000.0), $2, $3, $4, $5, $6, $7, $8::jsonb)
            """,
            rows,
        )
        for ev in batch:
            handler = _HANDLERS.get(ev["type"])
            if handler is not None:
                try:
                    await handler(con, ev)
                except Exception:
                    log.exception("rollup handler failed: %s", ev["type"])


def _event_row(ev: dict) -> tuple:
    payload = {
        k: v for k, v in ev.items()
        if k not in {"type", "ts_ms", "game_code", "round_num", "user_id", "session_id", "seq"}
    }
    return (
        ev["ts_ms"],
        ev.get("game_code"),
        ev.get("round_num"),
        ev.get("user_id"),
        ev.get("session_id"),
        ev["type"],
        ev.get("seq"),
        json.dumps(payload, default=str),
    )


# ─────────────────────────────────────────────────────────────────────
# Rollup handlers — each one is a coroutine(con, event_dict).
# Kept tight; no awaiting outside Postgres.
# ─────────────────────────────────────────────────────────────────────
async def _h_connection_opened(con, ev):
    await con.execute(
        """
        INSERT INTO connections (session_id, peer, opened_ts, user_agent)
        VALUES ($1, $2, to_timestamp($3 / 1000.0), $4)
        ON CONFLICT (session_id) DO NOTHING
        """,
        ev["session_id"], ev.get("peer"), ev["ts_ms"], ev.get("user_agent"),
    )
    await con.execute(
        """
        INSERT INTO live_sessions (session_id, connected_ts, peer)
        VALUES ($1, to_timestamp($2 / 1000.0), $3)
        ON CONFLICT (session_id) DO NOTHING
        """,
        ev["session_id"], ev["ts_ms"], ev.get("peer"),
    )


async def _h_connection_closed(con, ev):
    await con.execute(
        """
        UPDATE connections
           SET closed_ts = to_timestamp($2 / 1000.0),
               close_reason = $3,
               messages_in = $4,
               messages_out = $5,
               bytes_in = $6,
               bytes_out = $7
         WHERE session_id = $1
        """,
        ev["session_id"], ev["ts_ms"], ev.get("reason"),
        ev.get("messages_in", 0), ev.get("messages_out", 0),
        ev.get("bytes_in", 0), ev.get("bytes_out", 0),
    )
    await con.execute("DELETE FROM live_sessions WHERE session_id = $1", ev["session_id"])


async def _h_session_started(con, ev):
    await con.execute(
        """
        INSERT INTO sessions (session_id, user_id, name, connected_ts, peer, user_agent)
        VALUES ($1, $2, $3, to_timestamp($4 / 1000.0), $5, $6)
        ON CONFLICT (session_id) DO UPDATE
           SET user_id = EXCLUDED.user_id,
               name    = EXCLUDED.name
        """,
        ev["session_id"], ev.get("user_id"), ev.get("name"),
        ev["ts_ms"], ev.get("peer"), ev.get("user_agent"),
    )
    if ev.get("user_id"):
        await con.execute(
            """
            INSERT INTO player_stats (user_id, name_last, total_sessions, first_seen_ts, last_seen_ts)
            VALUES ($1, $2, 1, to_timestamp($3 / 1000.0), to_timestamp($3 / 1000.0))
            ON CONFLICT (user_id) DO UPDATE
               SET name_last = EXCLUDED.name_last,
                   total_sessions = player_stats.total_sessions + 1,
                   last_seen_ts = EXCLUDED.last_seen_ts
            """,
            ev["user_id"], ev.get("name"), ev["ts_ms"],
        )
    await con.execute(
        """
        UPDATE live_sessions
           SET user_id = $2, name = $3
         WHERE session_id = $1
        """,
        ev["session_id"], ev.get("user_id"), ev.get("name"),
    )


async def _h_session_ended(con, ev):
    duration_ms = ev.get("duration_ms")
    await con.execute(
        """
        UPDATE sessions
           SET disconnected_ts = to_timestamp($2 / 1000.0),
               duration_ms = $3,
               end_reason = $4,
               total_rolls = $5,
               games_joined = $6
         WHERE session_id = $1
        """,
        ev["session_id"], ev["ts_ms"], duration_ms,
        ev.get("reason"), ev.get("rolls", 0), ev.get("games_joined", 0),
    )
    if ev.get("user_id") and duration_ms is not None:
        await con.execute(
            """
            UPDATE player_stats
               SET total_time_played_ms = total_time_played_ms + $2,
                   longest_session_ms = GREATEST(coalesce(longest_session_ms, 0), $2),
                   last_seen_ts = to_timestamp($3 / 1000.0)
             WHERE user_id = $1
            """,
            ev["user_id"], duration_ms, ev["ts_ms"],
        )


async def _h_reconnected(con, ev):
    if ev.get("user_id"):
        await con.execute(
            """
            UPDATE player_stats
               SET total_reconnects = total_reconnects + 1,
                   last_seen_ts = to_timestamp($2 / 1000.0)
             WHERE user_id = $1
            """,
            ev["user_id"], ev["ts_ms"],
        )


async def _h_ws_ping(con, ev):
    rtt = ev.get("rtt_ms")
    if rtt is None:
        return
    await con.execute(
        "UPDATE live_sessions SET last_ping_rtt_ms = $2, last_message_ts = to_timestamp($3 / 1000.0) "
        "WHERE session_id = $1",
        ev["session_id"], rtt, ev["ts_ms"],
    )
    await con.execute(
        "UPDATE connections SET last_ping_rtt_ms = $2 WHERE session_id = $1",
        ev["session_id"], rtt,
    )


async def _h_game_created(con, ev):
    await con.execute(
        """
        INSERT INTO games (game_code, host_user_id, started_ts, player_count, peak_players, status)
        VALUES ($1, $2, to_timestamp($3 / 1000.0), 1, 1, 'lobby')
        ON CONFLICT (game_code) DO NOTHING
        """,
        ev["game_code"], ev.get("user_id"), ev["ts_ms"],
    )
    await con.execute(
        """
        INSERT INTO live_games (game_code, started_ts, status, player_count, host_user_id, updated_ts)
        VALUES ($1, to_timestamp($2 / 1000.0), 'lobby', 1, $3, to_timestamp($2 / 1000.0))
        ON CONFLICT (game_code) DO UPDATE
           SET host_user_id = EXCLUDED.host_user_id,
               updated_ts = EXCLUDED.updated_ts
        """,
        ev["game_code"], ev["ts_ms"], ev.get("user_id"),
    )


async def _h_player_joined(con, ev):
    pc = ev.get("player_count", 1)
    await con.execute(
        """
        UPDATE games SET player_count = $2, peak_players = GREATEST(peak_players, $2)
        WHERE game_code = $1
        """,
        ev["game_code"], pc,
    )
    await con.execute(
        "UPDATE live_games SET player_count = $2, updated_ts = now() WHERE game_code = $1",
        ev["game_code"], pc,
    )
    await con.execute(
        """
        INSERT INTO live_players (game_code, user_id, name, joined_ts)
        VALUES ($1, $2, $3, to_timestamp($4 / 1000.0))
        ON CONFLICT (game_code, user_id) DO UPDATE
           SET name = EXCLUDED.name,
               is_disconnected = FALSE
        """,
        ev["game_code"], ev["user_id"], ev.get("name"), ev["ts_ms"],
    )
    if ev.get("session_id"):
        await con.execute(
            "UPDATE live_sessions SET game_code = $2 WHERE session_id = $1",
            ev.get("session_id"), ev["game_code"],
        )


async def _h_player_left(con, ev):
    if ev.get("reason") == "drop":
        await con.execute(
            "DELETE FROM live_players WHERE game_code = $1 AND user_id = $2",
            ev["game_code"], ev["user_id"],
        )
        pc = ev.get("player_count")
        if pc is not None:
            await con.execute(
                "UPDATE games SET player_count = $2 WHERE game_code = $1",
                ev["game_code"], pc,
            )
            await con.execute(
                "UPDATE live_games SET player_count = $2, updated_ts = now() WHERE game_code = $1",
                ev["game_code"], pc,
            )
    else:
        await con.execute(
            "UPDATE live_players SET is_disconnected = TRUE WHERE game_code = $1 AND user_id = $2",
            ev["game_code"], ev["user_id"],
        )


async def _h_host_transferred(con, ev):
    new_host = ev.get("to")
    await con.execute("UPDATE games SET host_user_id = $2 WHERE game_code = $1", ev["game_code"], new_host)
    await con.execute(
        "UPDATE live_games SET host_user_id = $2, updated_ts = now() WHERE game_code = $1",
        ev["game_code"], new_host,
    )


async def _h_game_started(con, ev):
    target = ev.get("target")
    await con.execute(
        "UPDATE games SET status = 'playing' WHERE game_code = $1", ev["game_code"]
    )
    await con.execute(
        "UPDATE live_games SET status = 'playing', target = $2, round_num = 1, updated_ts = now() "
        "WHERE game_code = $1",
        ev["game_code"], target,
    )


async def _h_game_ended(con, ev):
    await con.execute(
        """
        UPDATE games
           SET ended_ts = to_timestamp($2 / 1000.0),
               status = 'ended',
               end_reason = $3,
               round_count = $4,
               total_rolls = $5
         WHERE game_code = $1
        """,
        ev["game_code"], ev["ts_ms"], ev.get("reason"),
        ev.get("round_count", 0), ev.get("total_rolls", 0),
    )
    # Increment total_games for every player who participated
    await con.execute(
        """
        UPDATE player_stats
           SET total_games = total_games + 1
         WHERE user_id IN (
             SELECT DISTINCT user_id FROM round_player WHERE game_code = $1
         )
        """,
        ev["game_code"],
    )
    await con.execute("DELETE FROM live_games WHERE game_code = $1", ev["game_code"])
    await con.execute("DELETE FROM live_players WHERE game_code = $1", ev["game_code"])


async def _h_round_started(con, ev):
    await con.execute(
        """
        INSERT INTO rounds (game_code, round_num, target, started_ts)
        VALUES ($1, $2, $3, to_timestamp($4 / 1000.0))
        ON CONFLICT (game_code, round_num) DO NOTHING
        """,
        ev["game_code"], ev["round_num"], ev.get("target"), ev["ts_ms"],
    )
    await con.execute(
        """
        UPDATE live_games
           SET round_num = $2,
               target = $3,
               rolls_this_round = 0,
               leader_user_id = NULL,
               leader_name = NULL,
               leader_matched = 0,
               updated_ts = now()
         WHERE game_code = $1
        """,
        ev["game_code"], ev["round_num"], ev.get("target"),
    )
    await con.execute(
        "UPDATE live_players SET matched = 0, rolls_this_round = 0 WHERE game_code = $1",
        ev["game_code"],
    )


async def _h_roll(con, ev):
    matched = ev.get("matched", 0)
    dt_ms = ev.get("dt_ms")
    await con.execute(
        "UPDATE games SET total_rolls = total_rolls + 1 WHERE game_code = $1",
        ev["game_code"],
    )
    await con.execute(
        "UPDATE rounds SET total_rolls = total_rolls + 1 "
        "WHERE game_code = $1 AND round_num = $2",
        ev["game_code"], ev["round_num"],
    )
    await con.execute(
        """
        INSERT INTO round_player (
            game_code, round_num, user_id, rolls, matched_at_end,
            time_to_first_match_ms, avg_dt_between_rolls_ms,
            fastest_dt_ms, slowest_dt_ms
        )
        VALUES ($1, $2, $3, 1, $4, $5, $6, $6, $6)
        ON CONFLICT (game_code, round_num, user_id) DO UPDATE
           SET rolls = round_player.rolls + 1,
               matched_at_end = EXCLUDED.matched_at_end,
               avg_dt_between_rolls_ms = CASE
                   WHEN $6 IS NULL THEN round_player.avg_dt_between_rolls_ms
                   WHEN round_player.avg_dt_between_rolls_ms IS NULL THEN $6
                   ELSE ((round_player.avg_dt_between_rolls_ms * round_player.rolls) + $6) / (round_player.rolls + 1)
               END,
               fastest_dt_ms = CASE
                   WHEN $6 IS NULL THEN round_player.fastest_dt_ms
                   WHEN round_player.fastest_dt_ms IS NULL THEN $6
                   ELSE LEAST(round_player.fastest_dt_ms, $6)
               END,
               slowest_dt_ms = CASE
                   WHEN $6 IS NULL THEN round_player.slowest_dt_ms
                   WHEN round_player.slowest_dt_ms IS NULL THEN $6
                   ELSE GREATEST(round_player.slowest_dt_ms, $6)
               END
        """,
        ev["game_code"], ev["round_num"], ev["user_id"], matched, None, dt_ms,
    )
    await con.execute(
        """
        UPDATE live_games
           SET rolls_this_round = rolls_this_round + 1,
               total_rolls = total_rolls + 1,
               last_roll_ts = to_timestamp($2 / 1000.0),
               leader_user_id = CASE WHEN $3 >= leader_matched THEN $4 ELSE leader_user_id END,
               leader_name    = CASE WHEN $3 >= leader_matched THEN $5 ELSE leader_name END,
               leader_matched = GREATEST(leader_matched, $3),
               updated_ts = now()
         WHERE game_code = $1
        """,
        ev["game_code"], ev["ts_ms"], matched, ev["user_id"], ev.get("name"),
    )
    await con.execute(
        """
        UPDATE live_players
           SET matched = $3,
               rolls_this_round = rolls_this_round + 1,
               total_rolls = total_rolls + 1,
               last_roll_ts = to_timestamp($4 / 1000.0)
         WHERE game_code = $1 AND user_id = $2
        """,
        ev["game_code"], ev["user_id"], matched, ev["ts_ms"],
    )
    if ev.get("user_id"):
        await con.execute(
            """
            UPDATE player_stats
               SET total_rolls = total_rolls + 1,
                   last_seen_ts = to_timestamp($2 / 1000.0)
             WHERE user_id = $1
            """,
            ev["user_id"], ev["ts_ms"],
        )


async def _h_round_won(con, ev):
    duration_ms = ev.get("duration_ms")
    await con.execute(
        """
        UPDATE rounds
           SET winner_user_id = $3,
               ended_ts = to_timestamp($4 / 1000.0),
               duration_ms = $5
         WHERE game_code = $1 AND round_num = $2
        """,
        ev["game_code"], ev["round_num"], ev["user_id"], ev["ts_ms"], duration_ms,
    )
    rolls = ev.get("roll_count", 0)
    if ev.get("user_id"):
        await con.execute(
            """
            INSERT INTO player_stats (
                user_id, total_wins, fastest_win_ms, fastest_win_rolls, last_seen_ts
            )
            VALUES ($1, 1, $2, $3, to_timestamp($4 / 1000.0))
            ON CONFLICT (user_id) DO UPDATE
               SET total_wins = player_stats.total_wins + 1,
                   fastest_win_ms = CASE
                       WHEN $2 IS NULL THEN player_stats.fastest_win_ms
                       WHEN player_stats.fastest_win_ms IS NULL THEN $2
                       ELSE LEAST(player_stats.fastest_win_ms, $2)
                   END,
                   fastest_win_rolls = CASE
                       WHEN player_stats.fastest_win_rolls IS NULL THEN $3
                       ELSE LEAST(player_stats.fastest_win_rolls, $3)
                   END,
                   last_seen_ts = to_timestamp($4 / 1000.0)
            """,
            ev["user_id"], duration_ms, rolls, ev["ts_ms"],
        )
        await con.execute(
            "UPDATE live_players SET wins = wins + 1 WHERE game_code = $1 AND user_id = $2",
            ev["game_code"], ev["user_id"],
        )


async def _h_round_ended(con, ev):
    """Increment total_rounds for every participant in the round."""
    await con.execute(
        """
        UPDATE player_stats ps
           SET total_rounds = ps.total_rounds + 1,
               last_seen_ts = GREATEST(ps.last_seen_ts, to_timestamp($3 / 1000.0))
          FROM round_player rp
         WHERE rp.game_code = $1 AND rp.round_num = $2
           AND ps.user_id = rp.user_id
        """,
        ev["game_code"], ev["round_num"], ev.get("ts_ms", 0),
    )


_HANDLERS = {
    "connection_opened":  _h_connection_opened,
    "connection_closed":  _h_connection_closed,
    "session_started":    _h_session_started,
    "session_ended":      _h_session_ended,
    "reconnected":        _h_reconnected,
    "ws_ping":            _h_ws_ping,
    "game_created":       _h_game_created,
    "player_joined":      _h_player_joined,
    "player_left":        _h_player_left,
    "host_transferred":   _h_host_transferred,
    "game_started":       _h_game_started,
    "game_ended":         _h_game_ended,
    "round_started":      _h_round_started,
    "round_won":          _h_round_won,
    "round_ended":        _h_round_ended,
    "roll":               _h_roll,
}
