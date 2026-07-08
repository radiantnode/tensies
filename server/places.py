"""Google Places proxy (server-side) for the lobby "check in" feature.

Credentials never reach the browser — the client asks the server for nearby
places, and the server holds them. Two backends, in order of preference:
  1. a **service account** (GOOGLE_APPLICATION_CREDENTIALS) → OAuth bearer token,
     so the key never has to be an unrestricted browser API key;
  2. a plain **API key** (GOOGLE_MAPS_API_KEY).
Places are Google-only: with no backend configured, the search endpoints return
nothing (the check-in picker simply shows no places) rather than any canned data.

httpx uses trust_env by default, so these calls inherit any HTTPS_PROXY / CA
bundle from the environment (same as server/drand.py and server/discord.py).

A place dict is: {"place_id", "name", "address"?, "lat", "lon"}.
"""
import asyncio
import base64
import json
import logging
import re
import time

import httpx
import jwt

from . import gamestore
from .telemetry import metrics
from .config import (
    GOOGLE_APPLICATION_CREDENTIALS,
    GOOGLE_CLOUD_PROJECT,
    GOOGLE_MAPS_API_KEY,
    PLACES_CACHE_TTL,
    PLACES_MAX_RESULTS,
    PLACES_NEARBY_CACHE_TTL,
    PLACES_PHOTO_CACHE_TTL,
    PLACES_RADIUS_M,
    PLACES_SEARCH_RADIUS_M,
)

log = logging.getLogger("tensies.places")

_NEW_BASE = "https://places.googleapis.com/v1"
_TIMEOUT = 8.0
_OAUTH_SCOPE = "https://www.googleapis.com/auth/cloud-platform"


# ─── Auth: service-account OAuth (preferred) or API key ───────────────────
# Places API (New) accepts an OAuth bearer token (scope cloud-platform) plus an
# X-Goog-User-Project billing header. We mint the token from the service account
# with PyJWT (already a dep — no google-auth needed) and cache it until ~expiry.
_sa: dict | None = None
_sa_loaded = False
_token: str | None = None
_token_exp = 0.0
_token_lock = asyncio.Lock()


def _load_sa() -> dict | None:
    """The service-account credentials dict, loaded once, or None if unconfigured."""
    global _sa, _sa_loaded
    if not _sa_loaded:
        _sa_loaded = True
        if GOOGLE_APPLICATION_CREDENTIALS:
            try:
                with open(GOOGLE_APPLICATION_CREDENTIALS) as f:
                    _sa = json.load(f)
            except Exception:  # noqa: BLE001 — fall back to the API key, never fatal
                log.exception("failed to load service account credentials")
                _sa = None
    return _sa


def _billing_project() -> str | None:
    sa = _load_sa()
    return GOOGLE_CLOUD_PROJECT or (sa.get("project_id") if sa else None)


def _has_google() -> bool:
    """True when a real Google backend (service account or API key) is set."""
    return _load_sa() is not None or GOOGLE_MAPS_API_KEY is not None


