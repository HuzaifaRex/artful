import React, { useEffect, useState, useCallback } from "react";
import { Download, IndianRupee, ShoppingCart, Clock3, CheckCircle2, XCircle } from "lucide-react";
import { adminApi, apiError, API } from "../lib/api";
import { toast } from "sonner";
import { inr, formatDateTime } from "../lib/utils";
import { StatusChip, PageHead } from "./ui";
import { DataTable, KpiCards } from "./DataTable";
import OrderDetailModal from "./OrderDetailModal";

const STATUSES = ["Pending", "Confirmed", "Processing", "Packed", "Shipped", "Out for Delivery", "Delivered", "Cancelled", "Returned", "Refunded", "Failed"];
const PAYMENTS = ["created", "paid", "cod_pending", "cod_confirmed", "failed"];

export default function Orders() {
  const [data, setData] = useState({ items: [], pages: 1, total: 0, page: 1 });
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const [sort, setSort] = useState("newest");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data: response } = await adminApi.get(`/orders?status=${encodeURIComponent(status)}&payment=${encodeURIComponent(payment)}&sort=${sort}&q=${encodeURIComponent(q)}&page=${page}&page_size=20`);
      setData(response);
    } catch (e) { toast.error(apiError(e, "Could not load orders")); }
  }, [status, payment, sort, q, page]);

  useEffect(() => { const t = setTimeout(load, 180); return () => clearTimeout(t); }, [load]);
  useEffect(() => { adminApi.get("/orders/summary").then(({ data }) => setSummary(data)).catch(() => {}); }, [data.total]);
  useEffect(() => { setPage(1); }, [status, payment, sort, q]);

  const exportCsv = () => window.open(`${API}/admin/export/orders`, "_blank");
  const cards = summary ? [
    { label: "Total Orders", value: summary.total, icon: ShoppingCart, sub: `${summary.paid_orders} paid / confirmed` },
    { label: "Revenue", value: inr(summary.revenue), icon: IndianRupee, sub: "Paid + COD confirmed" },
    { label: "In Progress", value: summary.pending, icon: Clock3, sub: "Pending to out for delivery" },
    { label: "Delivered", value: summary.delivered, icon: CheckCircle2, sub: `${summary.cancelled} cancelled` },
  ] : [];

  return (
    <div>
      <PageHead title="Orders" subtitle={`${data.total} matching orders`} action={<button onClick={exportCsv} className="border border-gray-300 rounded-lg px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50"><Download size={15} /> Export CSV</button>} />
      {summary && <KpiCards cards={cards} />}
      <DataTable
        testid="orders"
        rows={data.items}
        page={page}
        pages={data.pages}
        setPage={setPage}
        q={q}
        setQ={(v) => setQ(v)}
        searchPlaceholder="Search order / customer / email…"
        filters={[
          { key: "status", label: "All statuses", value: status, onChange: setStatus, options: STATUSES },
          { key: "payment", label: "All payment states", value: payment, onChange: setPayment, options: PAYMENTS },
          { key: "sort", label: "Sort: newest", value: sort, onChange: setSort, options: [
            { value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" },
            { value: "total_desc", label: "Highest value" }, { value: "total_asc", label: "Lowest value" },
            { value: "updated_desc", label: "Recently updated" }, { value: "status", label: "Status A–Z" },
          ]},
        ]}
        onRowClick={(o) => setOpen(o.order_number)}
        onExport={exportCsv}
        empty="No orders found"
        columns={[
          { key: "order", label: "Order", render: (o) => <div><p className="font-semibold text-gray-900">{o.order_number}</p><p className="text-[11px] text-gray-400">{formatDateTime(o.created_at)}</p></div> },
          { key: "customer", label: "Customer", render: (o) => <div><p className="text-gray-900">{o.customer?.name || "—"}</p><p className="text-[11px] text-gray-400">{o.customer?.phone || o.customer?.email || "—"}</p></div> },
          { key: "items", label: "Items", render: (o) => <span>{(o.items || []).reduce((n, i) => n + Number(i.qty || 0), 0)} units · {(o.items || []).length} lines</span> },
          { key: "total", label: "Total", align: "right", render: (o) => <span className="font-semibold text-gray-900">{inr(o.pricing?.total)}</span> },
          { key: "payment", label: "Payment", render: (o) => <StatusChip status={o.payment?.status} /> },
          { key: "status", label: "Status", render: (o) => <StatusChip status={o.status} /> },
        ]}
      />
      {open && <OrderDetailModal orderNumber={open} onClose={() => setOpen(null)} onSaved={load} editable />}
    </div>
  );
}
