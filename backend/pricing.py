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
    """Build server-priced cart lines, including customizable-product selections."""
    lines, errors = [], []
    for it in items or []:
        qty = max(1, int(it.get("qty", 1)))
        prod = await db.products.find_one({"id": it.get("product_id")}, {"_id": 0})
        if not prod or prod.get("status") == "Archived":
            errors.append({"product_id": it.get("product_id"), "error": "Product no longer available."})
            continue

        available = prod.get("stock", 0) - prod.get("reserved", 0)
        variant = None
        base_price = int(prod.get("price") or 0)
        if it.get("variant_id"):
            variant = next((v for v in prod.get("variants", []) if v.get("id") == it["variant_id"]), None)
            if variant:
                base_price = int(variant.get("price", base_price))
                available = variant.get("stock", available)
        available = max(0, int(available or 0))
        # Custom print products are produced to order; stock is treated as capacity only when > 0.
        custom_cfg = prod.get("customization") or {}
        is_custom = prod.get("product_type") == "customizable" or custom_cfg.get("enabled")

        if not is_custom:
            if available <= 0:
                errors.append({"product_id": prod["id"], "name": prod["name"], "requested_qty": qty, "available": 0, "error": "Out of stock."})
                continue
            if qty > available:
                errors.append({"product_id": prod["id"], "name": prod["name"], "requested_qty": qty, "available": available, "error": f"Only {available} units are available."})

        selection = it.get("customization") or {}
        option_details = []
        option_addons = 0
        if is_custom:
            selected_quantity_tier = None
            for opt in custom_cfg.get("options") or []:
                selected = selection.get(opt.get("id"))
                if opt.get("required") and not selected:
                    errors.append({"product_id": prod["id"], "name": prod["name"], "error": f"Please select {opt.get('name', 'an option')}."})
                    continue
                if not selected:
                    continue
                selected_ids = selected if isinstance(selected, list) else [selected]
                for sid in selected_ids:
                    val = next((v for v in opt.get("values") or [] if v.get("id") == sid), None)
                    if not val:
                        errors.append({"product_id": prod["id"], "name": prod["name"], "error": f"Invalid selection for {opt.get('name', 'option')}."})
                        continue
                    raw_addon = int(round(float(val.get("add_on", val.get("price", 0)) or 0)))
                    basis = opt.get("price_basis", "per_unit")
                    pcs_per_unit = max(1, int((custom_cfg.get("unit_definition") or {}).get("pcs_per_unit", 10) or 10))
                    multiplier = qty if basis == "per_pcs" else max(1, (qty + pcs_per_unit - 1) // pcs_per_unit)
                    addon = raw_addon * multiplier
                    option_addons += addon
                    option_details.append({"option_id": opt.get("id"), "option": opt.get("name"), "value_id": val.get("id"), "value": val.get("label"), "add_on": addon, "unit_add_on": raw_addon, "price_basis": basis})

            # Size selection is first-class for print products. Standard presets have no surcharge;
            # custom dimensions can use a fixed surcharge or price-per-cm².
            size_cfg = custom_cfg.get("size") or {}
            size_input = it.get("custom_size")
            size_addon = 0
            normalized_size = None
            if size_cfg.get("enabled"):
                if not size_input:
                    errors.append({"product_id": prod["id"], "name": prod["name"], "error": "Please select a size."})
                else:
                    unit = size_cfg.get("unit", "mm")
                    try:
                        w = float(size_input.get("width")); h = float(size_input.get("height"))
                    except (TypeError, ValueError):
                        w = h = 0
                    is_custom_size = bool(size_input.get("custom"))
                    if is_custom_size:
                        min_w, max_w = float(size_cfg.get("min_width", 20)), float(size_cfg.get("max_width", 1000))
                        min_h, max_h = float(size_cfg.get("min_height", 20)), float(size_cfg.get("max_height", 1000))
                        if w <= 0 or h <= 0 or w < min_w or w > max_w or h < min_h or h > max_h:
                            errors.append({"product_id": prod["id"], "name": prod["name"], "error": f"Custom size must be within {min_w:g}–{max_w:g} × {min_h:g}–{max_h:g} {unit}."})
                        elif size_cfg.get("pricing_mode") == "per_area":
                            factor = 0.01 if unit == "mm" else (2.54 if unit == "in" else 1)
                            area_cm2 = w * factor * h * factor
                            size_addon = max(float(size_cfg.get("min_price", 0) or 0), area_cm2 * float(size_cfg.get("price_per_area", 0) or 0))
                        else:
                            size_addon = float(size_cfg.get("min_price", 0) or 0)
                        basis = size_cfg.get("price_basis") or size_cfg.get("display_basis") or "per_unit"
                        if basis == "pcs": basis = "per_pcs"
                        elif basis == "unit": basis = "per_unit"
                        pcs_per_unit = max(1, int((custom_cfg.get("unit_definition") or {}).get("pcs_per_unit", 10) or 10))
                        multiplier = qty if basis == "per_pcs" else max(1, (qty + pcs_per_unit - 1) // pcs_per_unit)
                        size_addon *= multiplier
                        normalized_size = {"custom": True, "width": w, "height": h, "unit": unit}
                    else:
                        preset = next((sp for sp in size_cfg.get("presets", []) if sp.get("id") == size_input.get("preset_id")), None)
                        if not preset:
                            errors.append({"product_id": prod["id"], "name": prod["name"], "error": "Invalid size selection."})
                        else:
                            normalized_size = {"preset_id": preset.get("id"), "label": preset.get("label"), "width": float(preset.get("width")), "height": float(preset.get("height")), "unit": unit}
                            raw_size_price = float(preset.get("price", preset.get("add_on", 0)) or 0)
                            basis = size_cfg.get("price_basis") or size_cfg.get("display_basis") or "per_unit"
                            if basis == "pcs": basis = "per_pcs"
                            elif basis == "unit": basis = "per_unit"
                            pcs_per_unit = max(1, int((custom_cfg.get("unit_definition") or {}).get("pcs_per_unit", 10) or 10))
                            multiplier = qty if basis == "per_pcs" else max(1, (qty + pcs_per_unit - 1) // pcs_per_unit)
                            size_addon = raw_size_price * multiplier

            pricing = custom_cfg.get("pricing") or {}
            mode = pricing.get("mode", "base_addons")
            pricing_model = pricing.get("pricing_model", "unit_price")
            unit_price = base_price
            custom_order_total = None

            # New print-product builder pricing model: quantity rows are total order prices,
            # then selected option and size charges are added once. The resulting server unit
            # price is normalized so existing cart/checkout UIs can continue to use price * qty.
            if pricing_model == "order_total":
                if mode not in ("quantity", "base_addons"):
                    errors.append({"product_id": prod["id"], "name": prod["name"], "error": "Invalid pricing method configured for this product."})
                    continue
                tiers = sorted(pricing.get("quantity_tiers") or [], key=lambda x: int(x.get("min_quantity", x.get("quantity", 0)) or 0))
                selected_tier = None
                for tier in tiers:
                    tq = int(tier.get("quantity", tier.get("min_quantity", 0)) or 0)
                    tp = float(tier.get("price", 0) or 0)
                    if tq > 0 and tq <= qty and tp >= 0:
                        selected_tier = (tq, tp)
                if selected_tier:
                    tq, tp = selected_tier
                    selected_quantity_tier = {"quantity": tq, "price": int(round(tp))}
                    if qty == tq:
                        custom_order_total = tp
                    elif pricing.get("allow_custom_quantity", True):
                        custom_order_total = round((qty / tq) * tp)
                elif tiers and pricing.get("allow_custom_quantity", True):
                    tq = int(tiers[0].get("quantity", tiers[0].get("min_quantity", 0)) or 0)
                    tp = float(tiers[0].get("price", 0) or 0)
                    custom_order_total = round((qty / tq) * tp) if tq > 0 else 0
                elif not tiers:
                    custom_order_total = float(base_price)
                if custom_order_total is None:
                    errors.append({"product_id": prod["id"], "name": prod["name"], "error": "Please choose one of the available quantities."})
                    continue
                custom_order_total += option_addons + int(round(size_addon))
                custom_order_total = max(0, int(round(custom_order_total)))
                unit_price = round(custom_order_total / qty) if qty > 0 else custom_order_total
            elif mode == "base_addons":
                unit_price = base_price + option_addons + int(round(size_addon))
            elif mode == "quantity":
                tiers = sorted(pricing.get("quantity_tiers") or [], key=lambda x: int(x.get("min_quantity", 0) or 0))
                for tier in tiers:
                    if int(tier.get("min_quantity", 0) or 0) <= qty and float(tier.get("price", 0) or 0) > 0:
                        unit_price = int(round(float(tier["price"])))
                        selected_quantity_tier = {"quantity": int(tier.get("min_quantity", 0) or 0), "price": unit_price}
                unit_price += option_addons + int(round(size_addon))
            elif mode == "combination":
                unit_price = 0
                for rule in pricing.get("rules") or []:
                    rq = int(rule.get("min_quantity", 1) or 1)
                    mx = rule.get("max_quantity")
                    if qty < rq or (mx is not None and mx != "" and qty > int(mx)):
                        continue
                    selections = rule.get("selections") or {}
                    if all(not expected or selection.get(oid) == expected for oid, expected in selections.items()):
                        candidate = int(round(float(rule.get("price") or 0)))
                        if candidate > 0:
                            unit_price = candidate
                            break
                if unit_price <= 0:
                    errors.append({"product_id": prod["id"], "name": prod["name"], "error": "This customization and quantity combination is not available."})
                    continue
                unit_price += int(round(size_addon))
            else:
                errors.append({"product_id": prod["id"], "name": prod["name"], "error": "Invalid pricing method configured for this product."})
                continue

            artwork = it.get("artwork") or []
            artwork_cfg = custom_cfg.get("artwork") or {}
            if artwork_cfg.get("enabled") and artwork_cfg.get("required") and not artwork:
                errors.append({"product_id": prod["id"], "name": prod["name"], "error": "Please upload your design file before placing the order."})
            max_files = max(1, int(artwork_cfg.get("max_files", 1) or 1))
            if len(artwork) > max_files:
                errors.append({"product_id": prod["id"], "name": prod["name"], "error": f"Maximum {max_files} artwork file(s) allowed."})
            allowed_formats = set((artwork_cfg.get("formats") or ["pdf", "jpg", "jpeg", "png"]))
            max_artwork_bytes = max(1, int(artwork_cfg.get("max_size_mb", 20) or 20)) * 1024 * 1024
            for asset in artwork:
                filename = str(asset.get("filename") or "")
                ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
                if ext and ext not in allowed_formats:
                    errors.append({"product_id": prod["id"], "name": prod["name"], "error": f"Artwork format .{ext} is not allowed."})
                try:
                    asset_size = int(asset.get("size") or 0)
                except (TypeError, ValueError):
                    asset_size = 0
                if asset_size > max_artwork_bytes:
                    errors.append({"product_id": prod["id"], "name": prod["name"], "error": f"Artwork file exceeds the {int(artwork_cfg.get('max_size_mb', 20) or 20)}MB limit."})
            price = unit_price
        else:
            price = bulk_unit_price(prod, qty, base_price)

        unit_cost = (variant or {}).get("cost_price", prod.get("cost_price", 0)) if variant else prod.get("cost_price", 0)
        try:
            unit_cost = float(unit_cost or 0)
        except (TypeError, ValueError):
            unit_cost = 0.0
        gift_wrap = bool(it.get("gift_wrap"))
        wrap_price = 199 if gift_wrap else 0
        bulk_config = prod.get("bulk_order") or {}
        applicable_bulk_tier = None
        if not is_custom and bulk_config.get("enabled"):
            selected_tier_qty = int(it.get("bulk_tier_quantity") or 0)
            for tier in bulk_config.get("tiers") or []:
                try:
                    tier_qty = int(tier.get("min_quantity", 0))
                    tier_price = int(round(float(tier.get("price"))))
                except (TypeError, ValueError):
                    continue
                if tier_qty == selected_tier_qty and tier_price == int(price):
                    applicable_bulk_tier = {"min_quantity": tier_qty, "price": tier_price}
                    break
            if applicable_bulk_tier is None:
                for tier in sorted((bulk_config.get("tiers") or []), key=lambda t: int(t.get("min_quantity", 0) or 0), reverse=True):
                    try:
                        tier_qty = int(tier.get("min_quantity", 0))
                        tier_price = int(round(float(tier.get("price"))))
                    except (TypeError, ValueError):
                        continue
                    if tier_qty <= qty and tier_qty >= int(bulk_config.get("min_quantity", 0) or 0) and tier_price == int(price):
                        applicable_bulk_tier = {"min_quantity": tier_qty, "price": tier_price}
                        break
        bulk_enabled_for_line = bool(not is_custom and bulk_config.get("enabled") and qty >= int(bulk_config.get("min_quantity", 0) or 0) and price != int(base_price))
        bulk_savings = max(0, (int(base_price) - int(price)) * qty) if bulk_enabled_for_line else 0

        custom_detail = None
        if is_custom:
            pcs_per_unit = max(1, int((custom_cfg.get("unit_definition") or {}).get("pcs_per_unit", 10) or 10))
            quantity_base_total = (int(custom_order_total) - int(round(option_addons)) - int(round(size_addon))) if custom_order_total is not None else int(round(unit_price - option_addons - size_addon)) * qty
            custom_detail = {
                "selections": selection,
                "options": option_details,
                "option_addons": int(round(option_addons)),
                "size": normalized_size,
                "size_addon": int(round(size_addon)),
                "quantity": qty,
                "unit_definition": {"pcs_per_unit": pcs_per_unit, "label": (custom_cfg.get("unit_definition") or {}).get("label", "Unit")},
                "pricing_model": pricing_model,
                "quantity_tier": selected_quantity_tier,
                "quantity_base_total": max(0, int(round(quantity_base_total))),
                "custom_total": int(custom_order_total) if custom_order_total is not None else None,
                "unit_price": int(price),
            }
        lines.append({
            "product_id": prod["id"], "name": prod["name"], "slug": prod["slug"],
            "image": (prod.get("images") or [None])[0], "sku": prod.get("sku"),
            "variant_id": it.get("variant_id"), "variant_label": (variant or {}).get("label") if variant else None,
            "product_type": "customizable" if is_custom else "standard",
            "price": price, "base_price": base_price, "custom_total": int(custom_order_total) if custom_order_total is not None else None, "cost_price": unit_cost, "qty": qty, "requested_qty": qty,
            "customization": custom_detail,
            "artwork": artwork if is_custom else [],
            "artwork_status": ("Artwork Received" if artwork else "Awaiting Artwork") if is_custom else None,
            "bulk_order": {"enabled": bool(bulk_config.get("enabled")), "applied": bulk_enabled_for_line,
                           "min_quantity": int(bulk_config.get("min_quantity", 0) or 0), "tiers": bulk_config.get("tiers", []),
                           "selected_tier_quantity": applicable_bulk_tier["min_quantity"] if applicable_bulk_tier else None,
                           "selected_tier_unit_price": applicable_bulk_tier["price"] if applicable_bulk_tier else None,
                           "regular_unit_price": int(base_price), "savings": bulk_savings},
            "gift_wrap": gift_wrap, "wrap_price": wrap_price,
            "personalization": it.get("personalization") or None,
            "line_total": (int(custom_order_total) if custom_order_total is not None else price * qty) + wrap_price,
            "regular_line_total": (int(base_price) if custom_order_total is not None else (int(prod.get("compare_at_price")) if (prod.get("compare_at_price") or 0) > base_price else int(base_price)) * qty),
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
    regular_total = 0
    for l in lines:
        fallback_regular = ((l.get("compare_at_price") if (l.get("compare_at_price") or 0) > (l.get("base_price") or l["price"]) else (l.get("base_price") or l["price"])) * l["qty"])
        regular_total += int(l.get("regular_line_total", fallback_regular))
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
