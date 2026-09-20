import React, { useEffect, useState } from "react";
import { adminApi, apiError } from "../lib/api";
import { inr, formatDateTime } from "../lib/utils";
import { Modal, StatusChip, Field, inputCls } from "./ui";
import InvoiceDownloadButton from "../components/InvoiceDownloadButton";
import { toast } from "sonner";
import { Clock3, PackageCheck, Truck, CreditCard, Tag, Gift, FileText, MessageSquare } from "lucide-react";

const STATUSES = ["Pending", "Confirmed", "Processing", "Packed", "Shipped", "Out for Delivery", "Delivered", "Cancelled", "Returned", "Refunded", "Failed"];

export default function OrderDetailModal({ orderNumber, onClose, onSaved, editable = false }) {
  const [o, setO] = useState(null);
  const [status, setStatus] = useState("");
  const [tracking, setTracking] = useState({ number: "", courier: "" });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => adminApi.get(`/orders/${orderNumber}`).then(({ data }) => { setO(data); setStatus(data.status); setTracking(data.tracking || { number: "", courier: "" }); }).catch(() => setO(false));
  useEffect(() => { if (orderNumber) load(); }, [orderNumber]);

  const updateStatus = async () => {
    setSaving(true);
    try {
      const payload = { status };
      if (status === "Returned") payload.resellable = window.confirm("Mark returned items as resellable and add them back to stock? Click Cancel for non-resellable return.");
      const { data } = await adminApi.put(`/orders/${orderNumber}/status`, payload);
      setO(data); toast.success("Order status updated"); onSaved?.();
    } catch (e) { toast.error(apiError(e)); }
    finally { setSaving(false); }
  };
  const updateTracking = async () => {
    try { const { data } = await adminApi.put(`/orders/${orderNumber}/tracking`, tracking); setO(data); toast.success("Tracking saved"); onSaved?.(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const addNote = async () => {
    if (!note.trim()) return;
    try { await adminApi.post(`/orders/${orderNumber}/note`, { note: note.trim() }); setNote(""); await load(); toast.success("Note added"); }
    catch (e) { toast.error(apiError(e)); }
  };
  const updateArtworkStatus = async (itemIndex, artworkStatus) => {
    try { await adminApi.put(`/orders/${orderNumber}/artwork-status`, { item_index: itemIndex, artwork_status: artworkStatus }); await load(); toast.success("Artwork status updated"); }
    catch (e) { toast.error(apiError(e)); }
  };

  return (
    <Modal open title={orderNumber ? `Order ${orderNumber}` : "Order"} onClose={onClose} wide>
      {!o ? <p className="text-gray-400 text-sm">{o === false ? "Unable to load order." : "Loading…"}</p> : (
        <div className="space-y-6" data-testid="admin-order-detail">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div><div className="flex flex-wrap items-center gap-2"><StatusChip status={o.status} /><StatusChip status={o.payment?.status} /><span className="text-xs text-gray-400">Created {formatDateTime(o.created_at)}</span></div><p className="text-xs text-gray-400 mt-2">Updated {formatDateTime(o.updated_at)}</p></div>
            <div className="flex items-center gap-3"><InvoiceDownloadButton orderNumber={orderNumber} admin className="inline-flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"/><span className="text-2xl font-semibold text-gray-900">{inr(o.pricing?.total)}</span></div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4"><h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-2"><FileText size={13}/> Customer</h4><p className="font-medium text-gray-900 mt-2">{o.customer?.name || "—"}</p><p className="text-sm text-gray-600">{o.customer?.phone || "—"}</p><p className="text-sm text-gray-600 break-all">{o.customer?.email || "—"}</p></div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4"><h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-2"><Truck size={13}/> Shipping</h4>{(() => { const a=o.address||{}; return <p className="text-sm text-gray-600 leading-relaxed mt-2">{a.name && <><b className="text-gray-900">{a.name}</b><br/></>}{a.line1}{a.line2 ? `, ${a.line2}` : ""}{a.area ? `, ${a.area}` : ""}<br/>{a.city}, {a.state} — {a.pincode}{a.phone ? <><br/>Phone: {a.phone}</> : null}</p>; })()}</div>
          </div>

          <div className="rounded-2xl border border-gray-200 overflow-hidden"><div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between"><h4 className="text-sm font-semibold text-gray-900">Order items</h4><span className="text-xs text-gray-500">{(o.items||[]).reduce((n,i)=>n+Number(i.qty||0),0)} units</span></div><div className="divide-y divide-gray-100">{(o.items||[]).map((it,i)=><div key={i} className="p-4 flex gap-3 items-start"><img src={it.image} alt="" className="w-14 h-16 rounded-lg object-cover bg-gray-100 shrink-0"/><div className="flex-1 min-w-0"><p className="font-medium text-gray-900 artful-product-name">{it.name}</p><div className="mt-1 text-xs text-gray-500">SKU {it.sku || "—"} · Qty {it.qty} · Unit {inr(it.price)}</div><div className="flex flex-wrap gap-2 mt-2">{it.bulk_order?.applied && <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 text-violet-700 px-2 py-1 text-[11px]"><Tag size={11}/> Bulk price</span>}{it.gift_wrap && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-1 text-[11px]"><Gift size={11}/> Gift wrap</span>}</div>{it.bulk_order?.applied && <p className="text-xs text-violet-700 mt-2">Base price {inr(it.base_price)} · Applied bulk rate {inr(it.price)} / pc</p>}{it.personalization && <p className="text-xs text-plum mt-2 break-words"><b>Personalisation:</b> “{it.personalization}”</p>}</div><div className="font-semibold text-gray-900">{inr(it.line_total ?? (it.price * it.qty))}</div></div>)}</div></div>

          {(o.items || []).some((it) => (it.artwork || []).length > 0) && <div className="rounded-2xl border border-plum/20 bg-plum/5 p-4">
            <h4 className="text-sm font-semibold text-plum flex items-center gap-2"><FileText size={14}/> Customer artwork</h4>
            <p className="text-xs text-gray-500 mt-1">Print files uploaded by the customer for this order.</p>
            <div className="mt-3 space-y-3">
              {(o.items || []).map((it, ii) => (it.artwork || []).length > 0 && <div key={ii} className="rounded-xl border border-gray-200 bg-white p-3">
                <p className="text-sm font-medium text-gray-900">{it.name}</p>
                <div className="mt-2 space-y-2">{it.artwork.map((a, ai) => <div key={ai} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2"><div className="min-w-0"><p className="text-xs font-medium truncate">{a.filename || `Artwork ${ai + 1}`}</p><p className="text-[11px] text-gray-400">{a.content_type || "file"} · {a.size ? `${Math.round(a.size / 1024)} KB` : ""}</p></div><a href={a.url} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg bg-plum text-white px-3 py-1.5 text-xs">Open / Download</a></div>)}</div>
                <div className="mt-3 flex items-center gap-2"><span className="text-[11px] text-gray-500">Artwork status</span><select value={it.artwork_status || "Artwork Received"} onChange={e => updateArtworkStatus(ii, e.target.value)} className={inputCls + " text-xs max-w-xs"}>{["Awaiting Artwork","Artwork Received","Artwork Under Review","Artwork Approved","Artwork Issue"].map(s => <option key={s}>{s}</option>)}</select></div>
              </div>)}
            </div>
          </div>}

          {(o.items || []).some((it) => it.bulk_order?.applied) && <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
            <h4 className="text-sm font-semibold text-violet-900 flex items-center gap-2"><Tag size={14}/> Bulk order details</h4>
            <div className="mt-3 space-y-2">
              {(o.items || []).filter((it) => it.bulk_order?.applied).map((it, i) => {
                const regular = Number(it.bulk_order?.regular_unit_price ?? it.base_price ?? it.price ?? 0);
                const bulk = Number(it.bulk_order?.selected_tier_unit_price ?? it.price ?? 0);
                const qty = Number(it.qty || 0);
                const saving = Number(it.bulk_order?.savings ?? Math.max(0, (regular - bulk) * qty));
                return <div key={i} className="rounded-xl border border-violet-100 bg-white p-3 text-sm">
                  <div className="flex items-center justify-between gap-3"><span className="font-medium text-gray-900">{it.name}</span><span className="font-semibold text-violet-700">{inr(bulk * qty)}</span></div>
                  <div className="mt-1 text-xs text-gray-500">Tier: {it.bulk_order?.selected_tier_quantity || qty} pcs · Regular {inr(regular)} / pc → Bulk {inr(bulk)} / pc</div>
                  {saving > 0 && <div className="mt-1 text-xs font-medium text-emerald-700">Customer saved {inr(saving)}</div>}
                </div>;
              })}
            </div>
          </div>}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-200 p-4"><h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-2"><CreditCard size={13}/> Payment & Promotions</h4><div className="mt-3 space-y-2 text-sm"><div className="flex justify-between"><span className="text-gray-500">Method</span><b>{o.payment?.method || o.payment_method || "—"}</b></div><div className="flex justify-between"><span className="text-gray-500">Status</span><StatusChip status={o.payment?.status}/></div>{o.payment?.razorpay_payment_id && <div className="flex justify-between gap-4"><span className="text-gray-500">Transaction</span><span className="font-mono text-xs break-all text-right">{o.payment.razorpay_payment_id}</span></div>}{o.pricing?.coupon_code && <div className="flex justify-between"><span className="text-gray-500">Promo code</span><b>{o.pricing.coupon_code}</b></div>}<div className="flex justify-between"><span className="text-gray-500">Discount</span><b className="text-emerald-700">−{inr(o.pricing?.discount)}</b></div></div></div>
            <div className="rounded-2xl border border-gray-200 p-4"><h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Order summary</h4><div className="mt-3 space-y-2 text-sm"><div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{inr(o.pricing?.subtotal)}</span></div><div className="flex justify-between"><span className="text-gray-500">Shipping</span><span>{o.pricing?.shipping ? inr(o.pricing.shipping) : "Free"}</span></div><div className="flex justify-between"><span className="text-gray-500">Tax</span><span>{inr(o.pricing?.tax)}</span></div><div className="flex justify-between font-semibold text-gray-900 pt-2 border-t border-gray-100"><span>Total</span><span>{inr(o.pricing?.total)}</span></div></div></div>
          </div>

          {editable && <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-200 p-4"><h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><PackageCheck size={15}/> Manage order</h4><div className="mt-3"><Field label="Status"><select value={status} onChange={e=>setStatus(e.target.value)} className={inputCls}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></Field><button onClick={updateStatus} disabled={saving} className="mt-3 w-full rounded-lg bg-plum text-white py-2.5 text-sm disabled:opacity-50">{saving ? "Updating…" : "Update Status"}</button></div><div className="mt-4 border-t pt-4"><Field label="Courier"><input value={tracking.courier||""} onChange={e=>setTracking({...tracking,courier:e.target.value})} className={inputCls}/></Field><div className="mt-3"><Field label="Tracking / AWB"><input value={tracking.number||""} onChange={e=>setTracking({...tracking,number:e.target.value})} className={inputCls}/></Field></div><button onClick={updateTracking} className="mt-3 w-full rounded-lg border border-gray-300 py-2.5 text-sm">Save Tracking</button></div></div>
            <div className="rounded-2xl border border-gray-200 p-4"><h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><MessageSquare size={15}/> Internal notes</h4><textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} placeholder="Add an internal note…" className={inputCls+" mt-3"}/><button onClick={addNote} className="mt-2 w-full rounded-lg bg-gray-900 text-white py-2.5 text-sm">Add Note</button>{(o.internal_notes||[]).length>0 && <div className="mt-4 space-y-2 max-h-32 overflow-auto">{o.internal_notes.slice().reverse().map((n,i)=><div key={i} className="rounded-lg bg-gray-50 p-2.5 text-xs"><p className="text-gray-700">{n.note}</p><p className="text-gray-400 mt-1">{n.by} · {formatDateTime(n.at)}</p></div>)}</div>}</div>
          </div>}

          <div className="rounded-2xl border border-gray-200 p-4"><h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Clock3 size={15}/> Status timeline</h4><div className="mt-3 space-y-3">{(o.status_history||[]).map((h,i)=><div key={i} className="flex gap-3"><div className="w-2 h-2 rounded-full bg-plum mt-1.5 shrink-0"/><div><p className="text-sm text-gray-800"><b>{h.status}</b>{h.note ? ` — ${h.note}` : ""}</p><p className="text-xs text-gray-400">{formatDateTime(h.at)}</p></div></div>)}</div></div>
        </div>
      )}
    </Modal>
  );
}
