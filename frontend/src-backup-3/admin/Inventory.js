import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Boxes, Search, Plus, Minus, PackageCheck, AlertTriangle, Ban, IndianRupee, X, History, ArrowDownToLine, ArrowUpFromLine, Eye, Download } from "lucide-react";
import { adminApi, apiError } from "../lib/api";
import { toast } from "sonner";
import { inr } from "../lib/utils";
import { Modal, Field, inputCls, PageHead, StatusChip, Empty } from "./ui";
import { DataTable } from "./DataTable";

const reasons = ["New Purchase", "Damaged", "Returned", "Manual Adjustment", "Initial Stock", "Stock Correction"];

function Stat({ label, value, sub, icon: Icon, tone = "plum" }) {
  const toneCls = tone === "red" ? "bg-red-50 text-red-600" : tone === "amber" ? "bg-amber-50 text-amber-600" : tone === "green" ? "bg-emerald-50 text-emerald-600" : "bg-plum/10 text-plum";
  return <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
    <div className="flex items-start justify-between"><div><p className="text-xs text-gray-500">{label}</p><p className="text-2xl font-semibold text-gray-900 mt-2">{value}</p>{sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}</div><span className={`w-9 h-9 rounded-xl flex items-center justify-center ${toneCls}`}><Icon size={17} /></span></div>
  </div>;
}

function StockStatus({ status }) {
  const map = { healthy: "In Stock", low: "Low Stock", out: "Out of Stock" };
  return <StatusChip status={map[status] || status} />;
}

