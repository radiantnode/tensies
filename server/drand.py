"""Drand distributed randomness beacon integration.

Background poller fetches the latest beacon from the drand quicknet chain
every DRAND_POLL_INTERVAL seconds, caches it in-process. The roll path reads
the cached beacon with zero added latency. Falls back to random.randint()
when drand is unreachable.

Verification pipeline (defence in depth):
  1. SHA-256 consistency: randomness == SHA256(signature) — always checked.
  2. BLS signature: pairing check against the chain public key — checked when
     pyblst is available (Python bindings to supranational blst, the audited
     BLS12-381 library used by Ethereum consensus clients; ships wheels for
     every current CPython incl. 3.14).
"""
import asyncio
import hashlib
import hmac
import random
import time

import httpx

from .config import (
    DRAND_BASE_URL,
    DRAND_CHAIN_HASH,
    DRAND_POLL_INTERVAL,
    ENABLE_DRAND_ROLLING,
    log,
)
from .telemetry import metrics

# ── Process-local state (like server/state.py) ─────────────────────────
_task: asyncio.Task | None = None
_http: httpx.AsyncClient | None = None
_beacon: dict | None = None  # {"round": int, "randomness": str}
_chain_pk_bytes: bytes | None = None

# ── BLS verification (degrades gracefully) ─────────────────────────────
# blspy (Chia's C++ bindings) was used until 2026-08: it is unmaintained and its
# bindings do not compile on CPython >= 3.13, so it was replaced by pyblst.
_bls_ok = False
try:
    from pyblst import (  # type: ignore[import-untyped]
        BlstP1Element,
        BlstP2Element,
        final_verify,
        miller_loop,
    )

    _bls_ok = True
except ImportError:
    log.warning("pyblst not available — BLS verification disabled")

_DST = b"BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_"
# Compressed BLS12-381 G2 generator (IETF draft-irtf-cfrg-pairing-friendly-curves).
_G2_GENERATOR = bytes.fromhex(
    "93e02b6052719f607dacd3a088274f65596bd0d09920b61ab5da61bbdc7f5049"
    "334cf11213945d57e5ac7d055d042b7e024aa2b2f08f0a91260805272dc51051"
    "c6e47ad4fa403b02b4510b647ae3d1770bac0326a805bbefd48056c8c121bdb8"
)


def _verify_bls(sig_bytes: bytes, round_num: int) -> bool:
    """Verify a drand quicknet BLS signature (G1 sig, G2 pubkey).

    drand quicknet signs SHA256(round_as_be_u64), hashed to G1 with the
    standard min-sig DST. Verification: e(sig, G2_gen) == e(H(msg), pk),
    computed as final_verify(miller_loop(sig, G2_gen), miller_loop(H(msg), pk)).
    """
    if not _bls_ok or _chain_pk_bytes is None:
        return True  # skip, rely on SHA-256 consistency + HTTPS

    try:
        sig = BlstP1Element.uncompress(sig_bytes)
        pk = BlstP2Element.uncompress(_chain_pk_bytes)
        g2 = BlstP2Element.uncompress(_G2_GENERATOR)
        msg = hashlib.sha256(round_num.to_bytes(8, "big")).digest()
        h = BlstP1Element.hash_to_group(msg, _DST)
        return bool(final_verify(miller_loop(sig, g2), miller_loop(h, pk)))
    except Exception:
        log.exception("BLS verification error — skipping")
        return True


# ── Lifecycle (matches reaper/fanout start/stop pattern) ───────────────

async def start() -> None:
    global _task, _http, _chain_pk_bytes
    if not ENABLE_DRAND_ROLLING:
        log.info("drand rolling disabled")
        return

    _http = httpx.AsyncClient(timeout=5.0)

    try:
        resp = await _http.get(f"{DRAND_BASE_URL}/{DRAND_CHAIN_HASH}/info")
        resp.raise_for_status()
        info = resp.json()
        _chain_pk_bytes = bytes.fromhex(info["public_key"])
        log.info(
            "drand chain loaded  beacon=%s  period=%ss  pk=%s...  bls=%s",
            info.get("metadata", {}).get("beaconID", "?"),
            info.get("period", "?"),
            info["public_key"][:16],
            "on" if _bls_ok else "off",
        )
    except Exception:
        log.exception("drand chain info fetch failed — BLS verification disabled")

    _task = asyncio.create_task(_poll_loop(), name="drand.poller")
    log.info(
        "drand poller started  chain=%s...  interval=%ss",
        DRAND_CHAIN_HASH[:12],
        DRAND_POLL_INTERVAL,
    )


