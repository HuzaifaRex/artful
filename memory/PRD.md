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
