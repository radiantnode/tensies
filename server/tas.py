"""Tensies Attitude System (TAS).

Weather-driven personality that delivers contextual commentary to players.
Phrases live in Postgres (tas_phrases), cached in-memory at startup. Mood is
derived from weather + air quality at the server's configured location via
Open-Meteo (free, no API key). The mood source is never revealed to players.

Lifecycle mirrors server/drand.py: module-level state, start()/stop(),
background poll loop, sync public API on the hot path.
"""
import asyncio
import random
from collections import deque

import httpx

from . import db
from .config import (
    TAS_ENABLED,
    TAS_LAT,
    TAS_LON,
    TAS_SNARKINESS,
    TAS_WEATHER_INTERVAL,
    log,
)

# ── Process-local state ──────────────────────────────────────────────────
_task: asyncio.Task | None = None
_http: httpx.AsyncClient | None = None
_mood: str = "neutral"

# Phrase cache: _phrases[phrase_type][snarkiness][mood][context_tag] -> list[str]
_phrases: dict[str, dict[str, dict[str, dict[str, list[str]]]]] = {}

# Per-player recently-shown phrases (process-local). Tracks the last N phrases
# shown to each player so we avoid repeats until the pool is exhausted.
_RECENT_SIZE = 20
_recent: dict[str, deque[str]] = {}  # player_id -> deque of recent phrases

# ── Weather code → base mood ─────────────────────────────────────────────
_WEATHER_MOOD: list[tuple[range, str]] = [
    (range(0, 2), "sunny"),
    (range(2, 4), "bored"),
    (range(45, 49), "mysterious"),
    (range(51, 56), "melancholic"),
    (range(56, 68), "grumpy"),
    (range(71, 78), "cozy"),
    (range(80, 83), "chaotic"),
    (range(85, 87), "cozy"),
    (range(95, 100), "unhinged"),
]

# ── AQI moderate-shift table (AQI 41–60) ─────────────────────────────────
_AQI_EDGE_SHIFT: dict[str, str] = {
    "sunny": "restless",
    "bored": "irritable",
    "melancholic": "bitter",
    "grumpy": "irritable",
    "cozy": "stir_crazy",
    "chaotic": "manic",
    "unhinged": "manic",
    "mysterious": "paranoid",
    "neutral": "irritable",
}


def _weather_code_to_mood(code: int | None) -> str:
    if code is None:
        return "neutral"
    for rng, mood in _WEATHER_MOOD:
        if code in rng:
            return mood
    return "neutral"


def _apply_aqi(base_mood: str, aqi: float | None) -> str:
    if aqi is None or aqi <= 40:
        return base_mood
    if aqi <= 60:
        return _AQI_EDGE_SHIFT.get(base_mood, base_mood)
    if aqi <= 80:
        return "irritable"
    return "suffocating"


# ── Lifecycle ─────────────────────────────────────────────────────────────

async def start() -> None:
    global _task, _http
    if not TAS_ENABLED:
        log.info("tas      disabled")
        return

    await _load_phrases()

    if TAS_LAT and TAS_LON:
        _http = httpx.AsyncClient(timeout=10.0)
        _task = asyncio.create_task(_poll_loop(), name="tas.weather")
        log.info(
            "tas      started  lat=%s lon=%s snarkiness=%s interval=%ss",
            TAS_LAT, TAS_LON, TAS_SNARKINESS, TAS_WEATHER_INTERVAL,
        )
    else:
        log.info(
            "tas      started  mood=neutral (no TAS_LAT/TAS_LON)  snarkiness=%s",
            TAS_SNARKINESS,
        )


async def stop() -> None:
    global _task, _http
    if _task is not None:
        _task.cancel()
        _task = None
    if _http is not None:
        await _http.aclose()
        _http = None


# ── Phrase cache ──────────────────────────────────────────────────────────

