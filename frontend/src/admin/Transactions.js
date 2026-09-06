import React, { useEffect, useState, useCallback } from "react";
import { IndianRupee, RotateCcw, CheckCircle2, Clock } from "lucide-react";
import { adminApi } from "../lib/api";
import { inr, formatDateTime } from "../lib/utils";
import { PageHead, StatusChip } from "./ui";
import { DataTable, KpiCards } from "./DataTable";
import OrderDetailModal from "./OrderDetailModal";

export default function Transactions() {
  const [data, setData] = useState({ items: [], stats: {}, pages: 1 });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [method, setMethod] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.get(`/transactions?q=${encodeURIComponent(q)}&status=${status}&method=${method}&page=${page}`)
      .then(({ data }) => setData(data)).catch(() => {}).finally(() => setLoading(false));
  }, [q, status, method, page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  return (
    <div>
      <PageHead title="Payments & Transactions" subtitle="Every payment across your orders" />
      <KpiCards cards={[
        { label: "Captured", value: inr(data.stats.captured || 0), icon: IndianRupee, sub: `${data.stats.paid_count || 0} paid` },
        { label: "Refunded", value: inr(data.stats.refunded || 0), icon: RotateCcw },
        { label: "Pending", value: data.stats.pending_count || 0, icon: Clock },
        { label: "Failed", value: data.stats.failed_count || 0, icon: CheckCircle2 },
      ]} />
      <DataTable
        testid="transactions" loading={loading} q={q} setQ={setQ} searchPlaceholder="Search order, customer…"
        page={page} pages={data.pages} setPage={setPage} rows={data.items}
        onRowClick={(r) => setOpen(r.order_number)} empty="No transactions yet"
        filters={[
          { key: "status", label: "All payment states", value: status, onChange: (v) => { setStatus(v); setPage(1); }, options: [
            { value: "paid", label: "Paid" }, { value: "cod_confirmed", label: "COD Confirmed" },
            { value: "created", label: "Created" }, { value: "cod_pending", label: "COD Pending" }, { value: "failed", label: "Failed" }] },
          { key: "method", label: "All methods", value: method, onChange: (v) => { setMethod(v); setPage(1); }, options: [
            { value: "razorpay", label: "Razorpay" }, { value: "cod", label: "COD" }] },
        ]}
        columns={[
          { key: "order_number", label: "Order", render: (r) => <span className="font-medium text-gray-900">{r.order_number}</span> },
          { key: "customer", label: "Customer", render: (r) => <div><p className="text-gray-900">{r.customer?.name || "—"}</p><p className="text-xs text-gray-500">{r.customer?.phone}</p></div> },
          { key: "method", label: "Method", render: (r) => <span className="uppercase text-xs">{r.payment?.method || "—"}</span> },
          { key: "txn", label: "Txn ID", render: (r) => <span className="text-xs text-gray-500 break-all">{r.payment?.razorpay_payment_id || "—"}</span> },
          { key: "status", label: "Status", render: (r) => <StatusChip status={r.payment?.status} /> },
          { key: "amount", label: "Amount", align: "right", render: (r) => <span className="font-semibold text-gray-900">{inr(r.amount)}</span> },
          { key: "created_at", label: "Date", nowrap: true, render: (r) => formatDateTime(r.created_at) },
        ]}
      />
      {open && <OrderDetailModal orderNumber={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