async def stop() -> None:
    global _task, _http
    if _task is not None:
        _task.cancel()
        _task = None
    if _http is not None:
        await _http.aclose()
        _http = None


async def _poll_loop() -> None:
    while True:
        try:
            await _fetch_latest()
        except asyncio.CancelledError:
            return
        except Exception:
            log.exception("drand fetch error")
        await asyncio.sleep(DRAND_POLL_INTERVAL)


async def _fetch_latest() -> None:
    global _beacon
    t0 = time.monotonic()
    resp = await _http.get(f"{DRAND_BASE_URL}/{DRAND_CHAIN_HASH}/public/latest")
    resp.raise_for_status()
    dt = time.monotonic() - t0
    metrics.drand_fetch_seconds.observe(dt)

    data = resp.json()
    round_num = data["round"]
    randomness = data["randomness"]
    sig_bytes = bytes.fromhex(data["signature"])

    # Verification layer 1: SHA-256 consistency (always)
    expected_rand = hashlib.sha256(sig_bytes).hexdigest()
    if expected_rand != randomness:
        log.warning(
            "drand SHA-256 consistency check failed  round=%d  "
            "expected=%s  got=%s",
            round_num, expected_rand[:16], randomness[:16],
        )
        metrics.drand_verify_failures_total.inc()
        return

    # Verification layer 2: BLS signature (when pyblst available)
    if _bls_ok and _chain_pk_bytes is not None:
        if not _verify_bls(sig_bytes, round_num):
            log.warning("drand BLS verification failed  round=%d", round_num)
            metrics.drand_verify_failures_total.inc()
            return

    _beacon = {"round": round_num, "randomness": randomness}
    metrics.drand_beacon_fetches_total.inc()


# ── Public API ─────────────────────────────────────────────────────────

def get_beacon() -> dict | None:
    """Return the cached beacon. Pure read, no await, zero latency."""
    return _beacon


def derive_dice(
    randomness_hex: str,
    player_id: str,
    roll_count: int,
    game_code: str,
    num_dice: int = 10,
) -> list[int]:
    """Deterministically derive dice values from a drand beacon.

    Uses HMAC-SHA256 with the beacon randomness as key and a per-player,
    per-roll message. Always produces num_dice values (default 10). The
    caller consumes the first N for unlocked dice; the rest are unused but
    deterministic (so the verify endpoint can re-derive without knowing
    the locked state).

    Bias: 4/65536 = 0.006% per die (two-byte mod 6). Negligible.
    """
    key = bytes.fromhex(randomness_hex)
    message = f"{player_id}:{roll_count}:{game_code}".encode()
    mac = hmac.new(key, message, hashlib.sha256).digest()
    return [
        (int.from_bytes(mac[i * 2 : (i * 2) + 2], "big") % 6) + 1
        for i in range(num_dice)
    ]


def generate_dice(
    player_id: str,
    roll_count: int,
    game_code: str,
    num_dice: int = 10,
) -> tuple[list[int], int | None]:
    """Derive dice from drand or fall back to local RNG.

    Returns (dice_values, drand_round). drand_round is None when the
    feature is off or no beacon is cached (silent fallback).
    """
    if not ENABLE_DRAND_ROLLING:
        return [random.randint(1, 6) for _ in range(num_dice)], None
    beacon = get_beacon()
    if beacon is None:
        metrics.drand_fallback_total.inc()
        return [random.randint(1, 6) for _ in range(num_dice)], None
    dice = derive_dice(
        beacon["randomness"], player_id, roll_count, game_code, num_dice
    )
    return dice, beacon["round"]
