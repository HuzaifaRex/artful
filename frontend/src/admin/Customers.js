import React, { useEffect, useState, useCallback } from "react";
import { Search, Download } from "lucide-react";
import { adminApi, apiError, API } from "../lib/api";
import { toast } from "sonner";
import { inr, formatDate } from "../lib/utils";
import { StatusChip, Modal, inputCls, PageHead, Empty } from "./ui";

export default function Customers() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const load = useCallback(() => adminApi.get(`/customers?q=${encodeURIComponent(q)}&page_size=100`).then(({ data }) => setItems(data.items)).catch(() => {}), [q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const openDetail = async (c) => { const { data } = await adminApi.get(`/customers/${c.id}`); setOpen(data); };
  const setStatus = async (id, status) => { await adminApi.put(`/customers/${id}/status`, { status }); toast.success("Updated"); load(); setOpen(null); };

  return (
    <div>
      <PageHead title="Customers" subtitle={`${items.length} customers`} action={<button onClick={() => window.open(`${API}/admin/export/customers`, "_blank")} className="border border-gray-300 rounded-md px-4 py-2 text-sm flex items-center gap-2 text-gray-700"><Download size={15} /> Export</button>} />
      <div className="relative mb-4 max-w-sm"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers…" className={inputCls + " pl-9"} data-testid="customer-search" /></div>
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-400 text-xs bg-gray-50 border-b border-gray-200"><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Mobile</th><th className="px-4 py-3 font-medium">Email</th><th className="px-4 py-3 font-medium">Orders</th><th className="px-4 py-3 font-medium">Spend</th><th className="px-4 py-3 font-medium">Status</th></tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} onClick={() => openDetail(c)} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                <td className="px-4 py-3 font-medium text-gray-900">{c.name || "—"}</td>
                <td className="px-4 py-3 text-gray-600">{c.phone || "—"}</td>
                <td className="px-4 py-3 text-gray-600">{c.email || "—"}</td>
                <td className="px-4 py-3 text-gray-700">{c.order_count || 0}</td>
                <td className="px-4 py-3 text-gray-900">{inr(c.total_spend || 0)}</td>
                <td className="px-4 py-3"><StatusChip status={c.status || "New"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <Empty text="No customers yet" />}
      </div>
      {open && (
        <Modal open title={open.customer.name || "Customer"} onClose={() => setOpen(null)} wide>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600">Mobile: {open.customer.phone || "—"}</p>
              <p className="text-sm text-gray-600">Email: {open.customer.email || "—"}</p>
              <p className="text-sm text-gray-600">Joined: {formatDate(open.customer.created_at)}</p>
              <p className="text-sm text-gray-600 mt-2">Status: <StatusChip status={open.customer.status || "New"} /></p>
              <div className="flex gap-2 mt-3">
                {open.customer.status === "Blocked" ? <button onClick={() => setStatus(open.customer.id, "Active")} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded">Unblock</button>
                  : <button onClick={() => setStatus(open.customer.id, "Blocked")} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded" data-testid="block-customer">Disable Account</button>}
                <button onClick={() => setStatus(open.customer.id, "VIP")} className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded">Mark VIP</button>
              </div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mt-4 mb-2">Addresses</h4>
              {open.addresses.length === 0 ? <p className="text-sm text-gray-400">None</p> : open.addresses.map((a) => <p key={a.id} className="text-sm text-gray-600">{a.line1}, {a.city} — {a.pincode}</p>)}
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Order History ({open.orders.length})</h4>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {open.orders.map((o) => <div key={o.id} className="flex justify-between text-sm border-b border-gray-50 py-2"><span className="text-gray-700">{o.order_number}</span><span className="text-gray-900">{inr(o.pricing.total)}</span><StatusChip status={o.status} /></div>)}
                {open.orders.length === 0 && <p className="text-sm text-gray-400">No orders</p>}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
