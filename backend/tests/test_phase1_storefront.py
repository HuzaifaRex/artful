"""ARTFUL Phase-1 storefront tests: newsletter, contact, settings, CMS, categories,
DEV OTP + order flow + SMS log, cancel + SMS log, customer profile update."""
import os
import uuid
import subprocess
import time
import pytest
import requests


BASE_URL = ""
with open("/app/frontend/.env") as f:
    for line in f:
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.strip().split("=", 1)[1].rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def sess():
    s = requests.Session()
    s.headers["Content-Type"] = "application/json"
    return s


def _dev_customer(name="TEST Phase1"):
    s = requests.Session()
    s.headers["Content-Type"] = "application/json"
    phone = f"98{uuid.uuid4().int % 100000000:08d}"
    r = s.post(f"{API}/auth/otp/send", json={"phone": phone})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("dev_mode") is True
    code = d["dev_otp"]
    r2 = s.post(f"{API}/auth/otp/verify",
                json={"phone": phone, "code": code, "name": name})
    assert r2.status_code == 200, r2.text
    tok = r2.json()["token"]
    s.headers["Authorization"] = f"Bearer {tok}"
    return {"sess": s, "phone": phone, "token": tok}


# ---------------- Newsletter ----------------
class TestNewsletter:
    def test_subscribe_new_email(self, sess):
        email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
        r = sess.post(f"{API}/newsletter/subscribe", json={"email": email})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert d.get("already") in (False, None)

    def test_subscribe_duplicate(self, sess):
        email = f"TEST_dup_{uuid.uuid4().hex[:6]}@example.com"
        r1 = sess.post(f"{API}/newsletter/subscribe", json={"email": email})
        assert r1.status_code == 200
        r2 = sess.post(f"{API}/newsletter/subscribe", json={"email": email})
        assert r2.status_code == 200
        assert r2.json().get("already") is True

    def test_subscribe_invalid_email(self, sess):
        r = sess.post(f"{API}/newsletter/subscribe", json={"email": "not-an-email"})
        assert r.status_code == 400


# ---------------- Contact ----------------
class TestContact:
    def test_contact_ok(self, sess):
        r = sess.post(f"{API}/contact/submit",
                      json={"name": "TEST Buyer", "email": "t@t.com",
                            "message": "Hello support"})
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_contact_missing_name(self, sess):
        r = sess.post(f"{API}/contact/submit", json={"message": "hi"})
        assert r.status_code == 400

    def test_contact_missing_message(self, sess):
        r = sess.post(f"{API}/contact/submit", json={"name": "X"})
        assert r.status_code == 400


# ---------------- Settings ----------------
class TestSettings:
    def test_settings_contact_fields(self, sess):
        r = sess.get(f"{API}/settings")
        assert r.status_code == 200
        d = r.json()
        assert d.get("office_address") == "168, Netaji Subhash Marg, Martand Chowk, Ram Bagh, Indore, Madhya Pradesh 452007"
        assert d.get("contact_phone") == "+91 8871288853"
        assert d.get("whatsapp_number") == "+91 8871288853"
        assert d.get("contact_email") == "support@artful.com"


# ---------------- CMS homepage ----------------
class TestCMSHomepage:
    def test_hero_slides_with_badges(self, sess):
        r = sess.get(f"{API}/cms/homepage")
        assert r.status_code == 200
        d = r.json()
        # hero can be a section object OR a top-level 'hero' — support both
        hero = d.get("hero")
        if not hero:
            for s in d.get("sections", []):
                if s.get("type") == "hero":
                    hero = s
                    break
        assert hero, f"No hero section found. Keys: {list(d.keys())}"
        slides = hero.get("slides") or hero.get("data", {}).get("slides")
        assert slides and isinstance(slides, list) and len(slides) >= 3, f"Expected >=3 slides, got {slides}"
        for s in slides:
            assert s.get("heading"), f"slide missing heading: {s}"
            assert s.get("image"), f"slide missing image: {s}"
            badges = s.get("badges")
            assert badges and isinstance(badges, list) and len(badges) >= 1
            for b in badges:
                assert b.get("icon") and b.get("label"), f"badge missing icon/label: {b}"

    def test_promise_section_present(self, sess):
        r = sess.get(f"{API}/cms/homepage")
        d = r.json()
        sections = d.get("sections", [])
        types = [s.get("type") for s in sections]
        assert "promise" in types, f"No 'promise' section in {types}"

    def test_why_artful_values_have_icons(self, sess):
        r = sess.get(f"{API}/cms/homepage")
        d = r.json()
        sections = d.get("sections", [])
        why = None
        for s in sections:
            if s.get("type") in ("why_artful", "values"):
                why = s
                break
        assert why, f"No why_artful/values section. types={[s.get('type') for s in sections]}"
        items = why.get("items") or why.get("data", {}).get("items") or []
        assert items and len(items) >= 3
        for it in items:
            assert it.get("icon"), f"value item missing icon: {it}"


# ---------------- Categories icons ----------------
class TestCategoriesIcons:
    def test_categories_have_icon(self, sess):
        r = sess.get(f"{API}/categories")
        assert r.status_code == 200
        d = r.json()
        items = d if isinstance(d, list) else d.get("items", [])
        assert items and len(items) >= 1
        with_icon = [c for c in items if c.get("icon")]
        assert len(with_icon) >= 1, f"No categories with 'icon' field. Sample: {items[0] if items else None}"


