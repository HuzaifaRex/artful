"""ARTFUL iter-4 backend tests for the 17 changes:
newsletter, pages, cms/page, visitors, admin orders, razorpay checkout,
cms admin updates, collections manual+dynamic."""
import os
import uuid
import time
import pytest
import requests

BASE_URL = ""
try:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.strip().split("=", 1)[1].rstrip("/")
except Exception:
    BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@artful.com"
ADMIN_PASSWORD = "Artful@2026"


@pytest.fixture(scope="session")
def sess():
    s = requests.Session()
    s.headers["Content-Type"] = "application/json"
    return s


@pytest.fixture(scope="session")
def admin_hdr(sess):
    r = sess.post(f"{API}/admin/auth/login",
                  json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}",
            "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def customer():
    s = requests.Session()
    s.headers["Content-Type"] = "application/json"
    phone = f"98{uuid.uuid4().int % 100000000:08d}"
    r = s.post(f"{API}/auth/otp/send", json={"phone": phone})
    assert r.status_code == 200
    d = r.json()
    assert d.get("dev_mode") is True and d.get("dev_otp")
    r2 = s.post(f"{API}/auth/otp/verify",
                json={"phone": phone, "code": d["dev_otp"], "name": "TEST Iter4"})
    assert r2.status_code == 200, r2.text
    s.headers["Authorization"] = f"Bearer {r2.json()['token']}"
    return {"sess": s, "phone": phone}


# ---------- Health ----------
class TestHealth:
    def test_health_razorpay_enabled(self, sess):
        r = sess.get(f"{API}/health")
        assert r.status_code == 200
        assert r.json().get("razorpay") is True


# ---------- Newsletter ----------
class TestNewsletter:
    def test_new_and_duplicate(self, sess):
        email = f"TEST_{uuid.uuid4().hex[:8]}@x.com"
        r = sess.post(f"{API}/newsletter/subscribe", json={"email": email})
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True and d["already"] is False
        r2 = sess.post(f"{API}/newsletter/subscribe", json={"email": email})
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["ok"] is True and d2["already"] is True

    def test_invalid_email(self, sess):
        r = sess.post(f"{API}/newsletter/subscribe", json={"email": "not-an-email"})
        assert r.status_code == 400


# ---------- Pages: legal only ----------
class TestLegalPages:
    @pytest.mark.parametrize("slug", ["shipping", "returns", "privacy", "terms"])
    def test_legal_pages_200(self, sess, slug):
        r = sess.get(f"{API}/pages/{slug}")
        assert r.status_code == 200, f"{slug} -> {r.status_code}"
        d = r.json()
        assert d.get("slug") == slug
        assert d.get("body_html") or d.get("content") or d.get("body")

    @pytest.mark.parametrize("slug", ["about", "our-story", "contact", "corporate-gifting"])
    def test_removed_from_legal_404(self, sess, slug):
        r = sess.get(f"{API}/pages/{slug}")
        assert r.status_code == 404, f"{slug} unexpectedly returned {r.status_code}"


# ---------- CMS site pages ----------
class TestCmsPages:
    def test_corporate_gifting_has_body_html(self, sess):
        r = sess.get(f"{API}/cms/page/corporate-gifting")
        assert r.status_code == 200
        d = r.json()
        assert "body_html" in d or "hero" in d
        # hero present
        assert d.get("hero") is not None or d.get("hero_title") or "hero_title" in d

    def test_contact_has_contact_fields(self, sess):
        r = sess.get(f"{API}/cms/page/contact")
        assert r.status_code == 200
        d = r.json()
        for k in ("contact_address", "contact_phone", "contact_whatsapp",
                  "contact_email", "office_hours"):
            assert k in d, f"missing {k} in contact cms page"


# ---------- Visitor tracking ----------
class TestVisitors:
    def test_track_and_admin_list(self, sess, admin_hdr):
        vid = f"vt_{uuid.uuid4().hex}"
        for path in ("/", "/shop", "/product/x"):
            r = sess.post(f"{API}/track/visit",
                          json={"visitor_id": vid, "path": path,
                                "referrer": "https://google.com"})
            assert r.status_code == 200 and r.json().get("ok") is True
        # add identity capture
        r = sess.post(f"{API}/track/visit",
                      json={"visitor_id": vid, "path": "/checkout",
                            "identity": {"email": "TEST_visitor@x.com",
                                         "name": "TEST V"}})
        assert r.status_code == 200
        # admin list
        r = requests.get(f"{API}/admin/visitors", headers=admin_hdr)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d.get("items"), list)
        assert d.get("stats", {}).get("total", 0) > 0
        found = next((v for v in d["items"] if v.get("visitor_id") == vid), None)
        assert found, "our visitor not returned"
        assert found.get("visit_count", 0) >= 4
        assert found.get("last_path") == "/checkout"


