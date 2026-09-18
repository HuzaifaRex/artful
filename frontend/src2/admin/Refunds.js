import React, { useEffect, useState, useCallback } from "react";
import { Plus, Ticket } from "lucide-react";
import { adminApi, apiError } from "../lib/api";
import { toast } from "sonner";
import { inr, formatDateTime } from "../lib/utils";
import { StatusChip, Modal, Field, inputCls, PageHead } from "./ui";
import { DataTable, KpiCards } from "./DataTable";

const STATUSES = ["Requested", "Approved", "Processing", "Completed", "Rejected"];
const FILTER_STATUSES = ["Requested", "Approved", "Processing", "Completed", "Rejected", "Cancelled"];
const PAGE_SIZE = 10;

export default function Refunds() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(null);
  const load = useCallback(() => {
    setLoading(true);
    adminApi.get("/refunds").then(({ data }) => setItems(data.items)).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const update = async (e, id, newStatus) => {
    e.stopPropagation();
    if (newStatus === "Completed" && !window.confirm("Mark refund as completed? This will set the order to Refunded.")) return;
    await adminApi.put(`/refunds/${id}`, { status: newStatus }); toast.success("Refund updated"); load();
  };
  const create = async () => {
    try { await adminApi.post("/refunds", { order_number: creating.order_number, amount: Number(creating.amount || 0), reason: creating.reason }); toast.success("Refund logged"); setCreating(null); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const filtered = items.filter((r) =>
    (!status || r.status === status) &&
    (!q || (r.order_number || "").toLowerCase().includes(q.toLowerCase()) || (r.reason || "").toLowerCase().includes(q.toLowerCase())));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <PageHead title="Refunds & Returns" subtitle="Approve returns and track money back to customers" action={<button onClick={() => setCreating({})} className="bg-plum text-white rounded-md px-4 py-2 text-sm flex items-center gap-2" data-testid="add-refund"><Plus size={16} /> New Refund</button>} />
      <KpiCards cards={[
        { label: "Total Refunds", value: items.length, icon: Ticket },
        { label: "Requested", value: items.filter((r) => r.status === "Requested").length, icon: Ticket },
        { label: "Completed", value: items.filter((r) => r.status === "Completed").length, icon: Ticket },
        { label: "Refunded ₹", value: inr(items.filter((r) => r.status === "Completed").reduce((s, r) => s + (r.amount || 0), 0)), icon: Ticket },
      ]} />
      <DataTable
        testid="refunds" loading={loading} q={q} setQ={(v) => { setQ(v); setPage(1); }} searchPlaceholder="Search order or reason…"
        page={page} pages={pages} setPage={setPage} rows={rows} empty="No refund requests"
        filters={[{ key: "status", label: "All statuses", value: status, onChange: (v) => { setStatus(v); setPage(1); }, options: FILTER_STATUSES }]}
        columns={[
          { key: "order_number", label: "Order", render: (r) => <span className="font-medium text-gray-900">{r.order_number}</span> },
          { key: "amount", label: "Amount", render: (r) => inr(r.amount) },
          { key: "reason", label: "Reason", render: (r) => <span className="text-gray-600 line-clamp-1 max-w-xs inline-block">{r.reason || "—"}</span> },
          { key: "created_at", label: "Cancelled / Requested on", nowrap: true, render: (r) => formatDateTime(r.created_at) },
          { key: "status", label: "Status", render: (r) => <StatusChip status={r.status} /> },
          { key: "actions", label: "Update", render: (r) => (
            r.auto
              ? <button onClick={(e) => { e.stopPropagation(); setCreating({ order_number: r.order_number, amount: r.amount, reason: r.reason }); }} className="text-xs text-plum underline" data-testid={`refund-log-${r.order_number}`}>Log refund</button>
              : <select value={r.status} onClick={(e) => e.stopPropagation()} onChange={(e) => update(e, r.id, e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs" data-testid={`refund-status-${r.order_number}`}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          ) },
        ]}
      />
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
