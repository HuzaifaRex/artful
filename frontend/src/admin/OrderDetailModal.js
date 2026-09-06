import React, { useEffect, useState } from "react";
import { adminApi } from "../lib/api";
import { inr, formatDateTime } from "../lib/utils";
import { Modal, StatusChip } from "./ui";

// Shared order detail modal with full customer details — reused by Dashboard & Transactions.
export default function OrderDetailModal({ orderNumber, onClose }) {
  const [o, setO] = useState(null);
  useEffect(() => {
    if (!orderNumber) return;
    adminApi.get(`/orders/${orderNumber}`).then(({ data }) => setO(data)).catch(() => setO(false));
  }, [orderNumber]);

  return (
    <Modal open title={orderNumber ? `Order ${orderNumber}` : "Order"} onClose={onClose} wide>
      {!o ? <p className="text-gray-400 text-sm">Loading…</p> : (
        <div className="space-y-6" data-testid="admin-order-detail">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <StatusChip status={o.status} />
              <StatusChip status={o.payment?.status} />
              <span className="text-xs text-gray-400">{formatDateTime(o.created_at)}</span>
            </div>
            <span className="text-xl font-semibold text-gray-900">{inr(o.pricing?.total)}</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Customer</h4>
              <p className="text-sm text-gray-900 font-medium">{o.customer?.name || "—"}</p>
              <p className="text-sm text-gray-600">{o.customer?.phone || "—"}</p>
              <p className="text-sm text-gray-600">{o.customer?.email || "—"}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Shipping Address</h4>
              {o.shipping_address ? (
                <p className="text-sm text-gray-600 leading-relaxed">
                  {o.shipping_address.line1}{o.shipping_address.line2 ? `, ${o.shipping_address.line2}` : ""}<br />
                  {o.shipping_address.city}, {o.shipping_address.state} — {o.shipping_address.pincode}
                </p>
              ) : <p className="text-sm text-gray-400">—</p>}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Items</h4>
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
              {(o.items || []).map((it, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  {it.image && <img src={it.image} alt="" className="w-12 h-14 object-cover rounded bg-gray-100" />}
                  <div className="flex-1 min-w-0"><p className="text-sm text-gray-900 truncate">{it.name}</p><p className="text-xs text-gray-500">Qty {it.qty} × {inr(it.price)}</p></div>
                  <span className="text-sm text-gray-900">{inr(it.price * it.qty)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Payment</h4>
              <p className="text-sm text-gray-600">Method: {o.payment?.method || "—"}</p>
              <p className="text-sm text-gray-600">Status: {o.payment?.status || "—"}</p>
              {o.payment?.razorpay_payment_id && <p className="text-sm text-gray-600 break-all">Txn: {o.payment.razorpay_payment_id}</p>}
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <div className="flex justify-between"><span>Subtotal</span><span>{inr(o.pricing?.subtotal)}</span></div>
              {o.pricing?.discount ? <div className="flex justify-between text-emerald-700"><span>Discount</span><span>−{inr(o.pricing.discount)}</span></div> : null}
              <div className="flex justify-between"><span>Shipping</span><span>{o.pricing?.shipping ? inr(o.pricing.shipping) : "Free"}</span></div>
              <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t border-gray-100"><span>Total</span><span>{inr(o.pricing?.total)}</span></div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