# ---------- Admin order detail ----------
class TestAdminOrderDetail:
    def test_admin_order_has_address_and_giftwrap(self, customer, admin_hdr, sess):
        # find a product
        prod = sess.get(f"{API}/products?page_size=3").json()["items"][0]
        addr = {"name": "TEST Buyer", "phone": customer["phone"],
                "line1": "1 Addr Rd", "city": "Delhi",
                "state": "DL", "pincode": "110001"}
        payload = {"items": [{"product_id": prod["id"], "qty": 1, "gift_wrap": True}],
                   "address": addr, "payment_method": "cod"}
        r = customer["sess"].post(f"{API}/checkout/create-order", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("confirmed") is True
        onum = d["order_number"]
        # admin fetch
        r2 = requests.get(f"{API}/admin/orders/{onum}", headers=admin_hdr)
        assert r2.status_code == 200
        o = r2.json()
        assert isinstance(o.get("address"), dict), "address should be dict on order"
        assert o["address"].get("state") == "DL"
        items = o.get("items", [])
        assert items, "order has items"
        it = items[0]
        assert it.get("gift_wrap") is True
        assert (it.get("wrap_price") or 0) > 0, "wrap_price should be positive on wrapped item"


# ---------- Razorpay checkout ----------
class TestRazorpayCheckout:
    def test_razorpay_order_created(self, customer, sess):
        prod = sess.get(f"{API}/products?page_size=3").json()["items"][0]
        addr = {"name": "TEST RZ", "phone": customer["phone"],
                "line1": "9 RZ Ln", "city": "Mumbai",
                "state": "MH", "pincode": "400001"}
        r = customer["sess"].post(f"{API}/checkout/create-order",
                                  json={"items": [{"product_id": prod["id"], "qty": 1}],
                                        "address": addr, "payment_method": "razorpay"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("dev_mode") is False, f"expected real razorpay: {d}"
        assert d.get("razorpay_order_id"), "razorpay_order_id missing"
        kid = d.get("key_id") or d.get("razorpay_key_id") or d.get("key")
        assert kid and str(kid).startswith("rzp_test"), f"key_id should be test key, got {kid}"

    def test_cod_full_flow_with_gift_wrap_pricing(self, customer, sess):
        prod = sess.get(f"{API}/products?page_size=3").json()["items"][0]
        addr = {"name": "TEST GW", "phone": customer["phone"],
                "line1": "3 GW St", "city": "Delhi",
                "state": "DL", "pincode": "110001"}
        r = customer["sess"].post(f"{API}/checkout/create-order",
                                  json={"items": [{"product_id": prod["id"], "qty": 2,
                                                    "gift_wrap": True}],
                                        "address": addr, "payment_method": "cod"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("confirmed") is True
        onum = d["order_number"]
        og = customer["sess"].get(f"{API}/orders/{onum}").json()
        # totals consistency
        items = og.get("items", [])
        wraps = sum((it.get("wrap_price") or 0) for it in items if it.get("gift_wrap"))
        assert wraps > 0, "expected gift wrap total > 0"
        subtotal = og.get("subtotal") or og.get("sub_total") or 0
        total = og.get("total") or og.get("grand_total") or 0
        assert total >= subtotal >= 0


# ---------- Admin CMS site pages persist ----------
class TestAdminCmsPages:
    def test_put_contact_persists(self, admin_hdr, sess):
        marker = f"TEST-ADDR-{uuid.uuid4().hex[:6]}"
        payload = {"contact_address": marker, "contact_phone": "+91 9999900000",
                   "contact_whatsapp": "+91 9999900001",
                   "contact_email": "test@artful.com",
                   "office_hours": "Mon-Fri 10-6"}
        r = requests.put(f"{API}/admin/cms/pages/contact", json=payload, headers=admin_hdr)
        assert r.status_code == 200, r.text
        # public GET
        d = sess.get(f"{API}/cms/page/contact").json()
        assert d.get("contact_address") == marker
        assert d.get("contact_phone") == "+91 9999900000"

    @pytest.mark.parametrize("slug", ["about", "our-story", "corporate-gifting"])
    def test_put_body_html_persists(self, admin_hdr, sess, slug):
        marker = f"<p>TEST-BODY-{uuid.uuid4().hex[:6]}</p>"
        r = requests.put(f"{API}/admin/cms/pages/{slug}",
                         json={"body_html": marker}, headers=admin_hdr)
        assert r.status_code == 200, r.text
        d = sess.get(f"{API}/cms/page/{slug}").json()
        assert d.get("body_html") == marker


# ---------- Admin collections manual + dynamic ----------
class TestCollections:
    def test_manual_and_dynamic_collection(self, admin_hdr, sess):
        # find 2 active products; pick one with a badge if available
        prods = sess.get(f"{API}/products?page_size=20").json()["items"]
        assert len(prods) >= 2
        badge = None
        for p in prods:
            if p.get("badges"):
                badge = p["badges"][0] if isinstance(p["badges"], list) else p["badges"]
                break
        pick = prods[:2]

        # Manual
        m_slug = f"test-manual-{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/admin/collections",
                          json={"name": f"TEST Manual {m_slug}", "slug": m_slug,
                                "type": "manual",
                                "product_ids": [p["id"] for p in pick]},
                          headers=admin_hdr)
        assert r.status_code == 200, r.text
        r2 = sess.get(f"{API}/products?collection={m_slug}&page_size=50")
        assert r2.status_code == 200
        ids = {p["id"] for p in r2.json()["items"]}
        assert ids == {p["id"] for p in pick}, f"expected {[p['id'] for p in pick]}, got {ids}"

        # Dynamic (badge rule) – only if we found one badge
        if badge:
            d_slug = f"test-dyn-{uuid.uuid4().hex[:6]}"
            r = requests.post(f"{API}/admin/collections",
                              json={"name": f"TEST Dynamic {d_slug}", "slug": d_slug,
                                    "type": "dynamic", "rules": {"badge": badge}},
                              headers=admin_hdr)
            assert r.status_code == 200, r.text
            r2 = sess.get(f"{API}/products?collection={d_slug}&page_size=50")
            assert r2.status_code == 200
            for p in r2.json()["items"]:
                bs = p.get("badges") or []
                if isinstance(bs, str):
                    bs = [bs]
                assert badge in bs, f"product {p['slug']} missing badge {badge}"
