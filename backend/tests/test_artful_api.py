"""ARTFUL backend API tests - covers auth, storefront, checkout, admin, and security."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or \
           os.environ.get("BASE_URL", "https://artful-craft.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@artful.com"
ADMIN_PASSWORD = "Artful@2026"

# Read frontend/.env dynamically in case env not set
if "preview.emergentagent.com" not in API:
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    API = line.strip().split("=", 1)[1].rstrip("/") + "/api"
    except Exception:
        pass


# -------- fixtures --------
@pytest.fixture(scope="session")
def sess():
    s = requests.Session()
    s.headers["Content-Type"] = "application/json"
    return s


@pytest.fixture(scope="session")
def admin_token(sess):
    r = sess.post(f"{API}/admin/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_hdr(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def customer_auth(sess):
    """Returns (token, phone, customer_id) via DEV OTP."""
    phone = "9876543210"
    r = sess.post(f"{API}/auth/otp/send", json={"phone": phone})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("dev_mode") is True, "Expected DEV OTP mode"
    otp = d.get("dev_otp")
    assert otp
    r2 = sess.post(f"{API}/auth/otp/verify", json={"phone": phone, "code": otp, "name": "Test Buyer"})
    assert r2.status_code == 200, r2.text
    d2 = r2.json()
    return d2["token"], d2["customer"]["phone"], d2["customer"]["id"]


@pytest.fixture(scope="session")
def cust_hdr(customer_auth):
    return {"Authorization": f"Bearer {customer_auth[0]}"}


# -------- Health / basic --------
def test_health(sess):
    r = sess.get(f"{API}/health")
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "ok"
    # Expect DEV mode
    assert d["razorpay"] is False
    assert d["twilio"] is False


# -------- Storefront: products / categories / cms --------
def test_categories(sess):
    r = sess.get(f"{API}/categories")
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) >= 5
    for c in items:
        assert "_id" not in c
        assert "product_count" in c


def test_products_list(sess):
    r = sess.get(f"{API}/products", params={"page_size": 12})
    assert r.status_code == 200
    d = r.json()
    assert d["total"] >= 10
    assert len(d["items"]) > 0
    p = d["items"][0]
    assert "slug" in p and "price" in p and "_id" not in p


def test_products_filter_on_sale(sess):
    r = sess.get(f"{API}/products", params={"on_sale": True})
    assert r.status_code == 200
    for p in r.json()["items"]:
        assert p.get("compare_at_price") is not None


def test_product_detail(sess):
    r = sess.get(f"{API}/products/hand-thrown-ceramic-vase")
    assert r.status_code == 200
    d = r.json()
    assert d["slug"] == "hand-thrown-ceramic-vase"
    assert d["price"] > 0


def test_cms_homepage(sess):
    r = sess.get(f"{API}/cms/homepage")
    assert r.status_code == 200
    d = r.json()
    assert d["announcement"]["enabled"] is True
    assert any(s["type"] == "hero" for s in d["sections"])


def test_search_typo_correction(sess):
    r = sess.get(f"{API}/search", params={"q": "anniversery gift"})
    assert r.status_code == 200
    d = r.json()
    assert d["corrected_query"] and "anniversary" in d["corrected_query"].lower()
    assert d["total"] > 0


def test_search_autocomplete(sess):
    r = sess.get(f"{API}/search/autocomplete", params={"q": "candle"})
    assert r.status_code == 200
    d = r.json()
    assert len(d["products"]) > 0 or len(d["suggestions"]) > 0


# -------- Auth OTP --------
def test_otp_send_invalid_phone(sess):
    r = sess.post(f"{API}/auth/otp/send", json={"phone": "abc"})
    assert r.status_code == 400


def test_otp_verify_wrong_code(sess):
    sess.post(f"{API}/auth/otp/send", json={"phone": "9998887771"})
    r = sess.post(f"{API}/auth/otp/verify", json={"phone": "9998887771", "code": "000000"})
    assert r.status_code == 400


def test_customer_me(sess, cust_hdr):
    r = sess.get(f"{API}/auth/me", headers=cust_hdr)
    assert r.status_code == 200
    assert r.json()["phone"] == "+919876543210"


# -------- Coupon --------
def test_coupon_validate_welcome10(sess):
    # Get a product and build cart >= 999
    p = sess.get(f"{API}/products", params={"page_size": 1}).json()["items"][0]
    payload = {"items": [{"product_id": p["id"], "qty": 2}], "code": "WELCOME10"}
    r = sess.post(f"{API}/coupons/validate", json=payload)
    # WELCOME10 needs min cart 999 & first_time. Since anonymous, no customer check.
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["valid"] is True
    assert d["discount"] > 0


# -------- End-to-end checkout (DEV mock-pay) --------
@pytest.fixture(scope="session")
def placed_order(sess, cust_hdr, customer_auth):
    p = sess.get(f"{API}/products", params={"page_size": 1}).json()["items"][0]
    payload = {
        "items": [{"product_id": p["id"], "qty": 1}],
        "address": {"name": "Test Buyer", "line1": "1 Test St", "city": "Mumbai",
                    "state": "MH", "pincode": "400001", "phone": customer_auth[1]},
        "payment_method": "razorpay",
    }
    r = sess.post(f"{API}/checkout/create-order", json=payload, headers=cust_hdr)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["dev_mode"] is True
    order_id = d["order_id"]
    order_number = d["order_number"]

    # Mock pay
    r2 = sess.post(f"{API}/checkout/mock-pay", json={"order_id": order_id}, headers=cust_hdr)
    assert r2.status_code == 200, r2.text
    assert r2.json()["success"] is True

    # Idempotent - second call should also succeed and not double-charge
    r3 = sess.post(f"{API}/checkout/mock-pay", json={"order_id": order_id}, headers=cust_hdr)
    assert r3.status_code == 200
    return order_id, order_number


def test_order_created_and_visible(sess, cust_hdr, placed_order):
    _, order_number = placed_order
    r = sess.get(f"{API}/orders/{order_number}", headers=cust_hdr)
    assert r.status_code == 200
    o = r.json()
    assert o["status"] == "Confirmed"
    assert o["payment"]["status"] == "paid"


def test_mock_pay_idempotent_no_double_deduct(sess, cust_hdr, customer_auth):
    """Ensure double mock-pay doesn't deduct stock twice."""
    p = sess.get(f"{API}/products", params={"page_size": 1}).json()["items"][0]
    before_stock = p["stock"] - p.get("reserved", 0)
    payload = {
        "items": [{"product_id": p["id"], "qty": 1}],
        "address": {"name": "Test Buyer", "line1": "1 Test St", "city": "Mumbai",
                    "state": "MH", "pincode": "400001", "phone": customer_auth[1]},
        "payment_method": "razorpay",
    }
    r = sess.post(f"{API}/checkout/create-order", json=payload, headers=cust_hdr)
    order_id = r.json()["order_id"]
    sess.post(f"{API}/checkout/mock-pay", json={"order_id": order_id}, headers=cust_hdr)
    sess.post(f"{API}/checkout/mock-pay", json={"order_id": order_id}, headers=cust_hdr)
    p_after = sess.get(f"{API}/products/{p['slug']}").json()
    delta = before_stock - (p_after["stock"] - p_after.get("reserved", 0))
    # Should only deduct 1
    assert delta == 1, f"Stock deducted {delta} times, expected 1"


