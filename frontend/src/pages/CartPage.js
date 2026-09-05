import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag, Tag } from "lucide-react";
import { api, apiError } from "../lib/api";
import { useStore } from "../context/StoreContext";
import { inr } from "../lib/utils";
import { toast } from "sonner";

export default function CartPage() {
  const { cart, cartPayload, updateQty, removeItem } = useStore();
  const [totals, setTotals] = useState(null);
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState(null);
  const navigate = useNavigate();

  const validate = useCallback(async (code) => {
    if (cart.length === 0) { setTotals(null); return; }
    try {
      const { data } = await api.post("/cart/validate", { items: cartPayload, coupon_code: code ?? applied });
      setTotals(data);
      if (data.coupon_error && (code ?? applied)) { toast.error(data.coupon_error); setApplied(null); }
    } catch { setTotals(null); }
  }, [cart, cartPayload, applied]);

  useEffect(() => { validate(); }, [validate]);

  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    try {
      await api.post("/coupons/validate", { items: cartPayload, code: coupon.trim() });
      setApplied(coupon.trim().toUpperCase());
      validate(coupon.trim().toUpperCase());
      toast.success(`Coupon ${coupon.trim().toUpperCase()} applied`);
      setCoupon("");
    } catch (e) { toast.error(apiError(e)); }
  };

  if (cart.length === 0) {
    return (
      <div className="container-artful py-24 text-center">
        <ShoppingBag size={48} className="mx-auto text-ink-muted mb-6" strokeWidth={1} />
        <h1 className="section-title mb-3">Your cart is empty</h1>
        <p className="text-ink-secondary mb-8">Discover something beautiful to gift or keep.</p>
        <Link to="/shop" className="btn-primary">Start Shopping</Link>
      </div>
    );
  }

  return (
    <div className="container-artful py-12">
      <h1 className="section-title mb-10">Shopping Cart</h1>
      <div className="grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-6">
          {cart.map((item) => (
            <div key={item.key} className="flex gap-5 pb-6 border-b border-line" data-testid={`cartpage-item-${item.slug}`}>
              <img src={item.image} alt={item.name} className="w-24 h-32 object-cover bg-surface" />
              <div className="flex-1">
                <div className="flex justify-between">
                  <Link to={`/products/${item.slug}`} className="font-serif text-lg text-ink hover:text-plum">{item.name}</Link>
                  <button onClick={() => removeItem(item.key)} className="text-ink-muted hover:text-err"><Trash2 size={17} /></button>
                </div>
                {item.gift_wrap && <p className="text-xs text-plum mt-1">+ Gift wrap (₹199)</p>}
                {item.personalization && <p className="text-xs text-ink-muted mt-1">Personalization: "{item.personalization}"</p>}
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center border border-line">
                    <button onClick={() => updateQty(item.key, item.qty - 1)} className="p-2 text-plum"><Minus size={14} /></button>
                    <span className="px-4 text-sm">{item.qty}</span>
                    <button onClick={() => updateQty(item.key, item.qty + 1)} className="p-2 text-plum"><Plus size={14} /></button>
                  </div>
                  <span className="text-plum font-medium">{inr(item.price * item.qty)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-surface p-6 sticky top-28">
            <h3 className="font-serif text-2xl text-plum mb-6">Order Summary</h3>
            <div className="flex gap-2 mb-5">
              <input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Coupon code" className="input-field flex-1" data-testid="coupon-input" />
              <button onClick={applyCoupon} className="btn-primary !px-5" data-testid="apply-coupon-btn"><Tag size={15} /></button>
            </div>
            {applied && <p className="text-xs text-ok mb-4">Coupon <b>{applied}</b> applied</p>}
            {totals && (
              <div className="space-y-2.5 text-sm border-t border-line pt-4">
                <div className="flex justify-between text-ink-secondary"><span>Subtotal</span><span>{inr(totals.subtotal)}</span></div>
                {totals.discount > 0 && <div className="flex justify-between text-ok"><span>Discount</span><span>-{inr(totals.discount)}</span></div>}
                <div className="flex justify-between text-ink-secondary"><span>Shipping</span><span>{totals.shipping === 0 ? "Free" : inr(totals.shipping)}</span></div>
                {totals.tax > 0 && <div className="flex justify-between text-ink-secondary"><span>Tax</span><span>{inr(totals.tax)}</span></div>}
                <div className="flex justify-between text-xl text-plum font-medium pt-3 border-t border-line"><span>Total</span><span data-testid="cartpage-total">{inr(totals.total)}</span></div>
                {totals.savings > 0 && <p className="text-xs text-ok text-right">You're saving {inr(totals.savings)}</p>}
              </div>
            )}
            <button onClick={() => navigate("/checkout")} className="btn-primary w-full mt-6" data-testid="cartpage-checkout-btn">Proceed to Checkout</button>
            <Link to="/shop" className="btn-ghost w-full mt-2 justify-center">Continue Shopping</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
