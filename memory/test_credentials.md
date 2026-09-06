# ARTFUL — Test Credentials

## Admin Panel (`/admin/login`)
- Email: `admin@artful.com`
- Password: `Artful@2026`

## Customer (storefront) — Passwordless OTP (DEV mode)
- Twilio is in DEV mode. `POST /api/auth/otp/send` returns `dev_otp` in the response body (also logged to backend stdout).
- Test phone: `9876543210`

## Payments — Razorpay (TEST mode)
- Key ID: `rzp_test_TYIXd8zUjqE7NF` (configured in backend/.env)
- COD checkout can be used for full end-to-end order success without the gateway modal.

_Last updated: 2026-06 (load-in .env recreated; pydantic-core pinned to 2.27.2)._
