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
TWILIO_FROM = os.environ.get("TWILIO_FROM_NUMBER") or ""
TWILIO_API_KEY_SID = os.environ.get("TWILIO_API_KEY_SID") or ""
TWILIO_API_KEY_SECRET = os.environ.get("TWILIO_API_KEY_SECRET") or ""
RZP_KEY = os.environ.get("RAZORPAY_KEY_ID") or ""
RZP_SECRET = os.environ.get("RAZORPAY_KEY_SECRET") or ""
RZP_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET") or ""
EMERGENT_AUTH_BASE = os.environ.get("EMERGENT_AUTH_BASE", "https://demobackend.emergentagent.com/auth/v1/env")


def twilio_enabled():
    return bool(TWILIO_SID and TWILIO_TOKEN and TWILIO_VERIFY)




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


# ---------------- Transactional SMS ----------------
def sms_enabled():
    return bool(TWILIO_SID and TWILIO_TOKEN and TWILIO_FROM)


async def send_sms(phone: str, body: str):
    """Send a transactional SMS. Real via Twilio when configured, else logged (DEV)."""
    if not phone:
        return {"sent": False, "dev_mode": True, "message": "No phone on file."}
    if sms_enabled():
        try:
            from twilio.rest import Client
            if TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET:
                client = Client(TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_SID)
            else:
                client = Client(TWILIO_SID, TWILIO_TOKEN)
            msg = client.messages.create(to=phone, from_=TWILIO_FROM, body=body)
            return {"sent": True, "dev_mode": False, "sid": msg.sid}
        except Exception as e:
            print(f"[sms] Twilio send failed: {e}")
            return {"sent": False, "dev_mode": False, "error": str(e)}
    print(f"[sms][DEV] To {phone}: {body}")
    return {"sent": True, "dev_mode": True, "message": "SMS not configured — logged only."}



# ---------------- Razorpay ----------------

def razorpay_enabled():
    return bool(RZP_KEY and RZP_SECRET)

def razorpay_webhook_enabled():
    return bool(RZP_WEBHOOK_SECRET)


def _razorpay_client():
    if not razorpay_enabled():
        raise RuntimeError("Razorpay is not configured.")
    import razorpay
    return razorpay.Client(auth=(RZP_KEY, RZP_SECRET))


def create_payment_order(amount_rupees, receipt):
    """Create a server-side Razorpay Order for the exact cart total."""
    amount_paise = int(round(float(amount_rupees) * 100))
    if amount_paise <= 0:
        raise ValueError("Payment amount must be greater than zero.")

    if razorpay_enabled():
        client = _razorpay_client()
        order = client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": (receipt or "order")[:40],
            "payment_capture": 1,
        })
        return {
            "dev_mode": False,
            "razorpay_order_id": order["id"],
            "amount": amount_paise,
            "key_id": RZP_KEY,
            "currency": "INR",
        }

    return {
        "dev_mode": True,
        "razorpay_order_id": f"dev_order_{(receipt or '')[:24]}",
        "amount": amount_paise,
        "key_id": None,
        "currency": "INR",
        "message": "Razorpay keys not configured — DEV checkout. No real payment is processed.",
    }


def verify_payment_signature(order_id, payment_id, signature):
    """Verify Checkout signature with the server-stored Razorpay order id."""
    if not razorpay_enabled() or not order_id or not payment_id or not signature:
        return False
    body = f"{order_id}|{payment_id}"
    expected = hmac.new(
        RZP_SECRET.encode("utf-8"),
        body.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def verify_webhook_signature(raw_body, signature):
    """Verify X-Razorpay-Signature against the raw request body."""
    if not razorpay_webhook_enabled() or not signature:
        return False
    expected = hmac.new(
        RZP_WEBHOOK_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def fetch_payment(payment_id):
    """Fetch a payment from Razorpay for server-side status verification."""
    if not payment_id:
        raise ValueError("Missing Razorpay payment id.")
    return _razorpay_client().payment.fetch(payment_id)


def capture_payment(payment_id, amount_paise):
    """Capture an authorized payment for the exact server-calculated amount."""
    if not payment_id:
        raise ValueError("Missing Razorpay payment id.")
    return _razorpay_client().payment.capture(payment_id, {"amount": int(amount_paise), "currency": "INR"})


def create_refund(payment_id, amount_paise, receipt, idempotency_key):
    """Create a normal Razorpay refund with retry-safe idempotency."""
    if not razorpay_enabled():
        raise RuntimeError("Razorpay is not configured.")
    if not payment_id:
        raise ValueError("Missing Razorpay payment id.")
    if int(amount_paise) <= 0:
        raise ValueError("Refund amount must be greater than zero.")

    import httpx

    payload = {
        "amount": int(amount_paise),
        "speed": "normal",
        "receipt": (receipt or "refund")[:40],
    }
    headers = {
        "Content-Type": "application/json",
        "X-Refund-Idempotency": idempotency_key,
    }
    with httpx.Client(timeout=20.0) as client:
        response = client.post(
            f"https://api.razorpay.com/v1/payments/{payment_id}/refund",
            auth=(RZP_KEY, RZP_SECRET),
            json=payload,
            headers=headers,
        )

    try:
        data = response.json()
    except ValueError:
        data = {}

    if response.status_code >= 400:
        err = data.get("error") if isinstance(data, dict) else None
        description = (err or {}).get("description") if isinstance(err, dict) else None
        raise RuntimeError(description or "Razorpay refund request failed.")

    return data


# ---------------- Emergent Google Auth ----------------
async def fetch_google_session(session_id: str):
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"{EMERGENT_AUTH_BASE}/oauth/session-data",
                             headers={"X-Session-ID": session_id})
        if r.status_code != 200:
            return None
        return r.json()