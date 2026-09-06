# ARTFUL — Premium Gifting E-commerce + Admin Panel

## Problem Statement
Build ARTFUL, a premium artistic lifestyle & thoughtful-gifting D2C platform: polished storefront + secure admin/CMS, scalable DB, passwordless customer auth (OTP), guest checkout, Google login, payments, catalog/inventory/orders/coupons, smart typo-tolerant search, homepage CMS, analytics. MVP-first, production-quality foundation. Everything must work end-to-end — no fake functionality.

## Tech Stack / Architecture
- Frontend: React (CRA) + Tailwind + react-router v6 + axios + sonner + lucide-react
- Backend: FastAPI + Motor (MongoDB async), JWT (Bearer) auth for customer & admin, bcrypt, RBAC
- DB: MongoDB (UUID string ids, `_id` excluded everywhere)
- Layered modules: db, security (auth/RBAC), pricing (server-side totals/coupons), search_engine (normalization/fuzzy/synonyms/intent/budget), integrations (Twilio/Razorpay/Emergent Google), routers_store / routers_shop / routers_admin, seed

## User Choices
- Payments: Razorpay (keys not yet provided → DEV/demo mode, mock-pay, clearly labelled)
- OTP: Twilio (keys not yet provided → DEV OTP returned in API/UI)
- Google login: Emergent-managed Google Auth
- Currency: INR ₹; palette derived from plum/wine logo

## Personas
- Shopper (guest → auto account via verified mobile), returning customer, admin/operations team (RBAC roles).

## Implemented (2026-06 — Iteration 1, verified 33/33 backend + all critical FE flows)
- Storefront: editorial homepage (CMS-driven), shop/catalog with filters+sort+pagination, category & collection pages, PDP (gallery, personalization, gift wrap, pincode, accordions, related), smart search (typo correction, autocomplete, budget/intent, zero-result fallback), cart drawer + cart page, guest checkout (inline OTP → address → coupon → payment), DEV/COD/Razorpay payment, order success, order tracking, account (profile/orders/addresses/wishlist), corporate gifting form, FAQ, static pages, footer/newsletter.
- Auth: passwordless OTP (Twilio + DEV fallback), Emergent Google login, automatic account creation/linking by verified mobile/email (no duplicates), JWT.
- Commerce engine: server-side pricing, coupon engine (%/flat/free-ship/first-order/min-cart/caps), inventory reserve→deduct, idempotent payment/order creation, order status history.
- Admin: JWT login + RBAC (8 roles, server-enforced), dashboard, products CRUD + duplicate + bulk + inventory, categories, collections, reviews moderation, orders (status/tracking/notes), customers (detail/status), coupons, search rules (synonyms/corrections/analytics), homepage CMS (toggle/edit), banners/pages/FAQs, corporate pipeline, admin users & roles, audit logs, settings (incl. integration status), CSV export (products/orders/customers).
- Security verified: cross-customer order access → 404; admin APIs require token (401/403).

## Backlog / Next
- P1: reviews on PDP submission UX polish, refund management UI wiring in admin, shipping zones & tax config UI, media library, advanced promotions/discounts UI, notification provider (SendGrid/WhatsApp), SEO meta/sitemap.
- P2: semantic search, recommendations (frequently-bought-together), customer segmentation, campaign automation.
- Hardening: janitor to release stale inventory reservations for abandoned unpaid orders; migrate FastAPI startup → lifespan; tighten CORS if cookies introduced.
- Go-live: add RAZORPAY_KEY_ID/SECRET and TWILIO_* to backend .env to switch from DEV to live automatically.

## Credentials
See /app/memory/test_credentials.md

---

## Phase 1 — Storefront Overhaul (Completed 2026-06-06)
Env fix on load-in: recreated missing `backend/.env` & `frontend/.env`, pinned `pydantic-core==2.27.2` (was 2.46.5, incompatible with pydantic 2.10.4).

