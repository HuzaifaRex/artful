"""ARTFUL new-features tests: verified reviews, cancel order, refunds, campaigns, upload."""
import os
import io
import struct
import zlib
import uuid
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


def _tiny_png() -> bytes:
    """Generate a 1x1 red PNG bytes."""
    sig = b"\x89PNG\r\n\x1a\n"

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)

    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    raw = b"\x00\xff\x00\x00"  # filter byte + RGB red
    idat = zlib.compress(raw)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


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
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="session")
def customer():
    """DEV OTP customer with unique phone."""
    s = requests.Session()
    s.headers["Content-Type"] = "application/json"
    phone = f"98{uuid.uuid4().int % 100000000:08d}"
    r = s.post(f"{API}/auth/otp/send", json={"phone": phone})
    assert r.status_code == 200
    d = r.json()
    assert d.get("dev_mode") is True and d.get("dev_otp")
    r2 = s.post(f"{API}/auth/otp/verify",
                json={"phone": phone, "code": d["dev_otp"], "name": "TEST Reviewer"})
    assert r2.status_code == 200, r2.text
    tok = r2.json()["token"]
    s.headers["Authorization"] = f"Bearer {tok}"
    return {"sess": s, "phone": phone, "token": tok}


# --------- Admin image upload (Emergent object storage) ---------
class TestAdminUpload:
    def test_upload_image_returns_url_and_serves(self, sess, admin_hdr):
        files = {"file": ("t.png", _tiny_png(), "image/png")}
        # requests default JSON header conflicts with multipart; use fresh call
        r = requests.post(f"{API}/admin/upload", files=files,
                          headers={"Authorization": admin_hdr["Authorization"]})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "url" in data and data["url"].startswith("/api/uploads/")
        # Verify the image is served
        r2 = requests.get(f"{BASE_URL}{data['url']}")
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("image/")
        assert len(r2.content) > 0

    def test_upload_rejects_bad_extension(self, admin_hdr):
        files = {"file": ("t.exe", b"MZ", "application/octet-stream")}
        r = requests.post(f"{API}/admin/upload", files=files,
                          headers={"Authorization": admin_hdr["Authorization"]})
        assert r.status_code == 400

    def test_upload_requires_admin(self):
        files = {"file": ("t.png", _tiny_png(), "image/png")}
        r = requests.post(f"{API}/admin/upload", files=files)
        assert r.status_code in (401, 403)


# --------- Active campaign (promotions) ---------
class TestActiveCampaign:
    def test_active_campaign_endpoint(self, sess):
        r = sess.get(f"{API}/cms/active-campaign")
        assert r.status_code == 200
        d = r.json()
        assert "campaign" in d  # may be None or object

    def test_admin_create_promotion_shows_in_active(self, sess, admin_hdr):
        payload = {"name": "TEST Festive", "headline": "TEST Sale",
                   "end_date": "2099-12-31T23:59:59+00:00",
                   "cta_text": "Shop", "cta_url": "/shop",
                   "image": "/api/uploads/x.png"}
        r = requests.post(f"{API}/admin/promotions", json=payload, headers=admin_hdr)
        assert r.status_code == 200, r.text
        promo = r.json()
        assert promo.get("id")
        # verify list
        r2 = requests.get(f"{API}/admin/promotions", headers=admin_hdr)
        assert r2.status_code == 200
        names = [i.get("name") for i in r2.json().get("items", [])]
        assert "TEST Festive" in names
        # Verify active endpoint returns some active
        r3 = sess.get(f"{API}/cms/active-campaign")
        assert r3.json().get("campaign") is not None


