import React, { useEffect, useMemo, useState } from "react";
import { TrendingUp, ShoppingCart, Users, Package, AlertTriangle, IndianRupee, XCircle, Boxes, CalendarDays, BarChart3, Repeat2 } from "lucide-react";
import { adminApi } from "../lib/api";
import { inr, formatDateTime } from "../lib/utils";
import { StatusChip, PageHead } from "./ui";
import OrderDetailModal from "./OrderDetailModal";

const fmt = (v) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(v || 0);
const toISO = (d) => { const x = new Date(d); const pad=n=>String(n).padStart(2,"0"); return `${x.getUTCFullYear()}-${pad(x.getUTCMonth()+1)}-${pad(x.getUTCDate())}`; };
const addDays = (date, n) => { const d = new Date(date); d.setUTCDate(d.getUTCDate()+n); return d; };

function SimpleChart({ series, mode="revenue" }) {
  const vals = series.map(x => Number(x[mode] || 0)); const max = Math.max(1, ...vals); const w=720,h=220,pad=24;
  const pts = series.map((x,i)=>`${pad + (series.length===1?0:i*(w-pad*2)/(series.length-1))},${h-pad-(Number(x[mode]||0)/max)*(h-pad*2)}`).join(" ");
  return <div className="w-full overflow-x-auto"><svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[560px] h-[220px]"><line x1={pad} y1={h-pad} x2={w-pad} y2={h-pad} stroke="#e5e7eb"/><line x1={pad} y1={pad} x2={pad} y2={h-pad} stroke="#e5e7eb"/><polyline fill="none" stroke="currentColor" strokeWidth="3" className="text-plum" points={pts}/>{series.map((x,i)=>{const xx=pad+(series.length===1?0:i*(w-pad*2)/(series.length-1)); const yy=h-pad-(Number(x[mode]||0)/max)*(h-pad*2); return <g key={x.label}><circle cx={xx} cy={yy} r="4" className="fill-plum"/><text x={xx} y={h-6} textAnchor="middle" fontSize="9" fill="#9ca3af">{x.label.slice(5)}</text></g>;})}</svg></div>;
}

