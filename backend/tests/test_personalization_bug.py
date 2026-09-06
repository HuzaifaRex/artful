"""Iter-6: Verify customer's personalization message is persisted on order line item
and surfaced by GET /api/admin/orders/{order_number}."""
import os
import time
import requests
import pytest
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"

ADMIN_EMAIL = "admin@artful.com"
ADMIN_PASSWORD = "Artful@2026"
TEST_PHONE = "9876543210"
PERSONAL_MSG = "For Aarav ❤"
SLUG = "personalized-keepsake-box"


@pytest.fixture(scope="module")
def admin_h():
    r = requests.post(f"{BASE_URL}/api/admin/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def customer_token():
    s = requests.post(f"{BASE_URL}/api/auth/otp/send", json={"phone": TEST_PHONE}, timeout=15)
    assert s.status_code == 200, s.text
    otp = s.json().get("dev_otp")
    assert otp, "dev_otp missing"
    v = requests.post(f"{BASE_URL}/api/auth/otp/verify",
                      json={"phone": TEST_PHONE, "code": otp, "name": "Aarav Tester"}, timeout=15)
    assert v.status_code == 200, v.text
    return v.json()["token"]


@pytest.fixture(scope="module")
def product():
    p = requests.get(f"{BASE_URL}/api/products/{SLUG}", timeout=15)
    assert p.status_code == 200, p.text
    prod = p.json()
    assert prod.get("personalization", {}).get("enabled"), "product must have personalization enabled"
    return prod


def test_place_cod_order_with_personalization(customer_token, admin_h, product):
    """Full flow: create COD order with personalization -> admin GET must return the message."""
    headers = {"Authorization": f"Bearer {customer_token}"}
    payload = {
        "items": [{"product_id": product["id"], "qty": 1,
                   "personalization": PERSONAL_MSG, "gift_wrap": False}],
        "address": {"name": "Aarav Tester", "phone": TEST_PHONE,
                    "line1": "12 Palm Grove", "city": "Mumbai", "state": "MH", "pincode": "400001"},
        "payment_method": "cod", "email": "aarav@example.com",
    }
    r = requests.post(f"{BASE_URL}/api/checkout/create-order", json=payload,
                      headers=headers, timeout=20)
    assert r.status_code == 200, r.text
    order_number = r.json()["order_number"]
    print(f"Created order: {order_number}")

    # Admin GET
    time.sleep(0.5)
    ad = requests.get(f"{BASE_URL}/api/admin/orders/{order_number}", headers=admin_h, timeout=15)
    assert ad.status_code == 200, ad.text
    o = ad.json()
    items = o.get("items") or []
    assert items, "order has no items"
    assert items[0].get("personalization") == PERSONAL_MSG, \
        f"personalization mismatch: got {items[0].get('personalization')!r}"
    print(f"OK: admin sees personalization = {items[0]['personalization']!r}")

    # Store for UI test to reuse
    with open("/tmp/iter6_order.txt", "w") as f:
        f.write(order_number)


def test_place_cod_order_without_personalization(customer_token, admin_h, product):
    """Regression: items without personalization must NOT get a spurious empty field."""
    headers = {"Authorization": f"Bearer {customer_token}"}
    payload = {
        "items": [{"product_id": product["id"], "qty": 1, "gift_wrap": True}],
        "address": {"name": "No Msg", "phone": TEST_PHONE, "line1": "1 Test",
                    "city": "Delhi", "state": "DL", "pincode": "110001"},
        "payment_method": "cod",
    }
    r = requests.post(f"{BASE_URL}/api/checkout/create-order", json=payload,
                      headers=headers, timeout=20)
    assert r.status_code == 200, r.text
    order_number = r.json()["order_number"]
    ad = requests.get(f"{BASE_URL}/api/admin/orders/{order_number}", headers=admin_h, timeout=15).json()
    items = ad.get("items") or []
    assert items[0].get("personalization") in (None, ""), \
        f"expected null personalization, got {items[0].get('personalization')!r}"
    assert items[0].get("gift_wrap") is True, "gift_wrap should be True"
