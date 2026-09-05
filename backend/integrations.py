"""External integrations. Real when env creds present; clearly-marked DEV fallback otherwise.
DEV mode NEVER simulates a real production transaction silently — responses flag dev_mode=True."""
import os
import random
import hmac
import hashlib
from datetime import datetime, timezone, timedelta
import httpx
from db import db

# ---------------- Config presence ----------------
TWILIO_SID = os.environ.get("TWILIO_ACCOUNT_SID") or ""
TWILIO_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN") or ""
TWILIO_VERIFY = os.environ.get("TWILIO_VERIFY_SERVICE") or ""
RZP_KEY = os.environ.get("RAZORPAY_KEY_ID") or ""
RZP_SECRET = os.environ.get("RAZORPAY_KEY_SECRET") or ""
EMERGENT_AUTH_BASE = os.environ.get("EMERGENT_AUTH_BASE", "https://demobackend.emergentagent.com/auth/v1/env")


def twilio_enabled():
    return bool(TWILIO_SID and TWILIO_TOKEN and TWILIO_VERIFY)


def razorpay_enabled():
    return bool(RZP_KEY and RZP_SECRET)


# ---------------- OTP ----------------
async def send_otp(phone: str):
    if twilio_enabled():
        try:
            from twilio.rest import Client
            client = Client(TWILIO_SID, TWILIO_TOKEN)
            v = client.verify.v2.services(TWILIO_VERIFY).verifications.create(to=phone, channel="sms")
            return {"sent": True, "dev_mode": False, "status": v.status}
        except Exception as e:
            return {"sent": False, "dev_mode": False, "error": str(e)}
    # DEV fallback
    code = f"{random.randint(0, 999999):06d}"
    await db.otp_codes.update_one(
        {"phone": phone},
        {"$set": {"phone": phone, "code": code, "attempts": 0,
                  "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()}},
        upsert=True)
    return {"sent": True, "dev_mode": True, "dev_otp": code,
            "message": "SMS not configured — DEV OTP returned for testing only."}


async def verify_otp(phone: str, code: str):
    if twilio_enabled():
        try:
            from twilio.rest import Client
            client = Client(TWILIO_SID, TWILIO_TOKEN)
            check = client.verify.v2.services(TWILIO_VERIFY).verification_checks.create(to=phone, code=code)
            return check.status == "approved"
        except Exception:
            return False
    rec = await db.otp_codes.find_one({"phone": phone})
    if not rec:
        return False
    if rec.get("attempts", 0) >= 5:
        return False
    expires = rec.get("expires_at")
    if expires and datetime.fromisoformat(expires) < datetime.now(timezone.utc):
        return False
    if rec.get("code") != code:
        await db.otp_codes.update_one({"phone": phone}, {"$inc": {"attempts": 1}})
        return False
    await db.otp_codes.delete_one({"phone": phone})
    return True


# ---------------- Razorpay ----------------
def create_payment_order(amount_rupees: int, receipt: str):
    amount_paise = int(round(amount_rupees * 100))
    if razorpay_enabled():
        import razorpay
        client = razorpay.Client(auth=(RZP_KEY, RZP_SECRET))
        order = client.order.create({"amount": amount_paise, "currency": "INR",
                                      "receipt": receipt[:40], "payment_capture": 1})
        return {"dev_mode": False, "razorpay_order_id": order["id"], "amount": amount_paise,
                "key_id": RZP_KEY, "currency": "INR"}
    return {"dev_mode": True, "razorpay_order_id": f"dev_order_{receipt[:24]}", "amount": amount_paise,
            "key_id": None, "currency": "INR",
            "message": "Razorpay keys not configured — DEV checkout. No real payment is processed."}


def verify_payment_signature(order_id: str, payment_id: str, signature: str) -> bool:
    if not razorpay_enabled():
        return False
    body = f"{order_id}|{payment_id}"
    expected = hmac.new(RZP_SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature or "")


# ---------------- Emergent Google Auth ----------------
async def fetch_google_session(session_id: str):
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"{EMERGENT_AUTH_BASE}/oauth/session-data",
                             headers={"X-Session-ID": session_id})
        if r.status_code != 200:
            return None
        return r.json()
