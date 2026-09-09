import re
import io
import os
import csv
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from db import db, clean
from security import (verify_password, hash_password, create_token, get_current_admin,
                      require_permission, now_iso, ROLE_PERMISSIONS)

router = APIRouter()


def slugify(text):
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return s or uuid.uuid4().hex[:8]


async def audit(admin, action, resource, resource_id=None, before=None, after=None, request=None):
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()), "admin_id": admin.get("id"), "admin_email": admin.get("email"),
        "action": action, "resource": resource, "resource_id": resource_id,
        "before": before, "after": after,
        "ip": request.client.host if request and request.client else None,
        "at": now_iso()})


# ---------------- AUTH ----------------
@router.post("/auth/login")
async def admin_login(payload: dict, request: Request):
    email = (payload.get("email") or "").lower().strip()
    password = payload.get("password") or ""
    ident = f"{request.client.host if request.client else 'x'}:{email}"
    attempt = await db.admin_login_attempts.find_one({"id": ident})
    if attempt and attempt.get("count", 0) >= 5:
        locked = datetime.fromisoformat(attempt["locked_until"]) if attempt.get("locked_until") else None
        if locked and locked > datetime.now(timezone.utc):
            raise HTTPException(429, "Too many attempts. Please try again in a few minutes.")
    admin = await db.admin_users.find_one({"email": email})
    if not admin or not verify_password(password, admin.get("password_hash", "")):
        await db.admin_login_attempts.update_one({"id": ident},
            {"$inc": {"count": 1}, "$set": {"locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}},
            upsert=True)
        raise HTTPException(401, "Invalid email or password.")
    if admin.get("status") != "Active":
        raise HTTPException(403, "This admin account is inactive.")
    await db.admin_login_attempts.delete_one({"id": ident})
    await db.admin_users.update_one({"id": admin["id"]}, {"$set": {"last_login": now_iso()}})
    token = create_token(admin["id"], "admin")
    a = clean(admin); a.pop("password_hash", None)
    return {"token": token, "admin": a, "permissions": list(ROLE_PERMISSIONS.get(a["role"], set()))}


@router.get("/auth/me")
async def admin_me(admin: dict = Depends(get_current_admin)):
    return {"admin": admin, "permissions": list(ROLE_PERMISSIONS.get(admin["role"], set()))}


# ---------------- DASHBOARD ----------------
@router.get("/dashboard/stats")
async def dashboard(admin: dict = Depends(get_current_admin)):
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week = today - timedelta(days=7)
    month = today - timedelta(days=30)

    async def revenue_since(dt):
        total = 0
        cur = db.orders.find({"payment.status": {"$in": ["paid", "cod_confirmed"]},
                              "created_at": {"$gte": dt.isoformat()}}, {"pricing.total": 1, "_id": 0})
        async for o in cur:
            total += o["pricing"]["total"]
        return total

    paid_q = {"payment.status": {"$in": ["paid", "cod_confirmed"]}}
    all_paid = await db.orders.count_documents(paid_q)
    total_rev = await revenue_since(datetime(2000, 1, 1, tzinfo=timezone.utc))
    orders_by_status = {}
    for st in ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled", "Returned", "Refunded", "Failed"]:
        orders_by_status[st] = await db.orders.count_documents({"status": st})

    bestsellers = [clean(p) async for p in db.products.find({}, {"_id": 0}).sort("sales_count", -1).limit(5)]
    low_stock = [clean(p) async for p in db.products.find(
        {"$expr": {"$lte": ["$stock", "$low_stock_threshold"]}, "status": {"$ne": "Archived"}}, {"_id": 0}).limit(8)]
    recent_orders = [clean(o) async for o in db.orders.find({}, {"_id": 0}).sort("created_at", -1).limit(6)]
    recent_customers = [{"id": c["id"], "name": c.get("name"), "phone": c.get("phone"),
                         "email": c.get("email"), "created_at": c.get("created_at")}
                        async for c in db.customers.find({}, {"_id": 0}).sort("created_at", -1).limit(6)]
    recent_activity = [clean(a) async for a in db.audit_logs.find({}, {"_id": 0}).sort("at", -1).limit(8)]

    return {
        "sales": {"total": total_rev, "today": await revenue_since(today),
                  "week": await revenue_since(week), "month": await revenue_since(month),
                  "orders_paid": all_paid,
                  "aov": round(total_rev / all_paid) if all_paid else 0},
        "orders": {"total": await db.orders.count_documents({}), "by_status": orders_by_status},
        "customers": {"total": await db.customers.count_documents({}),
                      "new_month": await db.customers.count_documents({"created_at": {"$gte": month.isoformat()}})},
        "products": {"total": await db.products.count_documents({}),
                     "active": await db.products.count_documents({"status": "Active"}),
                     "out_of_stock": await db.products.count_documents({"status": "Out of Stock"}),
                     "bestsellers": bestsellers},
        "alerts": {"low_stock": low_stock,
                   "refund_requests": await db.refunds.count_documents({"status": "Requested"}),
                   "corporate_inquiries": await db.corporate_inquiries.count_documents({"status": "New"}),
                   "failed_payments": await db.orders.count_documents({"status": "Failed"})},
        "recent": {"orders": recent_orders, "customers": recent_customers, "activity": recent_activity},
    }


# ---------------- PRODUCTS ----------------
@router.get("/products")
async def admin_products(q: str = "", status: str = "", category: str = "",
                         sort: str = "newest", page: int = 1, page_size: int = 20,
                         admin: dict = Depends(require_permission("catalog"))):
    query = {}
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"sku": {"$regex": q, "$options": "i"}}]
    if status:
        query["status"] = status
    if category:
        query["category_slug"] = category
    sort_map = {"newest": [("created_at", -1)], "price_asc": [("price", 1)],
                "price_desc": [("price", -1)], "stock": [("stock", 1)], "sales": [("sales_count", -1)]}
    total = await db.products.count_documents(query)
    cur = db.products.find(query, {"_id": 0}).sort(sort_map.get(sort, sort_map["newest"])).skip((page-1)*page_size).limit(page_size)
    return {"items": [clean(p) async for p in cur], "total": total, "page": page,
            "pages": max(1, (total + page_size - 1)//page_size)}


@router.post("/products")
async def create_product(payload: dict, request: Request, admin: dict = Depends(require_permission("catalog"))):
    name = payload.get("name")
    if not name or payload.get("price") is None:
        raise HTTPException(400, "Product name and price are required.")
    slug = payload.get("slug") or slugify(name)
    if await db.products.find_one({"slug": slug}):
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"
    doc = {"id": str(uuid.uuid4()), "name": name, "slug": slug,
           "short_description": payload.get("short_description", ""),
           "description": payload.get("description", ""),
           "images": payload.get("images", []), "video": payload.get("video"),
           "price": int(payload["price"]), "compare_at_price": payload.get("compare_at_price"),
           "cost_price": payload.get("cost_price"), "sku": payload.get("sku") or slug.upper().replace("-", "")[:14],
           "barcode": payload.get("barcode"), "category_slug": payload.get("category_slug"),
           "collection_slugs": payload.get("collection_slugs", []), "tags": payload.get("tags", []),
           "material": payload.get("material"), "color": payload.get("color"),
           "dimensions": payload.get("dimensions"), "weight": payload.get("weight"),
           "care": payload.get("care"), "shipping_info": payload.get("shipping_info"),
           "stock": int(payload.get("stock", 0)), "reserved": 0,
           "low_stock_threshold": int(payload.get("low_stock_threshold", 5)),
           "status": payload.get("status", "Draft"), "badges": payload.get("badges", []),
           "sections": payload.get("sections", []),
           "occasion": payload.get("occasion", []), "recipient": payload.get("recipient", []),
           "rating": 0, "review_count": 0, "variants": payload.get("variants", []),
           "personalization": payload.get("personalization", {"enabled": False}),
           "seo": payload.get("seo", {"title": f"{name} — ARTFUL", "description": payload.get("short_description", "")}),
           "views": 0, "sales_count": 0, "created_at": now_iso(), "updated_at": now_iso()}
    await db.products.insert_one(doc)
    await audit(admin, "create", "product", doc["id"], after={"name": name, "price": doc["price"]}, request=request)
    return clean(doc)


@router.get("/products/{pid}")
async def admin_get_product(pid: str, admin: dict = Depends(require_permission("catalog"))):
    p = await db.products.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Product not found.")
    return p


@router.put("/products/{pid}")
async def update_product(pid: str, payload: dict, request: Request, admin: dict = Depends(require_permission("catalog"))):
    p = await db.products.find_one({"id": pid})
    if not p:
        raise HTTPException(404, "Product not found.")
    fields = {k: v for k, v in payload.items() if k not in ("id", "_id", "created_at", "reserved", "sales_count", "views")}
    fields["updated_at"] = now_iso()
    await db.products.update_one({"id": pid}, {"$set": fields})
    await audit(admin, "update", "product", pid,
                before={"price": p.get("price"), "stock": p.get("stock"), "status": p.get("status")},
                after={k: fields.get(k) for k in ("price", "stock", "status") if k in fields}, request=request)
    return clean(await db.products.find_one({"id": pid}))


@router.delete("/products/{pid}")
async def archive_product(pid: str, request: Request, admin: dict = Depends(require_permission("catalog"))):
    await db.products.update_one({"id": pid}, {"$set": {"status": "Archived", "updated_at": now_iso()}})
    await audit(admin, "archive", "product", pid, request=request)
    return {"ok": True}


@router.post("/products/{pid}/duplicate")
async def duplicate_product(pid: str, admin: dict = Depends(require_permission("catalog"))):
    p = await db.products.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Product not found.")
    p["id"] = str(uuid.uuid4()); p["name"] = p["name"] + " (Copy)"
    p["slug"] = slugify(p["name"]) + "-" + uuid.uuid4().hex[:4]
    p["sku"] = p["slug"].upper().replace("-", "")[:14]
    p["status"] = "Draft"; p["sales_count"] = 0; p["views"] = 0; p["reserved"] = 0
    p["created_at"] = now_iso(); p["updated_at"] = now_iso()
    await db.products.insert_one(p)
    return clean(p)


@router.post("/products/{pid}/inventory")
async def adjust_inventory(pid: str, payload: dict, request: Request, admin: dict = Depends(require_permission("catalog"))):
    p = await db.products.find_one({"id": pid})
    if not p:
        raise HTTPException(404, "Product not found.")
    change = int(payload.get("change", 0))
    reason = payload.get("reason", "Manual adjustment")
    new_stock = max(0, p.get("stock", 0) + change)
    upd = {"stock": new_stock, "updated_at": now_iso()}
    if new_stock > 0 and p.get("status") == "Out of Stock":
        upd["status"] = "Active"
    await db.products.update_one({"id": pid}, {"$set": upd})
    await db.inventory_transactions.insert_one({"id": str(uuid.uuid4()), "product_id": pid,
        "change": change, "reason": reason, "admin": admin["email"], "at": now_iso()})
    await audit(admin, "inventory", "product", pid, before={"stock": p.get("stock")}, after={"stock": new_stock}, request=request)
    return {"stock": new_stock}


@router.post("/products/bulk")
async def bulk_products(payload: dict, request: Request, admin: dict = Depends(require_permission("catalog"))):
    ids = payload.get("ids", [])
    action = payload.get("action")
    if not ids or not action:
        raise HTTPException(400, "Select products and an action.")
    upd = None
    if action == "publish":
        upd = {"status": "Active"}
    elif action == "unpublish":
        upd = {"status": "Draft"}
    elif action == "archive":
        upd = {"status": "Archived"}
    elif action == "price_pct" and payload.get("value") is not None:
        pct = float(payload["value"])
        async for p in db.products.find({"id": {"$in": ids}}, {"id": 1, "price": 1, "_id": 0}):
            await db.products.update_one({"id": p["id"]}, {"$set": {"price": max(1, round(p["price"] * (1 + pct/100)))}})
        await audit(admin, "bulk_price", "product", None, after={"ids": ids, "pct": pct}, request=request)
        return {"ok": True, "updated": len(ids)}
    if upd:
        upd["updated_at"] = now_iso()
        await db.products.update_many({"id": {"$in": ids}}, {"$set": upd})
    await audit(admin, f"bulk_{action}", "product", None, after={"ids": ids}, request=request)
    return {"ok": True, "updated": len(ids)}


# ---------------- Generic CRUD factory for simple resources ----------------
def register_crud(path, collection, area, name_field="name", extra_defaults=None, slug_from=None):
    @router.get(f"/{path}", name=f"list_{path}")
    async def _list(admin: dict = Depends(require_permission(area))):
        cur = db[collection].find({}, {"_id": 0})
        return {"items": [c async for c in cur]}

    @router.post(f"/{path}", name=f"create_{path}")
    async def _create(payload: dict, request: Request, admin: dict = Depends(require_permission(area))):
        doc = {"id": str(uuid.uuid4()), **(extra_defaults or {}), **payload, "created_at": now_iso()}
        if slug_from and not doc.get("slug"):
            doc["slug"] = slugify(doc.get(slug_from, ""))
        await db[collection].insert_one(dict(doc))
        await audit(admin, "create", collection, doc["id"], after={name_field: doc.get(name_field)}, request=request)
        return clean(doc)

    @router.put(f"/{path}/{{rid}}", name=f"update_{path}")
    async def _update(rid: str, payload: dict, request: Request, admin: dict = Depends(require_permission(area))):
        r = await db[collection].find_one({"id": rid})
        if not r:
            raise HTTPException(404, "Not found.")
        fields = {k: v for k, v in payload.items() if k not in ("id", "_id", "created_at")}
        await db[collection].update_one({"id": rid}, {"$set": fields})
        await audit(admin, "update", collection, rid, request=request)
        return clean(await db[collection].find_one({"id": rid}))

    @router.delete(f"/{path}/{{rid}}", name=f"delete_{path}")
    async def _delete(rid: str, request: Request, admin: dict = Depends(require_permission(area))):
        await db[collection].delete_one({"id": rid})
        await audit(admin, "delete", collection, rid, request=request)
        return {"ok": True}


register_crud("categories", "categories", "catalog", slug_from="name",
              extra_defaults={"status": "Active", "order": 0})
register_crud("collections", "collections", "catalog", slug_from="name",
              extra_defaults={"status": "Active", "order": 0, "type": "manual", "rules": {}, "product_ids": []})
register_crud("coupons", "coupons", "marketing",
              extra_defaults={"status": "Active", "used_count": 0, "stackable": False})
register_crud("discounts", "discounts", "marketing",
              extra_defaults={"status": "Active"})
register_crud("banners", "banners", "content", extra_defaults={"status": "Active"})
register_crud("pages", "pages", "content", name_field="title", slug_from="title",
              extra_defaults={"status": "Active"})
register_crud("faqs", "faqs", "content", name_field="question",
              extra_defaults={"status": "Active", "order": 0})
register_crud("search/synonyms", "search_synonyms", "search", name_field="term")
register_crud("search/corrections", "search_corrections", "search", name_field="wrong")
register_crud("promotions", "promotions", "marketing",
              extra_defaults={"status": "Active", "countdown": True})


UPLOAD_MIME = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
               ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif"}


@router.post("/upload")
async def upload_image(file: UploadFile = File(...), admin: dict = Depends(get_current_admin)):
    import storage
    ext = os.path.splitext(file.filename or "")[1].lower() or ".png"
    if ext not in UPLOAD_MIME:
        raise HTTPException(400, "Unsupported image type.")
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "Image too large (max 8MB).")
    path = f"{storage.APP_NAME}/uploads/{uuid.uuid4().hex}{ext}"
    try:
        result = storage.put_object(path, data, UPLOAD_MIME[ext])
    except Exception as e:
        raise HTTPException(502, f"Upload failed: {e}")
    url = f"/api/uploads/{result['path']}"
    await db.media.insert_one({"id": str(uuid.uuid4()), "storage_path": result["path"], "url": url,
                               "original_filename": file.filename, "content_type": UPLOAD_MIME[ext],
                               "size": result.get("size", len(data)), "is_deleted": False, "at": now_iso()})
    return {"url": url, "path": result["path"]}


# ---------------- ORDERS ----------------
@router.get("/orders")
async def admin_orders(status: str = "", q: str = "", page: int = 1, page_size: int = 20,
                       admin: dict = Depends(require_permission("orders"))):
    query = {}
    if status:
        query["status"] = status
    if q:
        query["$or"] = [{"order_number": {"$regex": q, "$options": "i"}},
                        {"customer.phone": {"$regex": q, "$options": "i"}},
                        {"customer.name": {"$regex": q, "$options": "i"}}]
    total = await db.orders.count_documents(query)
    cur = db.orders.find(query, {"_id": 0}).sort("created_at", -1).skip((page-1)*page_size).limit(page_size)
    return {"items": [clean(o) async for o in cur], "total": total, "page": page,
            "pages": max(1, (total + page_size - 1)//page_size)}


@router.get("/orders/{order_number}")
async def admin_order(order_number: str, admin: dict = Depends(require_permission("orders"))):
    o = await db.orders.find_one({"order_number": order_number}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found.")
    return o


@router.put("/orders/{order_number}/status")
async def update_order_status(order_number: str, payload: dict, request: Request,
                              admin: dict = Depends(require_permission("orders"))):
    o = await db.orders.find_one({"order_number": order_number})
    if not o:
        raise HTTPException(404, "Order not found.")
    new_status = payload.get("status")
    valid = ["Pending", "Confirmed", "Processing", "Packed", "Shipped", "Out for Delivery",
             "Delivered", "Cancelled", "Returned", "Refunded", "Failed"]
    if new_status not in valid:
        raise HTTPException(400, "Invalid status.")
    # Restock when cancelling/returning a previously paid order (once)
    if new_status in ("Cancelled", "Returned") and o["status"] not in ("Cancelled", "Returned", "Refunded"):
        paid = o["payment"]["status"] in ("paid", "cod_confirmed")
        for l in o["items"]:
            if paid:
                await db.products.update_one({"id": l["product_id"]}, {"$inc": {"stock": l["qty"]}})
            else:
                await db.products.update_one({"id": l["product_id"]}, {"$inc": {"reserved": -l["qty"]}})
    await db.orders.update_one({"order_number": order_number},
        {"$set": {"status": new_status, "updated_at": now_iso()},
         "$push": {"status_history": {"status": new_status, "at": now_iso(), "note": payload.get("note", "")}}})
    await audit(admin, "order_status", "order", order_number,
                before={"status": o["status"]}, after={"status": new_status}, request=request)
    return clean(await db.orders.find_one({"order_number": order_number}))


@router.put("/orders/{order_number}/tracking")
async def update_tracking(order_number: str, payload: dict, request: Request,
                          admin: dict = Depends(require_permission("orders"))):
    await db.orders.update_one({"order_number": order_number},
        {"$set": {"tracking": {"number": payload.get("number"), "courier": payload.get("courier")},
                  "updated_at": now_iso()}})
    await audit(admin, "order_tracking", "order", order_number, request=request)
    o = await db.orders.find_one({"order_number": order_number})
    if not o:
        raise HTTPException(404, "Order not found.")
    return clean(o)


@router.post("/orders/{order_number}/note")
async def order_note(order_number: str, payload: dict, admin: dict = Depends(require_permission("orders"))):
    await db.orders.update_one({"order_number": order_number},
        {"$push": {"internal_notes": {"note": payload.get("note"), "by": admin["email"], "at": now_iso()}}})
    return {"ok": True}


# ---------------- CUSTOMERS ----------------
async def _augment_customer(c):
    cid = c["id"]
    agg = await db.orders.aggregate([
        {"$match": {"customer_id": cid}},
        {"$group": {"_id": None, "count": {"$sum": 1},
                    "spend": {"$sum": {"$cond": [{"$in": ["$payment.status", ["paid", "cod_confirmed"]]}, "$pricing.total", 0]}},
                    "last": {"$max": "$created_at"}}}
    ]).to_list(1)
    stats = agg[0] if agg else {}
    c["order_count"] = stats.get("count", 0)
    c["total_spend"] = round(stats.get("spend", 0))
    c["last_order_at"] = stats.get("last")
    c.setdefault("status", "Active")
    c.pop("wishlist", None)
    return c


@router.get("/customers")
async def admin_customers(q: str = "", status: str = "", sort: str = "newest",
                          page: int = 1, page_size: int = 20,
                          admin: dict = Depends(require_permission("customers"))):
    query = {}
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}},
                        {"phone": {"$regex": q, "$options": "i"}},
                        {"email": {"$regex": q, "$options": "i"}}]
    if status:
        query["status"] = status
    total = await db.customers.count_documents(query)
    sort_field = {"newest": "created_at"}.get(sort, "created_at")
    cur = db.customers.find(query, {"_id": 0}).sort(sort_field, -1).skip((page-1)*page_size).limit(page_size)
    items = [await _augment_customer(c) async for c in cur]
    if sort == "spend":
        items.sort(key=lambda x: x.get("total_spend", 0), reverse=True)
    elif sort == "orders":
        items.sort(key=lambda x: x.get("order_count", 0), reverse=True)

    now = datetime.now(timezone.utc)
    month = (now - timedelta(days=30)).isoformat()
    all_ids = [c["id"] async for c in db.customers.find({}, {"id": 1, "_id": 0})]
    paid_agg = await db.orders.aggregate([
        {"$match": {"payment.status": {"$in": ["paid", "cod_confirmed"]}}},
        {"$group": {"_id": None, "spend": {"$sum": "$pricing.total"}, "cnt": {"$sum": 1}}}
    ]).to_list(1)
    total_spend = round(paid_agg[0]["spend"]) if paid_agg else 0
    stats = {
        "total": len(all_ids),
        "new_month": await db.customers.count_documents({"created_at": {"$gte": month}}),
        "vip": await db.customers.count_documents({"status": "VIP"}),
        "blocked": await db.customers.count_documents({"status": "Blocked"}),
        "total_spend": total_spend,
        "avg_spend": round(total_spend / len(all_ids)) if all_ids else 0,
    }
    return {"items": items, "total": total, "page": page, "stats": stats,
            "pages": max(1, (total + page_size - 1)//page_size)}


@router.get("/customers/{cid}")
async def admin_customer(cid: str, admin: dict = Depends(require_permission("customers"))):
    c = await db.customers.find_one({"id": cid}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Customer not found.")
    c = await _augment_customer(c)
    orders = [clean(o) async for o in db.orders.find({"customer_id": cid}, {"_id": 0}).sort("created_at", -1)]
    addresses = [clean(a) async for a in db.addresses.find({"customer_id": cid}, {"_id": 0})]
    return {"customer": c, "orders": orders, "addresses": addresses}


@router.put("/customers/{cid}/status")
async def customer_status(cid: str, payload: dict, request: Request, admin: dict = Depends(require_permission("customers"))):
    await db.customers.update_one({"id": cid}, {"$set": {"status": payload.get("status")}})
    await audit(admin, "customer_status", "customer", cid, after={"status": payload.get("status")}, request=request)
    return {"ok": True}


@router.post("/customers/{cid}/note")
async def customer_note(cid: str, payload: dict, admin: dict = Depends(require_permission("customers"))):
    await db.customers.update_one({"id": cid}, {"$push": {"notes": {"note": payload.get("note"),
        "by": admin["email"], "at": now_iso()}}})
    return {"ok": True}


# ---------------- REVIEWS ----------------
@router.get("/reviews")
async def admin_reviews(status: str = "", admin: dict = Depends(require_permission("catalog"))):
    query = {"status": status} if status else {}
    cur = db.reviews.find(query, {"_id": 0}).sort("created_at", -1)
    return {"items": [c async for c in cur]}


@router.put("/reviews/{rid}")
async def moderate_review(rid: str, payload: dict, admin: dict = Depends(require_permission("catalog"))):
    r = await db.reviews.find_one({"id": rid})
    if not r:
        raise HTTPException(404, "Review not found.")
    status = payload.get("status")
    await db.reviews.update_one({"id": rid}, {"$set": {"status": status}})
    # recompute product rating from approved reviews
    approved = [x async for x in db.reviews.find({"product_id": r["product_id"], "status": "Approved"}, {"rating": 1, "_id": 0})]
    if approved:
        avg = round(sum(a["rating"] for a in approved) / len(approved), 1)
        await db.products.update_one({"id": r["product_id"]}, {"$set": {"rating": avg, "review_count": len(approved)}})
    else:
        await db.products.update_one({"id": r["product_id"]}, {"$set": {"rating": 0, "review_count": 0}})
    return {"ok": True}


# ---------------- HOMEPAGE CMS ----------------
@router.get("/cms/homepage")
async def cms_homepage(admin: dict = Depends(require_permission("content"))):
    cur = db.homepage_sections.find({}, {"_id": 0})
    sections = sorted([s async for s in cur], key=lambda s: s.get("order", 0))
    return {"sections": sections}


@router.put("/cms/homepage/{sid}")
async def cms_update_section(sid: str, payload: dict, admin: dict = Depends(require_permission("content"))):
    fields = {k: v for k, v in payload.items() if k not in ("id", "_id")}
    await db.homepage_sections.update_one({"id": sid}, {"$set": fields})
    return clean(await db.homepage_sections.find_one({"id": sid}))


# ---------------- CMS SITE PAGES (About / Our Story / Contact) ----------------
@router.get("/cms/pages")
async def cms_pages_list(admin: dict = Depends(require_permission("content"))):
    cur = db.cms_pages.find({}, {"_id": 0}).sort("order", 1)
    return {"items": [c async for c in cur]}


@router.get("/cms/pages/{slug}")
async def cms_page_get(slug: str, admin: dict = Depends(require_permission("content"))):
    p = await db.cms_pages.find_one({"slug": slug}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Page not found.")
    return p


@router.put("/cms/pages/{slug}")
async def cms_page_update(slug: str, payload: dict, request: Request, admin: dict = Depends(require_permission("content"))):
    fields = {k: v for k, v in payload.items() if k not in ("id", "_id", "slug")}
    await db.cms_pages.update_one({"slug": slug}, {"$set": fields}, upsert=True)
    await audit(admin, "update", "cms_page", slug, request=request)
    return clean(await db.cms_pages.find_one({"slug": slug}))


# ---------------- SEARCH ANALYTICS ----------------
@router.get("/search/analytics")
async def search_analytics(admin: dict = Depends(require_permission("search"))):
    pipeline = [{"$group": {"_id": "$query", "count": {"$sum": 1},
                            "avg_results": {"$avg": "$results_count"}}},
                {"$sort": {"count": -1}}, {"$limit": 20}]
    top = [{"query": r["_id"], "count": r["count"], "avg_results": round(r.get("avg_results", 0), 1)}
           async for r in db.search_analytics.aggregate(pipeline)]
    no_result = [{"query": r["_id"], "count": r["count"]} async for r in db.search_analytics.aggregate(
        [{"$match": {"results_count": 0}}, {"$group": {"_id": "$query", "count": {"$sum": 1}}},
         {"$sort": {"count": -1}}, {"$limit": 15}])]
    total = await db.search_analytics.count_documents({})
    corrected = await db.search_analytics.count_documents({"corrected": True})
    return {"total_searches": total, "corrected_searches": corrected,
            "top_searches": top, "no_result_searches": no_result}


# ---------------- CORPORATE ----------------
@router.get("/corporate-inquiries")
async def corporate(admin: dict = Depends(require_permission("corporate"))):
    cur = db.corporate_inquiries.find({}, {"_id": 0}).sort("created_at", -1)
    return {"items": [c async for c in cur]}


@router.put("/corporate-inquiries/{cid}")
async def corporate_update(cid: str, payload: dict, admin: dict = Depends(require_permission("corporate"))):
    await db.corporate_inquiries.update_one({"id": cid}, {"$set": {"status": payload.get("status")}})
    return {"ok": True}


# ---------------- REFUNDS ----------------
@router.get("/refunds")
async def refunds(admin: dict = Depends(require_permission("orders"))):
    refund_docs = [r async for r in db.refunds.find({}, {"_id": 0}).sort("created_at", -1)]
    have = {r["order_number"] for r in refund_docs}
    # Also surface cancelled/refunded orders that don't yet have an explicit refund record,
    # so the page always shows cancellations with their date & time of cancellation.
    async for o in db.orders.find({"status": {"$in": ["Cancelled", "Refunded"]}}, {"_id": 0}):
        if o["order_number"] in have:
            continue
        cancel_at, note = o.get("updated_at") or o.get("created_at"), "Order cancelled"
        for h in reversed(o.get("status_history", []) or []):
            if h.get("status") in ("Cancelled", "Refunded"):
                cancel_at = h.get("at") or cancel_at
                note = h.get("note") or note
                break
        paid = (o.get("payment") or {}).get("status") == "paid"
        refund_docs.append({
            "id": "order-" + o["order_number"], "order_number": o["order_number"],
            "amount": o["pricing"]["total"] if paid else 0,
            "reason": note, "status": "Requested" if paid else "Cancelled",
            "created_at": cancel_at, "auto": True,
        })
    refund_docs.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return {"items": refund_docs}


@router.post("/refunds")
async def create_refund(payload: dict, request: Request, admin: dict = Depends(require_permission("orders"))):
    o = await db.orders.find_one({"order_number": payload.get("order_number")})
    if not o:
        raise HTTPException(404, "Order not found.")
    amount = min(float(payload.get("amount", 0)), o["pricing"]["total"])
    doc = {"id": str(uuid.uuid4()), "order_number": o["order_number"], "amount": amount,
           "reason": payload.get("reason"), "status": "Requested", "created_at": now_iso()}
    await db.refunds.insert_one(doc)
    await audit(admin, "refund_request", "order", o["order_number"], after={"amount": amount}, request=request)
    return clean(doc)


@router.put("/refunds/{rid}")
async def update_refund(rid: str, payload: dict, request: Request, admin: dict = Depends(require_permission("orders"))):
    r = await db.refunds.find_one({"id": rid})
    if not r:
        raise HTTPException(404, "Refund not found.")
    status = payload.get("status")
    await db.refunds.update_one({"id": rid}, {"$set": {"status": status}})
    if status == "Completed":
        await db.orders.update_one({"order_number": r["order_number"]},
            {"$set": {"status": "Refunded", "updated_at": now_iso()},
             "$push": {"status_history": {"status": "Refunded", "at": now_iso(), "note": "Refund completed."}}})
    await audit(admin, "refund_update", "refund", rid, after={"status": status}, request=request)
    return {"ok": True}


# ---------------- AUDIT LOGS ----------------
@router.get("/audit-logs")
async def audit_logs(page: int = 1, page_size: int = 40, admin: dict = Depends(require_permission("settings"))):
    total = await db.audit_logs.count_documents({})
    cur = db.audit_logs.find({}, {"_id": 0}).sort("at", -1).skip((page-1)*page_size).limit(page_size)
    return {"items": [c async for c in cur], "total": total,
            "pages": max(1, (total + page_size - 1)//page_size)}


# ---------------- LEADS: NEWSLETTER / SUPPORT / VISITORS ----------------
@router.get("/newsletter-subscribers")
async def newsletter_subscribers(q: str = "", page: int = 1, page_size: int = 30,
                                 admin: dict = Depends(require_permission("customers"))):
    query = {}
    if q:
        query["email"] = {"$regex": q, "$options": "i"}
    total = await db.newsletter_subscribers.count_documents(query)
    cur = db.newsletter_subscribers.find(query, {"_id": 0}).sort("created_at", -1).skip((page-1)*page_size).limit(page_size)
    month = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    stats = {"total": await db.newsletter_subscribers.count_documents({}),
             "new_month": await db.newsletter_subscribers.count_documents({"created_at": {"$gte": month}})}
    return {"items": [c async for c in cur], "total": total, "stats": stats,
            "pages": max(1, (total + page_size - 1)//page_size)}


@router.delete("/newsletter-subscribers/{sid}")
async def delete_subscriber(sid: str, admin: dict = Depends(require_permission("customers"))):
    await db.newsletter_subscribers.delete_one({"id": sid})
    return {"ok": True}


@router.get("/support-messages")
async def support_messages(q: str = "", status: str = "", page: int = 1, page_size: int = 30,
                           admin: dict = Depends(require_permission("customers"))):
    query = {}
    if status:
        query["status"] = status
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}},
                        {"email": {"$regex": q, "$options": "i"}},
                        {"message": {"$regex": q, "$options": "i"}}]
    total = await db.support_messages.count_documents(query)
    cur = db.support_messages.find(query, {"_id": 0}).sort("created_at", -1).skip((page-1)*page_size).limit(page_size)
    stats = {"total": await db.support_messages.count_documents({}),
             "open": await db.support_messages.count_documents({"status": "Open"})}
    return {"items": [c async for c in cur], "total": total, "stats": stats,
            "pages": max(1, (total + page_size - 1)//page_size)}


@router.put("/support-messages/{mid}")
async def update_support_message(mid: str, payload: dict, admin: dict = Depends(require_permission("customers"))):
    upd = {}
    if payload.get("status"):
        upd["status"] = payload["status"]
    if payload.get("reply") is not None:
        upd["admin_reply"] = payload["reply"]
        upd["replied_at"] = now_iso()
    await db.support_messages.update_one({"id": mid}, {"$set": upd})
    return {"ok": True}


@router.get("/visitors")
async def visitors(q: str = "", identified: str = "", page: int = 1, page_size: int = 30,
                   admin: dict = Depends(require_permission("customers"))):
    query = {}
    if identified == "yes":
        query["$or"] = [{"identity.phone": {"$exists": True, "$ne": None}},
                        {"identity.email": {"$exists": True, "$ne": None}}]
    if q:
        query["$or"] = [{"identity.phone": {"$regex": q, "$options": "i"}},
                        {"identity.email": {"$regex": q, "$options": "i"}},
                        {"identity.name": {"$regex": q, "$options": "i"}}]
    total = await db.visitors.count_documents(query)
    cur = db.visitors.find(query, {"_id": 0}).sort("last_seen", -1).skip((page-1)*page_size).limit(page_size)
    day = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    stats = {"total": await db.visitors.count_documents({}),
             "identified": await db.visitors.count_documents({"$or": [{"identity.phone": {"$ne": None}}, {"identity.email": {"$ne": None}}]}),
             "today": await db.visitors.count_documents({"last_seen": {"$gte": day}})}
    return {"items": [c async for c in cur], "total": total, "stats": stats,
            "pages": max(1, (total + page_size - 1)//page_size)}


# ---------------- PAYMENTS / TRANSACTIONS ----------------
@router.get("/transactions")
async def transactions(q: str = "", status: str = "", method: str = "", page: int = 1, page_size: int = 20,
                       admin: dict = Depends(require_permission("orders"))):
    query = {}
    if status:
        query["payment.status"] = status
    if method:
        query["payment.method"] = method
    if q:
        query["$or"] = [{"order_number": {"$regex": q, "$options": "i"}},
                        {"customer.name": {"$regex": q, "$options": "i"}},
                        {"customer.phone": {"$regex": q, "$options": "i"}}]
    total = await db.orders.count_documents(query)
    cur = db.orders.find(query, {"_id": 0}).sort("created_at", -1).skip((page-1)*page_size).limit(page_size)
    items = []
    async for o in cur:
        o = clean(o)
        items.append({"order_number": o["order_number"], "customer": o.get("customer"),
                      "amount": o["pricing"]["total"], "payment": o.get("payment", {}),
                      "status": o.get("status"), "created_at": o.get("created_at")})
    paid_agg = await db.orders.aggregate([
        {"$match": {"payment.status": {"$in": ["paid", "cod_confirmed"]}}},
        {"$group": {"_id": None, "sum": {"$sum": "$pricing.total"}}}]).to_list(1)
    refunded_agg = await db.refunds.aggregate([
        {"$match": {"status": "Completed"}}, {"$group": {"_id": None, "sum": {"$sum": "$amount"}}}]).to_list(1)
    stats = {
        "captured": round(paid_agg[0]["sum"]) if paid_agg else 0,
        "refunded": round(refunded_agg[0]["sum"]) if refunded_agg else 0,
        "paid_count": await db.orders.count_documents({"payment.status": {"$in": ["paid", "cod_confirmed"]}}),
        "pending_count": await db.orders.count_documents({"payment.status": {"$in": ["created", "cod_pending"]}}),
        "failed_count": await db.orders.count_documents({"payment.status": "failed"}),
    }
    return {"items": items, "total": total, "stats": stats,
            "pages": max(1, (total + page_size - 1)//page_size)}


@router.get("/transactions/{order_number}")
async def transaction_detail(order_number: str, admin: dict = Depends(require_permission("orders"))):
    o = await db.orders.find_one({"order_number": order_number}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Transaction not found.")
    refunds = [clean(r) async for r in db.refunds.find({"order_number": order_number}, {"_id": 0})]
    return {"order": clean(o), "refunds": refunds}


# ---------------- NOTIFICATIONS ----------------
@router.get("/notifications")
async def notifications(admin: dict = Depends(get_current_admin)):
    cur = db.notifications.find({}, {"_id": 0}).sort("at", -1).limit(30)
    items = [n async for n in cur]
    unread = await db.notifications.count_documents({"read": False})
    return {"items": items, "unread": unread}


@router.post("/notifications/read")
async def mark_read(admin: dict = Depends(get_current_admin)):
    await db.notifications.update_many({"read": False}, {"$set": {"read": True}})
    return {"ok": True}


# ---------------- ADMIN USERS & ROLES ----------------
@router.get("/roles")
async def roles(admin: dict = Depends(require_permission("settings"))):
    return {"roles": [{"name": k, "permissions": list(v)} for k, v in ROLE_PERMISSIONS.items()]}


@router.get("/admin-users")
async def admin_users(admin: dict = Depends(require_permission("settings"))):
    cur = db.admin_users.find({}, {"_id": 0, "password_hash": 0})
    return {"items": [a async for a in cur]}


@router.post("/admin-users")
async def create_admin_user(payload: dict, request: Request, admin: dict = Depends(require_permission("settings"))):
    email = (payload.get("email") or "").lower().strip()
    if not email or not payload.get("password"):
        raise HTTPException(400, "Email and password are required.")
    if await db.admin_users.find_one({"email": email}):
        raise HTTPException(400, "An admin with this email already exists.")
    if payload.get("role") not in ROLE_PERMISSIONS:
        raise HTTPException(400, "Invalid role.")
    doc = {"id": str(uuid.uuid4()), "email": email, "name": payload.get("name", email.split("@")[0]),
           "password_hash": hash_password(payload["password"]), "role": payload["role"],
           "status": "Active", "created_at": now_iso(), "last_login": None}
    await db.admin_users.insert_one(dict(doc))
    await audit(admin, "create", "admin_user", doc["id"], after={"email": email, "role": doc["role"]}, request=request)
    doc.pop("password_hash", None)
    return clean(doc)


@router.put("/admin-users/{uid}")
async def update_admin_user(uid: str, payload: dict, request: Request, admin: dict = Depends(require_permission("settings"))):
    upd = {}
    for k in ("name", "role", "status"):
        if k in payload:
            upd[k] = payload[k]
    if payload.get("password"):
        upd["password_hash"] = hash_password(payload["password"])
    await db.admin_users.update_one({"id": uid}, {"$set": upd})
    await audit(admin, "update", "admin_user", uid, request=request)
    return {"ok": True}


# ---------------- SETTINGS ----------------
@router.get("/settings")
async def get_settings(admin: dict = Depends(require_permission("settings"))):
    s = await db.settings.find_one({"id": "store"}, {"_id": 0}) or {}
    s["integrations"] = {
        "razorpay_configured": bool(__import__("integrations").razorpay_enabled()),
        "twilio_configured": bool(__import__("integrations").twilio_enabled()),
    }
    return s


@router.put("/settings")
async def update_settings(payload: dict, request: Request, admin: dict = Depends(require_permission("settings"))):
    fields = {k: v for k, v in payload.items() if k not in ("id", "_id", "integrations")}
    await db.settings.update_one({"id": "store"}, {"$set": fields}, upsert=True)
    await audit(admin, "update", "settings", "store", request=request)
    return await db.settings.find_one({"id": "store"}, {"_id": 0})


# ---------------- CSV EXPORT ----------------
async def _csv_response(rows, headers, filename):
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=headers, extrasaction="ignore")
    w.writeheader()
    for r in rows:
        w.writerow(r)
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={filename}"})


@router.get("/export/products")
async def export_products(admin: dict = Depends(require_permission("catalog"))):
    rows = [{"name": p["name"], "slug": p["slug"], "sku": p.get("sku"), "price": p["price"],
             "stock": p.get("stock"), "status": p.get("status"), "category": p.get("category_slug")}
            async for p in db.products.find({}, {"_id": 0})]
    return await _csv_response(rows, ["name", "slug", "sku", "price", "stock", "status", "category"], "products.csv")


@router.get("/export/orders")
async def export_orders(admin: dict = Depends(require_permission("orders"))):
    rows = [{"order_number": o["order_number"], "customer": o["customer"].get("name"),
             "phone": o["customer"].get("phone"), "total": o["pricing"]["total"],
             "payment_status": o["payment"]["status"], "status": o["status"], "created_at": o["created_at"]}
            async for o in db.orders.find({}, {"_id": 0})]
    return await _csv_response(rows, ["order_number", "customer", "phone", "total", "payment_status", "status", "created_at"], "orders.csv")


@router.get("/export/customers")
async def export_customers(admin: dict = Depends(require_permission("customers"))):
    rows = [{"name": c.get("name"), "phone": c.get("phone"), "email": c.get("email"),
             "orders": c.get("order_count", 0), "total_spend": c.get("total_spend", 0),
             "status": c.get("status"), "created_at": c.get("created_at")}
            async for c in db.customers.find({}, {"_id": 0})]
    return await _csv_response(rows, ["name", "phone", "email", "orders", "total_spend", "status", "created_at"], "customers.csv")