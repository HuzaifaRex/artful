import os
import uuid
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import db
from security import hash_password, verify_password
import seed as seed_module
import routers_store
import routers_shop
import routers_admin
import invoice
import chatbot

app = FastAPI(title="ARTFUL API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routers_store.router, prefix="/api")
app.include_router(routers_shop.router, prefix="/api")
app.include_router(routers_admin.router, prefix="/api/admin")
app.include_router(invoice.router, prefix="/api")
app.include_router(chatbot.router, prefix="/api")


@app.get("/api/health")
async def health():
    import integrations as ig
    return {"status": "ok", "razorpay": ig.razorpay_enabled(), "twilio": ig.twilio_enabled(), "whatsapp": ig.whatsapp_enabled()}


async def seed_admin():
    email = os.environ.get("ADMIN_SEED_EMAIL", "admin@artful.com").lower()
    password = os.environ.get("ADMIN_SEED_PASSWORD", "Artful@2026")
    existing = await db.admin_users.find_one({"email": email})
    if not existing:
        await db.admin_users.insert_one({
            "id": str(uuid.uuid4()), "email": email, "name": "ARTFUL Admin",
            "password_hash": hash_password(password), "role": "Super Admin",
            "status": "Active", "created_at": datetime.now(timezone.utc).isoformat(), "last_login": None})
    elif not verify_password(password, existing.get("password_hash", "")):
        await db.admin_users.update_one({"email": email}, {"$set": {"password_hash": hash_password(password)}})


@app.on_event("startup")
async def startup():
    await db.products.create_index("slug", unique=True)
    await db.products.create_index("category_slug")
    await db.products.create_index([("name", "text"), ("tags", "text")])
    await db.categories.create_index("slug", unique=True)
    await db.collections.create_index("slug", unique=True)
    await db.customers.create_index("phone", unique=True, sparse=True)
    await db.customers.create_index("email", sparse=True)
    await db.orders.create_index("order_number", unique=True)
    await db.orders.create_index("customer_id")
    await db.coupons.create_index("code", unique=True)
    await db.admin_users.create_index("email", unique=True)
    await seed_module.seed()
    await seed_admin()
    try:
        import storage
        storage.init_storage()
    except Exception as e:
        print(f"[storage] init deferred: {e}")
