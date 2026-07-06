"""Google Places proxy (server-side) for the lobby "check in" feature.

Credentials never reach the browser — the client asks the server for nearby
places, and the server holds them. Two backends, in order of preference:
  1. a **service account** (GOOGLE_APPLICATION_CREDENTIALS) → OAuth bearer token,
     so the key never has to be an unrestricted browser API key;
  2. a plain **API key** (GOOGLE_MAPS_API_KEY).
When PLACES_ENABLED is on but neither is set, a small dev stub stands in so the
whole check-in flow is testable without a Google account.

httpx uses trust_env by default, so these calls inherit any HTTPS_PROXY / CA
bundle from the environment (same as server/drand.py and server/discord.py).

A place dict is: {"place_id", "name", "address"?, "lat", "lon"}.
"""
import asyncio
import json
import logging
import time

import httpx
import jwt

from . import gamestore
from .config import (
    GOOGLE_APPLICATION_CREDENTIALS,
    GOOGLE_CLOUD_PROJECT,
    GOOGLE_MAPS_API_KEY,
    PLACES_CACHE_TTL,
    PLACES_MAX_RESULTS,
    PLACES_RADIUS_M,
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
            except Exception:  # noqa: BLE001 — fall back to key/stub, never fatal
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


# ─── Dev stub (no API key) ───────────────────────────────────────────────
# Fixed venues laid out as small offsets from the caller, so they appear as
# believable "nearby" places. Their coords are cached on search, and check-in
# resolves against that cache — so a stub check-in works end-to-end.
_STUB = [
    ("stub-rusty-anchor", "The Rusty Anchor", "12 Dock St", 0.00045, 0.00060),
    ("stub-corner-cafe", "Corner Café", "88 Main St", -0.00055, 0.00030),
    ("stub-old-oak", "The Old Oak Pub", "5 Elm Row", 0.00030, -0.00070),
    ("stub-taco-loco", "Taco Loco", "200 Market Ave", -0.00040, -0.00050),
    ("stub-book-nook", "The Book Nook", "17 Library Ln", 0.00080, 0.00010),
]


def _stub_nearby(lat: float, lon: float) -> list[dict]:
    return [
        {"place_id": pid, "name": name, "address": addr,
         "lat": lat + dlat, "lon": lon + dlon}
        for pid, name, addr, dlat, dlon in _STUB
    ]


# ─── Redis cache: place_id → {name, lat, lon} ────────────────────────────
def _ckey(place_id: str) -> str:
    return f"place:{place_id}"


async def _cache_put(p: dict) -> None:
    await gamestore.client().set(
        _ckey(p["place_id"]),
        json.dumps({"name": p["name"], "lat": p["lat"], "lon": p["lon"]}),
        ex=PLACES_CACHE_TTL,
    )


async def _cache_get(place_id: str) -> dict | None:
    raw = await gamestore.client().get(_ckey(place_id))
    if not raw:
        return None
    d = json.loads(raw)
    return {"place_id": place_id, "name": d["name"], "lat": d["lat"], "lon": d["lon"]}


# ─── Public API ──────────────────────────────────────────────────────────
async def search_nearby(lat: float, lon: float) -> list[dict]:
    """Places near (lat, lon). Falls back to the dev stub when no key is set.
    Every result is cached so a subsequent check-in can resolve it cheaply."""
    results = await _google_nearby(lat, lon) if _has_google() \
        else _stub_nearby(lat, lon)
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
        return None  # stub relies on the warm cache from search_nearby()
    p = await _google_details(place_id)
    if p is not None:
        await _cache_put(p)
    return p


# ─── Google Places API (New) ─────────────────────────────────────────────
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
    try:
        headers = {**await _auth_headers(), "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.location"}
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            resp = await c.post(f"{_NEW_BASE}/places:searchNearby",
                                headers=headers, json=body)
        resp.raise_for_status()
        data = resp.json()
    except Exception:  # noqa: BLE001 — places are cosmetic; never fatal
        log.exception("places searchNearby failed")
        return []
    out = []
    for pl in data.get("places", []):
        loc = pl.get("location") or {}
        if "latitude" not in loc or "longitude" not in loc:
            continue
        out.append({
            "place_id": pl["id"],
            "name": (pl.get("displayName") or {}).get("text") or "Unnamed place",
            "address": pl.get("formattedAddress") or "",
            "lat": loc["latitude"], "lon": loc["longitude"],
        })
    return out


async def _google_details(place_id: str) -> dict | None:
    try:
        headers = {**await _auth_headers(),
                   "X-Goog-FieldMask": "id,displayName,location"}
        async with httpx.AsyncClient(timeout=_TIMEOUT) as c:
            resp = await c.get(f"{_NEW_BASE}/places/{place_id}", headers=headers)
        resp.raise_for_status()
        pl = resp.json()
    except Exception:  # noqa: BLE001
        log.exception("places details failed")
        return None
    loc = pl.get("location") or {}
    if "latitude" not in loc or "longitude" not in loc:
        return None
    return {
        "place_id": pl.get("id", place_id),
        "name": (pl.get("displayName") or {}).get("text") or "Unnamed place",
        "lat": loc["latitude"], "lon": loc["longitude"],
    }
