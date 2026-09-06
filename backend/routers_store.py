from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from typing import Optional
from db import db, clean
from search_engine import SearchEngine, normalize
from security import now_iso

router = APIRouter()


@router.get("/uploads/{path:path}")
async def serve_upload(path: str):
    import storage
    try:
        data, ctype = storage.get_object(path)
    except Exception:
        raise HTTPException(404, "Image not found.")
    return Response(content=data, media_type=ctype, headers={"Cache-Control": "public, max-age=86400"})


@router.get("/cms/active-campaign")
async def active_campaign():
    now = now_iso()
    cur = db.promotions.find({"status": "Active"}, {"_id": 0})
    promos = [p async for p in cur]
    for p in promos:
        if p.get("end_date") and p["end_date"] < now:
            continue
        if p.get("start_date") and p["start_date"] > now:
            continue
        return {"campaign": p}
    return {"campaign": None}


def public_product(p):
    if not p:
        return None
    p = clean(p)
    p.pop("cost_price", None)
    return p


async def _search_engine():
    syn = {s["term"]: s["correct"] async for s in db.search_synonyms.find({}, {"_id": 0})}
    cor = {c["wrong"]: c["correct"] async for c in db.search_corrections.find({}, {"_id": 0})}
    vocab = set()
    async for p in db.products.find({"status": "Active"}, {"name": 1, "tags": 1, "category_slug": 1, "occasion": 1, "recipient": 1, "_id": 0}):
        for token in normalize(" ".join([p.get("name", ""), " ".join(p.get("tags", [])),
                                          p.get("category_slug", "").replace("-", " "),
                                          " ".join(p.get("occasion", [])), " ".join(p.get("recipient", []))])).split():
            if len(token) > 2:
                vocab.add(token)
    return SearchEngine(syn, cor, vocab)


