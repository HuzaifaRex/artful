import React, { useEffect, useState, useCallback } from "react";
import { Search, Download, Trash2 } from "lucide-react";
import { adminApi, apiError, API } from "../lib/api";
import { toast } from "sonner";
import { inr, formatDateTime } from "../lib/utils";
import { StatusChip, Modal, Field, inputCls, PageHead, Empty } from "./ui";

const STATUSES = ["Pending", "Confirmed", "Processing", "Packed", "Shipped", "Out for Delivery", "Delivered", "Cancelled", "Returned", "Refunded", "Failed"];

export default function Orders() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [selected, setSelected] = useState(new Set());

  const load = useCallback(() => adminApi.get(`/orders?status=${status}&q=${encodeURIComponent(q)}&page_size=100`).then(({ data }) => setItems(data.items)).catch(() => {}), [status, q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { setSelected(new Set()); }, [q, status]);
  const toggleSelected = (id) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleAll = () => setSelected((prev) => items.length && items.every((o) => prev.has(o.id)) ? new Set() : new Set(items.map((o) => o.id)));
  const bulkDelete = async () => {
    if (!selected.size) return;
    if (!window.confirm(`Permanently delete ${selected.size} selected order(s)? Payment/refund records tied to these orders may also be removed. This cannot be undone.`)) return;
    try { const { data } = await adminApi.post("/orders/bulk-delete", { ids: [...selected] }); toast.success(`${data.deleted} order(s) deleted`); setSelected(new Set()); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const exportCsv = () => window.open(`${API}/admin/export/orders`, "_blank");

  return (
    <div>
      <PageHead title="Orders" subtitle={`${items.length} orders`} action={<div className="flex items-center gap-2">
        {selected.size > 0 && <button onClick={bulkDelete} className="border border-red-200 text-red-600 bg-white rounded-md px-4 py-2 text-sm flex items-center gap-2 hover:bg-red-50" data-testid="bulk-delete-orders"><Trash2 size={15} /> Delete selected ({selected.size})</button>}
        <button onClick={exportCsv} className="border border-gray-300 rounded-md px-4 py-2 text-sm flex items-center gap-2 text-gray-700" data-testid="export-orders"><Download size={15} /> Export CSV</button>
      </div>} />
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order / customer…" className={inputCls + " pl-9"} data-testid="order-search" /></div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls + " max-w-[180px]"} data-testid="order-status-filter"><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-400 text-xs bg-gray-50 border-b border-gray-200"><th className="px-4 py-3 font-medium"><input type="checkbox" aria-label="Select all orders on this page" checked={items.length > 0 && items.every((o) => selected.has(o.id))} onChange={toggleAll} className="accent-plum w-4 h-4" /></th><th className="px-4 py-3 font-medium">Order</th><th className="px-4 py-3 font-medium">Customer</th><th className="px-4 py-3 font-medium">Total</th><th className="px-4 py-3 font-medium">Payment</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Date</th></tr></thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id} onClick={() => setOpen(o)} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" data-testid={`admin-order-${o.order_number}`}>
                <td className="px-4 py-3"><input type="checkbox" aria-label={`Select order ${o.order_number}`} checked={selected.has(o.id)} onChange={() => toggleSelected(o.id)} onClick={(e) => e.stopPropagation()} className="accent-plum w-4 h-4" /></td>
                <td className="px-4 py-3 font-medium text-gray-900">{o.order_number}</td>
                <td className="px-4 py-3 text-gray-600">{o.customer?.name || "—"}<br /><span className="text-xs text-gray-400">{o.customer?.phone}</span></td>
                <td className="px-4 py-3 text-gray-900">{inr(o.pricing.total)}</td>
                <td className="px-4 py-3"><StatusChip status={o.payment.status} /></td>
                <td className="px-4 py-3"><StatusChip status={o.status} /></td>
                <td className="px-4 py-3 text-gray-500 text-xs">{formatDateTime(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <Empty text="No orders found" />}
      </div>
      {open && <OrderModal order={open} onClose={() => setOpen(null)} onUpdated={() => { load(); }} setOpen={setOpen} />}
    </div>
  );
}

function OrderModal({ order, onClose, onUpdated, setOpen }) {
  const [status, setStatus] = useState(order.status);
  const [tracking, setTracking] = useState(order.tracking || { number: "", courier: "" });

  const updateStatus = async () => {
    try { const { data } = await adminApi.put(`/orders/${order.order_number}/status`, { status }); toast.success("Status updated"); setOpen(data); onUpdated(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const updateTracking = async () => {
    try { await adminApi.put(`/orders/${order.order_number}/tracking`, tracking); toast.success("Tracking updated"); onUpdated(); }
    catch (e) { toast.error(apiError(e)); }
  };

  return (
    <Modal open title={`Order ${order.order_number}`} onClose={onClose} wide>
      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Items</h4>
          <div className="space-y-2">
            {order.items.map((i, idx) => <div key={idx} className="flex justify-between text-sm"><span className="text-gray-700">{i.name} × {i.qty}</span><span className="text-gray-900">{inr(i.price * i.qty)}</span></div>)}
          </div>
          <div className="border-t border-gray-100 mt-3 pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{inr(order.pricing.subtotal)}</span></div>
            {order.pricing.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount ({order.pricing.coupon_code})</span><span>-{inr(order.pricing.discount)}</span></div>}
            <div className="flex justify-between text-gray-500"><span>Shipping</span><span>{order.pricing.shipping === 0 ? "Free" : inr(order.pricing.shipping)}</span></div>
            <div className="flex justify-between font-semibold text-gray-900"><span>Total</span><span>{inr(order.pricing.total)}</span></div>
          </div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mt-4 mb-1">Delivery Address</h4>
          <p className="text-sm text-gray-600">{order.address.name}, {order.address.phone}<br />{order.address.line1}, {order.address.line2}<br />{order.address.city}, {order.address.state} — {order.address.pincode}</p>
          <p className="text-xs text-gray-400 mt-2">Payment: {order.payment.provider} · {order.payment.status}{order.payment.dev_mode ? " (Demo)" : ""}</p>
        </div>
        <div className="space-y-4">
          <Field label="Order Status"><select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls} data-testid="order-status-select">{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <button onClick={updateStatus} className="bg-plum text-white rounded-md px-4 py-2 text-sm w-full" data-testid="update-status-btn">Update Status</button>
          <div className="border-t border-gray-100 pt-4">
            <Field label="Courier"><input value={tracking.courier || ""} onChange={(e) => setTracking({ ...tracking, courier: e.target.value })} className={inputCls} /></Field>
            <div className="mt-3"><Field label="Tracking / AWB Number"><input value={tracking.number || ""} onChange={(e) => setTracking({ ...tracking, number: e.target.value })} className={inputCls} /></Field></div>
            <button onClick={updateTracking} className="mt-3 border border-gray-300 rounded-md px-4 py-2 text-sm w-full text-gray-700">Save Tracking</button>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Timeline</h4>
            <ul className="text-xs text-gray-500 space-y-1">{order.status_history?.map((h, i) => <li key={i}>{formatDateTime(h.at)} — <b className="text-gray-700">{h.status}</b> {h.note}</li>)}</ul>
          </div>
        </div>
      </div>
    </Modal>
  );
}
