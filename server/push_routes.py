"""Web Push subscription endpoints.

The browser flow:
    1. GET  /push/vapid-public-key  → the applicationServerKey to subscribe with
    2. POST /push/subscribe         → store the resulting PushSubscription
    3. POST /push/unsubscribe       → drop it (on permission revoke / sign-out)

Subscribe/unsubscribe authenticate as the signed-in account via the shared
`require_user` JWT dependency, so a push is always owned by a real users.id.
"""
import logging

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from server import push
from server.auth import require_user

log = logging.getLogger("tensies.push")

router = APIRouter(prefix="/push", tags=["push"])


class SubscribeRequest(BaseModel):
    subscription: dict


class UnsubscribeRequest(BaseModel):
    endpoint: str


@router.get("/vapid-public-key")
async def vapid_public_key() -> dict:
    key = push.public_key()
    if key is None:
        raise HTTPException(503, "Push notifications are not configured")
    return {"public_key": key}


@router.post("/subscribe")
async def subscribe(
    body: SubscribeRequest,
    claims: dict = Depends(require_user),
    user_agent: str | None = Header(None),
) -> dict:
    if not push.is_configured():
        raise HTTPException(503, "Push notifications are not configured")
    try:
        await push.save_subscription(claims["sub"], body.subscription, user_agent)
    except KeyError as e:
        raise HTTPException(400, f"Malformed subscription (missing {e})") from None
    log.info("push  subscribed  user=%s", claims["sub"])
    return {"ok": True}


@router.post("/unsubscribe")
async def unsubscribe(
    body: UnsubscribeRequest,
    claims: dict = Depends(require_user),
) -> dict:
    await push.delete_subscription(body.endpoint)
    return {"ok": True}
