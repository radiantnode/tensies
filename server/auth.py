"""WebAuthn passkey registration + authentication endpoints.

Pure passkey auth — no passwords, no email. The username IS the identity.
Challenges are stored in Redis with a short TTL; JWTs are stateless (HS256).
"""
import logging
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from server import db, gamestore
from server.config import (
    JWT_EXPIRY_DAYS,
    JWT_SECRET,
    WEBAUTHN_ORIGIN,
    WEBAUTHN_RP_ID,
    WEBAUTHN_RP_NAME,
)

log = logging.getLogger("tensies.auth")

router = APIRouter(prefix="/auth", tags=["auth"])

# ─── Username validation ──────────────────────────────────────────────
import re

USERNAME_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,28}[a-zA-Z0-9]$")


def _enum_val(v):
    """Extract .value from an enum, or return the value as-is (str/int)."""
    return v.value if hasattr(v, "value") else v
USERNAME_MIN = 2
USERNAME_MAX = 30


def _validate_username(username: str) -> str:
    """Validate and return the username, or raise 400."""
    username = username.strip()
    if len(username) < USERNAME_MIN or len(username) > USERNAME_MAX:
        raise HTTPException(400, f"Username must be {USERNAME_MIN}–{USERNAME_MAX} characters")
    if not USERNAME_RE.match(username):
        raise HTTPException(
            400,
            "Username must start and end with a letter or number, "
            "and can contain letters, numbers, dots, hyphens, and underscores",
        )
    return username


# ─── JWT helpers ──────────────────────────────────────────────────────

