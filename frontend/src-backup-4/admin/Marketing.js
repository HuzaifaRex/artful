import React, { useEffect, useState, useCallback } from "react";
import { Plus, Edit, Archive } from "lucide-react";
import { adminApi, apiError } from "../lib/api";
import { toast } from "sonner";
import { inr } from "../lib/utils";
import { StatusChip, Modal, Field, inputCls, PageHead, Empty } from "./ui";

const TYPES = [["percentage", "Percentage %"], ["flat", "Flat ₹"], ["free_shipping", "Free Shipping"]];

export function Coupons() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = useCallback(() => adminApi.get("/coupons").then(({ data }) => setItems(data.items)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const f = editing;
    if (!f.code) return toast.error("Coupon code is required");
    const payload = { ...f, code: f.code.toUpperCase(), value: Number(f.value || 0), min_cart: Number(f.min_cart || 0), max_discount: f.max_discount ? Number(f.max_discount) : null };
    try {
      if (f.id) await adminApi.put(`/coupons/${f.id}`, payload);
      else await adminApi.post("/coupons", payload);
      toast.success("Coupon saved"); setEditing(null); load();
    } catch (e) { toast.error(apiError(e)); }
  };
  const del = async (c) => { if (!window.confirm(`Delete ${c.code}?`)) return; await adminApi.delete(`/coupons/${c.id}`); toast.success("Deleted"); load(); };

  return (
    <div>
      <PageHead title="Coupons & Discounts" subtitle="Create and manage promotions" action={<button onClick={() => setEditing({ type: "percentage", status: "Active", value: 10 })} className="bg-plum text-white rounded-md px-4 py-2 text-sm flex items-center gap-2" data-testid="add-coupon-btn"><Plus size={16} /> New Coupon</button>} />
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-400 text-xs bg-gray-50 border-b border-gray-200"><th className="px-4 py-3 font-medium">Code</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Value</th><th className="px-4 py-3 font-medium">Min Cart</th><th className="px-4 py-3 font-medium">Used</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Actions</th></tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50" data-testid={`coupon-${c.code}`}>
                <td className="px-4 py-3 font-mono font-medium text-plum">{c.code}</td>
                <td className="px-4 py-3 text-gray-600">{c.type}</td>
                <td className="px-4 py-3 text-gray-900">{c.type === "percentage" ? `${c.value}%` : c.type === "flat" ? inr(c.value) : "Free ship"}</td>
                <td className="px-4 py-3 text-gray-600">{c.min_cart ? inr(c.min_cart) : "—"}</td>
                <td className="px-4 py-3 text-gray-600">{c.used_count || 0}</td>
                <td className="px-4 py-3"><StatusChip status={c.status} /></td>
                <td className="px-4 py-3"><div className="flex gap-2 text-gray-400"><button onClick={() => setEditing(c)} className="hover:text-plum"><Edit size={15} /></button><button onClick={() => del(c)} className="hover:text-red-600"><Archive size={15} /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <Empty text="No coupons yet" />}
      </div>
      {editing && (
        <Modal open title={editing.id ? "Edit Coupon" : "New Coupon"} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <Field label="Coupon Code"><input value={editing.code || ""} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} className={inputCls} data-testid="coupon-code" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Type"><select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })} className={inputCls}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
              {editing.type !== "free_shipping" && <Field label={editing.type === "percentage" ? "Percent" : "Amount ₹"}><input type="number" value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} className={inputCls} data-testid="coupon-value" /></Field>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Min Cart Value ₹"><input type="number" value={editing.min_cart || ""} onChange={(e) => setEditing({ ...editing, min_cart: e.target.value })} className={inputCls} /></Field>
              <Field label="Max Discount ₹"><input type="number" value={editing.max_discount || ""} onChange={(e) => setEditing({ ...editing, max_discount: e.target.value })} className={inputCls} /></Field>
            </div>
            <Field label="Description"><input value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className={inputCls} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={!!editing.first_time_only} onChange={(e) => setEditing({ ...editing, first_time_only: e.target.checked })} className="accent-plum" /> First order only</label>
              <Field label="Status"><select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })} className={inputCls}><option>Active</option><option>Archived</option></select></Field>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6"><button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button><button onClick={save} className="bg-plum text-white rounded-md px-5 py-2 text-sm" data-testid="save-coupon">Save</button></div>
        </Modal>
      )}
    </div>
  );
}
