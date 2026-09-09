import re
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request, Depends
from db import db, clean
from security import (create_token, get_current_customer, optional_customer, now_iso)
from pricing import compute_totals, validate_coupon, build_line_items
import integrations as ig
from routers_store import public_product

router = APIRouter()
PHONE_RE = re.compile(r"^\+?[1-9]\d{7,14}$")


def norm_phone(phone: str) -> str:
    p = (phone or "").strip().replace(" ", "").replace("-", "")
    if p and not p.startswith("+"):
        if len(p) == 10:
            p = "+91" + p
        else:
            p = "+" + p
    return p


def customer_public(c):
    c = clean(dict(c))
    return {"id": c["id"], "name": c.get("name"), "phone": c.get("phone"),
            "email": c.get("email"), "picture": c.get("picture"),
            "wishlist": c.get("wishlist", [])}


async def upsert_customer_by_phone(phone, name=None, email=None):
    existing = await db.customers.find_one({"phone": phone})
    if existing:
        upd = {}
        if name and not existing.get("name"):
            upd["name"] = name
        if email and not existing.get("email"):
            upd["email"] = email
        if upd:
            await db.customers.update_one({"id": existing["id"]}, {"$set": upd})
            existing.update(upd)
        return clean(existing), False
    doc = {"id": str(uuid.uuid4()), "phone": phone, "name": name, "email": email,
           "picture": None, "google_id": None, "wishlist": [], "status": "New",
           "notes": [], "created_at": now_iso()}
    await db.customers.insert_one(doc)
    return clean(doc), True


# ---------------- AUTH ----------------
@router.post("/auth/otp/send")
async def otp_send(payload: dict):
    phone = norm_phone(payload.get("phone", ""))
    if not PHONE_RE.match(phone):
        raise HTTPException(400, "Please enter a valid mobile number.")
    res = await ig.send_otp(phone)
    if not res.get("sent"):
        raise HTTPException(400, res.get("error", "Could not send OTP. Please try again."))
    out = {"sent": True, "dev_mode": res.get("dev_mode", False), "phone": phone}
    if res.get("dev_mode"):
        out["dev_otp"] = res.get("dev_otp")
        out["message"] = res.get("message")
    return out


@router.post("/auth/otp/verify")
async def otp_verify(payload: dict):
    phone = norm_phone(payload.get("phone", ""))
    code = (payload.get("code") or "").strip()
    if not PHONE_RE.match(phone) or not code:
        raise HTTPException(400, "Mobile number and OTP are required.")
    if not await ig.verify_otp(phone, code):
        raise HTTPException(400, "Invalid or expired OTP. Please try again.")
    cust, is_new = await upsert_customer_by_phone(phone, name=payload.get("name"))
    token = create_token(cust["id"], "customer")
    return {"token": token, "customer": customer_public(cust), "new_account": is_new}


@router.post("/auth/google/session")
async def google_session(payload: dict):
    session_id = payload.get("session_id")
    if not session_id:
        raise HTTPException(400, "Missing session.")
    data = await ig.fetch_google_session(session_id)
    if not data or not data.get("email"):
        raise HTTPException(401, "Google sign-in failed. Please try again.")
    email = data["email"].lower()
    existing = await db.customers.find_one({"$or": [{"email": email}, {"google_id": data.get("id")}]})
    if existing:
        await db.customers.update_one({"id": existing["id"]}, {"$set": {
            "google_id": data.get("id"), "picture": data.get("picture") or existing.get("picture"),
            "name": existing.get("name") or data.get("name")}})
        cust = clean(await db.customers.find_one({"id": existing["id"]}))
        is_new = False
    else:
        doc = {"id": str(uuid.uuid4()), "phone": None, "name": data.get("name"), "email": email,
               "picture": data.get("picture"), "google_id": data.get("id"), "wishlist": [],
               "status": "New", "notes": [], "created_at": now_iso()}
        await db.customers.insert_one(doc)
        cust, is_new = clean(doc), True
    token = create_token(cust["id"], "customer")
    return {"token": token, "customer": customer_public(cust), "new_account": is_new}