# --------- Verified buyer review flow ---------
class TestVerifiedReviews:
    def _first_active_product(self, sess):
        r = sess.get(f"{API}/products?page_size=5")
        items = r.json().get("items", [])
        assert items, "No storefront products"
        return items[0]

    def test_cannot_review_without_purchase(self, sess, customer):
        p = self._first_active_product(sess)
        r = customer["sess"].get(f"{API}/products/{p['slug']}/can-review")
        assert r.status_code == 200
        d = r.json()
        assert d["can_review"] is False and d["purchased"] is False
        # attempt to submit -> 403
        r2 = customer["sess"].post(f"{API}/products/{p['slug']}/reviews",
                                   json={"rating": 5, "title": "T", "body": "B"})
        assert r2.status_code == 403

    def test_verified_buyer_review_then_admin_approve(self, sess, customer, admin_hdr):
        p = self._first_active_product(sess)
        # Place a COD order (upsert address inline)
        cart = [{"product_id": p["id"], "qty": 1}]
        addr = {"name": "TEST Buyer", "phone": customer["phone"],
                "line1": "1 Test Lane", "city": "Delhi", "state": "DL", "pincode": "110001"}
        r = customer["sess"].post(f"{API}/checkout/create-order",
                                  json={"items": cart, "address": addr, "payment_method": "cod"})
        assert r.status_code == 200, r.text
        assert r.json().get("confirmed") is True

        # can-review now true
        r2 = customer["sess"].get(f"{API}/products/{p['slug']}/can-review")
        assert r2.status_code == 200
        d = r2.json()
        assert d["can_review"] is True and d["purchased"] is True

        # submit review -> Pending
        r3 = customer["sess"].post(f"{API}/products/{p['slug']}/reviews",
                                   json={"rating": 5, "title": "TEST-Great",
                                         "body": "Loved the packaging."})
        assert r3.status_code == 200, r3.text
        review = r3.json()["review"]
        assert review["status"] == "Pending"
        assert review["verified_buyer"] is True

        # duplicate -> 400
        r4 = customer["sess"].post(f"{API}/products/{p['slug']}/reviews",
                                   json={"rating": 4, "title": "again", "body": "..."})
        assert r4.status_code == 400

        # admin approve
        r5 = requests.get(f"{API}/admin/reviews?status=Pending", headers=admin_hdr)
        assert r5.status_code == 200
        pending = [x for x in r5.json()["items"] if x["id"] == review["id"]]
        assert pending, "review not in pending list"
        r6 = requests.put(f"{API}/admin/reviews/{review['id']}",
                          json={"status": "Approved"}, headers=admin_hdr)
        assert r6.status_code == 200

        # Product rating updated & review_count >=1
        r7 = sess.get(f"{API}/products/{p['slug']}")
        assert r7.status_code == 200
        prod = r7.json()
        assert prod["review_count"] >= 1
        assert prod["rating"] >= 1


# --------- Cancel order flow (COD) ---------
class TestCancelOrder:
    def test_customer_can_cancel_pending_cod_order(self, sess, admin_hdr):
        # Fresh customer + product
        s = requests.Session()
        s.headers["Content-Type"] = "application/json"
        phone = f"97{uuid.uuid4().int % 100000000:08d}"
        r = s.post(f"{API}/auth/otp/send", json={"phone": phone})
        code = r.json()["dev_otp"]
        r2 = s.post(f"{API}/auth/otp/verify",
                    json={"phone": phone, "code": code, "name": "TEST Canceller"})
        s.headers["Authorization"] = f"Bearer {r2.json()['token']}"

        prod = sess.get(f"{API}/products?page_size=5").json()["items"][0]
        addr = {"name": "TEST", "phone": phone, "line1": "1 A", "city": "Delhi",
                "state": "DL", "pincode": "110001"}
        oc = s.post(f"{API}/checkout/create-order",
                    json={"items": [{"product_id": prod["id"], "qty": 1}],
                          "address": addr, "payment_method": "cod"})
        assert oc.status_code == 200
        onum = oc.json()["order_number"]

        # Cancel
        rc = s.post(f"{API}/orders/{onum}/cancel", json={"reason": "test"})
        assert rc.status_code == 200, rc.text
        assert rc.json().get("ok") is True

        # Verify status via customer GET
        rg = s.get(f"{API}/orders/{onum}")
        assert rg.status_code == 200
        assert rg.json()["status"] == "Cancelled"

        # Cannot cancel again
        rc2 = s.post(f"{API}/orders/{onum}/cancel", json={})
        assert rc2.status_code == 400
