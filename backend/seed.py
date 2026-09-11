"""Idempotent seed data for ARTFUL. No fabricated reviews / testimonials / business claims."""
import uuid
from datetime import datetime, timezone
from db import db

U = "https://images.unsplash.com/"
CERAMIC = [U+"photo-1631125915973-e0d155a14e4e?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
           U+"photo-1677761640321-b80251be00ca?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
           U+"photo-1631125915902-d8abe9225ff2?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
           U+"photo-1627042493632-fa4d12ff3b01?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000"]
CANDLE = [U+"photo-1602036610820-7d9e92f17a78?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
          U+"photo-1602036598416-5604b2e2a7ed?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
          U+"photo-1603218678692-3967d7523bb0?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
          U+"photo-1603905179139-db12ab535ca9?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000"]
JOURNAL = [U+"photo-1677064061401-f77f966ff8a1?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
           U+"photo-1720534195942-d55d1760df95?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
           U+"photo-1654542645651-5196f4931cd6?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
           U+"photo-1583341655648-78bdf4ed6d13?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000"]
GIFTBOX = [U+"photo-1592903297149-37fb25202dfa?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
           U+"photo-1625552186152-668cd2f0b707?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
           U+"photo-1674620213535-9b2a2553ef40?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
           U+"photo-1668127494486-f27a1d2b88f9?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000"]
JEWEL = [U+"photo-1506630448388-4e683c67ddb0?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
         U+"photo-1561828995-aa79a2db86dd?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
         U+"photo-1682823545338-96b6ac5802da?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000"]
WALLART = [U+"photo-1452457005517-a0dd81caca2a?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
           U+"photo-1598240087583-2f610faf1eaf?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
           U+"photo-1676107981869-2521b9c407ad?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000"]
DESK = [U+"photo-1618381801643-3d253a63a386?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
        U+"photo-1595351475754-8a520e0bc3a3?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
        U+"photo-1700451761309-656bd9439443?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000"]
DECOR = [U+"photo-1526057372486-90c2459c301b?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
         U+"photo-1572048572872-2394404cf1f3?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
         U+"photo-1760863264233-99639e897e36?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600"]
HERO = U+"photo-1592903297149-37fb25202dfa?crop=entropy&cs=srgb&fm=jpg&q=85&w=1800"


def now():
    return datetime.now(timezone.utc).isoformat()


CATEGORIES = [
    ("Artistic Gifts", "artistic-gifts", "Thoughtfully curated objects that carry emotion and craft.", GIFTBOX[0]),
    ("Personalized Gifts", "personalized-gifts", "Made yours with names, initials and heartfelt messages.", JOURNAL[0]),
    ("Home Décor", "home-decor", "Sculptural pieces that bring warmth to everyday spaces.", CERAMIC[0]),
    ("Premium Stationery", "stationery", "Beautiful journals and paper for the joy of writing.", JOURNAL[1]),
    ("Handmade Jewellery", "jewellery", "Delicate, minimal pieces made by hand.", JEWEL[1]),
    ("Candles & Fragrance", "candles", "Hand-poured candles for slow, serene evenings.", CANDLE[2]),
    ("Desk Accessories", "desk-accessories", "Considered objects for a calmer workspace.", DESK[0]),
    ("Wall Art", "wall-art", "Prints and frames to tell your walls a story.", WALLART[0]),
]

