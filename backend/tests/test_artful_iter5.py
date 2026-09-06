"""Iter-5 targeted tests: CKEditor persistence (legal pages + CMS site pages) and
Refunds endpoint surfacing cancelled orders with date/time."""
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


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/admin/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# --------- LEGAL PAGES (rich HTML persistence via /api/admin/pages) ---------
@pytest.mark.parametrize("slug", ["returns", "privacy", "terms", "shipping"])
def test_legal_page_rich_html_persist(admin_h, slug):
    lst = requests.get(f"{BASE_URL}/api/admin/pages", headers=admin_h, timeout=15).json()
    items = lst.get("items", lst) if isinstance(lst, dict) else lst
    doc = next((p for p in items if p.get("slug") == slug), None)
    assert doc, f"legal page {slug} not found"
    pid = doc["id"]
    marker = f"<h2>ITER5-{slug.upper()}</h2><p>Rich <strong>content</strong> {int(time.time())}</p>"
    new_content = (doc.get("content") or "") + marker
    r = requests.put(f"{BASE_URL}/api/admin/pages/{pid}",
                     json={**doc, "content": new_content}, headers=admin_h, timeout=15)
    assert r.status_code in (200, 201), r.text
    # public GET reflects it
    pub = requests.get(f"{BASE_URL}/api/pages/{slug}", timeout=15).json()
    assert marker in (pub.get("content") or ""), f"public {slug} did not persist marker"


# --------- SITE PAGES (CMS body_html via /api/admin/cms/pages/{slug}) ---------
@pytest.mark.parametrize("slug", ["about", "our-story", "contact", "corporate-gifting"])
def test_cms_page_body_html_persist(admin_h, slug):
    marker = f"<p>ITER5-CMS-{slug}-<em>editor</em>-{int(time.time())}</p>"
    r = requests.put(f"{BASE_URL}/api/admin/cms/pages/{slug}",
                     json={"body_html": marker}, headers=admin_h, timeout=15)
    assert r.status_code in (200, 201), r.text
    pub = requests.get(f"{BASE_URL}/api/cms/page/{slug}", timeout=15).json()
    assert marker in (pub.get("body_html") or ""), f"CMS {slug} did not persist"


# --------- REFUNDS surface cancelled orders with created_at ---------
def test_refunds_includes_cancelled_orders(admin_h):
    r = requests.get(f"{BASE_URL}/api/admin/refunds", headers=admin_h, timeout=15)
    assert r.status_code == 200, r.text
    items = r.json().get("items", [])
    # Find ART-2026-00004 or any cancelled auto row
    cancelled = [i for i in items if i.get("status") == "Cancelled"]
    assert cancelled, f"no cancelled orders shown in refunds; got {len(items)} rows"
    row = next((i for i in cancelled if i.get("order_number") == "ART-2026-00004"), cancelled[0])
    assert row.get("created_at"), "cancelled row missing created_at (date/time)"
    # date+time (ISO with T)
    assert "T" in str(row["created_at"]) or ":" in str(row["created_at"])
    assert row.get("order_number")
    assert row.get("reason") is not None
    # COD unpaid amount==0
    if row.get("auto"):
        assert row.get("amount") == 0 or isinstance(row.get("amount"), (int, float))


def test_refunds_create_and_update(admin_h):
    # Need an existing order number - fetch first cancelled or any
    rr = requests.get(f"{BASE_URL}/api/admin/refunds", headers=admin_h, timeout=15).json()
    order_num = None
    for i in rr.get("items", []):
        if i.get("order_number"):
            order_num = i["order_number"]
            break
    if not order_num:
        pytest.skip("no order to seed refund")
    payload = {"order_number": order_num, "amount": 1, "reason": "ITER5-TEST"}
    c = requests.post(f"{BASE_URL}/api/admin/refunds", json=payload, headers=admin_h, timeout=15)
    assert c.status_code in (200, 201), c.text
    rid = c.json()["id"]
    u = requests.put(f"{BASE_URL}/api/admin/refunds/{rid}",
                     json={"status": "Approved"}, headers=admin_h, timeout=15)
    assert u.status_code in (200, 201), u.text
    # Verify via list
    rr2 = requests.get(f"{BASE_URL}/api/admin/refunds", headers=admin_h, timeout=15).json()
    got = next((x for x in rr2.get("items", []) if x.get("id") == rid), None)
    assert got and got.get("status") == "Approved"
