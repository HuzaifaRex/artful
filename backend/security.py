import os
import jwt
import bcrypt
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Request

from db import db, clean

JWT_ALGO = "HS256"


def _secret():
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(subject: str, role: str, hours: int = 24 * 7) -> str:
    payload = {
        "sub": subject,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=hours),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGO)


def _decode(token: str):
    try:
        return jwt.decode(token, _secret(), algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session.")


def _bearer(request: Request):
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return request.cookies.get("access_token")


async def get_current_customer(request: Request) -> dict:
    token = _bearer(request)
    if not token:
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
    payload = _decode(token)
    if payload.get("role") != "customer":
        raise HTTPException(status_code=401, detail="Invalid session.")
    cust = await db.customers.find_one({"id": payload["sub"]})
    if not cust:
        raise HTTPException(status_code=401, detail="Account not found.")
    if cust.get("status") == "Blocked":
        raise HTTPException(status_code=403, detail="This account has been disabled.")
    return clean(cust)


async def optional_customer(request: Request):
    try:
        return await get_current_customer(request)
    except HTTPException:
        return None


async def get_current_admin(request: Request) -> dict:
    token = _bearer(request)
    if not token:
        raise HTTPException(status_code=401, detail="Admin authentication required.")
    payload = _decode(token)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    admin = await db.admin_users.find_one({"id": payload["sub"]})
    if not admin or admin.get("status") != "Active":
        raise HTTPException(status_code=403, detail="Admin account inactive.")
    admin.pop("password_hash", None)
    return clean(admin)


# Role -> permission areas
ROLE_PERMISSIONS = {
    "Super Admin": {"*"},
    "Admin": {"catalog", "orders", "customers", "marketing", "search", "content", "corporate", "analytics", "settings"},
    "Catalog Manager": {"catalog"},
    "Order Manager": {"orders"},
    "Marketing Manager": {"marketing", "search"},
    "Content Manager": {"content"},
    "Support Manager": {"customers", "orders", "corporate"},
    "Analyst": {"analytics"},
}


def has_permission(admin: dict, area: str) -> bool:
    perms = ROLE_PERMISSIONS.get(admin.get("role", ""), set())
    return "*" in perms or area in perms


def require_permission(area: str):
    async def _dep(request: Request):
        admin = await get_current_admin(request)
        if not has_permission(admin, area):
            raise HTTPException(status_code=403, detail="You do not have permission for this action.")
        return admin
    return _dep


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