# name, slug, cat_slug, price, compare_at, imgs, tags, occasion, recipient, material, color, badges, stock, personalize
PRODUCTS = [
    ("Hand-thrown Ceramic Vase", "hand-thrown-ceramic-vase", "home-decor", 1899, 2499, CERAMIC[:2], ["vase","ceramic","handmade","decor"], ["housewarming","anniversary"], ["her","couple"], "Stoneware Ceramic", "Ivory", ["Bestseller"], 24, False),
    ("Sculpted Clay Vase Trio", "sculpted-clay-vase-trio", "home-decor", 3299, 3999, [CERAMIC[2],CERAMIC[0]], ["vase","ceramic","set","decor"], ["housewarming"], ["couple","her"], "Terracotta", "Terracotta", ["Featured"], 12, False),
    ("Matte Bud Vase", "matte-bud-vase", "home-decor", 999, None, [CERAMIC[3],CERAMIC[1]], ["vase","ceramic","minimal"], ["birthday","housewarming"], ["her","friend"], "Ceramic", "Sand", ["New"], 40, False),
    ("Soy Wax Candle — Amber & Oud", "soy-candle-amber-oud", "candles", 899, 1099, [CANDLE[0],CANDLE[3]], ["candle","fragrance","soy","amber"], ["anniversary","birthday","festive"], ["her","him","couple"], "Soy Wax", "Charcoal", ["Bestseller"], 60, False),
    ("Ceramic Jar Candle — Fig & Cedar", "ceramic-candle-fig-cedar", "candles", 1199, None, [CANDLE[1],CANDLE[2]], ["candle","fragrance","ceramic","cedar"], ["housewarming","festive"], ["her","couple"], "Ceramic + Soy Wax", "Cream", ["New"], 35, False),
    ("Trio Candle Gift Set", "trio-candle-gift-set", "candles", 2199, 2699, [CANDLE[2],CANDLE[1]], ["candle","gift","set","fragrance"], ["birthday","anniversary","festive","corporate"], ["her","him","couple"], "Soy Wax", "Assorted", ["Featured","Sale"], 20, True),
    ("Handbound Leather Journal", "handbound-leather-journal", "stationery", 1499, 1899, [JOURNAL[0],JOURNAL[3]], ["journal","notebook","leather","stationery"], ["birthday","corporate"], ["him","her","colleague"], "Full-grain Leather", "Cognac", ["Bestseller"], 30, True),
    ("Forest Green Softbound Journal", "forest-green-journal", "stationery", 1099, None, [JOURNAL[2],JOURNAL[1]], ["journal","notebook","stationery"], ["birthday"], ["her","friend"], "Vegan Leather", "Forest Green", ["New"], 45, True),
    ("Everyday Writing Notebook", "everyday-writing-notebook", "stationery", 699, 899, [JOURNAL[1],JOURNAL[0]], ["notebook","journal","stationery","paper"], ["corporate"], ["colleague","him"], "Recycled Paper", "Kraft", ["Sale"], 80, False),
    ("Personalized Keepsake Gift Box", "personalized-keepsake-box", "personalized-gifts", 2499, 2999, [GIFTBOX[0],GIFTBOX[1]], ["gift","box","personalized","keepsake"], ["anniversary","wedding","birthday"], ["her","couple","wife"], "Assorted", "Blush", ["Bestseller","Featured"], 18, True),
    ("Monogrammed Gift Hamper", "monogrammed-gift-hamper", "personalized-gifts", 3499, 3999, [GIFTBOX[2],GIFTBOX[3]], ["gift","hamper","personalized","monogram"], ["corporate","wedding","festive"], ["couple","colleague"], "Assorted", "Midnight", ["Featured"], 14, True),
    ("Custom Name Necklace", "custom-name-necklace", "jewellery", 1799, 2199, [JEWEL[0],JEWEL[2]], ["jewellery","necklace","personalized","gold"], ["birthday","anniversary","valentine"], ["her","girlfriend","wife"], "Gold-plated Brass", "Gold", ["Bestseller","New"], 26, True),
    ("Minimal Gold Pendant", "minimal-gold-pendant", "jewellery", 1499, None, [JEWEL[1],JEWEL[0]], ["jewellery","pendant","minimal","gold"], ["birthday","valentine"], ["her","girlfriend"], "Gold-plated Silver", "Gold", ["New"], 33, False),
    ("Handmade Charm Earrings", "handmade-charm-earrings", "jewellery", 1299, 1599, [JEWEL[2],JEWEL[1]], ["jewellery","earrings","handmade"], ["birthday","anniversary"], ["her","friend"], "Sterling Silver", "Silver", ["Sale"], 22, False),
    ("Abstract Framed Art Print", "abstract-framed-art-print", "wall-art", 2299, 2799, [WALLART[1],WALLART[0]], ["art","print","frame","abstract","decor"], ["housewarming","corporate"], ["couple","him"], "Giclée Print + Oak Frame", "Multicolour", ["Featured"], 16, False),
    ("Botanical Line Art Set", "botanical-line-art-set", "wall-art", 1699, 1999, [WALLART[0],WALLART[2]], ["art","print","botanical","set","decor"], ["housewarming"], ["her","couple"], "Fine Art Paper", "Neutral", ["New"], 28, False),
    ("Framed Minimal Print", "framed-minimal-print", "wall-art", 1299, None, [WALLART[2],WALLART[1]], ["art","print","minimal","frame"], ["housewarming","birthday"], ["her","friend"], "Print + Frame", "Warm White", [], 34, False),
    ("Oak Desk Organizer", "oak-desk-organizer", "desk-accessories", 1599, 1899, [DESK[0],DESK[2]], ["desk","wood","organizer","office"], ["corporate","birthday"], ["him","colleague"], "Solid Oak", "Natural Oak", ["Bestseller"], 21, True),
    ("Wooden Pen & Card Stand", "wooden-pen-card-stand", "desk-accessories", 999, 1199, [DESK[2],DESK[1]], ["desk","wood","pen","stand"], ["corporate"], ["him","colleague"], "Walnut", "Walnut", ["Sale"], 38, True),
    ("Ceramic Desk Planter", "ceramic-desk-planter", "desk-accessories", 799, None, [DESK[1],DESK[0]], ["desk","planter","ceramic","office"], ["housewarming","corporate"], ["her","him","colleague"], "Ceramic", "White", ["New"], 50, False),
    ("Curated Artisan Gift Box", "curated-artisan-gift-box", "artistic-gifts", 2999, 3599, [GIFTBOX[1],GIFTBOX[0]], ["gift","box","curated","artisan","hamper"], ["anniversary","birthday","festive","corporate"], ["her","him","couple"], "Assorted", "Rose", ["Bestseller","Featured"], 19, True),
    ("Little Joys Gift Box", "little-joys-gift-box", "artistic-gifts", 1499, 1799, [GIFTBOX[3],GIFTBOX[2]], ["gift","box","small","artistic"], ["birthday","corporate"], ["colleague","friend"], "Assorted", "Charcoal", ["Sale"], 42, True),
    ("Festive Celebration Hamper", "festive-celebration-hamper", "artistic-gifts", 3999, 4699, [GIFTBOX[2],GIFTBOX[1]], ["gift","hamper","festive","premium"], ["festive","diwali","corporate"], ["couple","colleague"], "Assorted", "Gold", ["Featured","Limited"], 10, True),
    ("Terracotta Table Sculpture", "terracotta-table-sculpture", "home-decor", 1399, None, [DECOR[0],DECOR[1]], ["decor","sculpture","terracotta","table"], ["housewarming"], ["couple","her"], "Terracotta", "Terracotta", ["New"], 27, False),
]