@router.get("/auth/me")
async def auth_me(cust: dict = Depends(get_current_customer)):
    return customer_public(cust)


@router.put("/customers/me")
async def update_me(payload: dict, cust: dict = Depends(get_current_customer)):
    upd = {k: payload[k] for k in ("name", "email") if k in payload}
    if payload.get("phone"):
        new_phone = norm_phone(payload["phone"])
        if not PHONE_RE.match(new_phone):
            raise HTTPException(400, "Please enter a valid mobile number.")
        if new_phone != cust.get("phone"):
            clash = await db.customers.find_one({"phone": new_phone, "id": {"$ne": cust["id"]}})
            if clash:
                raise HTTPException(409, "This mobile number is already linked to another account.")
            upd["phone"] = new_phone
    if upd:
        await db.customers.update_one({"id": cust["id"]}, {"$set": upd})
    return customer_public(await db.customers.find_one({"id": cust["id"]}))


# ---------------- CART & COUPON ----------------
@router.post("/cart/validate")
async def cart_validate(payload: dict, request: Request):
    cust = await optional_customer(request)
    totals = await compute_totals(payload.get("items", []), payload.get("coupon_code"), cust)
    return totals


@router.post("/coupons/validate")
async def coupon_validate(payload: dict, request: Request):
    cust = await optional_customer(request)
    lines, _ = await build_line_items(payload.get("items", []))
    subtotal = sum(l["line_total"] for l in lines)
    coupon, discount, free_ship, err = await validate_coupon(payload.get("code"), subtotal, lines, cust)
    if err:
        raise HTTPException(400, err)
    return {"valid": True, "code": coupon["code"], "discount": discount,
            "free_shipping": free_ship, "description": coupon.get("description")}


# ---------------- WISHLIST ----------------
@router.get("/wishlist")
async def get_wishlist(cust: dict = Depends(get_current_customer)):
    ids = cust.get("wishlist", [])
    cur = db.products.find({"id": {"$in": ids}, "status": {"$ne": "Archived"}}, {"_id": 0})
    return {"items": [public_product(p) async for p in cur]}


@router.post("/wishlist/{product_id}")
async def add_wishlist(product_id: str, cust: dict = Depends(get_current_customer)):
    await db.customers.update_one({"id": cust["id"]}, {"$addToSet": {"wishlist": product_id}})
    c = await db.customers.find_one({"id": cust["id"]})
    return {"wishlist": c.get("wishlist", [])}


@router.delete("/wishlist/{product_id}")
async def remove_wishlist(product_id: str, cust: dict = Depends(get_current_customer)):
    await db.customers.update_one({"id": cust["id"]}, {"$pull": {"wishlist": product_id}})
    c = await db.customers.find_one({"id": cust["id"]})
    return {"wishlist": c.get("wishlist", [])}


# ---------------- ADDRESSES ----------------
@router.get("/addresses")
async def list_addresses(cust: dict = Depends(get_current_customer)):
    cur = db.addresses.find({"customer_id": cust["id"]}, {"_id": 0})
    return {"items": [a async for a in cur]}


@router.post("/addresses")
async def add_address(payload: dict, cust: dict = Depends(get_current_customer)):
    doc = {"id": str(uuid.uuid4()), "customer_id": cust["id"],
           "name": payload.get("name"), "phone": norm_phone(payload.get("phone", "")),
           "line1": payload.get("line1"), "line2": payload.get("line2"),
           "area": payload.get("area"), "city": payload.get("city"),
           "state": payload.get("state"), "pincode": payload.get("pincode"),
           "instructions": payload.get("instructions"),
           "is_default": payload.get("is_default", False), "created_at": now_iso()}
    if not (doc["name"] and doc["line1"] and doc["city"] and doc["state"] and doc["pincode"]):
        raise HTTPException(400, "Please complete all required address fields.")
    if doc["is_default"]:
        await db.addresses.update_many({"customer_id": cust["id"]}, {"$set": {"is_default": False}})
    count = await db.addresses.count_documents({"customer_id": cust["id"]})
    if count == 0:
        doc["is_default"] = True
    await db.addresses.insert_one(doc)
    return clean(doc)


