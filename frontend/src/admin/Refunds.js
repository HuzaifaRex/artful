import React, { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { adminApi, apiError } from "../lib/api";
import { toast } from "sonner";
import { inr, formatDate } from "../lib/utils";
import { StatusChip, Modal, Field, inputCls, PageHead, Empty } from "./ui";

const STATUSES = ["Requested", "Approved", "Processing", "Completed", "Rejected"];

export default function Refunds() {
  const [items, setItems] = useState([]);
  const [creating, setCreating] = useState(null);
  const load = useCallback(() => adminApi.get("/refunds").then(({ data }) => setItems(data.items)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const update = async (id, status) => {
    if (status === "Completed" && !window.confirm("Mark refund as completed? This will set the order to Refunded.")) return;
    await adminApi.put(`/refunds/${id}`, { status }); toast.success("Refund updated"); load();
  };
  const create = async () => {
    try { await adminApi.post("/refunds", { order_number: creating.order_number, amount: Number(creating.amount || 0), reason: creating.reason }); toast.success("Refund logged"); setCreating(null); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div>
      <PageHead title="Refunds & Returns" subtitle="Approve returns and track money back to customers" action={<button onClick={() => setCreating({})} className="bg-plum text-white rounded-md px-4 py-2 text-sm flex items-center gap-2" data-testid="add-refund"><Plus size={16} /> New Refund</button>} />
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-400 text-xs bg-gray-50 border-b border-gray-200"><th className="px-4 py-3 font-medium">Order</th><th className="px-4 py-3 font-medium">Amount</th><th className="px-4 py-3 font-medium">Reason</th><th className="px-4 py-3 font-medium">Requested</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Actions</th></tr></thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-b border-gray-50" data-testid={`refund-${r.order_number}`}>
                <td className="px-4 py-3 font-medium text-gray-900">{r.order_number}</td>
                <td className="px-4 py-3 text-gray-900">{inr(r.amount)}</td>
                <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{r.reason || "—"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(r.created_at)}</td>
                <td className="px-4 py-3"><StatusChip status={r.status} /></td>
                <td className="px-4 py-3">
                  <select value={r.status} onChange={(e) => update(r.id, e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs" data-testid={`refund-status-${r.order_number}`}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <Empty text="No refund requests" />}
      </div>
      {creating && (
        <Modal open title="Log Refund" onClose={() => setCreating(null)}>
          <div className="space-y-4">
            <Field label="Order Number"><input value={creating.order_number || ""} onChange={(e) => setCreating({ ...creating, order_number: e.target.value.toUpperCase() })} className={inputCls} data-testid="refund-order" /></Field>
            <Field label="Amount ₹"><input type="number" value={creating.amount || ""} onChange={(e) => setCreating({ ...creating, amount: e.target.value })} className={inputCls} data-testid="refund-amount" /></Field>
            <Field label="Reason"><input value={creating.reason || ""} onChange={(e) => setCreating({ ...creating, reason: e.target.value })} className={inputCls} /></Field>
          </div>
          <div className="flex justify-end gap-3 mt-6"><button onClick={() => setCreating(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button><button onClick={create} className="bg-plum text-white rounded-md px-5 py-2 text-sm" data-testid="save-refund">Save</button></div>
        </Modal>
      )}
    </div>
  );
}
