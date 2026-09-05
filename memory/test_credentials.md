# ARTFUL — Test Credentials

## Admin Panel
- URL: `/admin/login`
- Email: `admin@artful.com`
- Password: `Artful@2026`
- Role: `Super Admin` (full access)

## Customer (passwordless — OTP)
- Login via mobile OTP at checkout or `/account`.
- Twilio is NOT configured yet → **DEV OTP mode**: `POST /api/auth/otp/send` returns `dev_otp` in the response (also shown in the UI). Use that code to verify.
- Example test phone: `9876543210` (auto-normalised to `+919876543210`).

## Payments
- Razorpay is NOT configured yet → **DEV checkout mode**. Orders use `POST /api/checkout/mock-pay` (clearly marked DEMO, no real charge). COD is also available.
- To go live: set `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` in `/app/backend/.env`.

## Google Login
- Uses Emergent-managed Google Auth (no keys needed). Flow: `/account` → Continue with Google.

## Key API endpoints
- Public: `/api/products`, `/api/search`, `/api/cms/homepage`
- Customer: `/api/auth/otp/send|verify`, `/api/auth/google/session`, `/api/checkout/create-order`, `/api/checkout/verify-payment`, `/api/checkout/mock-pay`, `/api/orders`
- Admin: `/api/admin/auth/login`, `/api/admin/dashboard/stats`, `/api/admin/products`, `/api/admin/orders`, `/api/admin/coupons`
