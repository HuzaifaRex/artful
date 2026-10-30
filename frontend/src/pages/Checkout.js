import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Check, Lock, ShieldCheck, Minus, Plus, Trash2 } from "lucide-react";
import { api, apiError } from "../lib/api";
import { useStore } from "../context/StoreContext";
import { inr, isValidPhone, isValidPincode, sanitizePhone, INDIAN_STATES, getCitiesForState } from "../lib/utils";
import { toast } from "sonner";

let razorpayScriptPromise = null;
function loadScript(src = "https://checkout.razorpay.com/v1/checkout.js") {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve(true);
  if (razorpayScriptPromise) return razorpayScriptPromise;
  razorpayScriptPromise = new Promise((resolve) => {
    // A script element left behind by a previous failed load may never emit another
    // error/load event. Remove it and retry cleanly instead of leaving checkout pending.
    const previous = document.querySelector(`script[src="${src}"]`);
    if (previous) previous.remove();
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    const finish = (loaded) => {
      razorpayScriptPromise = null;
      resolve(!!loaded && !!window.Razorpay);
    };
    script.addEventListener("load", () => finish(true), { once: true });
    script.addEventListener("error", () => finish(false), { once: true });
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
}

const EMPTY_ADDR = { name: "", phone: "", line1: "", line2: "", area: "", city: "", state: "", pincode: "", instructions: "" };

function getCustomizationSummary(item) {
  const cfg = item.customization_config || {};
  const selected = item.customization || {};
  const details = [];
  (cfg.options || []).forEach((opt) => {
    const ids = Array.isArray(selected[opt.id]) ? selected[opt.id] : [selected[opt.id]];
    const labels = ids.filter(Boolean).map((id) => (opt.values || []).find((v) => v.id === id)?.label).filter(Boolean);
    if (labels.length) details.push({ label: opt.name || "Option", value: labels.join(", ") });
  });
  const size = item.custom_size;
  if (size?.custom && size.width && size.height) details.push({ label: "Size", value: `${size.width} × ${size.height} ${size.unit || "mm"}` });
  else if (size?.label) details.push({ label: "Size", value: `${size.label}${size.width && size.height ? ` · ${size.width} × ${size.height} ${size.unit || "mm"}` : ""}` });
  return details;
}

export default function Checkout() {
  const { cart, cartPayload, customer, setCustomer, loginSuccess, clearCart, updateQty, removeItem, updateArtwork, settings } = useStore();
  const navigate = useNavigate();
  const [totals, setTotals] = useState(null);
  const [coupon, setCoupon] = useState("");
  const [couponOptions, setCouponOptions] = useState([]);
  const [couponOptionsLoading, setCouponOptionsLoading] = useState(false);
  const [couponApplying, setCouponApplying] = useState(false);
  const [applied, setApplied] = useState(null);
  const [totalsLoading, setTotalsLoading] = useState(false);
  const [totalsError, setTotalsError] = useState("");
  const codFee = Math.max(0, Number(settings?.cod_fee ?? 99));
  const canUseCod = cart.every((item) => item.cod_available !== false);
  // auth
  const [otpStep, setOtpStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devOtp, setDevOtp] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [phoneVerificationStep, setPhoneVerificationStep] = useState("phone");
  const [verifiedPhone, setVerifiedPhone] = useState("");
  // address & payment
  const [addr, setAddr] = useState(EMPTY_ADDR);
  const [method, setMethod] = useState("razorpay");
  const [placing, setPlacing] = useState(false);
  const [artworkUploading, setArtworkUploading] = useState({});
  const [deliveryEstimate, setDeliveryEstimate] = useState(null);
  const mobileVerified = customer?.phone_verified !== false;

  const validate = useCallback(async (c) => {
    if (cart.length === 0) return null;
    setTotalsLoading(true);
    setTotalsError("");
    const requestedCoupon = c === undefined ? applied : c;
    try {
      const { data } = await api.post("/cart/validate", {
        items: cartPayload,
        coupon_code: requestedCoupon,
        state: addr.state,
      });
      setTotals(data);
      if (requestedCoupon && data.coupon_error) {
        setApplied(null);
        toast.error(data.coupon_error);
      }
      return data;
    } catch (e) {
      setTotalsError(apiError(e, "Unable to calculate your order total. Please refresh and try again."));
      return null;
    } finally {
      setTotalsLoading(false);
    }
  }, [cart.length, cartPayload, applied, addr.state]);

  useEffect(() => { validate(); }, [validate]);
  useEffect(() => { if (!canUseCod && method === "cod") setMethod("razorpay"); }, [canUseCod, method]);

  useEffect(() => {
    if (!cart.length) { setCouponOptions([]); setCouponOptionsLoading(false); return undefined; }
    let active = true;
    setCouponOptionsLoading(true);
    api.post("/coupons/options", { items: cartPayload })
      .then(({ data }) => { if (active) setCouponOptions(Array.isArray(data.items) ? data.items : []); })
      .catch(() => { if (active) setCouponOptions([]); })
      .finally(() => { if (active) setCouponOptionsLoading(false); });
    return () => { active = false; };
  }, [cartPayload, cart.length]);

  useEffect(() => {
    if (customer) {
      if (customer.phone && customer.phone_verified === false) setVerifiedPhone(customer.phone);
      else if (customer.phone) setVerifiedPhone(customer.phone);
      setAddr((a) => ({ ...a, name: a.name || customer.name || "", phone: a.phone || customer.phone || "" }));
      api.get("/addresses").then(({ data }) => {
        const def = data.items.find((x) => x.is_default) || data.items[0];
        if (def) setAddr({ ...EMPTY_ADDR, ...def });
      }).catch(() => {});
    }
  }, [customer]);

  useEffect(() => {
    const state = (addr.state || "").trim();
    if (!state) {
      setDeliveryEstimate(null);
      return undefined;
    }

    let cancelled = false;
    api.get(`/delivery-estimate?state=${encodeURIComponent(state)}`)
      .then(({ data }) => {
        if (!cancelled) setDeliveryEstimate(data);
      })
      .catch(() => {
        if (!cancelled) setDeliveryEstimate(null);
      });

    return () => { cancelled = true; };
  }, [addr.state]);

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

  const sendPhoneVerificationOtp = async () => {
    const value = verifiedPhone.replace(/\D/g, "");
    if (value.length < 10) return toast.error("Enter a valid mobile number");
    setAuthLoading(true);
    try {
      const { data } = await api.post("/auth/otp/send", { phone: verifiedPhone });
      setPhoneVerificationStep("otp");
      if (data.dev_mode) {
        setDevOtp(data.dev_otp);
        toast.info(`Demo OTP: ${data.dev_otp}`, { duration: 8000 });
      } else {
        toast.success("OTP sent to your mobile");
      }
    } catch (e) {
      toast.error(apiError(e));
    }
    setAuthLoading(false);
  };

  const verifyCustomerPhone = async () => {
    setAuthLoading(true);
    try {
      const { data } = await api.post("/auth/otp/verify-phone", { phone: verifiedPhone, code });
      setCustomer(data.customer);
      setAddr((a) => ({ ...a, phone: data.customer.phone || a.phone }));
      setPhoneVerificationStep("phone");
      setCode("");
      setDevOtp(null);
      toast.success("Mobile number verified");
    } catch (e) {
      toast.error(apiError(e));
    }
    setAuthLoading(false);
  };

  const uploadArtwork = async (item, file) => {
    if (!file) return;
    const cfg = item.customization_config?.artwork || {};
    const formats = cfg.formats?.length ? cfg.formats : ["pdf", "jpg", "png"];
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!formats.includes(ext)) return toast.error(`Please upload: ${formats.map(x => x.toUpperCase()).join(", ")}`);
    const maxMb = Number(cfg.max_size_mb || 20);
    if (file.size > maxMb * 1024 * 1024) return toast.error(`File must be ${maxMb}MB or smaller.`);
    const current = item.artwork || [];
    const maxFiles = Math.max(1, Number(cfg.max_files || 1));
    if (current.length >= maxFiles) return toast.error(`Maximum ${maxFiles} artwork file${maxFiles > 1 ? "s" : ""} allowed.`);
    const fd = new FormData();
    fd.append("file", file);
    setArtworkUploading(s => ({...s, [item.key]: true}));
    try {
      const { data } = await api.post("/artwork/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      updateArtwork(item.key, [...current, { url: data.url, filename: data.filename, size: data.size, content_type: data.content_type, path: data.path }]);
      toast.success("Design uploaded");
    } catch (e) { toast.error(apiError(e, "Design upload failed")); }
    finally { setArtworkUploading(s => ({...s, [item.key]: false})); }
  };

  const removeArtwork = (item, index) => {
    updateArtwork(item.key, (item.artwork || []).filter((_, i) => i !== index));
  };

  const applyCouponCode = async (rawCode) => {
    const codeValue = String(rawCode || "").trim().toUpperCase();
    if (!codeValue) return;
    setCouponApplying(true);
    try {
      await api.post("/coupons/validate", { items: cartPayload, code: codeValue });
      const { data } = await api.post("/cart/validate", {
        items: cartPayload, coupon_code: codeValue, state: addr.state,
      });
      if (data.coupon_error || !data.coupon_code) throw new Error(data.coupon_error || "This coupon is not applicable to your cart.");
      setApplied(codeValue);
      setTotals(data);
      setCoupon("");
      toast.success(`Coupon ${codeValue} applied`);
    } catch (e) {
      toast.error(apiError(e, "Could not apply this coupon."));
    } finally {
      setCouponApplying(false);
    }
  };

  const applyCoupon = () => applyCouponCode(coupon);
  const removeCoupon = async () => {
    setApplied(null);
    setCoupon("");
    await validate(null);
    toast.success("Coupon removed");
  };

  const finalize = (orderNumber) => { clearCart(); navigate(`/order-success/${orderNumber}`); };

  const placeOrder = async () => {
    if (!customer || !mobileVerified) return toast.error("Please verify your mobile number before checkout");
    if (!totals || totalsLoading) return toast.error("Your order total is still being calculated. Please try again.");
    for (const f of ["name", "line1", "city", "state", "pincode"]) {
      if (!addr[f]) return toast.error("Please complete your delivery address");
    }
    if (!isValidPhone(addr.phone)) return toast.error("Enter a valid 10-digit mobile number in the address");
    if (!isValidPincode(addr.pincode)) return toast.error("Enter a valid 6-digit pincode");
    setPlacing(true);
    let createdOrderId = null;
    let paymentDialogActive = false;
    let paymentCallbackReceived = false;
    const cancelPendingOrder = async (orderId, reason) => {
      if (!orderId) return;
      try { await api.post("/checkout/cancel-payment", { order_id: orderId, reason }); } catch (_) { /* retain the original checkout error */ }
    };
    try {
      const { data } = await api.post("/checkout/create-order", {
        items: cartPayload, coupon_code: applied, address: addr, email: customer?.email, payment_method: method,
      });
      createdOrderId = data.order_id || null;
      if (method === "cod" && data.confirmed) {
        finalize(data.order_number);
        return;
      }

      if (data.dev_mode) {
        const { data: res } = await api.post("/checkout/mock-pay", { order_id: data.order_id });
        if (!res?.success || !res?.order?.order_number) throw new Error("Demo payment could not be confirmed. Please try again.");
        toast.success("Demo payment complete");
        finalize(res.order.order_number);
        return;
      }

      if (!data.key_id || !data.razorpay_order_id || !Number(data.amount)) {
        throw new Error(data.message || "The payment gateway did not return a valid payment order. Please contact support.");
      }
      const loaded = await loadScript();
      if (!loaded || !window.Razorpay) throw new Error("Secure payment window could not be loaded. Check your internet connection and try again.");

      const rzp = new window.Razorpay({
        key: data.key_id,
        amount: data.amount,
        currency: "INR",
        name: "ARTFUL",
        description: `Order ${data.order_number}`,
        order_id: data.razorpay_order_id,
        prefill: data.prefill,
        theme: { color: "#5C3243" },
        handler: async (response) => {
          paymentCallbackReceived = true;
          paymentDialogActive = false;
          setPlacing(true);
          try {
            const { data: verification } = await api.post("/checkout/verify-payment", {
              order_id: data.order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });
            if (!verification?.success) throw new Error("Payment was received but order confirmation is pending.");
            finalize(data.order_number);
          } catch (e) {
            try { sessionStorage.setItem(`artful-payment-error-${data.order_number}`, apiError(e, "Payment verification is still in progress")); } catch (_) { /* storage may be unavailable */ }
            toast.error(apiError(e, "Payment verification is still in progress. Your order status is being checked."));
            navigate(`/order-processing/${data.order_number}`);
          } finally {
            setPlacing(false);
          }
        },
        modal: { ondismiss: () => {
          paymentDialogActive = false;
          setPlacing(false);
          if (!paymentCallbackReceived) cancelPendingOrder(createdOrderId, "Payment window closed before payment was completed.");
          toast.info("Payment was cancelled. No payment was completed.");
        } },
      });
      rzp.on("payment.failed", (event) => {
        paymentDialogActive = false;
        paymentCallbackReceived = true;
        setPlacing(false);
        cancelPendingOrder(createdOrderId, event?.error?.description || "Payment failed.");
        toast.error(event?.error?.description || "Payment failed. Please try another payment method.");
      });
      paymentDialogActive = true;
      rzp.open();
    } catch (e) {
      paymentDialogActive = false;
      await cancelPendingOrder(createdOrderId, "Checkout could not be started.");
      toast.error(apiError(e, "Unable to start checkout. Please try again."));
    } finally {
      if (!paymentDialogActive) setPlacing(false);
    }
  };

  const setField = (name, value) => {
    if (name === "phone") value = sanitizePhone(value);
    if (name === "pincode") value = value.replace(/\D/g, "").slice(0, 6);
    if (name === "state" && !getCitiesForState(value).includes(addr.city)) { setAddr({ ...addr, state: value, city: "" }); return; }
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
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${customer && mobileVerified ? "bg-ok text-white" : "bg-plum text-white"}`}>{customer && mobileVerified ? <Check size={15} /> : "1"}</span>
              <h2 className="font-serif text-xl text-ink">Contact & Verification</h2>
            </div>
            {customer ? (
              customer.phone_verified !== false ? (
                <p className="text-sm text-ink-secondary pl-10">Signed in as <b>{customer.phone || customer.email}</b> · <Check size={13} className="inline text-ok" /> Mobile verified</p>
              ) : (
                <div className="pl-10 space-y-3 max-w-sm">
                  <p className="text-sm text-ink-secondary">Your account needs mobile verification before checkout. Please verify your mobile number with OTP.</p>
                  {phoneVerificationStep === "phone" ? (
                    <>
                      <input value={verifiedPhone} onChange={(e) => setVerifiedPhone(sanitizePhone(e.target.value))} inputMode="numeric" placeholder="Mobile number" className="input-field" data-testid="checkout-verify-phone-input" />
                      <button onClick={sendPhoneVerificationOtp} disabled={authLoading} className="btn-primary w-full" data-testid="checkout-verify-phone-send">{authLoading ? "Sending…" : "Send OTP"}</button>
                    </>
                  ) : (
                    <>
                      <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Enter OTP" className="input-field text-center tracking-[0.4em] font-mono" data-testid="checkout-verify-phone-otp" />
                      {devOtp && <p className="text-xs text-warn">Demo OTP: <b>{devOtp}</b></p>}
                      <button onClick={verifyCustomerPhone} disabled={authLoading || code.length < 4} className="btn-primary w-full" data-testid="checkout-verify-phone-confirm">{authLoading ? "Verifying…" : "Verify Mobile"}</button>
                      <button onClick={() => setPhoneVerificationStep("phone")} className="text-xs text-ink-muted">← Change number</button>
                    </>
                  )}
                </div>
              )
            ) : (
              <div className="pl-10 space-y-3 max-w-sm">
                {otpStep === "phone" ? (
                  <>
                    <input value={phone} onChange={(e) => setPhone(sanitizePhone(e.target.value))} inputMode="numeric" placeholder="Mobile number" className="input-field" data-testid="checkout-phone-input" />
                    <button onClick={sendOtp} disabled={authLoading} className="btn-primary w-full" data-testid="checkout-send-otp">{authLoading ? "Sending…" : "Send OTP"}</button>
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
          <section className={`border border-line p-6 ${!customer || !mobileVerified ? "opacity-50 pointer-events-none" : ""}`}>
            <div className="flex items-center gap-3 mb-5"><span className="w-7 h-7 rounded-full bg-plum text-white flex items-center justify-center text-xs">2</span><h2 className="font-serif text-xl text-ink">Delivery Address</h2></div>
            <div className="grid sm:grid-cols-2 gap-4">
              {field("name", "Full Name", true)}
              {field("phone", "Mobile", true, { numeric: true })}
              {field("line1", "Flat / House No., Building", true, { full: true })}
              {field("line2", "Apartment / Road (optional)", false, { full: true })}
              {field("area", "Area / Locality", false)}
              {field("state", "State", true, { type: "select", options: INDIAN_STATES })}
              {field("city", "City", true, { type: "select", options: getCitiesForState(addr.state) })}

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
          <section className={`border border-line p-6 ${!customer || !mobileVerified ? "opacity-50 pointer-events-none" : ""}`}>
            <div className="flex items-center gap-3 mb-5"><span className="w-7 h-7 rounded-full bg-plum text-white flex items-center justify-center text-xs">3</span><h2 className="font-serif text-xl text-ink">Payment</h2></div>
            <div className="space-y-3">
              {[["razorpay", "UPI / Cards / Net Banking / Wallets", "Secure payment via Razorpay"], ["cod", "Cash on Delivery", `Pay when your order arrives (+${inr(codFee)})`]].map(([val, label, desc]) => (
                <label key={val} className={`flex items-start gap-3 border p-4 cursor-pointer ${method === val ? "border-plum bg-plum-light" : "border-line"}`} data-testid={`payment-${val}`}>
                  <input type="radio" name="method" checked={method === val} disabled={val === "cod" && !canUseCod} onChange={() => setMethod(val)} className="mt-1 accent-plum" />
                  <div><p className="text-sm font-medium text-ink">{label}</p><p className="text-xs text-ink-muted">{desc}</p>{val === "cod" && !canUseCod && <p className="text-xs text-red-600 mt-1">Cash on Delivery is not available for one or more products in your cart.</p>}</div>
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
              {cart.map((i) => {
                const isCustom = i.product_type === "customizable" || i.customization_config?.enabled;
                const customDetails = isCustom ? getCustomizationSummary(i) : [];
                return (
                  <div key={i.key} className={`rounded-xl border bg-white p-3 ${isCustom ? "border-plum/20" : "border-line"}`} data-testid={`checkout-item-${i.key}`}>
                    <div className="grid grid-cols-[56px,minmax(0,1fr),auto] gap-3 items-start">
                      <img src={i.image} alt="" className="w-14 h-16 object-contain bg-cream rounded-md shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0"><p className="text-ink leading-tight line-clamp-2 font-medium">{i.name}</p>{isCustom && <span className="inline-flex mt-1 rounded-full bg-plum-light text-plum px-2 py-0.5 text-[10px] font-semibold">Custom Print</span>}</div>
                          <button onClick={() => removeItem(i.key)} className="text-ink-muted hover:text-err shrink-0" data-testid={`checkout-remove-${i.key}`} aria-label="Remove"><Trash2 size={15} /></button>
                        </div>
                        {Number(i.pack_quantity || 1) > 1 && <p className="text-[11px] text-ink-muted mt-1">Each product: {i.pack_quantity} {i.quantity_unit || "pieces"} · Quantity {i.qty} = {i.qty * Number(i.pack_quantity)} {i.quantity_unit || "pieces"}</p>}
                        {i.gift_wrap && <p className="text-[11px] text-amber-700 mt-1">Gift wrapping · {inr(i.wrap_price ?? i.gift_wrap_price ?? 199)} × {i.qty}</p>}
                        {i.bulk_order?.applied && <p className="text-[11px] text-violet-700 mt-1">Bulk rate applied · {inr(i.price)} / item</p>}
                        {customDetails.length > 0 && <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">{customDetails.map((d, idx) => <p key={idx} className="text-[11px] text-ink-secondary truncate"><span className="text-ink-muted">{d.label}:</span> {d.value}</p>)}</div>}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          {i.bulk_locked ? <span className="rounded-full bg-violet-50 text-violet-700 px-2.5 py-1 text-[11px] font-medium">Bulk · {i.qty} {i.bulk_tier_quantity ? (i.bulk_order?.tiers || []).find((t) => Number(t.min_quantity) === Number(i.bulk_tier_quantity))?.quantity_unit || i.quantity_unit || "pieces" : i.quantity_unit || "pieces"}</span> : <div className="inline-flex items-center border border-line rounded-full">
                            <button onClick={() => i.qty > 1 ? updateQty(i.key, i.qty - 1) : removeItem(i.key)} className="w-7 h-7 flex items-center justify-center text-plum hover:bg-surface rounded-l-full" data-testid={`checkout-qty-dec-${i.key}`} aria-label="Decrease">{i.qty > 1 ? <Minus size={13} /> : <Trash2 size={13} />}</button>
                            <span className="w-8 text-center text-plum font-medium" data-testid={`checkout-qty-${i.key}`}>{i.qty}</span>
                            <button onClick={() => updateQty(i.key, i.qty + 1)} className="w-7 h-7 flex items-center justify-center text-plum hover:bg-surface rounded-r-full" data-testid={`checkout-qty-inc-${i.key}`} aria-label="Increase"><Plus size={13} /></button>
                          </div>}
                          <span className="text-plum font-medium whitespace-nowrap">{inr(i.custom_total ?? (i.price * i.qty))}</span>
                        </div>
                      </div>
                    </div>
                    {i.customization_config?.artwork?.enabled && (
                      <div className="mt-3 rounded-xl border border-dashed border-line bg-surface/60 p-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="min-w-0"><p className="text-xs font-semibold text-ink">Your design {i.customization_config.artwork.required ? "*" : ""}</p><p className="text-[11px] text-ink-muted mt-0.5 break-words">{i.customization_config.artwork.instructions || `PDF, JPG, PNG · max ${i.customization_config.artwork.max_size_mb || 20}MB`}</p></div>
                          <label className="cursor-pointer shrink-0 rounded-lg border border-plum px-3 py-2 text-xs font-medium text-plum hover:bg-plum-light text-center">
                            <input type="file" className="hidden" accept={(i.customization_config.artwork.formats || ["pdf","jpg","png"]).map(x => x === "pdf" ? "application/pdf" : x === "png" ? "image/png" : "image/jpeg").join(",")} disabled={!customer || artworkUploading[i.key]} onChange={e => uploadArtwork(i, e.target.files?.[0])} />
                            {artworkUploading[i.key] ? "Uploading…" : ((i.artwork || []).length ? "Add another file" : "Upload Design")}
                          </label>
                        </div>
                        {(i.artwork || []).length > 0 && <div className="mt-2 grid gap-2">{i.artwork.map((a, ai) => <div key={ai} className="flex items-center justify-between gap-2 rounded-lg bg-white border border-line px-3 py-2 text-xs"><span className="truncate min-w-0">{a.filename}</span><button type="button" onClick={() => removeArtwork(i, ai)} className="text-err shrink-0">Remove</button></div>)}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="space-y-2 mb-4">
              <label className="block text-xs font-medium text-ink-secondary">Available offers</label>
              <select value={applied || ""} onChange={(e) => { const code = e.target.value; if (!code) { removeCoupon(); return; } const option = couponOptions.find((item) => item.code === code); if (option?.eligible) applyCouponCode(code); }} className="input-field w-full" data-testid="checkout-coupon-select" disabled={couponOptionsLoading || couponApplying}>
                <option value="">{couponOptionsLoading ? "Loading offers…" : "Select an eligible coupon"}</option>
                {couponOptions.map((option) => <option key={option.code} value={option.code} disabled={!option.eligible}>{option.code} — {option.description || "Special offer"}{option.eligible ? ` · Save ${inr(option.discount || 0)}${option.free_shipping ? " + Free shipping" : ""}` : ` · ${option.reason || "Not eligible"}`}</option>)}
              </select>
              {couponOptions.length === 0 && !couponOptionsLoading && <p className="text-[11px] text-ink-muted">No active coupons are available for this cart. You can still enter a coupon code below.</p>}
              {couponOptions.filter((option) => !option.eligible).slice(0, 2).map((option) => <p key={option.code} className="text-[11px] text-ink-muted">{option.code}: {option.reason || "Not eligible for this cart"}</p>)}
              <div className="flex gap-2"><input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Enter coupon code" className="input-field flex-1" data-testid="checkout-coupon-input" /><button onClick={applyCoupon} disabled={!coupon.trim() || couponApplying} className="btn-primary !px-4 disabled:opacity-50">{couponApplying ? "Applying…" : "Apply"}</button></div>
              {applied && <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800"><span><b>{applied}</b> applied{totals?.coupon_description ? ` · ${totals.coupon_description}` : ""}</span><button type="button" onClick={removeCoupon} className="underline font-semibold">Remove</button></div>}
            </div>
            {totals && (
              <div className="space-y-3 text-sm border-t border-line pt-4" data-testid="checkout-pricing-breakdown">
                <div className="flex justify-between text-ink-secondary"><span>Subtotal</span><span>{inr(totals.subtotal)}</span></div>
                {Number(totals.gift_wrapping || 0) > 0 && <div className="flex justify-between text-ink-secondary" data-testid="checkout-giftwrap"><span>Gift wrapping</span><span>{inr(totals.gift_wrapping)}</span></div>}
                {Number(totals.discount || 0) > 0 && <div className="flex justify-between text-emerald-700"><span>Discount{totals.coupon_code ? ` (${totals.coupon_code})` : ""}</span><span>-{inr(totals.discount)}</span></div>}
                <div className="flex justify-between text-ink-secondary"><span>Shipping</span>{totals.shipping === 0 ? <span className="font-semibold text-emerald-700">Free shipping</span> : <span>{inr(totals.shipping)}</span>}</div>
                {Number(totals.tax || 0) > 0 && <div className="flex justify-between text-ink-secondary"><span>Tax</span><span>{inr(totals.tax)}</span></div>}
                {method === "cod" && codFee > 0 && <div className="flex justify-between text-ink-secondary"><span>Cash on Delivery fee</span><span>{inr(codFee)}</span></div>}
                <div className="border-t border-line-subtle pt-3 flex justify-between items-center text-lg text-plum font-semibold"><span>Order total</span><span data-testid="checkout-total">{inr(totals.total + (method === "cod" ? codFee : 0))}</span></div>
                {totals.shipping === 0 && <p className="text-[11px] text-emerald-700">Your order qualifies for free shipping.</p>}
                {totals.shipping > 0 && totals.shipping_note && <p className="text-[11px] text-ink-muted">{totals.shipping_note}</p>}
                {totalsError && <p className="text-xs text-err" role="alert">{totalsError}</p>}
                {(totals.errors || []).map((error, index) => <p key={`${error.product_id || "cart"}-${index}`} className="text-xs text-err" role="alert">{error.name ? `${error.name}: ` : ""}{error.error}</p>)}
                {totals.coupon_error && <p className="text-xs text-err" role="alert">{totals.coupon_error}</p>}
              </div>
            )}
            <button onClick={placeOrder} disabled={!customer || !mobileVerified || placing || totalsLoading || !totals || (totals.errors || []).length > 0} className="btn-primary w-full mt-6 disabled:opacity-50" data-testid="place-order-btn">
              <Lock size={14} /> {placing ? "Processing…" : totalsLoading ? "Calculating total…" : method === "cod" ? `Place order · ${inr((totals?.total || 0) + codFee)}` : `Pay Now · ${inr(totals?.total || 0)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