COLLECTIONS = [
    ("New Arrivals", "new-arrivals", "The latest additions to the ARTFUL edit.", DECOR[2], "dynamic", {"badge": "New"}),
    ("Bestsellers", "bestsellers", "Loved most by the ARTFUL community.", GIFTBOX[0], "dynamic", {"badge": "Bestseller"}),
    ("Birthday Gifts", "birthday-gifts", "Make their day unforgettable.", CANDLE[0], "dynamic", {"occasion": "birthday"}),
    ("Gifts for Her", "gifts-for-her", "Beautiful pieces she'll treasure.", JEWEL[1], "dynamic", {"recipient": "her"}),
    ("Personalized Gifts", "personalized-gifts-collection", "Add a name, initials or a message.", JOURNAL[0], "dynamic", {"tag": "personalized"}),
    ("Festive Gifts", "festive-gifts", "Celebrate the season in style.", GIFTBOX[2], "dynamic", {"occasion": "festive"}),
]

HOMEPAGE_SECTIONS = [
    {"key": "hero", "type": "hero", "enabled": True, "order": 1,
     "heading": "Thoughtfully made. Beautifully given.",
     "subheading": "Handcrafted lifestyle objects and bespoke gift boxes, created to elevate life's gentle celebrations.",
     "image": HERO, "cta_text": "Shop Gifts", "cta_link": "/collections/bestsellers",
     "cta_secondary_text": "Explore Collections", "cta_secondary_link": "/collections"},
    {"key": "featured_categories", "type": "categories", "enabled": True, "order": 2,
     "heading": "Explore by Category", "subheading": "Find the perfect piece for every moment.", "items": []},
    {"key": "bestsellers", "type": "product_rail", "enabled": True, "order": 3,
     "heading": "Bestsellers", "subheading": "Loved most by the ARTFUL community.", "collection_slug": "bestsellers"},
    {"key": "new_arrivals", "type": "product_rail", "enabled": True, "order": 4,
     "heading": "New Arrivals", "subheading": "The latest additions to our edit.", "collection_slug": "new-arrivals"},
    {"key": "gift_by_occasion", "type": "occasion", "enabled": True, "order": 5,
     "heading": "Gift by Occasion", "subheading": "Thoughtful gifting, made simple.",
     "items": [{"label": "Birthday", "link": "/collections/birthday-gifts"},
               {"label": "Anniversary", "link": "/search?q=anniversary+gift"},
               {"label": "Housewarming", "link": "/search?q=housewarming"},
               {"label": "Festive", "link": "/collections/festive-gifts"},
               {"label": "Corporate", "link": "/corporate-gifting"}]},
    {"key": "featured_collection", "type": "banner", "enabled": True, "order": 6,
     "heading": "The Personalized Edit", "subheading": "Add a name, initials, or a handwritten note. Make it unmistakably theirs.",
     "image": DECOR[2], "cta_text": "Shop Personalized", "cta_link": "/collections/personalized-gifts-collection"},
    {"key": "brand_story", "type": "story", "enabled": True, "order": 7,
     "heading": "The ARTFUL Story", "subheading": "We partner with independent makers to bring you objects with soul — pieces designed to be given, kept, and remembered.",
     "image": DECOR[2], "cta_text": "Our Story", "cta_link": "/our-story"},
    {"key": "why_artful", "type": "values", "enabled": True, "order": 8,
     "heading": "Why ARTFUL",
     "items": [{"title": "Handcrafted", "desc": "Made in small batches by independent artisans."},
               {"title": "Thoughtful Packaging", "desc": "Every order arrives gift-ready, beautifully wrapped."},
               {"title": "Made Personal", "desc": "Add names, initials and handwritten notes."},
               {"title": "Made to Last", "desc": "Considered materials chosen to be treasured."}]},
    {"key": "newsletter", "type": "newsletter", "enabled": True, "order": 9,
     "heading": "Join the ARTFUL circle", "subheading": "Be first to see new arrivals and seasonal edits."},
]

