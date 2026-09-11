"""Server-side pricing, coupon and totals engine. Never trust client math."""
from db import db


def bulk_unit_price(prod: dict, qty: int, base_price: int) -> int:
    """Return the applicable product unit price for a quantity using admin-defined bulk tiers."""
    config = prod.get("bulk_order") or {}
    if not config.get("enabled"):
        return int(base_price)
    try:
        min_qty = int(config.get("min_quantity", 0))
    except (TypeError, ValueError):
        min_qty = 0
    if min_qty <= 0 or qty < min_qty:
        return int(base_price)

    best = None
    for tier in config.get("tiers") or []:
        try:
            t_qty = int(tier.get("min_quantity", 0))
            t_price = int(round(float(tier.get("price"))))
        except (TypeError, ValueError):
            continue
        if t_qty >= min_qty and t_price > 0 and t_qty <= qty:
            if best is None or t_qty > best[0]:
                best = (t_qty, t_price)
    return best[1] if best else int(base_price)


async def build_line_items(items):
    """items: [{product_id, variant_id?, qty, personalization?, gift_wrap?}] -> priced lines."""
    lines, errors = [], []
    for it in items or []:
        qty = max(1, int(it.get("qty", 1)))
        prod = await db.products.find_one({"id": it.get("product_id")}, {"_id": 0})
        if not prod or prod.get("status") == "Archived":
            errors.append({"product_id": it.get("product_id"), "error": "Product no longer available."})
            continue
        available = prod.get("stock", 0) - prod.get("reserved", 0)
        variant = None
        base_price = prod["price"]
        if it.get("variant_id"):
            variant = next((v for v in prod.get("variants", []) if v.get("id") == it["variant_id"]), None)
            if variant:
                base_price = variant.get("price", base_price)
                available = variant.get("stock", available)
        capped = min(qty, max(0, available))
        if capped == 0:
            errors.append({"product_id": prod["id"], "name": prod["name"], "error": "Out of stock."})
            continue
        price = bulk_unit_price(prod, capped, base_price)
        gift_wrap = bool(it.get("gift_wrap"))
        wrap_price = 199 if gift_wrap else 0
        bulk_config = prod.get("bulk_order") or {}
        bulk_enabled_for_line = bool(bulk_config.get("enabled") and capped >= int(bulk_config.get("min_quantity", 0) or 0) and price != int(base_price))
        lines.append({
            "product_id": prod["id"], "name": prod["name"], "slug": prod["slug"],
            "image": (prod.get("images") or [None])[0], "sku": prod.get("sku"),
            "variant_id": it.get("variant_id"), "variant_label": (variant or {}).get("label") if variant else None,
            "price": price, "base_price": base_price, "qty": capped, "requested_qty": qty,
            "bulk_order": {"enabled": bool(bulk_config.get("enabled")), "applied": bulk_enabled_for_line,
                           "min_quantity": int(bulk_config.get("min_quantity", 0) or 0), "tiers": bulk_config.get("tiers", [])},
            "gift_wrap": gift_wrap, "wrap_price": wrap_price,
            "personalization": it.get("personalization") or None,
            "line_total": price * capped + wrap_price,
            "compare_at_price": prod.get("compare_at_price"),
        })
    return lines, errors


async def validate_coupon(code, subtotal, lines, customer=None):
    """Return (coupon_doc, discount, free_shipping, error_message)."""
    if not code:
        return None, 0, False, None
    coupon = await db.coupons.find_one({"code": code.upper().strip(), "status": "Active"}, {"_id": 0})
    if not coupon:
        return None, 0, False, "This coupon code is not valid."
    if coupon.get("min_cart") and subtotal < coupon["min_cart"]:
        return None, 0, False, f"Add ₹{coupon['min_cart'] - subtotal} more to use {coupon['code']}."
    if coupon.get("usage_limit") is not None and coupon.get("used_count", 0) >= coupon["usage_limit"]:
        return None, 0, False, "This coupon has reached its usage limit."
    if coupon.get("first_time_only"):
        if customer:
            prior = await db.orders.count_documents({"customer_id": customer.get("id"),
                                                     "payment.status": "paid"})
            if prior > 0:
                return None, 0, False, "This coupon is valid on your first order only."
    if coupon.get("per_customer_limit") is not None and customer:
        used = await db.orders.count_documents({"customer_id": customer.get("id"),
                                                "pricing.coupon_code": coupon["code"]})
        if used >= coupon["per_customer_limit"]:
            return None, 0, False, "You have already used this coupon."

    ctype = coupon["type"]
    discount, free_shipping = 0, False
    if ctype == "percentage":
        discount = round(subtotal * coupon["value"] / 100)
        if coupon.get("max_discount"):
            discount = min(discount, coupon["max_discount"])
    elif ctype == "flat":
        discount = min(coupon["value"], subtotal)
    elif ctype == "free_shipping":
        free_shipping = True
    return coupon, discount, free_shipping, None


async def compute_totals(items, coupon_code=None, customer=None, state=None):
    lines, errors = await build_line_items(items)
    subtotal = sum(l["line_total"] for l in lines)
    settings = await db.settings.find_one({"id": "store"}, {"_id": 0}) or {}
    coupon, discount, free_shipping, coupon_error = await validate_coupon(coupon_code, subtotal, lines, customer)

    threshold = settings.get("free_shipping_threshold", 999)
    flat_ship = settings.get("shipping_flat", 79)
    shipping_charge = flat_ship
    logic = settings.get("delivery_logic") or {}
    normalized_state = (state or "").strip().casefold()
    for rule in logic.get("state_rules") or []:
        if normalized_state and str(rule.get("state") or "").strip().casefold() == normalized_state:
            try:
                shipping_charge = max(0, int(rule.get("shipping_charge", flat_ship) or 0))
            except (TypeError, ValueError):
                shipping_charge = flat_ship
            break
    shipping = 0 if (subtotal - discount) >= threshold or free_shipping or subtotal == 0 else shipping_charge
    tax_rate = settings.get("tax_rate", 0)
    taxable = max(0, subtotal - discount)
    tax = 0 if settings.get("tax_inclusive", True) else round(taxable * tax_rate / 100)
    regular_total = sum((l.get("compare_at_price") if (l.get("compare_at_price") or 0) > (l.get("base_price") or l["price"]) else (l.get("base_price") or l["price"])) * l["qty"] for l in lines)
    savings = max(0, regular_total - subtotal) + discount
    total = max(0, subtotal - discount + shipping + tax)
    return {
        "items": lines, "errors": errors,
        "subtotal": subtotal, "discount": discount, "coupon_code": coupon["code"] if coupon else None,
        "coupon_error": coupon_error, "coupon_description": coupon.get("description") if coupon else None,
        "shipping": shipping, "shipping_charge": shipping_charge, "free_shipping_threshold": threshold, "tax": tax,
        "savings": savings, "total": total,
        "currency_symbol": settings.get("currency_symbol", "₹"),
    }