Implemented & tested (backend 16/16, frontend flows 100%):
- Brand logos (plum/cream) in header & footer; favicon; page `<title>`/meta.
- Light/Dark theme (CSS-variable driven) with header toggle, persisted in localStorage.
- Global scrollbar hidden (width 0) across site & admin.
- Branded page loader (centered logo + % counter, CSS auto-hide + interaction/timer dismissal). `?noloader=1` disables it for inspection/screenshot tooling.
- India-focused cookie consent (Accept All / Reject Optional / Cookie Settings), DPDP note, consent-gated analytics/marketing, reopen from footer.
- Header nav "About" -> /about (was /our-story).
- Admin-controllable hero CAROUSEL (embla) with per-slide TRUST BADGES (7-Day Returns, Best Quality, Best Price, etc.) — data in `homepage_sections.hero.slides`.
- Clickable CATEGORY MARQUEE right after hero (icons per category).
- Redesigned "Why ARTFUL" values section; old newsletter section replaced by meaningful "ARTFUL Promise" band.
- Confetti on order-success; newsletter thank-you popup with confetti.
- Newsletter subscribe + contact form now persist to DB (feed admin in Phase 2) via /api/newsletter/subscribe & /api/contact/submit (+ notifications).
- Contact page details -> Indore address, +91 8871288853 (call/whatsapp), support@artful.com (from settings).
- Checkout: qty +/- and remove controls in order summary (totals recompute).
- Profile: edit name, phone (with uniqueness/validation) and email.
- Cancel-order modal with required T&C + Refund Policy checkbox (links to /terms & /returns), reason select.
- Twilio SMS wired for order confirmation & cancellation via `integrations.send_sms()` — **DEV MODE (MOCKED): logs to backend stdout** until real Twilio messaging creds provided. OTP still DEV mode.

## Phase 2 — Admin (Backlog, not started)
Dashboard KPIs + notifications (new/cancel orders), data tables w/ filters everywhere, fix Customers data + detail view + KPIs, Visitors page (login identity capture), Newsletter subscribers page, Support/contact messages page, recent-order click-through to detail w/ customer, remove Banner page, CKEditor for policy/About/Our Story/Contact CMS, Payments & Transactions list+detail, product section assignment (new arrival/best seller), admin design polish. Also: admin UI for editing hero carousel slides & trust badges (data model already supports `slides`).

## Pending inputs
- Full Twilio creds to switch SMS/OTP from DEV to live: TWILIO_ACCOUNT_SID (AC…), TWILIO_AUTH_TOKEN (or API key SID+secret), TWILIO_FROM_NUMBER, TWILIO_VERIFY_SERVICE.

---

## Iteration — 2026-06 · 17-item fix/feature batch (COMPLETE)
Load-in note: `.env` files were missing and were recreated; `pydantic-core` pinned to 2.27.2. Backend health `razorpay:true`.

Implemented & verified (testing agent iter-4: backend 22/22, all frontend flows green):
1. Form + mobile-number validation across Checkout, Account (profile/address), Contact, Corporate, Auth, Footer (helpers in `lib/utils.js`: isValidEmail/isValidPhone/isValidPincode/sanitizePhone).
2. Footer newsletter: added missing `POST /api/newsletter/subscribe` route + confirmation popup + email validation.
3. Admin data tables (search + filters + pagination) applied to Products, Inventory, Categories, Collections, Legal Pages, FAQs, Refunds, Visitors.
4/12. Visitors page fixed — added frontend `VisitorTracker` (App.js) calling `/api/track/visit` with identity when signed in.
5. Checkout & Account address: Indian States dropdown + City free-text (`INDIAN_STATES`).
6. Razorpay TEST-mode Pay Now enabled via configured keys.
7. Checkout order card shows a Gift Wrapping line when a wrapped item is present.
8/9. Admin order detail modal now reads `o.address` (shipping address) and shows Gift Wrapping charges.
10. Collections admin: dynamic Rules editor vs manual product picker.
11. Refunds admin shows date+time of cancellation (formatDateTime) in a data table.
13. Legal pages use RichEditor (CKEditor) and render as rich HTML on the website (StaticPage).
14. Removed about/our-story/contact/corporate-gifting from Legal Pages admin (seed delete_many).
15. Corporate Gifting added to admin Site Pages + CMS-driven public page.
16. About/Our Story/Contact public pages now CMS-driven and reflect admin edits.
17. Contact address/phone/whatsapp/email/office-hours editable in Site Pages and shown on Contact page.