FAQS = [
    ("Orders & Shipping", "How long will my order take to arrive?", "Orders are typically dispatched within 2 business days. Delivery estimates are shown at checkout based on your pincode."),
    ("Orders & Shipping", "Do you offer gift wrapping?", "Yes — most products can be gift-wrapped at checkout, and we include a complimentary handwritten note on request."),
    ("Personalization", "How does personalization work?", "On eligible products you can add a name, initials or a short message. Personalized items may take slightly longer to craft."),
    ("Returns", "What is your return policy?", "Unused, non-personalized items in original packaging can be returned within 7 days of delivery. Personalized items are non-returnable."),
    ("Payments", "Which payment methods do you accept?", "We accept UPI, cards, net banking and wallets through our secure payment gateway."),
    ("Account", "Do I need an account to order?", "No. You can check out as a guest with just your mobile number. An account is created automatically so you can track orders anytime."),
]

PAGES = [
    ("about", "About ARTFUL", "ARTFUL brings art, emotion and thoughtful gifting together. We curate beautiful, handcrafted objects designed to be given and treasured."),
    ("our-story", "Our Story", "ARTFUL began with a simple belief — that the most meaningful gifts carry a story. We work with independent makers to create objects with soul."),
    ("contact", "Contact Us", "We'd love to hear from you. Reach our care team through the contact form and we'll respond within 1–2 business days."),
    ("shipping", "Shipping", "We ship across India. Orders are dispatched within 2 business days. Delivery timelines are shown at checkout based on your pincode."),
    ("returns", "Returns & Refunds", "Unused, non-personalized items can be returned within 7 days of delivery. Refunds are processed to the original payment method after inspection."),
    ("privacy", "Privacy Policy", "We respect your privacy. We collect only the information needed to fulfil your orders and never sell your personal data."),
    ("terms", "Terms & Conditions", "By using ARTFUL you agree to our terms of service. Please read them carefully before placing an order."),
    ("corporate-gifting", "Corporate Gifting", "Elevate your corporate gifting with curated, brandable hampers. Share your requirement and our team will craft a bespoke proposal."),
]

COUPONS = [
    {"code": "WELCOME10", "type": "percentage", "value": 10, "min_cart": 999, "max_discount": 500,
     "first_time_only": True, "usage_limit": None, "per_customer_limit": 1, "status": "Active",
     "description": "10% off your first order (up to ₹500)."},
    {"code": "ARTFUL15", "type": "percentage", "value": 15, "min_cart": 2500, "max_discount": 1000,
     "first_time_only": False, "usage_limit": None, "per_customer_limit": None, "status": "Active",
     "description": "15% off orders above ₹2,500 (up to ₹1,000)."},
    {"code": "FLAT200", "type": "flat", "value": 200, "min_cart": 1500, "max_discount": None,
     "first_time_only": False, "usage_limit": None, "per_customer_limit": None, "status": "Active",
     "description": "Flat ₹200 off orders above ₹1,500."},
    {"code": "FREESHIP", "type": "free_shipping", "value": 0, "min_cart": 0, "max_discount": None,
     "first_time_only": False, "usage_limit": None, "per_customer_limit": None, "status": "Active",
     "description": "Free shipping on any order."},
]