async def _access_token() -> str | None:
    """A cached OAuth access token minted from the service account, refreshed
    ~60 s before expiry. None when no service account is configured."""
    sa = _load_sa()
    if sa is None:
        return None
    global _token, _token_exp
    if _token and time.monotonic() < _token_exp - 60:
        return _token
    async with _token_lock:
        if _token and time.monotonic() < _token_exp - 60:
            return _token
        now = int(time.time())
        token_uri = sa.get("token_uri", "https://oauth2.googleapis.com/token")
        assertion = jwt.encode(
            {"iss": sa["client_email"], "scope": _OAUTH_SCOPE, "aud": token_uri,
             "iat": now, "exp": now + 3600},
            sa["private_key"], algorithm="RS256",
        )
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            resp = await c.post(token_uri, data={
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": assertion})
        resp.raise_for_status()
        data = resp.json()
        _token = data["access_token"]
        _token_exp = time.monotonic() + float(data.get("expires_in", 3600))
        return _token


async def _auth_headers() -> dict:
    """Auth headers for a Places call — service-account bearer preferred, else
    the API key. May raise if the token mint fails; callers wrap in try/except."""
    token = await _access_token()
    if token is not None:
        h = {"Authorization": f"Bearer {token}"}
        proj = _billing_project()
        if proj:
            h["X-Goog-User-Project"] = proj
        return h
    return {"X-Goog-Api-Key": GOOGLE_MAPS_API_KEY}


# ─── Redis cache: place_id → {name, lat, lon} ────────────────────────────
def _ckey(place_id: str) -> str:
    return f"place:{place_id}"


async def _cache_put(p: dict) -> None:
    await gamestore.client().set(
        _ckey(p["place_id"]),
        json.dumps({"name": p["name"], "lat": p["lat"], "lon": p["lon"],
                    "photo_ref": p.get("photo_ref")}),
        ex=PLACES_CACHE_TTL,
    )


async def _cache_get(place_id: str) -> dict | None:
    raw = await gamestore.client().get(_ckey(place_id))
    if not raw:
        metrics.places_cache_total.labels("place", "miss").inc()
        return None
    metrics.places_cache_total.labels("place", "hit").inc()
    d = json.loads(raw)
    return {"place_id": place_id, "name": d["name"], "lat": d["lat"], "lon": d["lon"],
            "photo_ref": d.get("photo_ref")}


# ─── Public API ──────────────────────────────────────────────────────────
def _nearby_ckey(lat: float, lon: float) -> str:
    # ~100 m grid (3 decimal places): players in the same venue land in the
    # same cell and share one Google search. Worst case a cell boundary splits
    # a room into two cells — two calls, not a correctness problem.
    return f"placesnearby:{lat:.3f}:{lon:.3f}"


async def search_nearby(lat: float, lon: float) -> list[dict]:
    """Places near (lat, lon), or [] when no Google backend is configured.
    Every result is cached so a subsequent check-in can resolve it cheaply.

    The whole response is also cached in Redis for PLACES_NEARBY_CACHE_TTL on a
    ~100 m grid — a roomful of players opening the check-in sheet costs one
    billed search, and everyone sees identical rows. Cache hits re-warm the
    per-place resolve entries so a later check-in stays cheap."""
    if not _has_google():
        return []
    r = gamestore.client()
    key = _nearby_ckey(lat, lon)
    cached = await r.get(key)
    if cached:
        metrics.places_cache_total.labels("nearby", "hit").inc()
        results = json.loads(cached)
    else:
        metrics.places_cache_total.labels("nearby", "miss").inc()
        results = await _google_nearby(lat, lon)
        # An empty list can be a transient Google failure — don't pin it.
        if results:
            await r.set(key, json.dumps(results), ex=PLACES_NEARBY_CACHE_TTL)
    for p in results:
        await _cache_put(p)
    return results


async def search_text(query: str, lat: float, lon: float) -> list[dict]:
    """Places matching a free-text query, biased toward (lat, lon), or [] when no
    Google backend is configured. Results are cached so a subsequent check-in
    resolves cheaply."""
    if not _has_google():
        return []
    results = await _google_text(query, lat, lon)
    for p in results:
        await _cache_put(p)
    return results


async def resolve(place_id: str) -> dict | None:
    """Authoritative {place_id, name, lat, lon} for a place — from the cache, or
    a Google Place Details call. None if unknown. Deriving coords server-side
    (never trusting client-sent coords) is what stops a game being dropped at an
    arbitrary spot."""
    cached = await _cache_get(place_id)
    if cached is not None:
        return cached
    if not _has_google():
        return None  # no Google backend → nothing to resolve
    p = await _google_details(place_id)
    if p is not None:
        await _cache_put(p)
    return p


# ─── Google Places API (New) ─────────────────────────────────────────────

# Social/gathering venue types (Table A) — where people actually meet up, so a
# check-in surfaces bars, cafes, and parks instead of the dry cleaners, offices,
# and auto shops a bare radius search returns. includedTypes is a request param,
# not a FieldMask field, so filtering on it does NOT change the billing tier.
# Tunable; the API allows up to 50.
_GATHERING_TYPES = [
    # Food, drink, nightlife — the heart of a check-in for a bar dice game.
    "restaurant", "bar", "pub", "wine_bar", "bar_and_grill", "cafe",
    "coffee_shop", "night_club", "bakery",
    # Leisure / culture places people gather.
    "park", "tourist_attraction", "amusement_park", "bowling_alley",
    "movie_theater", "stadium", "art_gallery", "museum", "zoo", "aquarium",
    "casino", "event_venue", "banquet_hall", "community_center",
]

# Below this many gathering hits, re-query unfiltered so a check-in still finds
# where you're standing somewhere with few tagged venues. search_nearby caches
# the result on a ~100 m grid, so this second call is rare and short-lived.
_MIN_GATHERING = 3


# Basic-tier field mask shared by the searchNearby and searchText calls.
_FIELD_MASK = (
    "places.id,places.displayName,places.formattedAddress,places.location,"
    "places.photos")


def _mark(kind: str, t0: float, ok: bool) -> None:
    """Record one Google Places API call's outcome + latency (never awaits)."""
    metrics.places_requests_total.labels(kind, "ok" if ok else "error").inc()
    metrics.places_request_seconds.labels(kind).observe(time.monotonic() - t0)


async def _post_nearby(body: dict) -> list[dict]:
    """POST one searchNearby request and parse it. Field mask is fixed (Basic
    tier) — the type filtering happens via the request body, at no extra cost."""
    t0 = time.monotonic()
    try:
        headers = {**await _auth_headers(), "X-Goog-FieldMask": _FIELD_MASK}
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            resp = await c.post(f"{_NEW_BASE}/places:searchNearby",
                                headers=headers, json=body)
        resp.raise_for_status()
        _mark("nearby", t0, True)
        return _parse_places(resp.json())
    except Exception:  # noqa: BLE001 — places are cosmetic; never fatal
        _mark("nearby", t0, False)
        log.exception("places searchNearby failed")
        return []


async def _google_nearby(lat: float, lon: float) -> list[dict]:
    body = {
        "maxResultCount": min(PLACES_MAX_RESULTS, 20),  # API caps at 20
        # Nearest first — for a check-in you want the place you're standing in,
        # not the most famous venue in the radius (the API's POPULARITY default).
        "rankPreference": "DISTANCE",
        "locationRestriction": {"circle": {
            "center": {"latitude": lat, "longitude": lon},
            "radius": PLACES_RADIUS_M}},
    }
    # 1) Prefer gathering venues (still nearest-first). 2) Fall back to the
    # unfiltered search when that's thin so check-in never comes up empty. A
    # rejected includedTypes (bad type) also returns [] here, so it degrades to
    # the unfiltered search rather than breaking nearby.
    hits = await _post_nearby({**body, "includedTypes": _GATHERING_TYPES})
    if len(hits) >= _MIN_GATHERING:
        return hits
    return await _post_nearby(body)


async def _google_text(query: str, lat: float, lon: float) -> list[dict]:
    body = {
        "textQuery": query,
        "maxResultCount": min(PLACES_MAX_RESULTS, 20),
        # Bias toward the caller (soft) so a name like "Starbucks" resolves to the
        # nearby one, without hard-limiting to the check-in radius.
        "locationBias": {"circle": {
            "center": {"latitude": lat, "longitude": lon},
            "radius": PLACES_SEARCH_RADIUS_M}},
    }
    t0 = time.monotonic()
    try:
        headers = {**await _auth_headers(), "X-Goog-FieldMask": _FIELD_MASK}
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            resp = await c.post(f"{_NEW_BASE}/places:searchText",
                                headers=headers, json=body)
        resp.raise_for_status()
        data = resp.json()
        _mark("text", t0, True)
    except Exception:  # noqa: BLE001 — search is cosmetic; never fatal
        _mark("text", t0, False)
        log.exception("places searchText failed")
        return []
    return _parse_places(data)


def _parse_places(data: dict) -> list[dict]:
    """Map a Google places[] payload to our place dicts (shared by nearby/text)."""
    out = []
    for pl in data.get("places", []):
        loc = pl.get("location") or {}
        if "latitude" not in loc or "longitude" not in loc:
            continue
        photos = pl.get("photos") or []
        out.append({
            "place_id": pl["id"],
            "name": (pl.get("displayName") or {}).get("text") or "Unnamed place",
            "address": pl.get("formattedAddress") or "",
            "lat": loc["latitude"], "lon": loc["longitude"],
            # First photo's resource name (places/<id>/photos/<ref>), if any —
            # the client fetches the bytes back through /api/places/photo.
            "photo_ref": (photos[0].get("name") if photos else None),
        })
    return out


_PHOTO_MISS = "MISS"          # negative-cache sentinel
_PHOTO_MISS_TTL = 300         # don't hammer Google for places that just failed

# The only Google URL shape we'll ever fetch media from (SSRF guard on the
# server-side ref — refs never come from, or go to, the browser).
_PHOTO_REF_RE = re.compile(r"^places/[\w-]+/photos/[\w-]+$")


def _photo_ckey(place_id: str, max_w: int) -> str:
    return f"placephoto:{place_id}:{max_w}"


async def fetch_photo(place_id: str, max_w: int) -> tuple[str, bytes] | None:
    """Image bytes + content-type for a place's primary photo, fetched with the
    server-side credentials (they never reach the browser). None on failure or
    when the place has no photo. The caller must validate `place_id` shape.

    Keyed by place id, NOT photo ref: Google mints a fresh photos[0] ref per
    search response, so ref-keyed entries for the same image never collide
    across clients. The ref is re-derived here via resolve() (place cache →
    details call) only on a cache miss. Bytes live in Redis for
    PLACES_PHOTO_CACHE_TTL (base64 — the shared client is decode_responses=True)
    so a photo costs one billed Google call per day across all instances and
    viewers; failures are negatively cached briefly."""
    r = gamestore.client()
    key = _photo_ckey(place_id, max_w)
    cached = await r.get(key)
    if cached is not None:  # bytes or the negative-cache marker — either saved a call
        metrics.places_cache_total.labels("photo", "hit").inc()
        if cached == _PHOTO_MISS:
            return None
        content_type, b64 = cached.split("\n", 1)
        return content_type, base64.b64decode(b64)
    metrics.places_cache_total.labels("photo", "miss").inc()
    if not _has_google():
        return None
    place = await resolve(place_id)
    ref = (place or {}).get("photo_ref")
    if not ref or not _PHOTO_REF_RE.match(ref):
        await r.set(key, _PHOTO_MISS, ex=_PHOTO_MISS_TTL)
        return None
    t0 = time.monotonic()
    try:
        headers = await _auth_headers()
        async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True) as c:
            resp = await c.get(f"{_NEW_BASE}/{ref}/media",
                               headers=headers, params={"maxWidthPx": max_w})
        resp.raise_for_status()
        _mark("photo", t0, True)
    except Exception:  # noqa: BLE001 — photos are cosmetic; never fatal
        _mark("photo", t0, False)
        log.exception("places photo failed")
        await r.set(key, _PHOTO_MISS, ex=_PHOTO_MISS_TTL)
        return None
    content_type = resp.headers.get("content-type", "image/jpeg")
    await r.set(key, f"{content_type}\n{base64.b64encode(resp.content).decode()}",
                ex=PLACES_PHOTO_CACHE_TTL)
    return content_type, resp.content


async def _google_details(place_id: str) -> dict | None:
    t0 = time.monotonic()
    try:
        headers = {**await _auth_headers(),
                   "X-Goog-FieldMask": "id,displayName,location,photos"}
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            resp = await c.get(f"{_NEW_BASE}/places/{place_id}", headers=headers)
        resp.raise_for_status()
        pl = resp.json()
        _mark("details", t0, True)
    except Exception:  # noqa: BLE001
        _mark("details", t0, False)
        log.exception("places details failed")
        return None
    loc = pl.get("location") or {}
    if "latitude" not in loc or "longitude" not in loc:
        return None
    photos = pl.get("photos") or []
    return {
        "place_id": pl.get("id", place_id),
        "name": (pl.get("displayName") or {}).get("text") or "Unnamed place",
        "lat": loc["latitude"], "lon": loc["longitude"],
        "photo_ref": (photos[0].get("name") if photos else None),
    }