# ---------------- Order flow with SMS DEV log ----------------
@pytest.fixture(scope="module")
def customer_9876543210():
    """Uses the exact phone from the spec: 9876543210."""
    s = requests.Session()
    s.headers["Content-Type"] = "application/json"
    r = s.post(f"{API}/auth/otp/send", json={"phone": "9876543210"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("dev_mode") is True and d.get("dev_otp"), f"Expected dev_otp: {d}"
    r2 = s.post(f"{API}/auth/otp/verify",
                json={"phone": "9876543210", "code": d["dev_otp"], "name": "TEST DevUser"})
    assert r2.status_code == 200, r2.text
    tok = r2.json()["token"]
    s.headers["Authorization"] = f"Bearer {tok}"
    return {"sess": s, "phone": "9876543210", "token": tok}


def _read_backend_log_tail(lines=800):
    """Read last N lines from supervisor backend log."""
    out = ""
    for p in ("/var/log/supervisor/backend.out.log", "/var/log/supervisor/backend.err.log"):
        try:
            r = subprocess.run(["tail", "-n", str(lines), p], capture_output=True, text=True, timeout=5)
            out += r.stdout + "\n"
        except Exception:
            pass
    return out


class TestOrderFlowSMS:
    def test_place_and_cancel_order_produces_sms_dev_logs(self, sess, customer_9876543210):
        c = customer_9876543210
        # Choose an in-stock product
        r = sess.get(f"{API}/products?page_size=10")
        items = r.json().get("items", [])
        assert items, "No products"
        product = items[0]
        addr = {"name": "TEST DevUser", "phone": c["phone"], "line1": "1 Test Rd",
                "city": "Indore", "state": "MP", "pincode": "452007"}

        # Prefer mock-pay flow if Razorpay is in DEV mode; else fallback to COD.
        create = c["sess"].post(f"{API}/checkout/create-order",
                                json={"items": [{"product_id": product["id"], "qty": 1}],
                                      "address": addr, "payment_method": "razorpay"})
        used_mock_pay = False
        if create.status_code == 200 and create.json().get("dev_mode") is True:
            d = create.json()
            order_number = d["order_number"]
            # get order id
            og = c["sess"].get(f"{API}/orders/{order_number}")
            order_id = og.json()["id"]
            mp = c["sess"].post(f"{API}/checkout/mock-pay",
                                json={"order_id": order_id})
            assert mp.status_code == 200, mp.text
            used_mock_pay = True
        else:
            create = c["sess"].post(f"{API}/checkout/create-order",
                                    json={"items": [{"product_id": product["id"], "qty": 1}],
                                          "address": addr, "payment_method": "cod"})
            assert create.status_code == 200, create.text
            order_number = create.json()["order_number"]
        print(f"[test] order={order_number} used_mock_pay={used_mock_pay}")

        # Give backend a moment to flush stdout
        time.sleep(1)
        log = _read_backend_log_tail(1500)
        assert "[sms][DEV]" in log, "No [sms][DEV] line in backend log at all"
        # order confirmation SMS attempt
        assert "+919876543210" in log, f"phone +919876543210 not in log tail"
        # Look for confirmation-like line
        confirm_lines = [l for l in log.splitlines()
                         if "[sms][DEV]" in l and "+919876543210" in l and "confirm" in l.lower()]
        assert confirm_lines, "No [sms][DEV] ... confirmed line for +919876543210"

        # Cancel
        rc = c["sess"].post(f"{API}/orders/{order_number}/cancel",
                            json={"reason": "test cancel"})
        assert rc.status_code == 200, rc.text
        assert rc.json().get("ok") is True

        time.sleep(1)
        log2 = _read_backend_log_tail(1500)
        cancel_lines = [l for l in log2.splitlines()
                        if "[sms][DEV]" in l and "+919876543210" in l and "cancel" in l.lower()]
        assert cancel_lines, "No [sms][DEV] ... cancelled line for +919876543210"


# ---------------- Customer profile update ----------------
class TestCustomerProfile:
    def test_update_name_and_email(self):
        c = _dev_customer("TEST Old Name")
        r = c["sess"].put(f"{API}/customers/me",
                          json={"name": "TEST New Name", "email": "new@example.com"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("name") == "TEST New Name"
        assert data.get("email") == "new@example.com"

    def test_update_phone_valid(self):
        c = _dev_customer()
        new_phone = f"91{uuid.uuid4().int % 100000000:08d}"
        r = c["sess"].put(f"{API}/customers/me", json={"phone": new_phone})
        assert r.status_code == 200, r.text

    def test_update_phone_invalid(self):
        c = _dev_customer()
        r = c["sess"].put(f"{API}/customers/me", json={"phone": "123"})
        assert r.status_code == 400

    def test_update_phone_conflict(self):
        c1 = _dev_customer("TEST c1")
        c2 = _dev_customer("TEST c2")
        # try to set c2's phone to c1's phone
        r = c2["sess"].put(f"{API}/customers/me", json={"phone": c1["phone"]})
        assert r.status_code == 409, f"expected 409, got {r.status_code}: {r.text}"
