"""Small, idempotent background monitor for orders awaiting dispatch."""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from db import db
from security import now_iso

TERMINAL_OR_DISPATCHED = {"Shipped", "Out for Delivery", "Delivered", "Cancelled", "Returned", "Refunded", "Failed"}


def _parse_dt(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


async def check_overdue_dispatches():
    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
    cur = db.orders.find({"status": {"$nin": list(TERMINAL_OR_DISPATCHED)}}, {"_id": 0, "order_number": 1, "status": 1, "created_at": 1})
    async for order in cur:
        created = _parse_dt(order.get("created_at"))
        if not created or created > cutoff:
            continue
        number = order.get("order_number")
        if not number:
            continue
        event_key = f"dispatch-overdue:{number}"
        await db.notifications.update_one(
            {"event_key": event_key},
            {"$setOnInsert": {
                "id": str(uuid.uuid4()), "event_key": event_key, "type": "dispatch_overdue",
                "title": "Order dispatch overdue", "description": f"Order {number} has not been dispatched within 48 hours.",
                "order_number": number, "link": f"/admin/orders", "read": False, "at": now_iso()
            }}, upsert=True)


async def dispatch_delay_monitor():
    while True:
        try:
            await check_overdue_dispatches()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            print(f"[notification_jobs] dispatch monitor error: {exc}")
        await asyncio.sleep(15 * 60)
