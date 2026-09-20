import re
import asyncio
import io
import os
import csv
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request, Depends, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from db import db, clean
from security import (verify_password, hash_password, create_token, get_current_admin,
                      require_permission, now_iso, ROLE_PERMISSIONS)
import integrations as ig

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
def _parse_dashboard_date(value, default):
    if not value:
        return default
    try:
        raw = value.strip()
        if len(raw) == 10:
            raw = raw + "T00:00:00+00:00"
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return default


def _bucket_key(dt, granularity):
    if granularity == "monthly":
        return dt.strftime("%Y-%m")
    if granularity == "weekly":
        monday = dt - timedelta(days=dt.weekday())
        return monday.strftime("%Y-%m-%d")
    return dt.strftime("%Y-%m-%d")


def _next_bucket(dt, granularity):
    if granularity == "monthly":
        month = 12 if dt.month == 12 else dt.month + 1
        year = dt.year + 1 if dt.month == 12 else dt.year
        return dt.replace(year=year, month=month, day=1)
    if granularity == "weekly":
        return dt + timedelta(days=7)
    return dt + timedelta(days=1)


def _bucket_start(dt, granularity):
    if granularity == "monthly":
        return dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if granularity == "weekly":
        base = dt - timedelta(days=dt.weekday())
        return base.replace(hour=0, minute=0, second=0, microsecond=0)
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)


@router.get("/dashboard/stats")
async def dashboard(from_date: str = "", to_date: str = "", granularity: str = "daily", admin: dict = Depends(get_current_admin)):
    now = datetime.now(timezone.utc)
    end = _parse_dashboard_date(to_date, now)
    if len(to_date) == 10:
        end = end.replace(hour=23, minute=59, second=59, microsecond=999999)
    start = _parse_dashboard_date(from_date, end - timedelta(days=29))
    if start > end:
        start, end = end - timedelta(days=29), end
    granularity = granularity if granularity in {"daily", "weekly", "monthly"} else "daily"

    paid_status = {"$in": ["paid", "cod_confirmed"]}
    order_q = {"created_at": {"$gte": start.isoformat(), "$lte": end.isoformat()}}
    paid_q = {**order_q, "payment.status": paid_status}

    total_orders = await db.orders.count_documents(order_q)
    paid_orders = await db.orders.count_documents(paid_q)
    cancelled_orders = await db.orders.count_documents({**order_q, "status": "Cancelled"})
    pending_orders = await db.orders.count_documents({**order_q, "status": "Pending"})
    delivered_orders = await db.orders.count_documents({**order_q, "status": "Delivered"})
    failed_orders = await db.orders.count_documents({**order_q, "status": "Failed"})

    revenue = 0
    discount = 0
    shipping = 0
    tax = 0
    units_sold = 0
    product_stats = {}
    series = {}
    cursor = db.orders.find(order_q, {"pricing": 1, "items": 1, "payment.status": 1, "created_at": 1, "customer_id": 1, "_id": 0})
    async for o in cursor:
        try:
            dt = datetime.fromisoformat(o.get("created_at", "").replace("Z", "+00:00"))
        except Exception:
            continue
        key = _bucket_key(dt, granularity)
        point = series.setdefault(key, {"label": key, "revenue": 0, "orders": 0, "units": 0})
        point["orders"] += 1
        if o.get("payment", {}).get("status") in ["paid", "cod_confirmed"]:
            pricing = o.get("pricing", {}) or {}
            rev = float(pricing.get("total", 0) or 0)
            revenue += rev
            discount += float(pricing.get("discount", 0) or 0)
            shipping += float(pricing.get("shipping", 0) or 0)
            tax += float(pricing.get("tax", 0) or 0)
            point["revenue"] += rev
            for line in o.get("items", []) or []:
                qty = int(line.get("qty", 0) or 0)
                units_sold += qty
                point["units"] += qty
                pid = line.get("product_id")
                if pid:
                    ps = product_stats.setdefault(pid, {"id": pid, "name": line.get("name", "Unknown"), "qty": 0, "revenue": 0})
                    ps["qty"] += qty
                    ps["revenue"] += float(line.get("line_total", line.get("price", 0) * qty) or 0)

    bucket_cursor = _bucket_start(start, granularity)
    points = []
    while bucket_cursor <= end:
        key = _bucket_key(bucket_cursor, granularity)
        points.append(series.get(key, {"label": key, "revenue": 0, "orders": 0, "units": 0}))
        bucket_cursor = _next_bucket(bucket_cursor, granularity)

    new_customers = await db.customers.count_documents({"created_at": {"$gte": start.isoformat(), "$lte": end.isoformat()}})
    repeat_customers = await db.customers.count_documents({"order_count": {"$gt": 1}})
    active_products = await db.products.count_documents({"status": "Active"})
    inventory_filter = {"product_type": {"$ne": "customizable"}}
    out_of_stock = await db.products.count_documents({**inventory_filter, "$or": [{"status": "Out of Stock"}, {"stock": {"$lte": 0}}]})
    low_stock = [clean(p) async for p in db.products.find({**inventory_filter, "$expr": {"$lte": ["$stock", "$low_stock_threshold"]}, "status": {"$ne": "Archived"}}, {"_id": 0}).sort("stock", 1).limit(10)]

    status_counts = {}
    for st in ["Pending", "Confirmed", "Processing", "Packed", "Shipped", "Out for Delivery", "Delivered", "Cancelled", "Returned", "Refunded", "Failed"]:
        status_counts[st] = await db.orders.count_documents({**order_q, "status": st})

    payment_counts = {}
    for method in ["razorpay", "cod"]:
        payment_counts[method] = await db.orders.count_documents({**order_q, "payment.method": method, "payment.status": paid_status})

    top_products = sorted(product_stats.values(), key=lambda x: x["revenue"], reverse=True)[:10]
    stock_value = 0
    stock_units = 0
    reserved_units = 0
    async for p in db.products.find({"status": {"$ne": "Archived"}, "product_type": {"$ne": "customizable"}}, {"stock": 1, "reserved": 1, "price": 1, "_id": 0}):
        stock = int(p.get("stock", 0) or 0)
        reserved = int(p.get("reserved", 0) or 0)
        stock_units += stock
        reserved_units += reserved
        stock_value += stock * float(p.get("price", 0) or 0)

    return {
        "period": {"from": start.isoformat(), "to": end.isoformat(), "granularity": granularity},
        "sales": {"revenue": round(revenue, 2), "discount": round(discount, 2), "shipping": round(shipping, 2), "tax": round(tax, 2),
                  "paid_orders": paid_orders, "aov": round(revenue / paid_orders, 2) if paid_orders else 0,
                  "units_sold": units_sold},
        "orders": {"total": total_orders, "pending": pending_orders, "cancelled": cancelled_orders, "delivered": delivered_orders, "failed": failed_orders, "by_status": status_counts},
        "customers": {"new": new_customers, "repeat": repeat_customers, "total": await db.customers.count_documents({})},
        "products": {"active": active_products, "out_of_stock": out_of_stock, "low_stock": low_stock, "bestsellers": top_products},
        "inventory": {"stock_units": stock_units, "reserved_units": reserved_units, "available_units": max(0, stock_units - reserved_units), "stock_value": round(stock_value, 2)},
        "payments": payment_counts,
        "series": points,
    }