export default function Dashboard() {
  const today = toISO(new Date());
  const [preset, setPreset] = useState("30d");
  const [from, setFrom] = useState(toISO(addDays(new Date(), -29)));
  const [to, setTo] = useState(today);
  const [granularity, setGranularity] = useState("daily");
  const [s, setS] = useState(null);
  const [openOrder, setOpenOrder] = useState(null);
  const [tab, setTab] = useState("revenue");

  const load = () => adminApi.get(`/dashboard/stats?from_date=${from}&to_date=${to}&granularity=${granularity}`).then(({data})=>setS(data)).catch(()=>{});
  useEffect(()=>{ load(); }, [from,to,granularity]);
  const applyPreset = (key) => {
    const end = new Date(); let start = new Date();
    if(key === "today") start = end;
    if(key === "7d") start = addDays(end,-6);
    if(key === "30d") start = addDays(end,-29);
    if(key === "month") start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    setPreset(key); setFrom(toISO(start)); setTo(toISO(end)); setGranularity(key === "month" ? "daily" : granularity);
  };
  const cards = useMemo(()=>s ? [
    ["Revenue", inr(s.sales.revenue), IndianRupee, `${s.sales.paid_orders} paid orders`],
    ["Orders", s.orders.total, ShoppingCart, `${s.orders.delivered} delivered`],
    ["Avg Order Value", inr(s.sales.aov), TrendingUp, `${s.sales.units_sold} units sold`],
    ["New Customers", s.customers.new, Users, `${s.customers.repeat} repeat customers`],
    ["Inventory Value", inr(s.inventory.stock_value), Boxes, `${s.inventory.available_units} available units`],
    ["Low Stock", s.products.low_stock.length || 0, AlertTriangle, `${s.products.out_of_stock} out of stock`],
    ["Cancelled", s.orders.cancelled, XCircle, `${s.orders.failed} failed`],
    ["Active Products", s.products.active, Package, "Live catalogue"],
  ] : [], [s]);
  if (!s) return <div className="text-gray-400">Loading dashboard…</div>;
  return <div>
    <PageHead title="Dashboard" subtitle="Detailed sales, order, customer and inventory overview" action={<div className="flex gap-2 items-center"><CalendarDays size={16} className="text-gray-400"/><select value={preset} onChange={e=>applyPreset(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="month">This month</option><option value="custom">Custom range</option></select></div>} />

    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5"><div className="flex flex-wrap gap-3 items-end"><div><label className="text-[11px] text-gray-500">From</label><input type="date" value={from} onChange={e=>{setPreset("custom");setFrom(e.target.value)}} className="block border rounded-lg px-3 py-2 text-sm"/></div><div><label className="text-[11px] text-gray-500">To</label><input type="date" value={to} onChange={e=>{setPreset("custom");setTo(e.target.value)}} className="block border rounded-lg px-3 py-2 text-sm"/></div><div><label className="text-[11px] text-gray-500">Data grouping</label><select value={granularity} onChange={e=>setGranularity(e.target.value)} className="block border rounded-lg px-3 py-2 text-sm"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div><div className="ml-auto text-xs text-gray-400">{from} → {to}</div></div></div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">{cards.map(([label,value,Icon,sub])=><div key={label} className="bg-white rounded-xl border border-gray-200 p-4"><div className="flex justify-between"><span className="text-xs text-gray-500">{label}</span><span className="w-8 h-8 rounded-lg bg-plum/10 text-plum flex items-center justify-center"><Icon size={16}/></span></div><p className="text-2xl font-semibold mt-2">{value}</p><p className="text-[11px] text-gray-400 mt-1">{sub}</p></div>)}</div>

    <div className="grid lg:grid-cols-3 gap-6"><div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5"><div className="flex justify-between items-center mb-2"><div><h3 className="font-semibold">Performance trend</h3><p className="text-xs text-gray-400">Selected period</p></div><div className="flex gap-1"><button onClick={()=>setTab("revenue")} className={`px-3 py-1.5 rounded-lg text-xs ${tab==="revenue"?"bg-plum text-white":"border text-gray-600"}`}>Revenue</button><button onClick={()=>setTab("orders")} className={`px-3 py-1.5 rounded-lg text-xs ${tab==="orders"?"bg-plum text-white":"border text-gray-600"}`}>Orders</button><button onClick={()=>setTab("units")} className={`px-3 py-1.5 rounded-lg text-xs ${tab==="units"?"bg-plum text-white":"border text-gray-600"}`}>Units</button></div></div><SimpleChart series={s.series} mode={tab}/></div>
      <div className="bg-white rounded-xl border border-gray-200 p-5"><h3 className="font-semibold mb-4 flex items-center gap-2"><BarChart3 size={15} className="text-plum"/> Order status</h3><div className="space-y-2">{Object.entries(s.orders.by_status).map(([k,v])=><div key={k} className="flex justify-between text-sm"><span><StatusChip status={k}/></span><b>{v}</b></div>)}</div></div></div>

    <div className="grid lg:grid-cols-3 gap-6 mt-6"><div className="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-2"><h3 className="font-semibold mb-4">Top products in selected period</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-xs text-gray-400 border-b"><th className="text-left pb-2">Product</th><th className="text-right pb-2">Units</th><th className="text-right pb-2">Revenue</th></tr></thead><tbody>{s.products.bestsellers.map(p=><tr key={p.id} className="border-b border-gray-50"><td className="py-2.5 artful-product-name">{p.name}</td><td className="py-2.5 text-right">{p.qty}</td><td className="py-2.5 text-right">{inr(p.revenue)}</td></tr>)}{s.products.bestsellers.length===0&&<tr><td colSpan="3" className="py-8 text-center text-gray-400">No sales in selected period</td></tr>}</tbody></table></div></div>
      <div className="bg-white rounded-xl border border-gray-200 p-5"><h3 className="font-semibold mb-4 flex items-center gap-2"><Repeat2 size={15} className="text-plum"/> Business overview</h3><div className="space-y-3 text-sm"><div className="flex justify-between"><span>Discounts</span><b>{inr(s.sales.discount)}</b></div><div className="flex justify-between"><span>Shipping collected</span><b>{inr(s.sales.shipping)}</b></div><div className="flex justify-between"><span>Tax</span><b>{inr(s.sales.tax)}</b></div><div className="flex justify-between"><span>Razorpay paid orders</span><b>{s.payments.razorpay}</b></div><div className="flex justify-between"><span>COD confirmed</span><b>{s.payments.cod}</b></div><div className="flex justify-between"><span>Reserved stock</span><b>{s.inventory.reserved_units}</b></div><div className="flex justify-between"><span>Available stock</span><b>{s.inventory.available_units}</b></div></div></div></div>

    <div className="bg-white rounded-xl border border-gray-200 p-5 mt-6"><h3 className="font-semibold mb-4">Low-stock items</h3><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{s.products.low_stock.map(p=><div key={p.id} className="border rounded-lg p-3"><p className="text-sm artful-product-name truncate">{p.name}</p><div className="flex justify-between text-xs mt-2"><span className="text-gray-400">Stock {p.stock}</span><span className="text-amber-600">Alert at {p.low_stock_threshold}</span></div></div>)}{s.products.low_stock.length===0&&<p className="text-gray-400 text-sm">No low-stock items.</p>}</div></div>

    {openOrder && <OrderDetailModal orderNumber={openOrder} onClose={()=>setOpenOrder(null)}/>} 
  </div>;
}