@router.put("/addresses/{aid}")
async def update_address(aid: str, payload: dict, cust: dict = Depends(get_current_customer)):
    a = await db.addresses.find_one({"id": aid, "customer_id": cust["id"]})
    if not a:
        raise HTTPException(404, "Address not found.")
    fields = {k: payload[k] for k in ("name", "phone", "line1", "line2", "area", "city",
                                      "state", "pincode", "instructions", "is_default") if k in payload}
    if fields.get("is_default"):
        await db.addresses.update_many({"customer_id": cust["id"]}, {"$set": {"is_default": False}})
    await db.addresses.update_one({"id": aid}, {"$set": fields})
    return clean(await db.addresses.find_one({"id": aid}))


@router.delete("/addresses/{aid}")
async def delete_address(aid: str, cust: dict = Depends(get_current_customer)):
    r = await db.addresses.delete_one({"id": aid, "customer_id": cust["id"]})
    if r.deleted_count == 0:
        raise HTTPException(404, "Address not found.")
    return {"ok": True}


# ---------------- ORDERS & CHECKOUT ----------------
async def _order_number():
    doc = await db.counters.find_one_and_update(
        {"id": "order"}, {"$inc": {"seq": 1}}, upsert=True, return_document=True)
    seq = (doc or {}).get("seq", 1)
    return f"ART-{datetime.now(timezone.utc).year}-{seq:05d}"


def order_public(o):
    o = clean(dict(o))
    o.pop("cost_snapshot", None)
    return o


@router.post("/checkout/create-order")
async def create_order(payload: dict, cust: dict = Depends(get_current_customer)):
    items = payload.get("items", [])
    address = payload.get("address") or {}
    if not items:
        raise HTTPException(400, "Your cart is empty.")
    for f in ("name", "line1", "city", "state", "pincode"):
        if not address.get(f):
            raise HTTPException(400, "Please provide a complete delivery address.")
    totals = await compute_totals(items, payload.get("coupon_code"), cust)
    if totals["errors"]:
        raise HTTPException(400, {"message": "Some items are unavailable.", "errors": totals["errors"]})
    if totals["total"] <= 0 or not totals["items"]:
        raise HTTPException(400, "Unable to place order. Please review your cart.")

    method = payload.get("payment_method", "razorpay")
    order_number = await _order_number()
    order_id = str(uuid.uuid4())

    # Reserve inventory atomically
    for l in totals["items"]:
        await db.products.update_one({"id": l["product_id"]}, {"$inc": {"reserved": l["qty"]}})

    pay = ig.create_payment_order(totals["total"], order_number) if method != "cod" else \
        {"dev_mode": False, "razorpay_order_id": None, "amount": int(totals["total"] * 100),
         "key_id": None, "currency": "INR"}

    order = {
        "id": order_id, "order_number": order_number, "customer_id": cust["id"],
        "customer": {"name": cust.get("name") or address.get("name"), "phone": cust.get("phone") or address.get("phone"),
                     "email": cust.get("email") or payload.get("email")},
        "items": totals["items"], "pricing": {
            "subtotal": totals["subtotal"], "discount": totals["discount"],
            "coupon_code": totals["coupon_code"], "shipping": totals["shipping"],
            "tax": totals["tax"], "savings": totals["savings"], "total": totals["total"],
            "currency_symbol": totals["currency_symbol"]},
        "address": address, "payment_method": method,
        "payment": {"provider": "cod" if method == "cod" else "razorpay",
                    "status": "cod_pending" if method == "cod" else "created",
                    "razorpay_order_id": pay.get("razorpay_order_id"),
                    "payment_id": None, "dev_mode": pay.get("dev_mode", False)},
        "status": "Pending",
        "status_history": [{"status": "Pending", "at": now_iso(), "note": "Order created."}],
        "tracking": {"number": None, "courier": None},
        "created_at": now_iso(), "updated_at": now_iso()}
    await db.orders.insert_one(order)

    resp = {"order_id": order_id, "order_number": order_number, "amount": pay.get("amount"),
            "razorpay_order_id": pay.get("razorpay_order_id"), "key_id": pay.get("key_id"),
            "dev_mode": pay.get("dev_mode", False), "payment_method": method,
            "prefill": {"name": cust.get("name") or address.get("name"),
                        "email": cust.get("email") or payload.get("email"),
                        "contact": cust.get("phone") or address.get("phone")},
            "total": totals["total"]}
    if pay.get("message"):
        resp["message"] = pay["message"]
    if method == "cod":
        # COD confirms immediately
        await _finalize_paid_order(order, payment_id=None, method="cod")
        resp["confirmed"] = True
    return resp