def _mint_jwt(user_id: str, username: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "username": username,
        "iat": now,
        "exp": now + timedelta(days=JWT_EXPIRY_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def _decode_jwt(token: str) -> dict:
    """Decode and verify a JWT. Raises HTTPException on failure."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired") from None
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token") from None


def require_user(authorization: str | None = Header(None)) -> dict:
    """FastAPI dependency: extract + verify the bearer JWT, return its claims
    ({"sub": user_id, "username": ...}). Raises 401 when missing/invalid.

    Shared by any endpoint that must act as a signed-in account (e.g. the push
    subscribe/unsubscribe routes), so they authenticate exactly like /auth/me.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    return _decode_jwt(authorization[7:])


# ─── Challenge storage (Redis, 120s TTL) ──────────────────────────────

CHALLENGE_TTL = 120  # seconds

async def _store_challenge(nonce: str, challenge: bytes) -> None:
    r = gamestore.client()
    await r.set(f"webauthn:challenge:{nonce}", challenge.hex(), ex=CHALLENGE_TTL)


async def _pop_challenge(nonce: str) -> bytes:
    r = gamestore.client()
    key = f"webauthn:challenge:{nonce}"
    val = await r.getdel(key)
    if val is None:
        raise HTTPException(400, "Challenge expired or already used")
    return bytes.fromhex(val)


# ─── Request/response models ─────────────────────────────────────────

class RegisterOptionsRequest(BaseModel):
    username: str

class RegisterVerifyRequest(BaseModel):
    nonce: str
    username: str
    credential: dict
    legacy_pid: str | None = None

class LoginOptionsRequest(BaseModel):
    username: str

class LoginVerifyRequest(BaseModel):
    nonce: str
    username: str
    credential: dict


# ─── Registration ─────────────────────────────────────────────────────

@router.post("/register/options")
async def register_options(body: RegisterOptionsRequest):
    username = _validate_username(body.username)
    username_lower = username.lower()

    # Check uniqueness
    async with db.pool().acquire() as con:
        exists = await con.fetchval(
            "SELECT 1 FROM users WHERE username_lower = $1", username_lower
        )
    if exists:
        raise HTTPException(409, "Username already taken")

    user_id = uuid.uuid4()
    options = generate_registration_options(
        rp_id=WEBAUTHN_RP_ID,
        rp_name=WEBAUTHN_RP_NAME,
        user_id=str(user_id).encode(),
        user_name=username,
        user_display_name=username,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
    )

    nonce = secrets.token_urlsafe(32)
    await _store_challenge(nonce, options.challenge)

    # Serialize options to JSON-safe dict
    options_dict = {
        "rp": {"id": options.rp.id, "name": options.rp.name},
        "user": {
            "id": bytes_to_base64url(options.user.id),
            "name": options.user.name,
            "displayName": options.user.display_name,
        },
        "challenge": bytes_to_base64url(options.challenge),
        "pubKeyCredParams": [
            {"type": _enum_val(p.type), "alg": _enum_val(p.alg)}
            for p in options.pub_key_cred_params
        ],
        "timeout": options.timeout,
        "authenticatorSelection": {
            "residentKey": _enum_val(options.authenticator_selection.resident_key),
            "userVerification": _enum_val(options.authenticator_selection.user_verification),
        },
        "attestation": _enum_val(options.attestation),
    }
    if options.exclude_credentials:
        options_dict["excludeCredentials"] = [
            {
                "id": bytes_to_base64url(c.id),
                "type": _enum_val(c.type),
                **({"transports": [_enum_val(t) for t in c.transports]} if c.transports else {}),
            }
            for c in options.exclude_credentials
        ]

    return {"options": options_dict, "nonce": nonce, "user_id": str(user_id)}


@router.post("/register/verify")
async def register_verify(body: RegisterVerifyRequest):
    username = _validate_username(body.username)
    username_lower = username.lower()
    challenge = await _pop_challenge(body.nonce)

    # Reconstruct the credential bytes from the client's base64url JSON
    cred = body.credential
    credential_response = _build_registration_credential(cred)

    verification = verify_registration_response(
        credential=credential_response,
        expected_challenge=challenge,
        expected_rp_id=WEBAUTHN_RP_ID,
        expected_origin=WEBAUTHN_ORIGIN,
    )

    # Extract the user_id that was generated in register/options
    user_id_str = cred.get("user_id") or body.credential.get("user_id")
    # Fallback: generate a new one if not passed through
    if not user_id_str:
        user_id_str = str(uuid.uuid4())

    async with db.pool().acquire() as con:
        async with con.transaction():
            # Race guard: UNIQUE index catches concurrent inserts
            try:
                await con.execute(
                    """
                    INSERT INTO users (id, username, username_lower, legacy_pid)
                    VALUES ($1, $2, $3, $4)
                    """,
                    uuid.UUID(user_id_str),
                    username,
                    username_lower,
                    body.legacy_pid,
                )
            except Exception as e:
                if "unique" in str(e).lower():
                    raise HTTPException(409, "Username already taken") from e
                raise

            transports = cred.get("transports", [])
            await con.execute(
                """
                INSERT INTO webauthn_credentials
                    (user_id, credential_id, public_key, sign_count, transports)
                VALUES ($1, $2, $3, $4, $5)
                """,
                uuid.UUID(user_id_str),
                verification.credential_id,
                verification.credential_public_key,
                verification.sign_count,
                transports or None,
            )

            # Data transfer: link old anonymous stats to the new account
            if body.legacy_pid:
                await con.execute(
                    "UPDATE player_stats SET user_id = $1 WHERE user_id = $2",
                    user_id_str,
                    body.legacy_pid,
                )

    # Fetch any transferred stats for the onboarding screen
    stats = None
    async with db.pool().acquire() as con:
        row = await con.fetchrow(
            """
            SELECT total_games, total_wins, total_rounds, total_rolls,
                   fastest_win_ms, total_time_played_ms
            FROM player_stats WHERE user_id = $1
            """,
            user_id_str,
        )
        if row and row["total_games"]:
            stats = dict(row)

    token = _mint_jwt(user_id_str, username)
    log.info("registered  user=%s  username=%s", user_id_str, username)
    return {
        "token": token,
        "user": {"id": user_id_str, "username": username},
        "stats": stats,
    }


# ─── Authentication ───────────────────────────────────────────────────

@router.post("/login/options")
async def login_options(body: LoginOptionsRequest):
    username = _validate_username(body.username)
    username_lower = username.lower()

    async with db.pool().acquire() as con:
        user = await con.fetchrow(
            "SELECT id, username FROM users WHERE username_lower = $1",
            username_lower,
        )
        if not user:
            raise HTTPException(404, "No account with that username")

        creds = await con.fetch(
            "SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = $1",
            user["id"],
        )

    allow_credentials = [
        PublicKeyCredentialDescriptor(id=row["credential_id"])
        for row in creds
    ]

    options = generate_authentication_options(
        rp_id=WEBAUTHN_RP_ID,
        allow_credentials=allow_credentials,
        user_verification=UserVerificationRequirement.PREFERRED,
    )

    nonce = secrets.token_urlsafe(32)
    await _store_challenge(nonce, options.challenge)

    options_dict = {
        "challenge": bytes_to_base64url(options.challenge),
        "rpId": WEBAUTHN_RP_ID,
        "timeout": options.timeout,
        "userVerification": _enum_val(options.user_verification),
        "allowCredentials": [
            {
                "id": bytes_to_base64url(c.id),
                "type": _enum_val(c.type),
            }
            for c in allow_credentials
        ],
    }

    return {
        "options": options_dict,
        "nonce": nonce,
        "user_id": str(user["id"]),
    }


@router.post("/login/verify")
async def login_verify(body: LoginVerifyRequest):
    username_lower = body.username.strip().lower()
    challenge = await _pop_challenge(body.nonce)

    async with db.pool().acquire() as con:
        user = await con.fetchrow(
            "SELECT id, username FROM users WHERE username_lower = $1",
            username_lower,
        )
        if not user:
            raise HTTPException(404, "No account with that username")

        cred = body.credential
        raw_id = base64url_to_bytes(cred["rawId"])

        stored = await con.fetchrow(
            """
            SELECT credential_id, public_key, sign_count
            FROM webauthn_credentials
            WHERE user_id = $1 AND credential_id = $2
            """,
            user["id"],
            raw_id,
        )
        if not stored:
            raise HTTPException(400, "Credential not recognized")

    credential_response = _build_authentication_credential(cred)

    verification = verify_authentication_response(
        credential=credential_response,
        expected_challenge=challenge,
        expected_rp_id=WEBAUTHN_RP_ID,
        expected_origin=WEBAUTHN_ORIGIN,
        credential_public_key=stored["public_key"],
        credential_current_sign_count=stored["sign_count"],
    )

    async with db.pool().acquire() as con:
        await con.execute(
            """
            UPDATE webauthn_credentials
            SET sign_count = $1, last_used_ts = now()
            WHERE user_id = $2 AND credential_id = $3
            """,
            verification.new_sign_count,
            user["id"],
            raw_id,
        )
        await con.execute(
            "UPDATE users SET last_login_ts = now() WHERE id = $1",
            user["id"],
        )

    user_id_str = str(user["id"])
    token = _mint_jwt(user_id_str, user["username"])
    log.info("login  user=%s  username=%s", user_id_str, user["username"])
    return {
        "token": token,
        "user": {"id": user_id_str, "username": user["username"]},
    }


# ─── /me ──────────────────────────────────────────────────────────────

@router.get("/me")
async def me(authorization: str | None = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    token = authorization[7:]
    payload = _decode_jwt(token)
    return {"user": {"id": payload["sub"], "username": payload["username"]}}


# ─── Credential builders ─────────────────────────────────────────────
# Convert the client's JSON-serialized credential into the objects that
# py_webauthn expects.

from webauthn.helpers.structs import (
    AuthenticationCredential,
    AuthenticatorAssertionResponse,
    AuthenticatorAttestationResponse,
    RegistrationCredential,
)


def _build_registration_credential(cred: dict) -> RegistrationCredential:
    response = cred["response"]
    return RegistrationCredential(
        id=cred["id"],
        raw_id=base64url_to_bytes(cred["rawId"]),
        response=AuthenticatorAttestationResponse(
            client_data_json=base64url_to_bytes(response["clientDataJSON"]),
            attestation_object=base64url_to_bytes(response["attestationObject"]),
        ),
        type=cred.get("type", "public-key"),
    )


def _build_authentication_credential(cred: dict) -> AuthenticationCredential:
    response = cred["response"]
    return AuthenticationCredential(
        id=cred["id"],
        raw_id=base64url_to_bytes(cred["rawId"]),
        response=AuthenticatorAssertionResponse(
            client_data_json=base64url_to_bytes(response["clientDataJSON"]),
            authenticator_data=base64url_to_bytes(response["authenticatorData"]),
            signature=base64url_to_bytes(response["signature"]),
            user_handle=(
                base64url_to_bytes(response["userHandle"])
                if response.get("userHandle")
                else None
            ),
        ),
        type=cred.get("type", "public-key"),
    )