# ---------------- INVENTORY ----------------
def _num(value, default=0.0):
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _int_num(value, default=0):
    try:
        if value is None or value == "":
            return default
        return int(float(value))
    except (TypeError, ValueError):
        return default


async def _category_names():
    return {c.get("slug"): c.get("name", "") async for c in db.categories.find({}, {"slug": 1, "name": 1, "_id": 0})}


@router.get("/inventory/summary")
async def inventory_summary(admin: dict = Depends(require_permission("catalog"))):
    base = {"status": {"$ne": "Archived"}, "product_type": {"$ne": "customizable"}}
    cats = await _category_names()
    total_products = in_stock = low_stock = out_of_stock = 0
    total_units = reserved_units = total_stock_value = 0
    async for p in db.products.find(base, {"stock":1,"reserved":1,"cost_price":1,"price":1,"low_stock_threshold":1,"_id":0}):
        total_products += 1
        stock = max(0, _int_num(p.get("stock")))
        reserved = max(0, _int_num(p.get("reserved")))
        available = max(0, stock - reserved)
        threshold = max(0, _int_num(p.get("low_stock_threshold"), 5))
        total_units += stock; reserved_units += reserved
        total_stock_value += stock * _num(p.get("cost_price"), 0)
        if available <= 0: out_of_stock += 1
        elif available <= threshold: low_stock += 1
        else: in_stock += 1
    return {
        "total_products": total_products, "in_stock": in_stock, "low_stock": low_stock,
        "out_of_stock": out_of_stock, "total_units": total_units, "reserved_units": reserved_units,
        "available_units": max(0, total_units - reserved_units), "total_stock_value": round(total_stock_value, 2),
        "categories": len(cats),
    }


