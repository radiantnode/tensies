"""Prometheus metrics. Imported once; objects are module-level singletons."""
from prometheus_client import Counter, Gauge, Histogram

# Buckets tuned to the game's dynamics.
_S_FAST   = (0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5)
_S_SECONDS = (0.5, 1, 2, 5, 10, 20, 30, 60, 120, 300, 600, 1800)
_S_ROLLS  = (1, 3, 5, 10, 20, 35, 50, 75, 100, 150, 250, 500)
_S_MATCHES = (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
_S_PLAYERS = (1, 2, 3, 4, 5, 6, 8, 10, 15, 20)
_S_BYTES  = (64, 256, 1024, 4096, 16_384, 65_536, 262_144)

# ─── Connections / sessions ─────────────────────────────────────────────
ws_connections_active = Gauge(
    "tensies_ws_connections_active", "Open WebSocket connections"
)
ws_connects_total = Counter(
    "tensies_ws_connects_total", "WebSocket connections opened"
)
ws_disconnects_total = Counter(
    "tensies_ws_disconnects_total", "WebSocket connections closed", ["reason"]
)
ws_connection_seconds = Histogram(
    "tensies_ws_connection_seconds", "WebSocket connection lifetime", buckets=_S_SECONDS
)
ws_ping_rtt_seconds = Histogram(
    "tensies_ws_ping_rtt_seconds", "Round-trip ping time", buckets=_S_FAST
)
ws_messages_in_total = Counter(
    "tensies_ws_messages_in_total", "Inbound WebSocket messages", ["action"]
)
ws_messages_out_total = Counter(
    "tensies_ws_messages_out_total", "Outbound WebSocket messages", ["type"]
)
ws_bytes_in_total = Counter("tensies_ws_bytes_in_total", "Inbound bytes")
ws_bytes_out_total = Counter("tensies_ws_bytes_out_total", "Outbound bytes")
ws_send_seconds = Histogram(
    "tensies_ws_send_seconds", "Time to serialize+send a message", buckets=_S_FAST, labelnames=["type"]
)
ws_message_size_bytes = Histogram(
    "tensies_ws_message_size_bytes", "Outbound message size", buckets=_S_BYTES
)
reconnects_total = Counter("tensies_reconnects_total", "Player reconnects")
sessions_started_total = Counter("tensies_sessions_started_total", "Sessions started")

# ─── Games / rounds ─────────────────────────────────────────────────────
games_active = Gauge("tensies_games_active", "Concurrent games")
games_started_total = Counter("tensies_games_started_total", "Games started")
games_ended_total = Counter("tensies_games_ended_total", "Games ended", ["reason"])
rounds_started_total = Counter("tensies_rounds_started_total", "Rounds started", ["target"])
rounds_completed_total = Counter("tensies_rounds_completed_total", "Rounds finished", ["target"])
round_duration_seconds = Histogram(
    "tensies_round_duration_seconds", "Round duration", buckets=_S_SECONDS
)
rolls_per_round = Histogram(
    "tensies_rolls_per_round", "Rolls per round per player", buckets=_S_ROLLS
)
round_winner_rolls = Histogram(
    "tensies_round_winner_rolls", "Rolls it took the winner", buckets=_S_ROLLS
)
players_per_game = Histogram(
    "tensies_players_per_game", "Players at game start", buckets=_S_PLAYERS
)
game_duration_seconds = Histogram(
    "tensies_game_duration_seconds", "Game lifetime", buckets=_S_SECONDS
)

# ─── Rolls / dice ───────────────────────────────────────────────────────
rolls_total = Counter("tensies_rolls_total", "All rolls")
dice_value_total = Counter("tensies_dice_value_total", "Dice values seen", ["value"])
matches_per_roll = Histogram(
    "tensies_matches_per_roll", "Newly-locked dice per roll", buckets=_S_MATCHES
)
time_between_rolls_seconds = Histogram(
    "tensies_time_between_rolls_seconds", "Tempo per player", buckets=_S_FAST
)
rate_limits_total = Counter("tensies_rate_limits_total", "MIN_ROLL_INTERVAL rejections")
ack_timeouts_total = Counter("tensies_ack_timeouts_total", "Reveal-ack timeouts")

# ─── Telemetry self-observability ───────────────────────────────────────
telemetry_queue_depth = Gauge(
    "tensies_telemetry_queue_depth", "Bus queue depth", ["subscriber"]
)
telemetry_batch_size = Histogram(
    "tensies_telemetry_batch_size",
    "Events per write batch",
    buckets=(1, 5, 25, 100, 250, 500, 1000, 2500),
)
telemetry_write_seconds = Histogram(
    "tensies_telemetry_write_seconds", "Postgres batch insert time", buckets=_S_FAST
)
telemetry_dropped_total = Counter(
    "tensies_telemetry_dropped_total", "Events dropped due to queue overflow"
)
live_push_seconds = Histogram(
    "tensies_live_push_seconds", "Grafana Live push time", buckets=_S_FAST, labelnames=["channel"]
)
live_push_failures_total = Counter(
    "tensies_live_push_failures_total", "Grafana Live push failures"
)

# ─── Discord notifier ───────────────────────────────────────────────────
discord_messages_total = Counter(
    "tensies_discord_messages_total", "Discord card posts/edits", ["op"]
)
discord_failures_total = Counter(
    "tensies_discord_failures_total", "Discord API failures", ["op"]
)
discord_interactions_total = Counter(
    "tensies_discord_interactions_total",
    "Discord slash-command interactions handled", ["command", "outcome"]
)

# ─── Web Push (VAPID) ─────────────────────────────────────────────────
push_sent_total = Counter(
    "tensies_push_sent_total", "Web Push messages delivered to a subscription"
)
push_failed_total = Counter(
    "tensies_push_failed_total", "Web Push send failures", ["reason"]
)
push_pruned_total = Counter(
    "tensies_push_pruned_total", "Dead push subscriptions pruned (404/410)"
)

# ─── drand beacon ─────────────────────────────────────────────────────
drand_beacon_fetches_total = Counter(
    "tensies_drand_beacon_fetches_total", "Successful drand beacon fetches"
)
drand_verify_failures_total = Counter(
    "tensies_drand_verify_failures_total", "BLS verification failures"
)
drand_fallback_total = Counter(
    "tensies_drand_fallback_total", "Rolls that fell back to local RNG"
)
drand_fetch_seconds = Histogram(
    "tensies_drand_fetch_seconds", "Drand HTTP fetch latency", buckets=_S_FAST
)
