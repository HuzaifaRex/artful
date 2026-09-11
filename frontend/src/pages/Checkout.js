import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Check, Lock, ShieldCheck, Minus, Plus, Trash2 } from "lucide-react";
import { api, apiError } from "../lib/api";
import { useStore } from "../context/StoreContext";
import { inr, giftWrapTotal, isValidPhone, isValidPincode, sanitizePhone, INDIAN_STATES } from "../lib/utils";
import { toast } from "sonner";

function loadScript(src) {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve(true);
    const s = document.createElement("script");
    s.src = src; s.onload = () => resolve(true); s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const EMPTY_ADDR = { name: "", phone: "", line1: "", line2: "", area: "", city: "", state: "", pincode: "", instructions: "" };

export default function Checkout() {
  const { cart, cartPayload, customer, loginSuccess, clearCart, updateQty, removeItem } = useStore();
  const navigate = useNavigate();
  const [totals, setTotals] = useState(null);
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState(null);
  // auth
  const [otpStep, setOtpStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devOtp, setDevOtp] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  // address & payment
  const [addr, setAddr] = useState(EMPTY_ADDR);
  const [method, setMethod] = useState("razorpay");
  const [placing, setPlacing] = useState(false);
  const [deliveryEstimate, setDeliveryEstimate] = useState(null);

  const validate = useCallback(async (c) => {
    if (cart.length === 0) return;
    try {
      const { data } = await api.post("/cart/validate", { items: cartPayload, coupon_code: c ?? applied });
      setTotals(data);
    } catch { /* ignore */ }
  }, [cart, cartPayload, applied]);

  useEffect(() => { validate(); }, [validate]);

  useEffect(() => {
    if (customer) {
      setAddr((a) => ({ ...a, name: a.name || customer.name || "", phone: a.phone || customer.phone || "" }));
      api.get("/addresses").then(({ data }) => {
        const def = data.items.find((x) => x.is_default) || data.items[0];
        if (def) setAddr({ ...EMPTY_ADDR, ...def });
      }).catch(() => {});
    }
  }, [customer]);

  useEffect(() => {
    const pin = addr.pincode || "";
    if (pin.length !== 6) {
      setDeliveryEstimate(null);
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get(`/delivery-estimate?pincode=${pin}`);
        setDeliveryEstimate(data);
      } catch {
        setDeliveryEstimate(null);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [addr.pincode]);

  if (cart.length === 0) {
    return <div className="container-artful py-24 text-center"><h1 className="section-title mb-4">Your cart is empty</h1><Link to="/shop" className="btn-primary">Shop Now</Link></div>;
  }

  const sendOtp = async () => {
    if (phone.replace(/\D/g, "").length < 10) return toast.error("Enter a valid mobile number");
    setAuthLoading(true);
    try {
      const { data } = await api.post("/auth/otp/send", { phone });
      setOtpStep("otp");
      if (data.dev_mode) { setDevOtp(data.dev_otp); toast.info(`Demo OTP: ${data.dev_otp}`, { duration: 8000 }); }
      else toast.success("OTP sent");
    } catch (e) { toast.error(apiError(e)); }
    setAuthLoading(false);
  };
  const verifyOtp = async () => {
    setAuthLoading(true);
    try {
      const { data } = await api.post("/auth/otp/verify", { phone, code });
      loginSuccess(data.token, data.customer);
      toast.success(data.new_account ? "Account created!" : "Verified");
    } catch (e) { toast.error(apiError(e)); }
    setAuthLoading(false);
  };
  const googleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(window.location.origin + "/checkout")}`;
  };

  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    try {
      await api.post("/coupons/validate", { items: cartPayload, code: coupon.trim() });
      setApplied(coupon.trim().toUpperCase()); validate(coupon.trim().toUpperCase());
      toast.success("Coupon applied"); setCoupon("");
    } catch (e) { toast.error(apiError(e)); }
  };

  const finalize = (orderNumber) => { clearCart(); navigate(`/order-success/${orderNumber}`); };

  const placeOrder = async () => {
    for (const f of ["name", "line1", "city", "state", "pincode"]) {
      if (!addr[f]) return toast.error("Please complete your delivery address");
    }
    if (!isValidPhone(addr.phone)) return toast.error("Enter a valid 10-digit mobile number in the address");
    if (!isValidPincode(addr.pincode)) return toast.error("Enter a valid 6-digit pincode");
    setPlacing(true);
    try {
      const { data } = await api.post("/checkout/create-order", {
        items: cartPayload, coupon_code: applied, address: addr, email: customer?.email, payment_method: method,
      });
      if (method === "cod" && data.confirmed) return finalize(data.order_number);

      if (data.dev_mode) {
        // DEMO mode — Razorpay not configured. Clearly not a real charge.
        const { data: res } = await api.post("/checkout/mock-pay", { order_id: data.order_id });
        if (res.success) { toast.success("Demo payment complete"); return finalize(res.order.order_number); }
      } else {
        const ok = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
        if (!ok) throw new Error("Could not load payment gateway");
        const rzp = new window.Razorpay({
          key: data.key_id, amount: data.amount, currency: "INR", name: "ARTFUL",
          description: `Order ${data.order_number}`, order_id: data.razorpay_order_id, prefill: data.prefill,
          theme: { color: "#5C3243" },
          handler: async (r) => {
            try {
              const { data: res } = await api.post("/checkout/verify-payment", {
                order_id: data.order_id, razorpay_payment_id: r.razorpay_payment_id,
                razorpay_order_id: r.razorpay_order_id, razorpay_signature: r.razorpay_signature,
              });
              if (res.success) finalize(res.order.order_number);
            } catch (e) { toast.error(apiError(e, "Payment verification failed")); }
          },
          modal: { ondismiss: () => toast.info("Payment cancelled") },
        });
        rzp.open();
      }
    } catch (e) { toast.error(apiError(e)); }
    setPlacing(false);
  };

  const setField = (name, value) => {
    if (name === "phone") value = sanitizePhone(value);
    if (name === "pincode") value = value.replace(/\D/g, "").slice(0, 6);
    setAddr({ ...addr, [name]: value });
  };
  const field = (name, label, req, extra = {}) => (
    <div className={extra.full ? "sm:col-span-2" : ""}>
      <label className="label-caption block mb-1.5">{label}{req && " *"}</label>
      {extra.type === "select" ? (
        <select value={addr[name]} onChange={(e) => setField(name, e.target.value)} className="input-field" data-testid={`addr-${name}`}>
          <option value="">Select {label}</option>
          {extra.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input value={addr[name]} onChange={(e) => setField(name, e.target.value)} inputMode={extra.numeric ? "numeric" : undefined} className="input-field" data-testid={`addr-${name}`} />
      )}
    </div>
  );

  return (
    <div className="container-artful py-10" data-testid="guest-checkout-flow">
      <h1 className="section-title mb-10">Checkout</h1>
      <div className="grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8">
          {/* Contact / Auth */}
          <section className="border border-line p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${customer ? "bg-ok text-white" : "bg-plum text-white"}`}>{customer ? <Check size={15} /> : "1"}</span>
              <h2 className="font-serif text-xl text-ink">Contact & Verification</h2>
            </div>
            {customer ? (
              <p className="text-sm text-ink-secondary pl-10">Signed in as <b>{customer.phone || customer.email}</b> · <Check size={13} className="inline text-ok" /> Verified</p>
            ) : (
              <div className="pl-10 space-y-3 max-w-sm">
                {otpStep === "phone" ? (
                  <>
                    <input value={phone} onChange={(e) => setPhone(sanitizePhone(e.target.value))} inputMode="numeric" placeholder="Mobile number" className="input-field" data-testid="checkout-phone-input" />
                    <button onClick={sendOtp} disabled={authLoading} className="btn-primary w-full" data-testid="checkout-send-otp">{authLoading ? "Sending…" : "Send OTP"}</button>
                    <div className="flex items-center gap-3"><div className="flex-1 h-px bg-line" /><span className="text-xs text-ink-muted">or</span><div className="flex-1 h-px bg-line" /></div>
                    <button onClick={googleLogin} className="btn-outline w-full !text-sm !normal-case !tracking-normal" data-testid="checkout-google"><img src="https://www.google.com/favicon.ico" alt="" className="w-4 h-4" /> Continue with Google</button>
                  </>
                ) : (
                  <>
                    <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Enter OTP" className="input-field text-center tracking-[0.4em] font-mono" data-testid="checkout-otp-input" />
                    {devOtp && <p className="text-xs text-warn">Demo OTP: <b>{devOtp}</b></p>}
                    <button onClick={verifyOtp} disabled={authLoading || code.length < 4} className="btn-primary w-full" data-testid="checkout-verify-otp">{authLoading ? "Verifying…" : "Verify"}</button>
                    <button onClick={() => setOtpStep("phone")} className="text-xs text-ink-muted">← Change number</button>
                  </>
                )}
              </div>
            )}
          </section>

          {/* Address */}
          <section className={`border border-line p-6 ${!customer ? "opacity-50 pointer-events-none" : ""}`}>
            <div className="flex items-center gap-3 mb-5"><span className="w-7 h-7 rounded-full bg-plum text-white flex items-center justify-center text-xs">2</span><h2 className="font-serif text-xl text-ink">Delivery Address</h2></div>
            <div className="grid sm:grid-cols-2 gap-4">
              {field("name", "Full Name", true)}
              {field("phone", "Mobile", true, { numeric: true })}
              {field("line1", "Flat / House No., Building", true, { full: true })}
              {field("line2", "Apartment / Road (optional)", false, { full: true })}
              {field("area", "Area / Locality", false)}
              {field("city", "City", true)}
              {field("state", "State", true, { type: "select", options: INDIAN_STATES })}
              {field("pincode", "Pincode", true, { numeric: true })}
              {field("instructions", "Delivery instructions (optional)", false, { full: true })}
            </div>
            {deliveryEstimate && (
              <div className="mt-4 bg-surface p-4" data-testid="checkout-delivery-estimate">
                <p className="label-caption mb-1.5">Delivery Estimate</p>
                <p className="text-sm text-ok flex items-center gap-1.5">
                  <Check size={14} /> {deliveryEstimate.dispatch_text} · {deliveryEstimate.delivery_text}
                </p>
                {deliveryEstimate.label && <p className="text-xs text-ink-muted mt-1">{deliveryEstimate.label}</p>}
              </div>
            )}
          </section>

          {/* Payment */}
          <section className={`border border-line p-6 ${!customer ? "opacity-50 pointer-events-none" : ""}`}>
            <div className="flex items-center gap-3 mb-5"><span className="w-7 h-7 rounded-full bg-plum text-white flex items-center justify-center text-xs">3</span><h2 className="font-serif text-xl text-ink">Payment</h2></div>
            <div className="space-y-3">
              {[["razorpay", "UPI / Cards / Net Banking / Wallets", "Secure payment via Razorpay"], ["cod", "Cash on Delivery", "Pay when your order arrives (+₹99)"]].map(([val, label, desc]) => (
                <label key={val} className={`flex items-start gap-3 border p-4 cursor-pointer ${method === val ? "border-plum bg-plum-light" : "border-line"}`} data-testid={`payment-${val}`}>
                  <input type="radio" name="method" checked={method === val} onChange={() => setMethod(val)} className="mt-1 accent-plum" />
                  <div><p className="text-sm font-medium text-ink">{label}</p><p className="text-xs text-ink-muted">{desc}</p></div>
                </label>
              ))}
            </div>
            <p className="flex items-center gap-2 text-xs text-ink-muted mt-4"><ShieldCheck size={14} /> Payments are verified server-side. We never store card details.</p>
          </section>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="bg-surface p-6 sticky top-28">
            <h3 className="font-serif text-2xl text-plum mb-5">Your Order</h3>
            <div className="space-y-4 max-h-72 overflow-y-auto mb-5 pr-1">
              {cart.map((i) => (
                <div key={i.key} className="flex gap-3 text-sm" data-testid={`checkout-item-${i.key}`}>
                  <img src={i.image} alt="" className="w-14 h-16 object-cover bg-cream shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-ink leading-tight line-clamp-2">{i.name}</p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="inline-flex items-center border border-line rounded-full">
                        <button onClick={() => i.qty > 1 ? updateQty(i.key, i.qty - 1) : removeItem(i.key)} className="w-7 h-7 flex items-center justify-center text-plum hover:bg-surface rounded-l-full" data-testid={`checkout-qty-dec-${i.key}`} aria-label="Decrease">
                          {i.qty > 1 ? <Minus size={13} /> : <Trash2 size={13} />}
                        </button>
                        <span className="w-8 text-center text-plum font-medium" data-testid={`checkout-qty-${i.key}`}>{i.qty}</span>
                        <button onClick={() => updateQty(i.key, i.qty + 1)} className="w-7 h-7 flex items-center justify-center text-plum hover:bg-surface rounded-r-full" data-testid={`checkout-qty-inc-${i.key}`} aria-label="Increase"><Plus size={13} /></button>
                      </div>
                      <span className="text-plum font-medium">{inr(i.price * i.qty)}</span>
                    </div>
                  </div>
                  <button onClick={() => removeItem(i.key)} className="text-ink-muted hover:text-err self-start" data-testid={`checkout-remove-${i.key}`} aria-label="Remove"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mb-4">
              <input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Coupon" className="input-field flex-1" data-testid="checkout-coupon-input" />
              <button onClick={applyCoupon} className="btn-primary !px-4">Apply</button>
            </div>
            {applied && <p className="text-xs text-ok mb-3">Coupon {applied} applied</p>}
            {totals && (
              <div className="space-y-2 text-sm border-t border-line pt-4">
                {(() => { const wrap = giftWrapTotal(totals.items); return (<>
                <div className="flex justify-between text-ink-secondary"><span>Subtotal</span><span>{inr(totals.subtotal - wrap)}</span></div>
                {wrap > 0 && <div className="flex justify-between text-ink-secondary" data-testid="checkout-giftwrap"><span>Gift Wrapping</span><span>{inr(wrap)}</span></div>}
                {totals.discount > 0 && <div className="flex justify-between text-ok"><span>Discount</span><span>-{inr(totals.discount)}</span></div>}
                <div className="flex justify-between text-ink-secondary"><span>Shipping</span><span>{totals.shipping === 0 ? "Free" : inr(totals.shipping)}</span></div>
                <div className="flex justify-between text-lg text-plum font-medium pt-2 border-t border-line-subtle"><span>Total</span><span data-testid="checkout-total">{inr(totals.total + (method === "cod" ? 99 : 0))}</span></div>
                </>); })()}
              </div>
            )}
            <button onClick={placeOrder} disabled={!customer || placing} className="btn-primary w-full mt-6" data-testid="place-order-btn">
              <Lock size={14} /> {placing ? "Processing…" : method === "cod" ? "Place Order" : "Pay Now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