@router.get("/inventory")
async def inventory_list(q: str = "", category: str = "", status: str = "", page: int = 1, page_size: int = 25,
                        sort: str = "available_desc", admin: dict = Depends(require_permission("catalog"))):
    cats = await _category_names()
    prods = [p async for p in db.products.find({"status": {"$ne": "Archived"}, "product_type": {"$ne": "customizable"}}, {"_id": 0})]
    ql = q.strip().lower()
    rows = []
    for p in prods:
        name = str(p.get("name") or "")
        sku = str(p.get("sku") or "")
        if ql and ql not in name.lower() and ql not in sku.lower():
            continue
        category_slug = p.get("category_slug") or ""
        if category and category_slug != category:
            continue
        stock = max(0, _int_num(p.get("stock")))
        reserved = max(0, _int_num(p.get("reserved")))
        available = max(0, stock - reserved)
        threshold = max(0, _int_num(p.get("low_stock_threshold"), 5))
        state = "out" if available <= 0 else ("low" if available <= threshold else "healthy")
        if status and state != status:
            continue
        cost = _num(p.get("cost_price"), 0)
        selling = _num(p.get("price"), 0)
        mrp = _num(p.get("mrp"), _num(p.get("compare_at_price"), selling))
        rows.append({
            **clean(p), "stock": stock, "reserved": reserved, "available": available,
            "cost_price": round(cost,2), "price": round(selling,2), "mrp": round(mrp,2),
            "category_name": cats.get(category_slug, category_slug or "Uncategorized"),
            "inventory_status": state, "stock_value": round(stock * cost, 2),
        })
    reverse = sort.endswith("_desc")
    field = sort.rsplit("_", 1)[0] if sort.endswith(("_desc","_asc")) else sort
    if field in {"stock","available","reserved","stock_value","price","cost_price","sales_count","name"}:
        if field == "name": rows.sort(key=lambda x: str(x.get("name") or "").lower(), reverse=reverse)
        else: rows.sort(key=lambda x: _num(x.get(field), 0), reverse=reverse)
    total = len(rows); pages = max(1, (total + page_size - 1) // page_size); page = min(max(page, 1), pages)
    return {"items": rows[(page-1)*page_size:page*page_size], "total": total, "pages": pages, "page": page}


@router.get("/inventory/{pid}")
async def inventory_detail(pid: str, admin: dict = Depends(require_permission("catalog"))):
    p = await db.products.find_one({"id": pid}, {"_id": 0})
    if not p: raise HTTPException(404, "Product not found.")
    if p.get("product_type") == "customizable":
        raise HTTPException(400, "Customizable print products are made to order and do not use inventory.")
    cats = await _category_names()
    stock = max(0, _int_num(p.get("stock"))); reserved = max(0, _int_num(p.get("reserved"))); available = max(0, stock-reserved)
    p = clean(p); p.update({"stock":stock,"reserved":reserved,"available":available,"cost_price":round(_num(p.get("cost_price")),2),"price":round(_num(p.get("price")),2),"mrp":round(_num(p.get("mrp"),_num(p.get("compare_at_price"))),2),"category_name":cats.get(p.get("category_slug"),p.get("category_slug") or "Uncategorized")})
    movements = [clean(x) async for x in db.inventory_transactions.find({"product_id": pid}, {"_id":0}).sort("at", -1).limit(50)]
    return {"product": p, "movements": movements}


@router.get("/inventory/movements")
async def inventory_movements(product_id: str = "", limit: int = 100, admin: dict = Depends(require_permission("catalog"))):
    query = {"product_id": product_id} if product_id else {}
    rows = [clean(x) async for x in db.inventory_transactions.find(query, {"_id": 0}).sort("at", -1).limit(min(max(limit, 1), 500))]
    ids = list({r.get("product_id") for r in rows if r.get("product_id")})
    products = {p["id"]: p.get("name", "") async for p in db.products.find({"id": {"$in": ids}}, {"id": 1, "name": 1, "_id": 0})}
    for r in rows: r["product_name"] = products.get(r.get("product_id"), "")
    return {"items": rows}


@router.post("/inventory/adjust")
async def inventory_adjust(payload: dict, request: Request, admin: dict = Depends(require_permission("catalog"))):
    pid = str(payload.get("product_id") or "")
    if not pid: raise HTTPException(400, "product_id is required.")
    p = await db.products.find_one({"id": pid}, {"_id": 0})
    if not p: raise HTTPException(404, "Product not found.")
    if p.get("product_type") == "customizable":
        raise HTTPException(400, "Customizable print products are made to order and do not use inventory.")
    qty = abs(_int_num(payload.get("quantity"), 0)); action = (payload.get("action") or "add").lower(); reason = (payload.get("reason") or "Manual Adjustment").strip()[:100]
    if qty <= 0: raise HTTPException(400, "Quantity must be greater than zero.")
    old_stock = max(0, _int_num(p.get("stock"))); reserved = max(0, _int_num(p.get("reserved")))
    delta = qty if action == "add" else -qty
    new_stock = old_stock + delta
    if new_stock < reserved: raise HTTPException(400, f"Cannot remove {qty} units. {reserved} units are currently reserved.")
    new_available = max(0, new_stock - reserved)
    upd = {"stock": new_stock, "updated_at": now_iso()}
    if p.get("status") == "Active" and new_available <= 0: upd["status"] = "Out of Stock"
    elif p.get("status") == "Out of Stock" and new_available > 0: upd["status"] = "Active"
    await db.products.update_one({"id": pid}, {"$set": upd})
    await db.inventory_transactions.insert_one({"id":str(uuid.uuid4()),"product_id":pid,"change":delta,"reason":reason,"notes":payload.get("notes"),"admin":admin["email"],"at":now_iso(),"source":"manual"})
    await audit(admin, "inventory_adjust", "product", pid, before={"stock":old_stock}, after={"stock":new_stock,"change":delta,"reason":reason}, request=request)
    return {"ok":True,"stock":new_stock,"reserved":reserved,"available":max(0,new_stock-reserved)}


@router.post("/inventory/bulk-adjust")
async def inventory_bulk_adjust(payload: dict, request: Request, admin: dict = Depends(require_permission("catalog"))):
    ids=[str(x) for x in payload.get("ids",[]) if str(x).strip()]; qty=abs(_int_num(payload.get("quantity"),0)); action=(payload.get("action") or "add").lower(); reason=(payload.get("reason") or "Manual Adjustment").strip()[:100]
    if not ids or qty<=0: raise HTTPException(400,"Select products and enter a quantity.")
    delta=qty if action=="add" else -qty; updated=0
    async for p in db.products.find({"id":{"$in":ids}},{"_id":0}):
        if p.get("product_type") == "customizable":
            continue
        stock=max(0,_int_num(p.get("stock"))); reserved=max(0,_int_num(p.get("reserved"))); new_stock=stock+delta
        if new_stock<reserved: continue
        await db.products.update_one({"id":p["id"]},{"$set":{"stock":new_stock,"updated_at":now_iso()}})
        await db.inventory_transactions.insert_one({"id":str(uuid.uuid4()),"product_id":p["id"],"change":delta,"reason":reason,"admin":admin["email"],"at":now_iso(),"source":"bulk"})
        updated+=1
    await audit(admin,"inventory_bulk_adjust","products",None,after={"ids":ids,"change":delta,"reason":reason},request=request)
    return {"ok":True,"updated":updated,"skipped":len(ids)-updated}


@router.post("/inventory/set-threshold")
async def inventory_threshold(payload: dict, request: Request, admin: dict = Depends(require_permission("catalog"))):
    pid=str(payload.get("product_id") or ""); threshold=max(0,_int_num(payload.get("threshold"),5))
    if not pid: raise HTTPException(400,"product_id is required.")
    p = await db.products.find_one({"id": pid}, {"product_type": 1, "_id": 0})
    if p and p.get("product_type") == "customizable":
        raise HTTPException(400, "Customizable print products do not use low-stock thresholds.")
    await db.products.update_one({"id":pid},{"$set":{"low_stock_threshold":threshold,"updated_at":now_iso()}})
    await audit(admin,"inventory_threshold","product",pid,after={"low_stock_threshold":threshold},request=request)
    return {"ok":True,"threshold":threshold}


# ---------------- P&L ----------------
def _period_bounds(value, end=False):
    if not value: return None
    try:
        raw=value.strip()
        if len(raw)==10:
            return datetime.fromisoformat(raw + ("T23:59:59.999999+00:00" if end else "T00:00:00+00:00"))
        dt=datetime.fromisoformat(raw.replace("Z","+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _pnl_bucket(iso, granularity="daily"):
    try: dt=datetime.fromisoformat((iso or "").replace("Z","+00:00"))
    except Exception: return "Unknown"
    if granularity=="monthly": return dt.strftime("%Y-%m")
    if granularity=="weekly": return f"{dt.date().isocalendar().year}-W{dt.date().isocalendar().week:02d}"
    return dt.strftime("%Y-%m-%d")


@router.get("/pnl/summary")
async def pnl_summary(from_date: str = Query(default="", alias="from"), to_date: str = Query(default="", alias="to"), granularity: str = "daily", admin: dict = Depends(require_permission("orders"))):
    start=_period_bounds(from_date,False); end=_period_bounds(to_date,True)
    query={"payment.status":{"$in":["paid","cod_confirmed"]}}
    if start or end:
        query["created_at"]={};
        if start: query["created_at"]["$gte"]=start.isoformat()
        if end: query["created_at"]["$lte"]=end.isoformat()
    if granularity not in {"daily","weekly","monthly"}: granularity="daily"
    buckets={}; gross=discount=refunds=shipping=0.0; cogs=0.0
    orders=[o async for o in db.orders.find(query,{"_id":0})]
    fallback_ids={line.get("product_id") for o in orders for line in (o.get("items") or []) if not _num(line.get("cost_price"),0) and line.get("product_id")}
    fallback_costs={}
    if fallback_ids:
        fallback_costs={p.get("id"):_num(p.get("cost_price"),0) async for p in db.products.find({"id":{"$in":list(fallback_ids)}},{"id":1,"cost_price":1,"_id":0})}
    for o in orders:
        pricing=o.get("pricing") or {}; b=_pnl_bucket(o.get("created_at"),granularity); row=buckets.setdefault(b,{"period":b,"sales":0.0,"discounts":0.0,"refunds":0.0,"net_revenue":0.0,"cogs":0.0,"gross_profit":0.0,"expenses":0.0,"net_profit":0.0})
        sale=_num(pricing.get("subtotal"),0); disc=_num(pricing.get("discount"),0); gross+=sale; discount+=disc; shipping+=_num(pricing.get("shipping"),0); row["sales"]+=sale; row["discounts"]+=disc
        for line in o.get("items",[]) or []:
            qty=_int_num(line.get("qty"),0); unit=_num(line.get("cost_price"),0) or fallback_costs.get(line.get("product_id"),0)
            cogs+=qty*unit; row["cogs"]+=qty*unit
    refund_query={"status":"Completed"};
    if start or end:
        refund_query["created_at"]={};
        if start: refund_query["created_at"]["$gte"]=start.isoformat()[:19]
        if end: refund_query["created_at"]["$lte"]=end.isoformat()[:19]
    async for r in db.refunds.find(refund_query,{"_id":0}):
        amt=_num(r.get("amount"),0); refunds+=amt; b=_pnl_bucket(r.get("created_at"),granularity); buckets.setdefault(b,{"period":b,"sales":0.0,"discounts":0.0,"refunds":0.0,"net_revenue":0.0,"cogs":0.0,"gross_profit":0.0,"expenses":0.0,"net_profit":0.0})["refunds"]+=amt
    exp_query={};
    if start or end:
        exp_query["date"]={};
        if start: exp_query["date"]["$gte"]=start.date().isoformat()
        if end: exp_query["date"]["$lte"]=end.date().isoformat()
    expense_breakdown={}; total_exp=0.0
    async for e in db.pnl_expenses.find(exp_query,{"_id":0}):
        amt=_num(e.get("amount"),0); total_exp+=amt; expense_breakdown[e.get("category") or "Other Expenses"]=expense_breakdown.get(e.get("category") or "Other Expenses",0)+amt
        b=_pnl_bucket(e.get("date"),granularity); buckets.setdefault(b,{"period":b,"sales":0.0,"discounts":0.0,"refunds":0.0,"net_revenue":0.0,"cogs":0.0,"gross_profit":0.0,"expenses":0.0,"net_profit":0.0})["expenses"]+=amt
    series=[]
    for b,row in sorted(buckets.items()):
        row["net_revenue"]=row["sales"]-row["discounts"]-row["refunds"]; row["gross_profit"]=row["net_revenue"]-row["cogs"]; row["net_profit"]=row["gross_profit"]-row["expenses"]; row["profit_margin"]=(row["net_profit"]/row["net_revenue"]*100) if row["net_revenue"] else 0
        series.append({k:(round(v,2) if isinstance(v,float) else v) for k,v in row.items()})
    net_revenue=gross-discount-refunds; gross_profit=net_revenue-cogs; net_profit=gross_profit-total_exp
    return {"sales":round(gross,2),"discounts":round(discount,2),"refunds":round(refunds,2),"net_revenue":round(net_revenue,2),"cogs":round(cogs,2),"gross_profit":round(gross_profit,2),"expenses":round(total_exp,2),"net_profit":round(net_profit,2),"profit_margin":round((net_profit/net_revenue*100) if net_revenue else 0,2),"shipping":round(shipping,2),"expense_breakdown":[{"category":k,"amount":round(v,2)} for k,v in sorted(expense_breakdown.items())],"series":series,"max_sales":max([x["sales"] for x in series],default=0)}


@router.get("/pnl/expenses")
async def pnl_expenses(from_date: str = Query(default="", alias="from"), to_date: str = Query(default="", alias="to"), admin: dict = Depends(require_permission("orders"))):
    q={}
    if from_date or to_date:
        q["date"]={}
        if from_date: q["date"]["$gte"]=from_date
        if to_date: q["date"]["$lte"]=to_date
    return {"items":[clean(x) async for x in db.pnl_expenses.find(q,{"_id":0}).sort("date",-1).limit(500)]}


@router.post("/pnl/expenses")
async def create_pnl_expense(payload: dict, request: Request, admin: dict = Depends(require_permission("orders"))):
    category=(payload.get("category") or "Other Expenses").strip()[:80]; amount=_num(payload.get("amount"),0); date=str(payload.get("date") or datetime.now(timezone.utc).date().isoformat())[:10]
    if amount<=0: raise HTTPException(400,"Expense amount must be greater than zero.")
    doc={"id":str(uuid.uuid4()),"category":category,"amount":round(amount,2),"date":date,"note":(payload.get("note") or "").strip()[:300],"admin":admin["email"],"created_at":now_iso()}
    await db.pnl_expenses.insert_one(doc); await audit(admin,"pnl_expense_create","pnl_expense",doc["id"],after=doc,request=request); return clean(doc)


@router.delete("/pnl/expenses/{eid}")
async def delete_pnl_expense(eid: str, request: Request, admin: dict = Depends(require_permission("orders"))):
    r=await db.pnl_expenses.find_one({"id":eid},{"_id":0})
    if not r: raise HTTPException(404,"Expense not found.")
    await db.pnl_expenses.delete_one({"id":eid}); await audit(admin,"pnl_expense_delete","pnl_expense",eid,before=r,request=request); return {"ok":True}


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
    sort_map = {
        "newest": [("created_at", -1)], "updated_desc": [("updated_at", -1)],
        "name_asc": [("name", 1)], "price_asc": [("price", 1)], "price_desc": [("price", -1)],
        "stock_asc": [("stock", 1)], "stock_desc": [("stock", -1)], "sales_desc": [("sales_count", -1)],
    }
    total = await db.products.count_documents(query)
    cur = db.products.find(query, {"_id": 0}).sort(sort_map.get(sort, sort_map["newest"])).skip((page-1)*page_size).limit(page_size)
    return {"items": [clean(p) async for p in cur], "total": total, "page": page,
            "pages": max(1, (total + page_size - 1)//page_size)}


@router.get("/products/summary")
async def admin_products_summary(admin: dict = Depends(require_permission("catalog"))):
    total = await db.products.count_documents({"status": {"$ne": "Archived"}})
    active = await db.products.count_documents({"status": "Active"})
    draft = await db.products.count_documents({"status": "Draft"})
    out = await db.products.count_documents({"$or": [{"status": "Out of Stock"}, {"stock": {"$lte": 0}}], "status": {"$ne": "Archived"}})
    low = 0; units = 0; value = 0
    async for prod in db.products.find({"status": {"$ne": "Archived"}}, {"stock":1,"reserved":1,"low_stock_threshold":1,"cost_price":1,"_id":0}):
        stock = _int_num(prod.get("stock"), 0); reserved = _int_num(prod.get("reserved"), 0); available = max(0, stock - reserved)
        units += stock
        value += stock * _num(prod.get("cost_price"), 0)
        if available > 0 and available <= _int_num(prod.get("low_stock_threshold"), 5): low += 1
    return {"total": total, "active": active, "draft": draft, "out_of_stock": out, "low_stock": low, "stock_units": units, "inventory_value": round(value, 2)}


@router.post("/products")
async def create_product(payload: dict, request: Request, admin: dict = Depends(require_permission("catalog"))):
    name = payload.get("name")
    if not name or payload.get("price") is None:
        raise HTTPException(400, "Product name and price are required.")
    slug = payload.get("slug") or slugify(name)
    if await db.products.find_one({"slug": slug}):
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"
    product_type = payload.get("product_type", "standard")
    is_customizable = product_type == "customizable"
    doc = {"id": str(uuid.uuid4()), "name": name, "slug": slug,
           "short_description": payload.get("short_description", ""),
           "description": payload.get("description", ""),
           "images": payload.get("images", []), "video": payload.get("video"),
           "price": int(payload["price"]), "compare_at_price": None if is_customizable else payload.get("compare_at_price"),
           "mrp": None if is_customizable else payload.get("mrp", payload.get("compare_at_price")),
           "cost_price": 0 if is_customizable else payload.get("cost_price", 0), "sku": payload.get("sku") or slug.upper().replace("-", "")[:14],
           "barcode": payload.get("barcode"), "category_slug": payload.get("category_slug"),
           "collection_slugs": payload.get("collection_slugs", []), "tags": payload.get("tags", []),
           "material": payload.get("material"), "color": payload.get("color"),
           "dimensions": payload.get("dimensions"), "weight": payload.get("weight"),
           "care": payload.get("care"), "shipping_info": payload.get("shipping_info"),
           "stock": 0 if is_customizable else int(payload.get("stock", 0)), "reserved": 0,
           "low_stock_threshold": 0 if is_customizable else int(payload.get("low_stock_threshold", 5)),
           "status": ("Draft" if is_customizable and payload.get("status") == "Out of Stock" else payload.get("status", "Draft")), "badges": payload.get("badges", []),
           "sections": payload.get("sections", []),
           "occasion": payload.get("occasion", []), "recipient": payload.get("recipient", []),
           "rating": 0, "review_count": 0, "variants": payload.get("variants", []),
           "product_type": product_type,
           "customization": payload.get("customization", {"enabled": False, "options": [], "pricing": {"mode": "base_addons", "quantity_tiers": [], "rules": []}, "artwork": {"enabled": False, "required": False, "formats": ["pdf", "jpg", "png"], "max_size_mb": 20, "max_files": 1, "instructions": ""}}),
           "bulk_order": payload.get("bulk_order", {"enabled": False, "min_quantity": 10, "tiers": []}),
           "personalization": payload.get("personalization", {"enabled": False}),
           "seo": payload.get("seo", {"title": f"{name} — ARTFUL", "description": payload.get("short_description", "")}),
           "views": 0, "sales_count": 0, "created_at": now_iso(), "updated_at": now_iso()}
    await db.products.insert_one(doc)
    if not is_customizable and int(doc.get("stock", 0) or 0) > 0:
        await db.inventory_transactions.insert_one({"id":str(uuid.uuid4()),"product_id":doc["id"],"change":int(doc["stock"]),"reason":"Initial Stock","admin":admin["email"],"at":now_iso(),"source":"product_create"})
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
    if "mrp" in fields and "compare_at_price" not in fields:
        fields["compare_at_price"] = fields.get("mrp")
    if "compare_at_price" in fields and "mrp" not in fields:
        fields["mrp"] = fields.get("compare_at_price")
    if "cost_price" in fields:
        fields["cost_price"] = _num(fields.get("cost_price"), 0)
    is_customizable = fields.get("product_type", p.get("product_type")) == "customizable"
    if is_customizable:
        fields["cost_price"] = 0
        fields["mrp"] = None
        fields["compare_at_price"] = None
        fields["stock"] = 0
        fields["reserved"] = 0
        fields["low_stock_threshold"] = 0
        if fields.get("status") == "Out of Stock":
            fields["status"] = "Draft"
    fields["updated_at"] = now_iso()
    old_stock = _int_num(p.get("stock"),0); new_stock = _int_num(fields.get("stock"), old_stock)
    if "stock" in fields and not is_customizable:
        reserved = _int_num(p.get("reserved"), 0)
        available = max(0, new_stock - reserved)
        if available <= 0 and fields.get("status", p.get("status")) == "Active": fields["status"] = "Out of Stock"
        elif available > 0 and fields.get("status", p.get("status")) == "Out of Stock": fields["status"] = "Active"
    await db.products.update_one({"id": pid}, {"$set": fields})
    if "stock" in fields and new_stock != old_stock and not is_customizable:
        await db.inventory_transactions.insert_one({"id":str(uuid.uuid4()),"product_id":pid,"change":new_stock-old_stock,"reason":"Manual Adjustment","admin":admin["email"],"at":now_iso(),"source":"product_edit"})
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
    if p.get("product_type") == "customizable":
        raise HTTPException(400, "Customizable print products are made to order and do not use inventory.")
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
    if action == "publish" or action == "activate":
        # Re-activate non-archived products; archived products remain archived.
        updated = 0
        async for p in db.products.find({"id": {"$in": ids}, "status": {"$ne": "Archived"}}, {"id": 1, "stock": 1, "reserved": 1, "_id": 0}):
            stock = _int_num(p.get("stock"), 0); reserved = _int_num(p.get("reserved"), 0)
            status = "Active" if max(0, stock - reserved) > 0 else "Out of Stock"
            result = await db.products.update_one({"id": p["id"]}, {"$set": {"status": status, "updated_at": now_iso()}})
            updated += result.modified_count
        await audit(admin, "bulk_activate", "product", None, after={"ids": ids, "updated": updated}, request=request)
        return {"ok": True, "updated": updated}
    elif action == "deactivate":
        result = await db.products.update_many({"id": {"$in": ids}}, {"$set": {"status": "Inactive", "updated_at": now_iso()}})
        await audit(admin, "bulk_deactivate", "product", None, after={"ids": ids, "updated": result.modified_count}, request=request)
        return {"ok": True, "updated": result.modified_count}
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



# ---------------- BULK DELETE ----------------
def _normalize_bulk_ids(payload: dict, limit: int = 100):
    ids = payload.get("ids")
    if not isinstance(ids, list):
        raise HTTPException(400, "ids must be an array.")
    ids = [str(x).strip() for x in ids if str(x).strip()]
    ids = list(dict.fromkeys(ids))
    if not ids:
        raise HTTPException(400, "Select at least one record.")
    if len(ids) > limit:
        raise HTTPException(400, f"You can delete at most {limit} records at once.")
    return ids


@router.post("/products/bulk-delete")
async def bulk_delete_products(payload: dict, request: Request,
                               admin: dict = Depends(require_permission("catalog"))):
    ids = _normalize_bulk_ids(payload)
    result = await db.products.delete_many({"id": {"$in": ids}})
    await audit(admin, "bulk_delete", "product", None,
                after={"ids": ids, "deleted": result.deleted_count}, request=request)
    return {"ok": True, "deleted": result.deleted_count}


@router.post("/categories/bulk-delete")
async def bulk_delete_categories(payload: dict, request: Request,
                                 admin: dict = Depends(require_permission("catalog"))):
    ids = _normalize_bulk_ids(payload)
    cats = [c async for c in db.categories.find({"id": {"$in": ids}}, {"id": 1, "slug": 1, "_id": 0})]
    slugs = [c.get("slug") for c in cats if c.get("slug")]
    result = await db.categories.delete_many({"id": {"$in": ids}})
    if slugs:
        await db.products.update_many({"category_slug": {"$in": slugs}}, {"$set": {"category_slug": None, "updated_at": now_iso()}})
    await audit(admin, "bulk_delete", "category", None,
                after={"ids": ids, "deleted": result.deleted_count}, request=request)
    return {"ok": True, "deleted": result.deleted_count}


@router.post("/customers/bulk-delete")
async def bulk_delete_customers(payload: dict, request: Request,
                                admin: dict = Depends(require_permission("customers"))):
    ids = _normalize_bulk_ids(payload)
    result = await db.customers.delete_many({"id": {"$in": ids}})
    await db.addresses.delete_many({"customer_id": {"$in": ids}})
    await audit(admin, "bulk_delete", "customer", None,
                after={"ids": ids, "deleted": result.deleted_count, "addresses_deleted": len(ids)}, request=request)
    return {"ok": True, "deleted": result.deleted_count}


@router.post("/visitors/bulk-delete")
async def bulk_delete_visitors(payload: dict, request: Request,
                               admin: dict = Depends(require_permission("customers"))):
    ids = _normalize_bulk_ids(payload)
    result = await db.visitors.delete_many({"id": {"$in": ids}})
    await audit(admin, "bulk_delete", "visitor", None,
                after={"ids": ids, "deleted": result.deleted_count}, request=request)
    return {"ok": True, "deleted": result.deleted_count}


@router.post("/orders/bulk-delete")
async def bulk_delete_orders(payload: dict, request: Request,
                             admin: dict = Depends(require_permission("orders"))):
    ids = _normalize_bulk_ids(payload)
    orders = [o async for o in db.orders.find({"id": {"$in": ids}}, {"id": 1, "order_number": 1, "_id": 0})]
    order_numbers = [o.get("order_number") for o in orders if o.get("order_number")]
    result = await db.orders.delete_many({"id": {"$in": ids}})
    if order_numbers:
        await db.refunds.delete_many({"order_number": {"$in": order_numbers}})
        await db.notifications.delete_many({"order_number": {"$in": order_numbers}})
    await audit(admin, "bulk_delete", "order", None,
                after={"ids": ids, "order_numbers": order_numbers, "deleted": result.deleted_count}, request=request)
    return {"ok": True, "deleted": result.deleted_count}


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
VIDEO_MIME = {".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".m4v": "video/x-m4v", ".ogv": "video/ogg"}


@router.post("/upload")
async def upload_media(file: UploadFile = File(...), admin: dict = Depends(get_current_admin)):
    import storage
    ext = os.path.splitext(file.filename or "")[1].lower() or ".png"
    if ext not in UPLOAD_MIME and ext not in VIDEO_MIME:
        raise HTTPException(400, "Unsupported media type.")

    content_type = UPLOAD_MIME.get(ext) or VIDEO_MIME[ext]
    resource_type = "image" if ext in UPLOAD_MIME else "video"
    data = await file.read()
    max_bytes = 8 * 1024 * 1024 if resource_type == "image" else 50 * 1024 * 1024
    if len(data) > max_bytes:
        label = "Image" if resource_type == "image" else "Video"
        limit = "8MB" if resource_type == "image" else "50MB"
        raise HTTPException(400, f"{label} too large (max {limit}).")

    path = f"{storage.APP_NAME}/uploads/{uuid.uuid4().hex}{ext}"
    try:
        result = storage.upload_media(path, data, content_type, resource_type=resource_type)
    except Exception as e:
        raise HTTPException(502, f"Upload failed: {e}")

    if resource_type == "image":
        url = f"/api/uploads/{result['path']}"
        stored_path = result["path"]
    else:
        url = result["url"]
        stored_path = result.get("public_id", result["path"])

    await db.media.insert_one({"id": str(uuid.uuid4()), "storage_path": stored_path, "url": url,
                               "original_filename": file.filename, "content_type": content_type,
                               "size": result.get("size", len(data)), "resource_type": resource_type,
                               "is_deleted": False, "at": now_iso()})
    return {"url": url, "path": stored_path, "resource_type": resource_type}


# ---------------- ORDERS ----------------
@router.get("/orders")
async def admin_orders(status: str = "", q: str = "", payment: str = "", sort: str = "newest",
                       page: int = 1, page_size: int = 20, admin: dict = Depends(require_permission("orders"))):
    query = {}
    if status:
        query["status"] = status
    if payment:
        query["payment.status"] = payment
    if q:
        query["$or"] = [{"order_number": {"$regex": q, "$options": "i"}},
                        {"customer.phone": {"$regex": q, "$options": "i"}},
                        {"customer.name": {"$regex": q, "$options": "i"}},
                        {"customer.email": {"$regex": q, "$options": "i"}}]
    sort_map = {"newest": [("created_at", -1)], "oldest": [("created_at", 1)], "total_desc": [("pricing.total", -1)],
                "total_asc": [("pricing.total", 1)], "status": [("status", 1)], "updated_desc": [("updated_at", -1)]}
    total = await db.orders.count_documents(query)
    cur = db.orders.find(query, {"_id": 0}).sort(sort_map.get(sort, sort_map["newest"])).skip((page-1)*page_size).limit(page_size)
    return {"items": [clean(o) async for o in cur], "total": total, "page": page,
            "pages": max(1, (total + page_size - 1)//page_size)}


@router.get("/orders/summary")
async def admin_orders_summary(admin: dict = Depends(require_permission("orders"))):
    total = await db.orders.count_documents({})
    pending = await db.orders.count_documents({"status": {"$in": ["Pending", "Confirmed", "Processing", "Packed", "Shipped", "Out for Delivery"]}})
    delivered = await db.orders.count_documents({"status": "Delivered"})
    cancelled = await db.orders.count_documents({"status": "Cancelled"})
    paid = 0
    revenue = 0
    async for o in db.orders.find({"payment.status": {"$in": ["paid", "cod_confirmed"]}}, {"pricing.total":1,"_id":0}):
        paid += 1
        revenue += _num((o.get("pricing") or {}).get("total"), 0)
    return {"total": total, "pending": pending, "delivered": delivered, "cancelled": cancelled, "paid_orders": paid, "revenue": round(revenue, 2)}


@router.get("/orders/{order_number}")
async def admin_order(order_number: str, admin: dict = Depends(require_permission("orders"))):
    o = await db.orders.find_one({"order_number": order_number}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found.")
    return o


@router.post("/whatsapp/test")
async def whatsapp_test(payload: dict, admin: dict = Depends(require_permission("settings"))):
    phone = (payload.get("phone") or "").strip()
    if not phone:
        raise HTTPException(400, "Phone is required.")
    template_name = (payload.get("template_name") or "").strip() or None
    language_code = (payload.get("language_code") or ig.WHATSAPP_TEMPLATE_LANGUAGE).strip()
    params = payload.get("body_params") or []
    if not isinstance(params, list):
        raise HTTPException(400, "body_params must be a list.")
    result = await ig.send_whatsapp_template(phone, template_name, language_code, params)
    if not result.get("sent"):
        raise HTTPException(502, result.get("error") or result.get("message") or "WhatsApp send failed.")
    return result


@router.put("/orders/{order_number}/artwork-status")
async def update_artwork_status(order_number: str, payload: dict, request: Request,
                                admin: dict = Depends(require_permission("orders"))):
    o = await db.orders.find_one({"order_number": order_number})
    if not o:
        raise HTTPException(404, "Order not found.")
    item_index = int(payload.get("item_index", -1))
    new_status = payload.get("artwork_status")
    valid = ["Awaiting Artwork", "Artwork Received", "Artwork Under Review", "Artwork Approved", "Artwork Issue"]
    if item_index < 0 or item_index >= len(o.get("items", [])) or new_status not in valid:
        raise HTTPException(400, "Invalid artwork status or order item.")
    items = list(o.get("items", []))
    if not items[item_index].get("artwork"):
        raise HTTPException(400, "This order item has no uploaded artwork.")
    items[item_index] = {**items[item_index], "artwork_status": new_status}
    await db.orders.update_one({"order_number": order_number}, {"$set": {"items": items, "updated_at": now_iso()}})
    await audit(admin, "artwork_status", "order", o["id"], after={"item_index": item_index, "artwork_status": new_status}, request=request)
    return await db.orders.find_one({"order_number": order_number}, {"_id": 0})


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
    # Inventory lifecycle: reservation at order placement; physical stock changes only on delivery.
    old_status = o.get("status")
    if new_status == "Delivered" and old_status != "Delivered":
        for l in o.get("items", []):
            if l.get("product_type") == "customizable":
                continue
            qty = _int_num(l.get("qty"),0)
            await db.products.update_one({"id":l["product_id"]},{"$inc":{"reserved":-qty,"stock":-qty}})
            prod=await db.products.find_one({"id":l["product_id"]},{"stock":1,"reserved":1,"status":1,"_id":0})
            if prod and prod.get("status") == "Active" and int(prod.get("stock",0) or 0)-int(prod.get("reserved",0) or 0) <= 0:
                await db.products.update_one({"id":l["product_id"]},{"$set":{"status":"Out of Stock"}})
            await db.inventory_transactions.insert_one({"id":str(uuid.uuid4()),"product_id":l["product_id"],"change":-qty,"reason":f"Order {o["order_number"]} delivered","admin":admin["email"],"at":now_iso(),"source":"order_delivered","order_number":o["order_number"]})
    elif new_status == "Cancelled" and old_status not in ("Cancelled","Returned","Refunded"):
        for l in o.get("items", []):
            if l.get("product_type") == "customizable":
                continue
            qty = _int_num(l.get("qty"),0)
            await db.products.update_one({"id":l["product_id"]},{"$inc":{"reserved":-qty}})
            prod=await db.products.find_one({"id":l["product_id"]},{"stock":1,"reserved":1,"status":1,"_id":0})
            if prod and prod.get("status") == "Out of Stock" and int(prod.get("stock",0) or 0)-int(prod.get("reserved",0) or 0) > 0:
                await db.products.update_one({"id":l["product_id"]},{"$set":{"status":"Active"}})
            await db.inventory_transactions.insert_one({"id":str(uuid.uuid4()),"product_id":l["product_id"],"change":0,"reason":f"Order {o["order_number"]} cancelled; reservation released","admin":admin["email"],"at":now_iso(),"source":"order_cancel","order_number":o["order_number"]})
    elif new_status == "Returned" and old_status not in ("Returned","Refunded"):
        if old_status != "Delivered":
            raise HTTPException(400, "Only delivered orders can be marked as returned.")
        resellable = bool(payload.get("resellable", True))
        if resellable:
            for l in o.get("items", []):
                if l.get("product_type") == "customizable":
                    continue
                qty = _int_num(l.get("qty"),0)
                await db.products.update_one({"id":l["product_id"]},{"$inc":{"stock":qty}})
                prod=await db.products.find_one({"id":l["product_id"]},{"stock":1,"reserved":1,"status":1,"_id":0})
                if prod and prod.get("status") == "Out of Stock" and int(prod.get("stock",0) or 0)-int(prod.get("reserved",0) or 0) > 0:
                    await db.products.update_one({"id":l["product_id"]},{"$set":{"status":"Active"}})
                await db.inventory_transactions.insert_one({"id":str(uuid.uuid4()),"product_id":l["product_id"],"change":qty,"reason":f"Return {o["order_number"]} - Resellable","admin":admin["email"],"at":now_iso(),"source":"return_resellable","order_number":o["order_number"]})
    await db.orders.update_one({"order_number": order_number},
        {"$set": {"status": new_status, "updated_at": now_iso()},
         "$push": {"status_history": {"status": new_status, "at": now_iso(), "note": payload.get("note", "")}}})

    updated_order = await db.orders.find_one({"order_number": order_number})
    customer = await db.customers.find_one({"id": o.get("customer_id")}, {"phone": 1, "name": 1, "_id": 0})
    if customer and customer.get("phone") and o.get("status") != new_status:
        name = customer.get("name") or (o.get("customer") or {}).get("name") or "there"
        tracking_number = ((updated_order or {}).get("tracking") or {}).get("number") or "Not available"
        if new_status == "Confirmed":
            template = ig.WHATSAPP_TEMPLATE_ORDER_CONFIRMATION
            params = await ig.build_order_confirmation_params(updated_order or o)
        elif new_status == "Cancelled":
            template = ig.WHATSAPP_TEMPLATE_ORDER_CANCELLED
            params = [name, order_number]
        elif new_status == "Shipped":
            template = ig.WHATSAPP_TEMPLATE_ORDER_SHIPPED
            params = [name, order_number, tracking_number]
        elif new_status == "Out for Delivery":
            template = ig.WHATSAPP_TEMPLATE_OUT_FOR_DELIVERY
            params = [name, order_number]
        elif new_status == "Delivered":
            template = ig.WHATSAPP_TEMPLATE_ORDER_DELIVERED
            params = [name, order_number]
        else:
            template = ig.WHATSAPP_TEMPLATE_ORDER_STATUS
            params = [name, order_number, new_status]
        asyncio.create_task(ig.send_whatsapp_template(customer["phone"], template, ig.WHATSAPP_TEMPLATE_LANGUAGE, params))

    await audit(admin, "order_status", "order", order_number,
                before={"status": o["status"]}, after={"status": new_status}, request=request)
    return clean(updated_order)


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
    if status not in ("Pending", "Approved", "Rejected"):
        raise HTTPException(400, "Invalid review status.")
    image_status = payload.get("image_status")
    update = {"status": status}
    if image_status in ("Pending", "Approved", "Rejected"):
        update["image_status"] = image_status
    await db.reviews.update_one({"id": rid}, {"$set": update})
    approved = [x async for x in db.reviews.find({"product_id": r["product_id"], "status": "Approved"}, {"rating": 1, "_id": 0})]
    if approved:
        avg = round(sum(a["rating"] for a in approved) / len(approved), 1)
        await db.products.update_one({"id": r["product_id"]}, {"$set": {"rating": avg, "review_count": len(approved)}})
    else:
        await db.products.update_one({"id": r["product_id"]}, {"$set": {"rating": 0, "review_count": 0}})
    return {"ok": True}


@router.put("/reviews/{rid}/image")
async def moderate_review_image(rid: str, payload: dict, admin: dict = Depends(require_permission("catalog"))):
    r = await db.reviews.find_one({"id": rid})
    if not r:
        raise HTTPException(404, "Review not found.")
    status = payload.get("status")
    if not r.get("image_url"):
        raise HTTPException(400, "This review has no image.")
    if status not in ("Pending", "Approved", "Rejected"):
        raise HTTPException(400, "Invalid image status.")
    await db.reviews.update_one({"id": rid}, {"$set": {"image_status": status}})
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

    payment = o.get("payment") or {}
    if payment.get("status") != "paid":
        raise HTTPException(400, "Only captured Razorpay payments can be refunded.")

    payment_id = payment.get("payment_id") or payment.get("razorpay_payment_id")
    if not payment_id:
        raise HTTPException(400, "Razorpay payment id is missing for this order.")

    try:
        amount = float(payload.get("amount", 0))
    except (TypeError, ValueError):
        raise HTTPException(400, "Refund amount is invalid.")
    if amount <= 0:
        raise HTTPException(400, "Refund amount must be greater than zero.")

    existing = [r async for r in db.refunds.find(
        {"order_number": o["order_number"], "status": {"$nin": ["Rejected"]}},
        {"amount": 1, "_id": 0},
    )]
    already_committed = sum(float(r.get("amount", 0) or 0) for r in existing)
    remaining = max(0.0, float(o["pricing"]["total"]) - already_committed)
    if amount > remaining + 1e-9:
        raise HTTPException(400, f"Maximum refundable amount remaining is ₹{remaining:.2f}.")

    doc = {
        "id": str(uuid.uuid4()),
        "order_number": o["order_number"],
        "amount": round(amount, 2),
        "reason": payload.get("reason"),
        "status": "Requested",
        "payment_id": payment_id,
        "razorpay_refund_id": None,
        "razorpay_status": None,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.refunds.insert_one(doc)
    await audit(
        admin, "refund_request", "order", o["order_number"],
        after={"amount": round(amount, 2), "payment_id": payment_id}, request=request,
    )
    return clean(doc)


@router.put("/refunds/{rid}")
async def update_refund(rid: str, payload: dict, request: Request, admin: dict = Depends(require_permission("orders"))):
    r = await db.refunds.find_one({"id": rid})
    if not r:
        raise HTTPException(404, "Refund not found.")

    status = payload.get("status")
    allowed = {"Requested", "Approved", "Processing", "Completed", "Rejected"}
    if status not in allowed:
        raise HTTPException(400, "Invalid refund status.")
    if r.get("status") == "Completed":
        raise HTTPException(400, "A completed refund cannot be changed.")

    if status == "Completed":
        # Do not create two refunds for the same local record.
        if r.get("razorpay_refund_id") and (r.get("razorpay_status") or "").lower() in {"pending", "processed"}:
            raise HTTPException(400, "This refund has already been submitted to Razorpay. Wait for its final status.")
        if (r.get("razorpay_status") or "").lower() == "failed":
            raise HTTPException(400, "This Razorpay refund previously failed. Create a new refund request to retry.")

        o = await db.orders.find_one({"order_number": r["order_number"]})
        if not o:
            raise HTTPException(404, "Order not found.")
        payment = o.get("payment") or {}
        if payment.get("status") != "paid":
            raise HTTPException(400, "The order is not in a refundable payment state.")

        payment_id = r.get("payment_id") or payment.get("payment_id") or payment.get("razorpay_payment_id")
        if not payment_id:
            raise HTTPException(400, "Razorpay payment id is missing for this refund.")

        amount_paise = int(round(float(r.get("amount", 0)) * 100))
        if amount_paise <= 0:
            raise HTTPException(400, "Refund amount must be greater than zero.")

        # Re-check the outstanding refundable amount immediately before creating the refund.
        existing = [x async for x in db.refunds.find(
            {"order_number": r["order_number"], "id": {"$ne": rid}, "status": {"$nin": ["Rejected"]}},
            {"amount": 1, "_id": 0},
        )]
        committed = sum(float(x.get("amount", 0) or 0) for x in existing)
        remaining = max(0.0, float(o["pricing"]["total"]) - committed)
        if float(r.get("amount", 0)) > remaining + 1e-9:
            raise HTTPException(400, f"Maximum refundable amount remaining is ₹{remaining:.2f}.")

        idempotency_key = f"artful-refund-{rid}"
        try:
            refund = await asyncio.to_thread(
                ig.create_refund,
                payment_id,
                amount_paise,
                f"{r['order_number']}-{rid}",
                idempotency_key,
            )
        except Exception as exc:
            print(f"[razorpay] refund failed for {r['order_number']}/{rid}: {exc}")
            await db.refunds.update_one(
                {"id": rid},
                {"$set": {
                    "status": "Processing",
                    "payment_id": payment_id,
                    "razorpay_status": "unknown",
                    "updated_at": now_iso(),
                }},
            )
            raise HTTPException(502, "Refund request could not be confirmed with Razorpay. Please check the refund status before retrying.")

        razorpay_status = (refund.get("status") or "pending").lower()
        if razorpay_status == "failed":
            local_status = "Rejected"
        elif razorpay_status == "processed":
            local_status = "Completed"
        else:
            local_status = "Processing"

        await db.refunds.update_one(
            {"id": rid},
            {"$set": {
                "status": local_status,
                "payment_id": payment_id,
                "razorpay_refund_id": refund.get("id"),
                "razorpay_status": razorpay_status,
                "updated_at": now_iso(),
            }},
        )

        if local_status == "Completed":
            completed = [x async for x in db.refunds.find(
                {"order_number": r["order_number"], "status": "Completed"},
                {"amount": 1, "_id": 0},
            )]
            total_refunded = sum(float(x.get("amount", 0) or 0) for x in completed)
            if total_refunded + 1e-9 >= float(o["pricing"]["total"]):
                await db.orders.update_one(
                    {"id": o["id"]},
                    {"$set": {"status": "Refunded", "updated_at": now_iso()},
                     "$push": {"status_history": {
                         "status": "Refunded", "at": now_iso(),
                         "note": "Refund fully processed by Razorpay.",
                     }}},
                )
    else:
        # For Requested/Approved/Processing/Rejected, only the local workflow state changes.
        await db.refunds.update_one(
            {"id": rid},
            {"$set": {"status": status, "updated_at": now_iso()}},
        )

    latest = await db.refunds.find_one({"id": rid}, {"_id": 0})
    await audit(
        admin, "refund_update", "refund", rid,
        after={
            "status": (latest or {}).get("status", status),
            "razorpay_refund_id": (latest or {}).get("razorpay_refund_id"),
        },
        request=request,
    )
    return {"ok": True, "refund": clean(latest) if latest else None}


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