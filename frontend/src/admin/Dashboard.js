import React, { useEffect, useState } from "react";
import { TrendingUp, ShoppingCart, Users, Package, AlertTriangle } from "lucide-react";
import { adminApi } from "../lib/api";
import { inr, formatDateTime } from "../lib/utils";
import { StatusChip, PageHead } from "./ui";

export default function Dashboard() {
  const [s, setS] = useState(null);
  useEffect(() => { adminApi.get("/dashboard/stats").then(({ data }) => setS(data)).catch(() => {}); }, []);
  if (!s) return <div className="text-gray-400">Loading dashboard…</div>;

  const cards = [
    { label: "Total Revenue", value: inr(s.sales.total), icon: TrendingUp, sub: `${s.sales.orders_paid} paid orders` },
    { label: "This Month", value: inr(s.sales.month), icon: TrendingUp, sub: `AOV ${inr(s.sales.aov)}` },
    { label: "Total Orders", value: s.orders.total, icon: ShoppingCart, sub: `${s.orders.by_status.Pending || 0} pending` },
    { label: "Customers", value: s.customers.total, icon: Users, sub: `${s.customers.new_month} new this month` },
  ];

  return (
    <div>
      <PageHead title="Dashboard" subtitle="Your store at a glance" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-lg border border-gray-200 p-5" data-testid={`stat-${c.label.toLowerCase().replace(/\s/g, "-")}`}>
            <div className="flex items-center justify-between"><span className="text-xs text-gray-500">{c.label}</span><c.icon size={16} className="text-plum" /></div>
            <p className="text-2xl font-semibold text-gray-900 mt-2">{c.value}</p>
            <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Orders</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-400 text-xs border-b border-gray-100">
                <th className="pb-2 font-medium">Order</th><th className="pb-2 font-medium">Customer</th><th className="pb-2 font-medium">Total</th><th className="pb-2 font-medium">Status</th></tr></thead>
              <tbody>
                {s.recent.orders.map((o) => (
                  <tr key={o.id} className="border-b border-gray-50"><td className="py-2.5 font-medium text-gray-900">{o.order_number}</td><td className="py-2.5 text-gray-600">{o.customer?.name || o.customer?.phone}</td><td className="py-2.5 text-gray-900">{inr(o.pricing.total)}</td><td className="py-2.5"><StatusChip status={o.status} /></td></tr>
                ))}
                {s.recent.orders.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-gray-400">No orders yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><AlertTriangle size={15} className="text-amber-500" /> Alerts</h3>
            <ul className="text-sm space-y-2 text-gray-600">
              <li className="flex justify-between">Low stock <b>{s.alerts.low_stock.length}</b></li>
              <li className="flex justify-between">Out of stock <b>{s.products.out_of_stock}</b></li>
              <li className="flex justify-between">Corporate inquiries <b>{s.alerts.corporate_inquiries}</b></li>
              <li className="flex justify-between">Failed payments <b>{s.alerts.failed_payments}</b></li>
            </ul>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Package size={15} className="text-plum" /> Bestsellers</h3>
            <ul className="text-sm space-y-2">
              {s.products.bestsellers.slice(0, 5).map((p) => <li key={p.id} className="flex justify-between text-gray-600"><span className="truncate pr-2">{p.name}</span><b>{p.sales_count}</b></li>)}
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 mt-6">
        <h3 className="font-semibold text-gray-900 mb-3">Recent Activity</h3>
        <ul className="text-sm space-y-1.5 text-gray-500">
          {s.recent.activity.map((a) => <li key={a.id}>{formatDateTime(a.at)} — <b className="text-gray-700">{a.admin_email}</b> {a.action} {a.resource}</li>)}
          {s.recent.activity.length === 0 && <li className="text-gray-400">No activity yet</li>}
        </ul>
      </div>
    </div>
  );
}