# ---------- Products ----------
@router.get("/products")
async def list_products(
    category: Optional[str] = None, collection: Optional[str] = None,
    q: Optional[str] = None, occasion: Optional[str] = None, recipient: Optional[str] = None,
    material: Optional[str] = None, color: Optional[str] = None, badge: Optional[str] = None,
    min_price: Optional[int] = None, max_price: Optional[int] = None,
    in_stock: Optional[bool] = None, on_sale: Optional[bool] = None,
    sort: str = "featured", page: int = 1, page_size: int = 12,
):
    query = {"status": {"$in": ["Active", "Out of Stock"]}}
    if category:
        query["category_slug"] = category
    if occasion:
        query["occasion"] = occasion
    if recipient:
        query["recipient"] = recipient
    if material:
        query["material"] = {"$regex": material, "$options": "i"}
    if color:
        query["color"] = {"$regex": color, "$options": "i"}
    if badge:
        query["badges"] = badge
    if min_price is not None or max_price is not None:
        pr = {}
        if min_price is not None:
            pr["$gte"] = min_price
        if max_price is not None:
            pr["$lte"] = max_price
        query["price"] = pr
    if on_sale:
        query["compare_at_price"] = {"$ne": None}
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}},
                        {"tags": {"$regex": q, "$options": "i"}},
                        {"sku": {"$regex": q, "$options": "i"}}]

    if collection:
        col = await db.collections.find_one({"slug": collection}, {"_id": 0})
        if col:
            if col.get("type") == "manual" and col.get("product_ids"):
                query["id"] = {"$in": col["product_ids"]}
            else:
                r = col.get("rules", {})
                if r.get("badge"):
                    query["badges"] = r["badge"]
                if r.get("occasion"):
                    query["occasion"] = r["occasion"]
                if r.get("recipient"):
                    query["recipient"] = r["recipient"]
                if r.get("tag"):
                    query.setdefault("tags", r["tag"])

    sort_map = {
        "newest": [("created_at", -1)], "price_asc": [("price", 1)], "price_desc": [("price", -1)],
        "bestselling": [("sales_count", -1)], "rating": [("rating", -1)],
        "featured": [("sales_count", -1), ("created_at", -1)],
    }
    total = await db.products.count_documents(query)
    cursor = db.products.find(query, {"_id": 0}).sort(sort_map.get(sort, sort_map["featured"]))
    cursor = cursor.skip((page - 1) * page_size).limit(page_size)
    items = [public_product(p) async for p in cursor]
    if in_stock:
        items = [p for p in items if (p.get("stock", 0) - p.get("reserved", 0)) > 0]
    return {"items": items, "total": total, "page": page, "page_size": page_size,
            "pages": max(1, (total + page_size - 1) // page_size)}


@router.get("/products/{slug}")
async def get_product(slug: str):
    p = await db.products.find_one({"slug": slug}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Product not found.")
    await db.products.update_one({"slug": slug}, {"$inc": {"views": 1}})
    return public_product(p)


@router.get("/products/{slug}/related")
async def related(slug: str):
    p = await db.products.find_one({"slug": slug}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Product not found.")
    cur = db.products.find({"category_slug": p["category_slug"], "slug": {"$ne": slug},
                            "status": "Active"}, {"_id": 0}).limit(4)
    items = [public_product(x) async for x in cur]
    if len(items) < 4:
        cur2 = db.products.find({"tags": {"$in": p.get("tags", [])}, "slug": {"$ne": slug},
                                 "status": "Active"}, {"_id": 0}).limit(4)
        seen = {i["id"] for i in items}
        async for x in cur2:
            if x["id"] not in seen and len(items) < 4:
                items.append(public_product(x))
    return {"items": items}


# ---------- Categories & Collections ----------
@router.get("/categories")
async def categories():
    cur = db.categories.find({"status": "Active"}, {"_id": 0}).sort("order", 1)
    out = []
    async for c in cur:
        c["product_count"] = await db.products.count_documents({"category_slug": c["slug"], "status": "Active"})
        out.append(c)
    return {"items": out}


@router.get("/categories/{slug}")
async def category(slug: str):
    c = await db.categories.find_one({"slug": slug}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Category not found.")
    return c


@router.get("/collections")
async def collections():
    cur = db.collections.find({"status": "Active"}, {"_id": 0}).sort("order", 1)
    return {"items": [c async for c in cur]}


@router.get("/collections/{slug}")
async def collection(slug: str):
    c = await db.collections.find_one({"slug": slug}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Collection not found.")
    return c


# ---------- Search ----------
@router.get("/search")
async def search(q: str = Query(""), page: int = 1, page_size: int = 24):
    eng = await _search_engine()
    parsed = eng.process(q)
    prods = [public_product(p) async for p in db.products.find({"status": "Active"}, {"_id": 0})]
    scored = []
    for p in prods:
        s = eng.score(p, parsed["tokens"], parsed["recipient"], parsed["occasion"])
        if parsed["min_price"] is not None and p["price"] < parsed["min_price"]:
            continue
        if parsed["max_price"] is not None and p["price"] > parsed["max_price"]:
            continue
        if s > 0:
            scored.append((s, p))
    scored.sort(key=lambda x: (-x[0], x[1]["price"]))
    results = [p for _, p in scored]

    await db.search_analytics.insert_one({
        "query": q, "normalized": parsed["corrected_query"] or q,
        "results_count": len(results), "corrected": bool(parsed["corrected_query"]),
        "at": now_iso()})

    suggestions = []
    if not results:
        suggestions = [public_product(p) async for p in db.products.find(
            {"status": "Active", "badges": "Bestseller"}, {"_id": 0}).limit(6)]
    return {
        "query": q, "original_query": parsed["original_query"],
        "corrected_query": parsed["corrected_query"],
        "detected": {"recipient": parsed["recipient"], "occasion": parsed["occasion"],
                     "min_price": parsed["min_price"], "max_price": parsed["max_price"]},
        "total": len(results), "results": results[(page - 1) * page_size: page * page_size],
        "fallback_suggestions": suggestions,
    }


@router.get("/search/autocomplete")
async def autocomplete(q: str = Query("")):
    if not q or len(q) < 1:
        return {"products": [], "categories": [], "collections": [], "suggestions": []}
    rx = {"$regex": q, "$options": "i"}
    prods = [public_product(p) async for p in db.products.find(
        {"status": "Active", "$or": [{"name": rx}, {"tags": rx}]}, {"_id": 0}).limit(5)]
    cats = [c async for c in db.categories.find({"name": rx, "status": "Active"}, {"_id": 0}).limit(4)]
    for c in cats:
        c["product_count"] = await db.products.count_documents({"category_slug": c["slug"], "status": "Active"})
    cols = [c async for c in db.collections.find({"name": rx, "status": "Active"}, {"_id": 0}).limit(4)]
    suggestions = []
    seen = set()
    async for p in db.products.find({"status": "Active", "name": rx}, {"name": 1, "_id": 0}).limit(6):
        if p["name"].lower() not in seen:
            suggestions.append(p["name"])
            seen.add(p["name"].lower())
    return {
        "products": [{"id": p["id"], "name": p["name"], "slug": p["slug"], "price": p["price"],
                      "image": (p.get("images") or [None])[0]} for p in prods],
        "categories": [{"name": c["name"], "slug": c["slug"], "product_count": c["product_count"]} for c in cats],
        "collections": [{"name": c["name"], "slug": c["slug"]} for c in cols],
        "suggestions": suggestions,
    }


# ---------- CMS / Content ----------
@router.get("/cms/homepage")
async def homepage():
    settings = await db.settings.find_one({"id": "store"}, {"_id": 0}) or {}
    sections = [s async for s in db.homepage_sections.find({"enabled": True}, {"_id": 0})]
    sections.sort(key=lambda s: s.get("order", 0))
    banners = [b async for b in db.banners.find({"status": "Active"}, {"_id": 0})]
    return {"announcement": {"enabled": settings.get("announcement_enabled", False),
                             "text": settings.get("announcement_text", "")},
            "sections": sections, "banners": banners,
            "store_name": settings.get("store_name", "ARTFUL")}


@router.get("/settings")
async def public_settings():
    s = await db.settings.find_one({"id": "store"}, {"_id": 0}) or {}
    for k in ("cost_",):
        s.pop(k, None)
    return s


@router.get("/pages/{slug}")
async def page(slug: str):
    p = await db.pages.find_one({"slug": slug, "status": "Active"}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Page not found.")
    return p


@router.get("/faqs")
async def faqs():
    cur = db.faqs.find({"status": "Active"}, {"_id": 0}).sort("order", 1)
    return {"items": [f async for f in cur]}


@router.get("/products/{slug}/reviews")
async def product_reviews(slug: str):
    p = await db.products.find_one({"slug": slug}, {"id": 1, "_id": 0})
    if not p:
        raise HTTPException(404, "Product not found.")
    cur = db.reviews.find({"product_id": p["id"], "status": "Approved"}, {"_id": 0}).sort("created_at", -1)
    return {"items": [r async for r in cur]}


@router.post("/corporate-inquiries")
async def corporate_inquiry(payload: dict):
    import uuid
    required = ["company_name", "contact_person", "mobile"]
    if not all(payload.get(k) for k in required):
        raise HTTPException(400, "Please provide company name, contact person and mobile.")
    doc = {"id": str(uuid.uuid4()), "company_name": payload.get("company_name"),
           "contact_person": payload.get("contact_person"), "mobile": payload.get("mobile"),
           "email": payload.get("email"), "quantity": payload.get("quantity"),
           "budget": payload.get("budget"), "requirement": payload.get("requirement"),
           "message": payload.get("message"), "status": "New", "created_at": now_iso()}
    await db.corporate_inquiries.insert_one(doc)
    return {"ok": True, "message": "Thank you. Our team will be in touch shortly."}



@router.post("/newsletter/subscribe")
async def newsletter_subscribe(payload: dict):
    import uuid
    email = (payload.get("email") or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(400, "Please enter a valid email address.")
    existing = await db.newsletter_subscribers.find_one({"email": email})
    if existing:
        return {"ok": True, "already": True, "message": "You're already on the list."}
    await db.newsletter_subscribers.insert_one({
        "id": str(uuid.uuid4()), "email": email, "source": payload.get("source", "footer"),
        "status": "Subscribed", "created_at": now_iso()})
    await db.notifications.insert_one({"id": str(uuid.uuid4()), "type": "newsletter",
        "title": f"New newsletter signup: {email}", "read": False, "at": now_iso()})
    return {"ok": True, "already": False, "message": "You're on the list — welcome to ARTFUL."}


@router.post("/contact/submit")
async def contact_submit(payload: dict):
    import uuid
    name = (payload.get("name") or "").strip()
    message = (payload.get("message") or "").strip()
    if not name or not message:
        raise HTTPException(400, "Please add your name and message.")
    doc = {"id": str(uuid.uuid4()), "name": name, "email": (payload.get("email") or "").strip(),
           "phone": (payload.get("phone") or "").strip(), "subject": payload.get("subject", ""),
           "message": message, "status": "Open", "created_at": now_iso()}
    await db.support_messages.insert_one(doc)
    await db.notifications.insert_one({"id": str(uuid.uuid4()), "type": "support",
        "title": f"New contact message from {name}", "read": False, "at": now_iso()})
    return {"ok": True, "message": "Thank you! We'll respond within 1–2 business days."}