function ProductInventoryModal({ product, onClose, reload }) {
  const [change, setChange] = useState(10);
  const [mode, setMode] = useState("add");
  const [reason, setReason] = useState("New Purchase");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [movements, setMovements] = useState([]);

  const load = useCallback(async () => {
    try { const { data } = await adminApi.get(`/inventory/${product.id}`); setMovements(data.movements || []); } catch (_) { setMovements([]); }
  }, [product.id]);
  useEffect(() => { load(); }, [load]);

  const update = async () => {
    const qty = Math.abs(Number(change || 0));
    if (!qty) return toast.error("Enter a quantity.");
    setSaving(true);
    try {
      await adminApi.post("/inventory/adjust", { product_id: product.id, quantity: qty, action: mode, reason, notes });
      toast.success(mode === "add" ? "Stock added" : "Stock removed");
      await reload();
      onClose();
    } catch (e) { toast.error(apiError(e)); }
    finally { setSaving(false); }
  };

  return <Modal open title="Inventory detail" onClose={onClose} wide>
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-lg font-semibold text-gray-900">{product.name}</p><p className="text-sm text-gray-500 mt-1">SKU: {product.sku || "—"} · {product.category_name || product.category_slug || "Uncategorized"}</p></div>
        <StockStatus status={product.inventory_status} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 p-4"><p className="text-xs text-gray-500">Total Stock</p><p className="text-xl font-semibold mt-1">{product.stock}</p></div>
        <div className="rounded-xl border border-gray-200 p-4"><p className="text-xs text-gray-500">Reserved</p><p className="text-xl font-semibold mt-1">{product.reserved}</p></div>
        <div className="rounded-xl border border-gray-200 p-4"><p className="text-xs text-gray-500">Available</p><p className="text-xl font-semibold mt-1">{product.available}</p></div>
        <div className="rounded-xl border border-gray-200 p-4"><p className="text-xs text-gray-500">Low Alert</p><p className="text-xl font-semibold mt-1">{product.low_stock_threshold}</p></div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div><p className="text-xs text-gray-500">Purchase Price</p><p className="font-semibold mt-1">{inr(product.cost_price || 0)}</p></div>
        <div><p className="text-xs text-gray-500">Selling Price</p><p className="font-semibold mt-1">{inr(product.price || 0)}</p></div>
        <div><p className="text-xs text-gray-500">MRP</p><p className="font-semibold mt-1">{inr(product.mrp || 0)}</p></div>
      </div>
      <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 space-y-4">
        <div className="flex items-center justify-between"><div><p className="font-semibold text-gray-900">Stock adjustment</p><p className="text-xs text-gray-500 mt-1">Update physical inventory with an auditable reason.</p></div><span className="text-xs text-gray-400">Available = Total − Reserved</span></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Action"><div className="grid grid-cols-2 gap-2"><button onClick={() => setMode("add")} className={`px-3 py-2 rounded-lg border text-sm flex items-center justify-center gap-2 ${mode === "add" ? "bg-plum text-white border-plum" : "bg-white border-gray-300 text-gray-700"}`}><Plus size={15}/> Add Stock</button><button onClick={() => setMode("remove")} className={`px-3 py-2 rounded-lg border text-sm flex items-center justify-center gap-2 ${mode === "remove" ? "bg-plum text-white border-plum" : "bg-white border-gray-300 text-gray-700"}`}><Minus size={15}/> Remove</button></div></Field>
          <Field label="Quantity"><input type="number" min="1" value={change} onChange={(e) => setChange(e.target.value)} className={inputCls} /></Field>
          <Field label="Reason"><select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>{reasons.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Notes (optional)"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="Reference, batch, supplier…" /></Field>
        </div>
        <div className="flex justify-end"><button onClick={update} disabled={saving} className="px-4 py-2 rounded-lg bg-plum text-white text-sm disabled:opacity-50">{saving ? "Updating…" : "Update Stock"}</button></div>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-3"><History size={16} className="text-plum"/><h4 className="font-semibold">Recent inventory history</h4></div>
        <div className="rounded-xl border border-gray-200 divide-y max-h-64 overflow-auto">
          {movements.length === 0 ? <Empty text="No inventory movements yet" /> : movements.map((m) => <div key={m.id} className="p-3 flex items-center justify-between gap-3 text-sm"><div><p className="font-medium text-gray-800">{m.reason}</p><p className="text-xs text-gray-400">{new Date(m.at).toLocaleString()} · {m.admin || "System"}</p></div><div className={`font-semibold ${m.change >= 0 ? "text-emerald-600" : "text-red-600"}`}>{m.change >= 0 ? "+" : ""}{m.change}</div></div>)}
        </div>
      </div>
    </div>
  </Modal>;
}

export default function Inventory() {
  const [summary, setSummary] = useState({ total_products: 0, in_stock: 0, low_stock: 0, out_of_stock: 0, total_stock_value: 0, total_units: 0, reserved_units: 0, available_units: 0 });
  const [data, setData] = useState({ items: [], pages: 1, total: 0, page: 1 });
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState(""); const [category, setCategory] = useState(""); const [status, setStatus] = useState(""); const [sort, setSort] = useState("available_desc"); const [page, setPage] = useState(1); const [loading, setLoading] = useState(true); const [view, setView] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, list] = await Promise.all([
        adminApi.get("/inventory/summary"),
        adminApi.get(`/inventory?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&status=${status}&sort=${sort}&page=${page}&page_size=25`),
      ]);
      setSummary(s.data); setData(list.data);
    } catch (e) { toast.error(`Inventory API error: ${apiError(e)}`); }
    finally { setLoading(false); }
  }, [q, category, status, sort, page]);

  useEffect(() => { const t = setTimeout(load, 180); return () => clearTimeout(t); }, [load]);
  useEffect(() => { adminApi.get("/categories").then(({ data }) => setCats(data.items || [])).catch(() => {}); }, []);
  useEffect(() => { setPage(1); }, [q, category, status, sort]);

  const exportCsv = () => {
    const rows = data.items || [];
    const header = ["Product Name","SKU","Category","Purchase Price","Selling Price","Total Stock","Reserved","Available","Status"];
    const body = rows.map(r => [r.name,r.sku,r.category_name || r.category_slug || "",r.cost_price || 0,r.price || 0,r.stock,r.reserved,r.available,r.inventory_status].map(v => `"${String(v ?? "").replaceAll('"','""')}"`).join(","));
    const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `artful-inventory-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const cards = useMemo(() => [
    ["Total Products", summary.total_products, "Products tracked", Boxes, "plum"],
    ["In Stock", summary.in_stock, `${summary.available_units} available units`, PackageCheck, "green"],
    ["Low Stock", summary.low_stock, "Below reorder threshold", AlertTriangle, "amber"],
    ["Out of Stock", summary.out_of_stock, "No available units", Ban, "red"],
    ["Total Stock Value", inr(summary.total_stock_value), `${summary.total_units} physical units`, IndianRupee, "plum"],
  ], [summary]);

  return <div>
    <PageHead title="Inventory Management" subtitle="A clean source of truth for stock, reservations, cost and inventory movements" action={<div className="flex gap-2"><button onClick={load} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">Refresh</button><button onClick={exportCsv} className="px-3 py-2 rounded-lg bg-plum text-white text-sm flex items-center gap-2"><Download size={14}/> Export</button></div>} />
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">{cards.map(([label,value,sub,Icon,tone]) => <Stat key={label} label={label} value={value} sub={sub} icon={Icon} tone={tone} />)}</div>

    <div className="grid lg:grid-cols-3 gap-4 mb-6">
      <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5"><div className="flex items-center justify-between mb-4"><div><p className="font-semibold">Stock position</p><p className="text-xs text-gray-400 mt-1">Physical, reserved and available units</p></div><Boxes size={18} className="text-plum"/></div><div className="grid grid-cols-3 gap-3 text-sm"><div className="rounded-xl bg-gray-50 p-4"><p className="text-gray-500 text-xs">Physical</p><p className="text-xl font-semibold mt-1">{summary.total_units}</p></div><div className="rounded-xl bg-amber-50 p-4"><p className="text-gray-500 text-xs">Reserved</p><p className="text-xl font-semibold mt-1">{summary.reserved_units}</p></div><div className="rounded-xl bg-emerald-50 p-4"><p className="text-gray-500 text-xs">Available</p><p className="text-xl font-semibold mt-1">{summary.available_units}</p></div></div></div>
      <div className="bg-white rounded-2xl border border-gray-200 p-5"><p className="font-semibold">Stock health</p><div className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><span>In Stock</span><b>{summary.in_stock}</b></div><div className="flex justify-between"><span className="text-amber-700">Low Stock</span><b>{summary.low_stock}</b></div><div className="flex justify-between"><span className="text-red-600">Out of Stock</span><b>{summary.out_of_stock}</b></div></div></div>
    </div>

    <div className="bg-white rounded-2xl border border-gray-200 p-5"><div className="flex flex-wrap gap-3 items-center mb-4"><div className="relative flex-1 min-w-[240px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search product name or SKU…" className={`${inputCls} pl-9`}/></div><select value={category} onChange={e => setCategory(e.target.value)} className={inputCls+" max-w-[220px]"}><option value="">All categories</option>{cats.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select><select value={status} onChange={e => setStatus(e.target.value)} className={inputCls+" max-w-[180px]"}><option value="">All stock status</option><option value="healthy">In Stock</option><option value="low">Low Stock</option><option value="out">Out of Stock</option></select><select value={sort} onChange={e => setSort(e.target.value)} className={inputCls+" max-w-[210px]"}><option value="available_desc">Available: high → low</option><option value="available_asc">Available: low → high</option><option value="stock_desc">Stock: high → low</option><option value="stock_asc">Stock: low → high</option><option value="stock_value_desc">Stock value: high → low</option><option value="name_asc">Product: A → Z</option></select></div>
      <DataTable testid="inventory" loading={loading} rows={data.items || []} page={data.page || page} pages={data.pages || 1} setPage={setPage} empty="No inventory records found" columns={[
        {key:"name",label:"Product",render:r=><div><p className="font-medium text-gray-900">{r.name}</p><p className="text-xs text-gray-400">{r.sku || "No SKU"}</p></div>},
        {key:"category",label:"Category",render:r=>r.category_name || r.category_slug || "—"},
        {key:"cost_price",label:"Purchase",render:r=>inr(r.cost_price || 0)},
        {key:"price",label:"Selling",render:r=>inr(r.price || 0)},
        {key:"stock",label:"Total",render:r=>r.stock},
        {key:"reserved",label:"Reserved",render:r=>r.reserved},
        {key:"available",label:"Available",render:r=><span className="font-semibold">{r.available}</span>},
        {key:"status",label:"Status",render:r=><StockStatus status={r.inventory_status}/>},
        {key:"action",label:"Action",render:r=><button onClick={(e)=>{e.stopPropagation();setView(r);}} className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs hover:bg-gray-50"><Eye size={13}/> View</button>},
      ]}/>
    </div>
    {view && <ProductInventoryModal product={view} onClose={() => setView(null)} reload={load} />}
  </div>;
}
