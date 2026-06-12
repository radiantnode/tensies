"""Tensies Attitude — the server-decided snark pack.

attitude.json (repo root; override with ATTITUDE_FILE) holds phrase variants
for every scenario at every attitude level. At import this module resolves the
pack into one payload per level: nested scenario keys are flattened to dot
paths ("winner.flavor_lose"), and each scenario picks the closest filled level
at or below the target (intolerable → who_invited_him → heckler →
friendly_drunk), so the pack doesn't need every cell filled. Level "off"
serves an empty phrase map — the client then uses its built-in copy for
everything.

The active level comes from ATTITUDE_LEVEL; /attitude.json (routes.py) serves
the resolved payload. Resolution happens server-side on purpose: a client at a
polite level never even receives the upper tiers' profanity.
"""
import hashlib
import json
from pathlib import Path

from .config import (
    ATTITUDE_FILE,
    ATTITUDE_LEVEL,
    ATTITUDE_MAX_LEVEL,
    ATTITUDE_PLAYER_CHOICE,
    log,
)

LEVELS = ["off", "friendly_drunk", "heckler", "who_invited_him", "intolerable"]


def _level_index(raw: str | None, default: int = 0) -> int:
    """Level name or numeric index → index into LEVELS (default on nonsense)."""
    if raw in LEVELS:
        return LEVELS.index(raw)
    try:
        n = int(raw)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default
    return n if 0 <= n < len(LEVELS) else default


def _pick(level_map: dict, level_idx: int):
    """The closest variant list at or below level_idx (None when none exists)."""
    for i in range(level_idx, 0, -1):
        v = level_map.get(LEVELS[i])
        if v:
            return v
    return None


def _flatten(node: dict, level_idx: int, prefix: str, out: dict) -> None:
    """Walk the nested phrase tree; a node keyed by level names is a leaf."""
    if any(k in LEVELS for k in node):
        variants = _pick(node, level_idx)
        if variants:
            out[prefix] = variants
        return
    for key, child in node.items():
        if isinstance(child, dict):
            _flatten(child, level_idx, f"{prefix}.{key}" if prefix else key, out)


def _build_payload(pack: dict, level_idx: int) -> dict:
    phrases: dict = {}
    if level_idx > 0:
        _flatten(pack.get("phrases", {}), level_idx, "", phrases)
    return {
        "level": LEVELS[level_idx],
        "levels": LEVELS,
        "player_choice": ATTITUDE_PLAYER_CHOICE,
        "nicknames": (_pick(pack.get("nicknames", {}), level_idx) or []) if level_idx else [],
        "phrases": phrases,
    }


def _load_pack() -> dict:
    path = Path(ATTITUDE_FILE)
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError) as e:
        log.warning("attitude: cannot load %s (%s) — serving level 'off'", path, e)
        return {}


_pack = _load_pack()
ACTIVE_LEVEL_INDEX = _level_index(ATTITUDE_LEVEL) if _pack else 0
MAX_LEVEL_INDEX = max(_level_index(ATTITUDE_MAX_LEVEL, len(LEVELS) - 1), ACTIVE_LEVEL_INDEX)

# One pre-serialized body + ETag per level: index ACTIVE_LEVEL_INDEX is the
# default response; the rest exist for ?level= once ATTITUDE_PLAYER_CHOICE is on.
_payloads = [_build_payload(_pack, i) for i in range(len(LEVELS))]
BODIES = [json.dumps(p, separators=(",", ":")).encode() for p in _payloads]
ETAGS = ['"%s"' % hashlib.sha1(b).hexdigest()[:16] for b in BODIES]

if ACTIVE_LEVEL_INDEX:
    log.info("attitude: level=%s (%d scenarios)",
             LEVELS[ACTIVE_LEVEL_INDEX], len(_payloads[ACTIVE_LEVEL_INDEX]["phrases"]))


def response_for(requested: str | None) -> tuple[bytes, str]:
    """Body + ETag for one request: the active level, unless player choice is
    on and a valid ?level= at or below the operator ceiling was asked for."""
    idx = ACTIVE_LEVEL_INDEX
    if ATTITUDE_PLAYER_CHOICE and requested is not None:
        idx = min(_level_index(requested, ACTIVE_LEVEL_INDEX), MAX_LEVEL_INDEX)
    return BODIES[idx], ETAGS[idx]