async def _finalize_paid_order(order, payment_id=None, method="razorpay"):
    """Idempotent: deduct inventory, confirm order, update counters. Runs once per order."""
    guard = await db.orders.update_one(
        {"id": order["id"], "payment.status": {"$nin": ["paid", "cod_confirmed"]}},
        {"$set": {"payment.status": "paid" if method != "cod" else "cod_confirmed",
                  "payment.payment_id": payment_id, "payment.method": method,
                  "status": "Confirmed", "updated_at": now_iso()},
         "$push": {"status_history": {"status": "Confirmed", "at": now_iso(),
                                      "note": "Payment confirmed." if method != "cod" else "COD order confirmed."}}})
    if guard.modified_count == 0:
        return  # already finalized -> idempotent no-op
    for l in order["items"]:
        await db.products.update_one({"id": l["product_id"]},
                                     {"$inc": {"reserved": -l["qty"], "stock": -l["qty"],
                                               "sales_count": l["qty"]}})
        await db.inventory_transactions.insert_one({
            "id": str(uuid.uuid4()), "product_id": l["product_id"], "change": -l["qty"],
            "reason": f"Order {order['order_number']}", "at": now_iso()})
        prod = await db.products.find_one({"id": l["product_id"]}, {"stock": 1, "status": 1, "_id": 0})
        if prod and prod.get("stock", 0) <= 0 and prod.get("status") == "Active":
            await db.products.update_one({"id": l["product_id"]}, {"$set": {"status": "Out of Stock"}})
    if order["pricing"].get("coupon_code"):
        await db.coupons.update_one({"code": order["pricing"]["coupon_code"]}, {"$inc": {"used_count": 1}})
    await db.customers.update_one({"id": order["customer_id"]},
                                  {"$set": {"status": "Active"},
                                   "$inc": {"order_count": 1, "total_spend": order["pricing"]["total"]}})
    await db.notifications.insert_one({"id": str(uuid.uuid4()), "type": "new_order",
                                       "title": f"New order {order['order_number']}",
                                       "order_number": order["order_number"], "read": False, "at": now_iso()})
    cust = await db.customers.find_one({"id": order["customer_id"]}, {"phone": 1, "_id": 0})
    if cust and cust.get("phone"):
        total = order["pricing"]["total"]
        await ig.send_sms(cust["phone"],
                          f"ARTFUL: Your order {order['order_number']} is confirmed! "
                          f"Amount Rs.{total}. Track it in your account. Thank you for shopping with us.")


