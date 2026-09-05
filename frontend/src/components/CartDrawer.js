import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { X, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { api } from "../lib/api";
import { inr } from "../lib/utils";

export default function CartDrawer() {
  const { cart, cartPayload, cartOpen, setCartOpen, updateQty, removeItem } = useStore();
  const [totals, setTotals] = useState(null);
  const navigate = useNavigate();

  const validate = useCallback(async () => {
    if (cart.length === 0) { setTotals(null); return; }
    try {
      const { data } = await api.post("/cart/validate", { items: cartPayload });
      setTotals(data);
    } catch { setTotals(null); }
  }, [cart, cartPayload]);

  useEffect(() => { if (cartOpen) validate(); }, [cartOpen, validate]);

  const threshold = totals?.free_shipping_threshold || 999;
  const progress = totals ? Math.min(100, (totals.subtotal / threshold) * 100) : 0;

  return (
    <>
      {cartOpen && <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setCartOpen(false)} />}
      <div className={`fixed top-0 right-0 bottom-0 w-full max-w-md bg-cream z-50 flex flex-col transition-transform duration-400 ${cartOpen ? "translate-x-0" : "translate-x-full"}`} data-testid="cart-drawer">
        <div className="flex items-center justify-between px-6 py-5 border-b border-line">
          <h3 className="font-serif text-2xl text-plum">Your Cart {cart.length > 0 && `(${cart.length})`}</h3>
          <button onClick={() => setCartOpen(false)} className="p-1 text-plum" data-testid="cart-close"><X size={22} /></button>
        </div>

        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
            <ShoppingBag size={44} className="text-ink-muted" strokeWidth={1} />
            <p className="text-ink-secondary">Your cart is empty.</p>
            <button className="btn-primary" onClick={() => { setCartOpen(false); navigate("/shop"); }}>Start Shopping</button>
          </div>
        ) : (
          <>
            {totals && totals.subtotal < threshold && (
              <div className="px-6 pt-4">
                <p className="text-xs text-ink-secondary mb-2">Add <b>{inr(threshold - totals.subtotal)}</b> more for complimentary shipping</p>
                <div className="h-1 bg-line rounded-full overflow-hidden"><div className="h-full bg-plum transition-all" style={{ width: `${progress}%` }} /></div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {cart.map((item) => (
                <div key={item.key} className="flex gap-4" data-testid={`cart-item-${item.slug}`}>
                  <img src={item.image} alt={item.name} className="w-20 h-24 object-cover bg-surface" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <Link to={`/products/${item.slug}`} onClick={() => setCartOpen(false)} className="font-serif text-base text-ink leading-tight line-clamp-2">{item.name}</Link>
                      <button onClick={() => removeItem(item.key)} className="text-ink-muted hover:text-err shrink-0" data-testid={`cart-remove-${item.slug}`}><Trash2 size={15} /></button>
                    </div>
                    {item.gift_wrap && <p className="text-[11px] text-plum mt-0.5">+ Gift wrap</p>}
                    {item.personalization && <p className="text-[11px] text-ink-muted mt-0.5 truncate">"{item.personalization}"</p>}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border border-line">
                        <button onClick={() => updateQty(item.key, item.qty - 1)} className="p-1.5 text-plum" data-testid={`cart-dec-${item.slug}`}><Minus size={13} /></button>
                        <span className="px-3 text-sm" data-testid={`cart-qty-${item.slug}`}>{item.qty}</span>
                        <button onClick={() => updateQty(item.key, item.qty + 1)} className="p-1.5 text-plum" data-testid={`cart-inc-${item.slug}`}><Plus size={13} /></button>
                      </div>
                      <span className="text-sm text-plum font-medium">{inr(item.price * item.qty)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-line px-6 py-5 space-y-4">
              {totals && (
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-ink-secondary"><span>Subtotal</span><span data-testid="cart-subtotal">{inr(totals.subtotal)}</span></div>
                  {totals.savings > 0 && <div className="flex justify-between text-ok"><span>You save</span><span>-{inr(totals.savings)}</span></div>}
                  <div className="flex justify-between text-ink-secondary"><span>Shipping</span><span>{totals.shipping === 0 ? "Free" : inr(totals.shipping)}</span></div>
                  <div className="flex justify-between text-lg text-plum font-medium pt-2 border-t border-line-subtle"><span>Total</span><span data-testid="cart-total">{inr(totals.total)}</span></div>
                </div>
              )}
              <button className="btn-primary w-full" onClick={() => { setCartOpen(false); navigate("/checkout"); }} data-testid="cart-checkout-btn">Proceed to Checkout</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
