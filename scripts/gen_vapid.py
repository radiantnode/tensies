#!/usr/bin/env python3
"""Generate a VAPID keypair for Web Push.

Prints the public/private keys in the base64url forms the rest of the stack
expects — the public key goes to the browser as the applicationServerKey, the
private key signs outgoing pushes via pywebpush. Paste both into your .env:

    VAPID_PUBLIC_KEY=...
    VAPID_PRIVATE_KEY=...
    VAPID_SUBJECT=mailto:you@example.com
    PUSH_ENABLED=1

The script validates that pywebpush's loader accepts the private key it prints,
so a key it emits is guaranteed usable by server/push.py.
"""
import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from py_vapid import Vapid


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def main() -> None:
    private_key = ec.generate_private_key(ec.SECP256R1())

    priv_scalar = private_key.private_numbers().private_value.to_bytes(32, "big")
    private_b64 = _b64url(priv_scalar)

    public_point = private_key.public_key().public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )
    public_b64 = _b64url(public_point)

    # Fail loudly here if the format isn't what pywebpush will load at send time.
    Vapid.from_string(private_key=private_b64)

    print("# Web Push VAPID keys — add to your .env")
    print(f"VAPID_PUBLIC_KEY={public_b64}")
    print(f"VAPID_PRIVATE_KEY={private_b64}")
    print("VAPID_SUBJECT=mailto:michael@simmonstx.com")
    print("PUSH_ENABLED=1")


if __name__ == "__main__":
    main()