@router.post("/checkout/verify-payment")
async def verify_payment(payload: dict, cust: dict = Depends(get_current_customer)):
    order = await db.orders.find_one({"id": payload.get("order_id"), "customer_id": cust["id"]})
    if not order:
        raise HTTPException(404, "Order not found.")
    if order["payment"]["status"] in ("paid", "cod_confirmed"):
        return {"success": True, "order": order_public(order)}  # idempotent
    if not ig.razorpay_enabled():
        raise HTTPException(400, "Payment gateway not configured. Use the demo checkout instead.")
    ok = ig.verify_payment_signature(payload.get("razorpay_order_id"),
                                     payload.get("razorpay_payment_id"),
                                     payload.get("razorpay_signature"))
    if not ok:
        await db.orders.update_one({"id": order["id"]}, {"$set": {"payment.status": "failed",
                                   "status": "Failed", "updated_at": now_iso()},
                                   "$push": {"status_history": {"status": "Failed", "at": now_iso(),
                                             "note": "Payment verification failed."}}})
        for l in order["items"]:
            await db.products.update_one({"id": l["product_id"]}, {"$inc": {"reserved": -l["qty"]}})
        raise HTTPException(400, "Payment could not be verified. If money was deducted it will be refunded.")
    await _finalize_paid_order(order, payment_id=payload.get("razorpay_payment_id"))
    return {"success": True, "order": order_public(await db.orders.find_one({"id": order["id"]}))}


@router.post("/checkout/mock-pay")
async def mock_pay(payload: dict, cust: dict = Depends(get_current_customer)):
    """DEV ONLY: finalize an order when Razorpay is not configured. Clearly a demo, not a real charge."""
    if ig.razorpay_enabled():
        raise HTTPException(400, "Live payments are configured. Use the real payment flow.")
    order = await db.orders.find_one({"id": payload.get("order_id"), "customer_id": cust["id"]})
    if not order:
        raise HTTPException(404, "Order not found.")
    if order["payment"]["status"] in ("paid", "cod_confirmed"):
        return {"success": True, "order": order_public(order), "dev_mode": True}
    await db.orders.update_one({"id": order["id"]}, {"$set": {"payment.dev_mode": True}})
    await _finalize_paid_order(order, payment_id=f"dev_pay_{uuid.uuid4().hex[:12]}")
    o = await db.orders.find_one({"id": order["id"]})
    return {"success": True, "order": order_public(o), "dev_mode": True,
            "message": "DEMO payment recorded. No real transaction occurred."}


@router.get("/orders")
async def my_orders(cust: dict = Depends(get_current_customer)):
    cur = db.orders.find({"customer_id": cust["id"]}, {"_id": 0}).sort("created_at", -1)
    return {"items": [order_public(o) async for o in cur]}


@router.get("/orders/{order_number}")
async def get_order(order_number: str, cust: dict = Depends(get_current_customer)):
    o = await db.orders.find_one({"order_number": order_number, "customer_id": cust["id"]})
    if not o:
        raise HTTPException(404, "Order not found.")
    return order_public(o)


@router.post("/orders/track")
async def track_order(payload: dict):
    number = (payload.get("order_number") or "").strip().upper()
    phone = norm_phone(payload.get("phone", ""))
    o = await db.orders.find_one({"order_number": number}, {"_id": 0})
    if not o or o.get("customer", {}).get("phone") != phone:
        raise HTTPException(404, "No matching order found. Please check the details.")
    return {"order_number": o["order_number"], "status": o["status"],
            "status_history": o["status_history"], "tracking": o.get("tracking"),
            "items": [{"name": i["name"], "qty": i["qty"], "image": i.get("image")} for i in o["items"]],
            "total": o["pricing"]["total"], "created_at": o["created_at"],
            "address": {"city": o["address"].get("city"), "state": o["address"].get("state")}}


async def _has_purchased(customer_id, product_id):
    return await db.orders.count_documents({
        "customer_id": customer_id,
        "payment.status": {"$in": ["paid", "cod_confirmed"]},
        "items.product_id": product_id}) > 0