def test_cod_order(sess, cust_hdr, customer_auth):
    p = sess.get(f"{API}/products", params={"page_size": 1}).json()["items"][0]
    payload = {
        "items": [{"product_id": p["id"], "qty": 1}],
        "address": {"name": "Test Buyer", "line1": "1 Test St", "city": "Mumbai",
                    "state": "MH", "pincode": "400001", "phone": customer_auth[1]},
        "payment_method": "cod",
    }
    r = sess.post(f"{API}/checkout/create-order", json=payload, headers=cust_hdr)
    assert r.status_code == 200
    d = r.json()
    assert d.get("confirmed") is True
    r2 = sess.get(f"{API}/orders/{d['order_number']}", headers=cust_hdr)
    assert r2.json()["payment"]["status"] == "cod_confirmed"


def test_track_order(sess, placed_order, customer_auth):
    _, order_number = placed_order
    r = sess.post(f"{API}/orders/track", json={"order_number": order_number,
                                                "phone": customer_auth[1]})
    assert r.status_code == 200
    d = r.json()
    assert d["order_number"] == order_number
    assert d["status_history"]


def test_track_wrong_phone(sess, placed_order):
    _, order_number = placed_order
    r = sess.post(f"{API}/orders/track", json={"order_number": order_number, "phone": "9111111111"})
    assert r.status_code == 404


# -------- Wishlist requires auth --------
def test_wishlist_requires_auth(sess):
    r = sess.get(f"{API}/wishlist")
    assert r.status_code in (401, 403)


def test_wishlist_add(sess, cust_hdr):
    p = sess.get(f"{API}/products", params={"page_size": 1}).json()["items"][0]
    r = sess.post(f"{API}/wishlist/{p['id']}", headers=cust_hdr)
    assert r.status_code == 200
    assert p["id"] in r.json()["wishlist"]