async def _load_phrases() -> None:
    """Load all active phrases from Postgres into the in-memory cache."""
    global _phrases
    try:
        pool = db.pool()
        rows = await pool.fetch(
            "SELECT phrase_type, snarkiness, mood, context_tag, phrase "
            "FROM tas_phrases WHERE active ORDER BY id"
        )
        cache: dict[str, dict[str, dict[str, dict[str, list[str]]]]] = {}
        for r in rows:
            pt = r["phrase_type"]
            sk = r["snarkiness"]
            md = r["mood"]
            ct = r["context_tag"]
            cache.setdefault(pt, {}).setdefault(sk, {}).setdefault(md, {}).setdefault(ct, []).append(r["phrase"])
        _phrases = cache
        total = sum(
            len(phrases)
            for pt in cache.values()
            for sk in pt.values()
            for md in sk.values()
            for phrases in md.values()
        )
        log.info("tas      loaded %d phrases", total)
    except Exception:
        log.exception("tas      failed to load phrases — commentary disabled")
        _phrases = {}


async def reload_phrases() -> None:
    """Public helper to refresh the phrase cache without restart."""
    await _load_phrases()


# ── Weather polling ───────────────────────────────────────────────────────

async def _poll_loop() -> None:
    # Fetch immediately on startup, then every interval.
    while True:
        try:
            await _fetch_weather()
        except asyncio.CancelledError:
            return
        except Exception:
            log.exception("tas      weather fetch error")
        await asyncio.sleep(TAS_WEATHER_INTERVAL)


async def _fetch_weather() -> None:
    global _mood
    weather_code = None
    aqi = None

    # Fetch weather and air quality in parallel.
    weather_url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={TAS_LAT}&longitude={TAS_LON}&current=weather_code"
    )
    aqi_url = (
        f"https://air-quality-api.open-meteo.com/v1/air-quality"
        f"?latitude={TAS_LAT}&longitude={TAS_LON}&current=european_aqi"
    )

    try:
        resp = await _http.get(weather_url)
        resp.raise_for_status()
        data = resp.json()
        weather_code = data.get("current", {}).get("weather_code")
    except Exception:
        log.warning("tas      weather API failed — keeping previous mood")

    try:
        resp = await _http.get(aqi_url)
        resp.raise_for_status()
        data = resp.json()
        aqi = data.get("current", {}).get("european_aqi")
    except Exception:
        log.warning("tas      air quality API failed — skipping AQI modifier")

    base = _weather_code_to_mood(weather_code)
    new_mood = _apply_aqi(base, aqi)

    if new_mood != _mood:
        log.info("tas      mood changed  %s → %s", _mood, new_mood)
    _mood = new_mood


# ── Public API (sync, zero-await) ─────────────────────────────────────────

def get_phrase(
    phrase_type: str,
    context_tag: str,
    context_vars: dict[str, object],
    player_id: str = "",
) -> str | None:
    """Pick a phrase for the current mood and snarkiness. Returns None when
    TAS is disabled or no phrases match the fallback chain.

    Tracks recently shown phrases per player to avoid repeats until the
    candidate pool is exhausted.
    """
    if not TAS_ENABLED or not _phrases:
        return None

    snarkiness = TAS_SNARKINESS
    mood = _mood
    pt = _phrases.get(phrase_type)
    if not pt:
        return None
    sk = pt.get(snarkiness)
    if not sk:
        return None

    # Build a merged candidate pool: mood-specific phrases plus neutral
    # fallbacks, so sparse moods still have variety.
    mood_tag = sk.get(mood, {}).get(context_tag, [])
    mood_default = sk.get(mood, {}).get("default", []) if context_tag != "default" else []
    neutral_tag = sk.get("neutral", {}).get(context_tag, []) if mood != "neutral" else []
    neutral_default = sk.get("neutral", {}).get("default", []) if mood != "neutral" or context_tag != "default" else []
    candidates = mood_tag + mood_default + neutral_tag + neutral_default
    if not candidates:
        return None

    # Filter out recently shown phrases for this player.
    recent = _recent.get(player_id, deque(maxlen=_RECENT_SIZE))
    fresh = [p for p in candidates if p not in recent]
    if not fresh:
        # All seen — reset and pick from full pool.
        recent.clear()
        fresh = candidates

    phrase = random.choice(fresh)
    if player_id:
        if player_id not in _recent:
            _recent[player_id] = deque(maxlen=_RECENT_SIZE)
        _recent[player_id].append(phrase)

    try:
        return phrase.format(**{k: str(v) for k, v in context_vars.items()})
    except (KeyError, IndexError):
        return phrase