@router.get("/products/{slug}/can-review")
async def can_review(slug: str, cust: dict = Depends(get_current_customer)):
    p = await db.products.find_one({"slug": slug}, {"id": 1, "_id": 0})
    if not p:
        raise HTTPException(404, "Product not found.")
    purchased = await _has_purchased(cust["id"], p["id"])
    already = await db.reviews.count_documents({"product_id": p["id"], "customer_id": cust["id"]}) > 0
    return {"can_review": purchased and not already, "purchased": purchased, "already_reviewed": already}


@router.post("/products/{slug}/reviews")
async def submit_review(slug: str, payload: dict, cust: dict = Depends(get_current_customer)):
    p = await db.products.find_one({"slug": slug}, {"id": 1, "_id": 0})
    if not p:
        raise HTTPException(404, "Product not found.")
    if not await _has_purchased(cust["id"], p["id"]):
        raise HTTPException(403, "Only verified buyers can review this product.")
    if await db.reviews.count_documents({"product_id": p["id"], "customer_id": cust["id"]}) > 0:
        raise HTTPException(400, "You have already reviewed this product.")
    rating = int(payload.get("rating", 0))
    if rating < 1 or rating > 5:
        raise HTTPException(400, "Please provide a rating between 1 and 5.")
    doc = {"id": str(uuid.uuid4()), "product_id": p["id"], "product_slug": slug,
           "customer_id": cust["id"], "customer_name": cust.get("name") or "ARTFUL Customer",
           "rating": rating, "title": payload.get("title"), "body": payload.get("body"),
           "verified_buyer": True,
           "status": "Pending", "created_at": now_iso()}
    await db.reviews.insert_one(doc)
    return {"ok": True, "message": "Thank you! Your review will appear once approved.", "review": clean(doc)}


@router.post("/orders/{order_number}/cancel")
async def cancel_order(order_number: str, payload: dict, cust: dict = Depends(get_current_customer)):
    o = await db.orders.find_one({"order_number": order_number, "customer_id": cust["id"]})
    if not o:
        raise HTTPException(404, "Order not found.")
    if o["status"] in ("Shipped", "Out for Delivery", "Delivered", "Cancelled", "Returned", "Refunded"):
        raise HTTPException(400, f"This order cannot be cancelled once it is {o['status'].lower()}.")
    paid = o["payment"]["status"] in ("paid", "cod_confirmed")
    for l in o["items"]:
        if paid:
            await db.products.update_one({"id": l["product_id"]}, {"$inc": {"stock": l["qty"]}})
        else:
            await db.products.update_one({"id": l["product_id"]}, {"$inc": {"reserved": -l["qty"]}})
    await db.orders.update_one({"id": o["id"]}, {"$set": {"status": "Cancelled", "updated_at": now_iso()},
        "$push": {"status_history": {"status": "Cancelled", "at": now_iso(),
                  "note": payload.get("reason") or "Cancelled by customer."}}})
    if o["payment"]["status"] == "paid":
        await db.refunds.insert_one({"id": str(uuid.uuid4()), "order_number": o["order_number"],
            "amount": o["pricing"]["total"], "reason": "Order cancelled by customer",
            "status": "Requested", "created_at": now_iso()})
    await db.notifications.insert_one({"id": str(uuid.uuid4()), "type": "cancel_order",
        "title": f"Order {o['order_number']} cancelled", "order_number": o["order_number"],
        "read": False, "at": now_iso()})
    if cust.get("phone"):
        refund_note = " A refund has been initiated." if o["payment"]["status"] == "paid" else ""
        await ig.send_sms(cust["phone"],
                          f"ARTFUL: Your order {o['order_number']} has been cancelled.{refund_note} "
                          f"Need help? Reach us on WhatsApp +91 8871288853.")
    return {"ok": True, "message": "Your order has been cancelled." + (" A refund has been initiated." if o["payment"]["status"] == "paid" else "")}