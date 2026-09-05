import React, { useState } from "react";
import { api, apiError } from "../lib/api";
import { inr, formatDateTime } from "../lib/utils";
import { toast } from "sonner";

const STEPS = ["Order Placed", "Confirmed", "Processing", "Packed", "Shipped", "Out for Delivery", "Delivered"];

export default function TrackOrder() {
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);

  const track = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/orders/track", { order_number: orderNumber, phone });
      setOrder(data);
    } catch (err) { toast.error(apiError(err)); setOrder(null); }
    setLoading(false);
  };

  const currentIdx = order ? STEPS.findIndex((s) => order.status_history?.some((h) => h.status === s || (s === "Order Placed" && h.status === "Pending"))) : -1;
  const reached = (i) => order && order.status_history?.some((h) => STEPS.indexOf(h.status === "Pending" ? "Order Placed" : h.status) >= i && STEPS.indexOf(h.status === "Pending" ? "Order Placed" : h.status) === i) ? true : (order && i <= Math.max(...order.status_history.map((h) => STEPS.indexOf(h.status === "Pending" ? "Order Placed" : h.status))));

  return (
    <div className="container-artful py-16 max-w-2xl mx-auto">
      <h1 className="section-title text-center mb-3">Track Your Order</h1>
      <p className="text-ink-secondary text-center mb-10">Enter your order number and mobile to see live status.</p>
      <form onSubmit={track} className="bg-surface p-6 sm:p-8 space-y-4">
        <div><label className="label-caption block mb-1.5">Order Number *</label><input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value.toUpperCase())} placeholder="ART-2026-00001" className="input-field" data-testid="track-order-number" /></div>
        <div><label className="label-caption block mb-1.5">Mobile Number *</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Registered mobile" className="input-field" data-testid="track-phone" /></div>
        <button className="btn-primary w-full" disabled={loading} data-testid="track-submit">{loading ? "Searching…" : "Track Order"}</button>
      </form>

      {order && (
        <div className="mt-10 bg-white border border-line p-6 sm:p-8" data-testid="track-result">
          <div className="flex justify-between items-center mb-8">
            <div><p className="font-serif text-xl text-plum">{order.order_number}</p><p className="text-xs text-ink-muted">Placed {formatDateTime(order.created_at)}</p></div>
            <span className="text-sm bg-plum-light text-plum px-3 py-1">{order.status}</span>
          </div>
          {order.status !== "Cancelled" && (
            <div className="space-y-0 mb-8">
              {STEPS.map((s, i) => {
                const done = reached(i);
                return (
                  <div key={s} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-3.5 h-3.5 rounded-full ${done ? "bg-plum" : "bg-line"}`} />
                      {i < STEPS.length - 1 && <div className={`w-px h-8 ${done ? "bg-plum" : "bg-line"}`} />}
                    </div>
                    <span className={`text-sm -mt-0.5 ${done ? "text-ink font-medium" : "text-ink-muted"}`}>{s}</span>
                  </div>
                );
              })}
            </div>
          )}
          {order.tracking?.number && <p className="text-sm text-ink-secondary mb-4">Courier: {order.tracking.courier} · AWB: {order.tracking.number}</p>}
          <div className="border-t border-line pt-4 space-y-2">
            {order.items.map((i, idx) => <div key={idx} className="flex justify-between text-sm"><span className="text-ink-secondary">{i.name} × {i.qty}</span></div>)}
            <div className="flex justify-between text-plum font-medium pt-2"><span>Total</span><span>{inr(order.total)}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