SYNONYMS = [
    {"term": "present", "correct": "gift"}, {"term": "bday", "correct": "birthday"},
    {"term": "mom", "correct": "mother"}, {"term": "custom", "correct": "personalized"},
    {"term": "decor", "correct": "decor"}, {"term": "notebook", "correct": "journal"},
]
CORRECTIONS = [
    {"wrong": "jwellery", "correct": "jewellery"}, {"wrong": "candel", "correct": "candle"},
    {"wrong": "candell", "correct": "candle"}, {"wrong": "statinary", "correct": "stationery"},
    {"wrong": "anniversery", "correct": "anniversary"}, {"wrong": "persnalized", "correct": "personalized"},
    {"wrong": "stationary", "correct": "stationery"},
]

SETTINGS = {
    "id": "store",
    "store_name": "ARTFUL",
    "currency": "INR", "currency_symbol": "₹", "locale": "en-IN",
    "announcement_enabled": True,
    "announcement_text": "Complimentary handwritten gift card on orders above ₹999",
    "guest_checkout": True, "cod_enabled": True, "cod_fee": 99,
    "free_shipping_threshold": 999, "shipping_flat": 79,
    "tax_rate": 0, "tax_inclusive": True,
    "contact_email": "care@artful.com", "contact_phone": "+91 90000 00000",
    "whatsapp_number": "+91 90000 00000",
    "office_address": "ARTFUL Studio, 4th Floor, Design District, Bandra West, Mumbai 400050, India",
    "office_hours": "Mon – Sat · 10:00 AM – 7:00 PM IST",
    "social": {"instagram": "https://instagram.com/artful",
               "facebook": "https://facebook.com/artful",
               
               "pinterest": "https://pinterest.com/artful"},
    
    "seo_title": "ARTFUL — Thoughtfully made. Beautifully given.",
    "seo_description": "Premium artistic lifestyle & thoughtful gifting. Handcrafted objects and bespoke gift boxes.",
}


