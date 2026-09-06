import React, { useEffect, useState } from "react";
import { TrendingUp, ShoppingCart, Users, Package, AlertTriangle, IndianRupee, Bell, Clock, XCircle, Boxes } from "lucide-react";
import { adminApi } from "../lib/api";
import { inr, formatDateTime } from "../lib/utils";
import { StatusChip, PageHead } from "./ui";
import OrderDetailModal from "./OrderDetailModal";

const NOTE_ICON = { new_order: ShoppingCart, cancel_order: XCircle, newsletter: Users, support: Bell };

export default function Dashboard() {
  const [s, setS] = useState(null);
  const [notes, setNotes] = useState({ items: [], unread: 0 });
  const [openOrder, setOpenOrder] = useState(null);

  const loadNotes = () => adminApi.get("/notifications").then(({ data }) => setNotes(data)).catch(() => {});
  useEffect(() => {
    adminApi.get("/dashboard/stats").then(({ data }) => setS(data)).catch(() => {});
    loadNotes();
    const t = setInterval(loadNotes, 20000);
    return () => clearInterval(t);
  }, []);
  if (!s) return <div className="text-gray-400">Loading dashboard…</div>;

  const cards = [
    { label: "Total Revenue", value: inr(s.sales.total), icon: IndianRupee, sub: `${s.sales.orders_paid} paid orders` },
    { label: "This Month", value: inr(s.sales.month), icon: TrendingUp, sub: `Today ${inr(s.sales.today)}` },
    { label: "Avg Order Value", value: inr(s.sales.aov), icon: TrendingUp },
    { label: "Total Orders", value: s.orders.total, icon: ShoppingCart, sub: `${s.orders.by_status.Pending || 0} pending` },
    { label: "Customers", value: s.customers.total, icon: Users, sub: `${s.customers.new_month} new / 30d` },
    { label: "Active Products", value: s.products.active, icon: Package, sub: `${s.products.total} total` },
    { label: "Out of Stock", value: s.products.out_of_stock, icon: Boxes, sub: `${s.alerts.low_stock.length} low stock` },
    { label: "Failed Payments", value: s.alerts.failed_payments, icon: XCircle, sub: `${s.alerts.refund_requests} refund requests` },
  ];

  return (
    <div>
      <PageHead title="Dashboard" subtitle="Your store at a glance" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow" data-testid={`stat-${c.label.toLowerCase().replace(/\s/g, "-")}`}>
            <div className="flex items-center justify-between"><span className="text-xs text-gray-500">{c.label}</span><span className="w-8 h-8 rounded-lg bg-plum/10 text-plum flex items-center justify-center"><c.icon size={16} /></span></div>
            <p className="text-2xl font-semibold text-gray-900 mt-2">{c.value}</p>
            {c.sub && <p className="text-xs text-gray-400 mt-1">{c.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Orders <span className="text-xs text-gray-400 font-normal">— click a row for full details</span></h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-400 text-xs border-b border-gray-100">
                <th className="pb-2 font-medium">Order</th><th className="pb-2 font-medium">Customer</th><th className="pb-2 font-medium">Total</th><th className="pb-2 font-medium">Status</th></tr></thead>
              <tbody>
                {s.recent.orders.map((o, i) => (
                  <tr key={o.id} onClick={() => setOpenOrder(o.order_number)} className="border-b border-gray-50 hover:bg-plum/5 cursor-pointer" data-testid={`dashboard-order-${i}`}>
                    <td className="py-2.5 font-medium text-gray-900">{o.order_number}</td>
                    <td className="py-2.5 text-gray-600">{o.customer?.name || o.customer?.phone}</td>
                    <td className="py-2.5 text-gray-900">{inr(o.pricing.total)}</td>
                    <td className="py-2.5"><StatusChip status={o.status} /></td>
                  </tr>
                ))}
                {s.recent.orders.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-gray-400">No orders yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5" data-testid="dashboard-notifications">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Bell size={15} className="text-plum" /> Notifications {notes.unread > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{notes.unread}</span>}</h3>
              {notes.unread > 0 && <button onClick={async () => { await adminApi.post("/notifications/read"); loadNotes(); }} className="text-xs text-plum" data-testid="notifications-mark-read">Mark all read</button>}
            </div>
            <ul className="space-y-2.5 max-h-64 overflow-y-auto">
              {notes.items.slice(0, 12).map((n) => {
                const Icon = NOTE_ICON[n.type] || Bell;
                return (
                  <li key={n.id} onClick={() => n.order_number && setOpenOrder(n.order_number)} className={`flex items-start gap-2.5 text-sm ${n.order_number ? "cursor-pointer hover:text-plum" : ""} ${!n.read ? "font-medium text-gray-900" : "text-gray-500"}`}>
                    <Icon size={14} className={`mt-0.5 shrink-0 ${n.type === "cancel_order" ? "text-red-500" : "text-plum"}`} />
                    <div className="min-w-0"><p className="truncate">{n.title}</p><p className="text-[11px] text-gray-400">{formatDateTime(n.at)}</p></div>
                  </li>
                );
              })}
              {notes.items.length === 0 && <li className="text-gray-400 text-sm">No notifications</li>}
            </ul>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><AlertTriangle size={15} className="text-amber-500" /> Alerts</h3>
            <ul className="text-sm space-y-2 text-gray-600">
              <li className="flex justify-between">Low stock <b>{s.alerts.low_stock.length}</b></li>
              <li className="flex justify-between">Out of stock <b>{s.products.out_of_stock}</b></li>
              <li className="flex justify-between">Refund requests <b>{s.alerts.refund_requests}</b></li>
              <li className="flex justify-between">Corporate inquiries <b>{s.alerts.corporate_inquiries}</b></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Package size={15} className="text-plum" /> Bestsellers</h3>
          <ul className="text-sm space-y-2">
            {s.products.bestsellers.slice(0, 5).map((p) => <li key={p.id} className="flex justify-between text-gray-600"><span className="truncate pr-2">{p.name}</span><b>{p.sales_count}</b></li>)}
          </ul>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Clock size={15} className="text-gray-500" /> Recent Activity</h3>
          <ul className="text-sm space-y-1.5 text-gray-500">
            {s.recent.activity.map((a) => <li key={a.id}>{formatDateTime(a.at)} — <b className="text-gray-700">{a.admin_email}</b> {a.action} {a.resource}</li>)}
            {s.recent.activity.length === 0 && <li className="text-gray-400">No activity yet</li>}
          </ul>
        </div>
      </div>

      {openOrder && <OrderDetailModal orderNumber={openOrder} onClose={() => setOpenOrder(null)} />}
    </div>
  );
}