# -------- Admin --------
def test_admin_dashboard(sess, admin_hdr):
    r = sess.get(f"{API}/admin/dashboard/stats", headers=admin_hdr)
    assert r.status_code == 200
    d = r.json()
    assert "sales" in d and "orders" in d


def test_admin_requires_token(sess):
    r = sess.get(f"{API}/admin/dashboard/stats")
    assert r.status_code in (401, 403)


def test_admin_wrong_password_locks(sess):
    r = sess.post(f"{API}/admin/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
    assert r.status_code in (401, 429)


@pytest.fixture(scope="session")
def created_product(sess, admin_hdr):
    name = f"TEST_Product_{uuid.uuid4().hex[:6]}"
    payload = {"name": name, "price": 1299, "stock": 10, "status": "Active",
               "category_slug": "candles", "short_description": "Test product",
               "images": ["https://example.com/i.jpg"]}
    r = sess.post(f"{API}/admin/products", json=payload, headers=admin_hdr)
    assert r.status_code == 200, r.text
    return r.json()


def test_admin_product_appears_on_storefront(sess, created_product):
    slug = created_product["slug"]
    r = sess.get(f"{API}/products/{slug}")
    assert r.status_code == 200
    assert r.json()["price"] == 1299


def test_admin_product_update(sess, admin_hdr, created_product):
    pid = created_product["id"]
    r = sess.put(f"{API}/admin/products/{pid}", json={"price": 1499}, headers=admin_hdr)
    assert r.status_code == 200
    assert r.json()["price"] == 1499


def test_admin_inventory_adjust(sess, admin_hdr, created_product):
    pid = created_product["id"]
    r = sess.post(f"{API}/admin/products/{pid}/inventory",
                  json={"change": 5, "reason": "restock"}, headers=admin_hdr)
    assert r.status_code == 200
    assert r.json()["stock"] >= 5


def test_admin_orders_list(sess, admin_hdr, placed_order):
    _, order_number = placed_order
    r = sess.get(f"{API}/admin/orders", headers=admin_hdr)
    assert r.status_code == 200
    nums = [o["order_number"] for o in r.json()["items"]]
    assert order_number in nums


def test_admin_order_status_update(sess, admin_hdr, placed_order):
    _, order_number = placed_order
    r = sess.put(f"{API}/admin/orders/{order_number}/status",
                 json={"status": "Processing", "note": "picking"}, headers=admin_hdr)
    assert r.status_code == 200
    assert r.json()["status"] == "Processing"

    r2 = sess.put(f"{API}/admin/orders/{order_number}/tracking",
                  json={"number": "TRK123", "courier": "BlueDart"}, headers=admin_hdr)
    assert r2.status_code == 200


def test_admin_coupon_create(sess, admin_hdr):
    code = f"TEST{uuid.uuid4().hex[:5].upper()}"
    r = sess.post(f"{API}/admin/coupons", json={
        "code": code, "type": "flat", "value": 100, "min_cart": 500,
        "description": "Test coupon"}, headers=admin_hdr)
    assert r.status_code == 200
    assert r.json()["code"] == code


def test_admin_customers_list(sess, admin_hdr):
    r = sess.get(f"{API}/admin/customers", headers=admin_hdr)
    assert r.status_code == 200


def test_admin_search_analytics(sess, admin_hdr):
    r = sess.get(f"{API}/admin/search/analytics", headers=admin_hdr)
    assert r.status_code == 200


def test_admin_settings(sess, admin_hdr):
    r = sess.get(f"{API}/admin/settings", headers=admin_hdr)
    assert r.status_code == 200
    assert "integrations" in r.json()


def test_admin_cms_homepage(sess, admin_hdr):
    r = sess.get(f"{API}/admin/cms/homepage", headers=admin_hdr)
    assert r.status_code == 200
    assert len(r.json()["sections"]) > 0


# -------- Security: cross-customer order access --------
def test_customer_cannot_access_other_order(sess, placed_order):
    _, order_number = placed_order
    # login as a different phone
    phone = "9000000002"
    sess.post(f"{API}/auth/otp/send", json={"phone": phone})
    r = sess.post(f"{API}/auth/otp/send", json={"phone": phone})
    otp = r.json()["dev_otp"]
    tok = sess.post(f"{API}/auth/otp/verify", json={"phone": phone, "code": otp}).json()["token"]
    r2 = sess.get(f"{API}/orders/{order_number}", headers={"Authorization": f"Bearer {tok}"})
    assert r2.status_code == 404