async def seed():
    if await db.settings.find_one({"id": "store"}) is None:
        await db.settings.insert_one({**SETTINGS})
    else:
        # backfill any newly-added settings keys without overwriting admin edits
        existing = await db.settings.find_one({"id": "store"})
        missing = {k: v for k, v in SETTINGS.items() if k not in existing}
        if missing:
            await db.settings.update_one({"id": "store"}, {"$set": missing})

    if await db.categories.count_documents({}) == 0:
        for i, (name, slug, desc, img) in enumerate(CATEGORIES):
            await db.categories.insert_one({
                "id": str(uuid.uuid4()), "name": name, "slug": slug, "description": desc,
                "image": img, "parent_id": None, "order": i, "status": "Active",
                "seo": {"title": f"{name} — ARTFUL", "description": desc}, "created_at": now()})

    if await db.products.count_documents({}) == 0:
        for p in PRODUCTS:
            (name, slug, cat, price, cmp, imgs, tags, occ, rec, mat, col, badges, stock, personalize) = p
            await db.products.insert_one({
                "id": str(uuid.uuid4()), "name": name, "slug": slug,
                "short_description": f"{name} — a handcrafted ARTFUL piece.",
                "description": f"{name}. Crafted in small batches from {mat.lower()}, this piece brings quiet craft and warmth to every occasion. Thoughtfully finished and gift-ready.",
                "images": imgs, "video": None, "price": price, "compare_at_price": cmp,
                "cost_price": round(price * 0.5), "sku": slug.upper().replace("-", "")[:14],
                "barcode": None, "category_slug": cat, "collection_slugs": [],
                "tags": tags, "material": mat, "color": col,
                "dimensions": "Varies by piece", "weight": "0.5–1.5 kg",
                "care": "Wipe clean with a soft dry cloth. Handle with care.",
                "shipping_info": "Dispatched within 2 business days.",
                "stock": stock, "reserved": 0, "low_stock_threshold": 5,
                "status": "Active", "badges": badges, "occasion": occ, "recipient": rec,
                "rating": 0, "review_count": 0, "variants": [],
                "personalization": {"enabled": personalize, "char_limit": 30, "extra_price": 0,
                                    "processing_days": 2, "label": "Add a name / message"},
                "seo": {"title": f"{name} — ARTFUL", "description": f"{name}. Handcrafted premium gifting."},
                "views": 0, "sales_count": 0, "created_at": now(), "updated_at": now()})

    if await db.collections.count_documents({}) == 0:
        for i, (name, slug, desc, img, ctype, rules) in enumerate(COLLECTIONS):
            await db.collections.insert_one({
                "id": str(uuid.uuid4()), "name": name, "slug": slug, "description": desc,
                "image": img, "banner": img, "type": ctype, "rules": rules, "product_ids": [],
                "status": "Active", "order": i,
                "seo": {"title": f"{name} — ARTFUL", "description": desc}, "created_at": now()})

    if await db.homepage_sections.count_documents({}) == 0:
        for s in HOMEPAGE_SECTIONS:
            await db.homepage_sections.insert_one({"id": str(uuid.uuid4()), **s})

    if await db.faqs.count_documents({}) == 0:
        for i, (cat, q, a) in enumerate(FAQS):
            await db.faqs.insert_one({"id": str(uuid.uuid4()), "category": cat, "question": q,
                                      "answer": a, "order": i, "status": "Active"})

    if await db.pages.count_documents({}) == 0:
        for slug, title, content in PAGES:
            await db.pages.insert_one({"id": str(uuid.uuid4()), "slug": slug, "title": title,
                                       "content": content,
                                       "seo": {"title": f"{title} — ARTFUL", "description": content[:150]},
                                       "status": "Active", "updated_at": now()})

    if await db.coupons.count_documents({}) == 0:
        for c in COUPONS:
            await db.coupons.insert_one({"id": str(uuid.uuid4()), **c, "used_count": 0,
                                         "stackable": False, "start_date": None, "end_date": None,
                                         "product_ids": [], "category_ids": [], "collection_ids": [],
                                         "created_at": now()})

    if await db.search_synonyms.count_documents({}) == 0:
        for s in SYNONYMS:
            await db.search_synonyms.insert_one({"id": str(uuid.uuid4()), **s})
    if await db.search_corrections.count_documents({}) == 0:
        for c in CORRECTIONS:
            await db.search_corrections.insert_one({"id": str(uuid.uuid4()), **c})

    # ---------------- Phase-1 migrations (idempotent) ----------------
    # 1) Force ARTFUL India contact details
    await db.settings.update_one({"id": "store"}, {"$set": {
        "office_address": "168, Netaji Subhash Marg, Martand Chowk, Ram Bagh, Indore, Madhya Pradesh 452007",
        "contact_phone": "+91 8871288853",
        "whatsapp_number": "+91 8871288853",
        "contact_email": "support@artful.com",
    }})

    # 2) Hero → admin-controlled carousel slides with per-slide trust badges
    hero = await db.homepage_sections.find_one({"key": "hero"})
    if hero and not hero.get("slides"):
        slides = [
            {"id": str(uuid.uuid4()),
             "heading": "Thoughtfully made. Beautifully given.",
             "subheading": "Handcrafted lifestyle objects and bespoke gift boxes, created to elevate life's gentle celebrations.",
             "image": HERO, "eyebrow": "Artisanal · Handcrafted · Gifting",
             "cta_text": "Shop Gifts", "cta_link": "/collections/bestsellers",
             "cta_secondary_text": "Explore Collections", "cta_secondary_link": "/collections",
             "badges": [
                 {"icon": "RefreshCw", "label": "7-Day Easy Returns"},
                 {"icon": "Award", "label": "Best Quality"},
                 {"icon": "BadgeIndianRupee", "label": "Best Price"},
             ]},
            {"id": str(uuid.uuid4()),
             "heading": "Make it unmistakably theirs.",
             "subheading": "Add a name, initials or a handwritten note. Personalisation that turns a gift into a keepsake.",
             "image": DECOR[2], "eyebrow": "Personalised · Made to Order",
             "cta_text": "Shop Personalised", "cta_link": "/collections/personalized-gifts-collection",
             "cta_secondary_text": "How It Works", "cta_secondary_link": "/our-story",
             "badges": [
                 {"icon": "PenTool", "label": "Custom Engraving"},
                 {"icon": "Gift", "label": "Gift-Ready Packaging"},
                 {"icon": "Truck", "label": "Fast Dispatch"},
             ]},
            {"id": str(uuid.uuid4()),
             "heading": "Gifting for every occasion.",
             "subheading": "From birthdays to corporate hampers — curated edits that make choosing effortless.",
             "image": GIFTBOX[1], "eyebrow": "Curated Edits",
             "cta_text": "Explore Occasions", "cta_link": "/collections/festive-gifts",
             "cta_secondary_text": "Corporate Gifting", "cta_secondary_link": "/corporate-gifting",
             "badges": [
                 {"icon": "ShieldCheck", "label": "100% Trusted"},
                 {"icon": "Star", "label": "Loved by 1000+"},
                 {"icon": "HeartHandshake", "label": "Handpicked"},
             ]},
        ]
        await db.homepage_sections.update_one({"key": "hero"}, {"$set": {"slides": slides}})

    # 3) Richer "Why ARTFUL" values with icons
    await db.homepage_sections.update_one({"key": "why_artful"}, {"$set": {
        "heading": "Why ARTFUL",
        "subheading": "Small-batch craft, thoughtful details, and a promise on every order.",
        "items": [
            {"title": "Handcrafted", "desc": "Made in small batches by independent Indian artisans.", "icon": "Hand"},
            {"title": "Thoughtful Packaging", "desc": "Every order arrives gift-ready, beautifully wrapped.", "icon": "Gift"},
            {"title": "Made Personal", "desc": "Add names, initials and handwritten notes.", "icon": "PenTool"},
            {"title": "Made to Last", "desc": "Considered materials chosen to be treasured.", "icon": "ShieldCheck"},
        ],
    }})

    # 4) Replace the generic newsletter section with a meaningful "promise" band
    await db.homepage_sections.update_one({"key": "newsletter"}, {"$set": {
        "type": "promise", "enabled": True,
        "heading": "The ARTFUL Promise",
        "subheading": "Every piece is backed by craft, care and a commitment to make gifting effortless.",
        "items": [
            {"title": "7-Day Easy Returns", "desc": "Changed your mind? Return within 7 days.", "icon": "RefreshCw"},
            {"title": "Secure Payments", "desc": "UPI, cards & net banking — safely processed.", "icon": "Lock"},
            {"title": "Pan-India Delivery", "desc": "Carefully packed and shipped across India.", "icon": "Truck"},
            {"title": "Real Human Support", "desc": "Talk to us on WhatsApp for gifting help.", "icon": "HeartHandshake"},
        ],
    }})

    # 5) Give categories clickable icons for the marquee
    CAT_ICONS = {
        "artistic-gifts": "Sparkles", "personalized-gifts": "PenTool", "home-decor": "Home",
        "stationery": "NotebookPen", "jewellery": "Gem", "candles": "Flame",
        "desk-accessories": "Briefcase", "wall-art": "Frame",
    }
    for slug, icon in CAT_ICONS.items():
        await db.categories.update_one({"slug": slug, "icon": {"$exists": False}}, {"$set": {"icon": icon}})

    # 6) Seed admin-editable CMS pages (About / Our Story / Contact) if missing
    CMS_PAGES = [
        {"slug": "about", "order": 1, "title": "About",
         "hero_eyebrow": "About ARTFUL", "hero_title": "Art, emotion and thoughtful gifting — together.",
         "hero_image": "https://images.unsplash.com/photo-1766499670904-edab815e8fe3?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600",
         "body_html": "<h2>A home for beautiful, meaningful objects</h2><p>ARTFUL curates handcrafted lifestyle pieces and bespoke gift boxes designed to be given and treasured. We believe the most meaningful gifts carry a story — of the hands that made them and the moment they mark.</p><p>From hand-thrown ceramics to personalised keepsakes, each piece is chosen for its craft and quiet beauty.</p>",
         "cards": [
            {"icon": "Sparkles", "title": "Artful by design", "desc": "Every object is chosen for its craft, character and quiet beauty."},
            {"icon": "HandHeart", "title": "Made by makers", "desc": "We work directly with independent artisans and small studios."},
            {"icon": "Gift", "title": "Made to be given", "desc": "Thoughtful packaging and personalisation on every eligible piece."},
            {"icon": "Leaf", "title": "Made to last", "desc": "Considered materials, chosen to be kept and treasured."}]},
        {"slug": "our-story", "order": 2, "title": "Our Story",
         "hero_eyebrow": "Our Story", "hero_title": "Crafted with intention, given with love.",
         "hero_image": "https://images.unsplash.com/photo-1595351298020-038700609878?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600",
         "body_html": "<p>ARTFUL began with a simple belief — that the most meaningful gifts carry a story. We set out to find objects with soul and share them with people who feel the same.</p>",
         "chapters": [
            {"title": "The beginning", "desc": "ARTFUL began with a simple belief — that the most meaningful gifts carry a story.", "image": "https://images.unsplash.com/photo-1534953342533-7711c98712be?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000"},
            {"title": "The makers", "desc": "We partner with independent artisans and small studios, championing slow, small-batch craft.", "image": "https://images.unsplash.com/photo-1522065893269-6fd20f6d7438?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000"},
            {"title": "The gift", "desc": "We obsess over the unboxing — considered packaging, a handwritten note, the option to make it personal.", "image": "https://images.unsplash.com/photo-1534953342533-7711c98712be?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000"}]},
        {"slug": "contact", "order": 3, "title": "Contact",
         "hero_eyebrow": "Contact", "hero_title": "We'd love to help.",
         "hero_image": "https://images.unsplash.com/photo-1715593947958-ee0ca51de552?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
         "body_html": "<p>Questions about an order, a gift or a bulk enquiry? Our team is here Monday to Saturday, 10am–7pm IST.</p>",
         "contact_address": "168, Netaji Subhash Marg, Martand Chowk, Ram Bagh, Indore, Madhya Pradesh 452007",
         "contact_phone": "+91 8871288853", "contact_whatsapp": "+91 8871288853",
         "contact_email": "support@artful.com", "office_hours": "Mon – Sat · 10:00 AM – 7:00 PM IST"},
        {"slug": "corporate-gifting", "order": 4, "title": "Corporate Gifting",
         "hero_eyebrow": "Corporate Gifting", "hero_title": "Gifting, elevated for business.",
         "hero_image": "https://images.unsplash.com/photo-1592903297149-37fb25202dfa?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600",
         "body_html": "<p>Curated, brandable hampers for clients, teams and milestones. Share your requirement and our team will craft a bespoke proposal.</p>"},
    ]
    for cp in CMS_PAGES:
        await db.cms_pages.update_one({"slug": cp["slug"]}, {"$setOnInsert": {"id": str(uuid.uuid4()), **cp}}, upsert=True)

    # Backfill contact fields onto existing contact CMS page (idempotent, no overwrite of admin edits)
    contact_doc = await db.cms_pages.find_one({"slug": "contact"})
    if contact_doc:
        cbackfill = {k: v for k, v in {
            "contact_address": "168, Netaji Subhash Marg, Martand Chowk, Ram Bagh, Indore, Madhya Pradesh 452007",
            "contact_phone": "+91 8871288853", "contact_whatsapp": "+91 8871288853",
            "contact_email": "support@artful.com", "office_hours": "Mon – Sat · 10:00 AM – 7:00 PM IST",
        }.items() if k not in contact_doc}
        if cbackfill:
            await db.cms_pages.update_one({"slug": "contact"}, {"$set": cbackfill})

    # Legal Pages admin should only manage true legal/policy pages — remove marketing/site pages
    await db.pages.delete_many({"slug": {"$in": ["about", "our-story", "contact", "corporate-gifting"]}})

    # 7) Rich-HTML policy pages (convert plain text -> HTML once)
    for pg in await db.pages.find({"content": {"$exists": True}}).to_list(50):
        c = pg.get("content", "")
        if c and "<" not in c:
            html = "".join(f"<p>{para.strip()}</p>" for para in c.split("\n\n") if para.strip())
            await db.pages.update_one({"id": pg["id"]}, {"$set": {"content": html}})

    # 8) Default product SECTION assignment so New Arrivals / Bestsellers rails stay populated
    if await db.products.count_documents({"sections": {"$exists": True, "$ne": []}}) == 0:
        newest = await db.products.find({"status": "Active"}, {"id": 1, "_id": 0}).sort("created_at", -1).limit(8).to_list(8)
        best = await db.products.find({"status": "Active"}, {"id": 1, "_id": 0}).sort("sales_count", -1).limit(8).to_list(8)
        for p in newest:
            await db.products.update_one({"id": p["id"]}, {"$addToSet": {"sections": "new-arrivals"}})
        for p in best:
            await db.products.update_one({"id": p["id"]}, {"$addToSet": {"sections": "bestsellers"}})
        for p in best[:6]:
            await db.products.update_one({"id": p["id"]}, {"$addToSet": {"sections": "featured"}})

