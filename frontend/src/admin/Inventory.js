import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, ClipboardList, Download,
    FilePlus2, History, PackageCheck, RefreshCw, Search, Settings2, Truck, Undo2,
    Users, X, BarChart3, TrendingDown, TrendingUp
} from "lucide-react";
import { adminApi, apiError } from "../lib/api";
import { toast } from "sonner";
import { inr } from "../lib/utils";
import { Modal, Field, inputCls, PageHead, StatusChip } from "./ui";
import { DataTable } from "./DataTable";

const TABS = [
    ["overview", "Overview"], ["stock", "Stock"], ["movements", "Movements"],
    ["purchasing", "Purchasing"], ["suppliers", "Suppliers"], ["forecast", "Forecast"],
];

const money = (n) => inr(Number(n || 0));
const num = (n) => Number(n || 0).toLocaleString("en-IN");

function Metric({ label, value, sub, icon: Icon, tone = "plum" }) {
    const tones = { plum: "bg-plum/10 text-plum", green: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", red: "bg-red-50 text-red-700", blue: "bg-sky-50 text-sky-700" };
    return <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-[0_6px_24px_rgba(23,16,38,0.04)]">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-wide text-gray-400">{label}</p><p className="text-2xl font-semibold text-gray-900 mt-2">{value}</p><p className="text-xs text-gray-400 mt-1">{sub}</p></div><span className={`w-10 h-10 rounded-xl flex items-center justify-center ${tones[tone] || tones.plum}`}><Icon size={18} /></span></div>
    </div>;
}

function Section({ title, subtitle, action, children }) {
    return <section className="bg-white rounded-2xl border border-gray-200 shadow-[0_6px_24px_rgba(23,16,38,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3"><div><h3 className="font-semibold text-gray-900">{title}</h3>{subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}</div>{action}</div>
        <div className="p-5">{children}</div>
    </section>;
}

function MiniBars({ series = [] }) {
    const max = Math.max(1, ...series.map((x) => Number(x.value || 0)));
    return <div className="flex items-end gap-1.5 h-40">
        {series.slice(-24).map((x, i) => <div key={i} className="flex-1 min-w-1 flex flex-col items-center justify-end gap-1" title={`${x.label}: ${num(x.value)}`}><div className="w-full max-w-7 rounded-t bg-plum/70" style={{ height: `${Math.max(4, (Number(x.value || 0) / max) * 125)}px` }} /></div>)}
    </div>;
}

function StockModal({ row, mode, onClose, onSaved }) {
    const [qty, setQty] = useState(mode === "adjust" ? row.stock : 1);
    const [reason, setReason] = useState(mode === "in" ? "Supplier receipt" : mode === "out" ? "Damage / loss" : "Physical count adjustment");
    const [unitCost, setUnitCost] = useState(row.cost_price || "");
    const [saving, setSaving] = useState(false);
    const title = mode === "in" ? "Receive stock" : mode === "out" ? "Issue stock" : "Adjust stock to physical count";
    const save = async () => {
        if (qty === "" || Number(qty) < 0) return toast.error("Enter a valid quantity.");
        setSaving(true);
        try {
            const endpoint = mode === "in" ? "/inventory/stock-in" : mode === "out" ? "/inventory/stock-out" : "/inventory/adjust";
            const body = mode === "adjust"
                ? { product_id: row.product_id, variant_id: row.variant_id, new_stock: Number(qty), reason }
                : { product_id: row.product_id, variant_id: row.variant_id, quantity: Number(qty), reason, unit_cost: Number(unitCost || 0) };
            await adminApi.post(endpoint, body);
            toast.success("Inventory updated"); onSaved();
        } catch (e) { toast.error(apiError(e)); }
        finally { setSaving(false); }
    };
    return <Modal open wide title={`${title} — ${row.name}`} onClose={onClose}>
        <div className="grid sm:grid-cols-2 gap-4">
            <Field label="SKU"><div className="p-2.5 rounded-md bg-gray-50 border text-sm font-mono">{row.sku || "—"}</div></Field>
            <Field label="Current on-hand"><div className="p-2.5 rounded-md bg-gray-50 border text-sm">{row.stock}</div></Field>
            <Field label={mode === "adjust" ? "Physical count" : "Quantity"}><input autoFocus type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} /></Field>
            {mode !== "adjust" && <Field label="Unit cost (optional)"><input type="number" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className={inputCls} /></Field>}
            <div className="sm:col-span-2"><Field label="Reason"><input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} /></Field></div>
        </div>
        <div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button><button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-plum text-white rounded-lg disabled:opacity-50">{saving ? "Saving…" : "Save"}</button></div>
    </Modal>;
}

function SupplierModal({ onClose, onSaved, supplier }) {
    const [f, setF] = useState(supplier || { name: "", code: "", contact_name: "", phone: "", email: "", address: "", payment_terms: "", lead_time_days: 7, active: true });
    const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
    const save = async () => {
        if (!f.name.trim()) return toast.error("Supplier name is required.");
        try { if (supplier?.id) await adminApi.put(`/inventory/suppliers/${supplier.id}`, f); else await adminApi.post("/inventory/suppliers", f); toast.success("Supplier saved"); onSaved(); }
        catch (e) { toast.error(apiError(e)); }
    };
    return <Modal open wide title={supplier ? "Edit supplier" : "Add supplier"} onClose={onClose}>
        <div className="grid sm:grid-cols-2 gap-4"><Field label="Supplier name *"><input value={f.name} onChange={(e) => set("name", e.target.value)} className={inputCls} /></Field><Field label="Supplier code"><input value={f.code} onChange={(e) => set("code", e.target.value)} className={inputCls} /></Field><Field label="Contact person"><input value={f.contact_name} onChange={(e) => set("contact_name", e.target.value)} className={inputCls} /></Field><Field label="Phone"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} /></Field><Field label="Email"><input value={f.email} onChange={(e) => set("email", e.target.value)} className={inputCls} /></Field><Field label="Lead time (days)"><input type="number" min="0" value={f.lead_time_days} onChange={(e) => set("lead_time_days", e.target.value)} className={inputCls} /></Field><div className="sm:col-span-2"><Field label="Address"><input value={f.address} onChange={(e) => set("address", e.target.value)} className={inputCls} /></Field></div><Field label="Payment terms"><input value={f.payment_terms} onChange={(e) => set("payment_terms", e.target.value)} className={inputCls} /></Field></div>
        <div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Cancel</button><button onClick={save} className="px-4 py-2 bg-plum text-white rounded-lg text-sm">Save supplier</button></div>
    </Modal>;
}

function PurchaseOrderModal({ suppliers, onClose, onSaved }) {
    const [supplierId, setSupplierId] = useState(suppliers[0]?.id || "");
    const [note, setNote] = useState("");
    const [items, setItems] = useState([{ sku: "", quantity: 1, unit_cost: "" }]);
    const update = (i, k, v) => setItems((arr) => arr.map((x, idx) => idx === i ? { ...x, [k]: v } : x));
    const save = async () => {
        const cleanItems = items.filter((x) => x.sku.trim()).map((x) => ({ ...x, quantity: Number(x.quantity), unit_cost: Number(x.unit_cost || 0) }));
        if (!supplierId || !cleanItems.length) return toast.error("Select supplier and add at least one SKU.");
        try { await adminApi.post("/inventory/purchase-orders", { supplier_id: supplierId, notes: note, items: cleanItems }); toast.success("Purchase order created"); onSaved(); }
        catch (e) { toast.error(apiError(e)); }
    };
    return <Modal open wide title="Create purchase order" onClose={onClose}><div className="space-y-4"><Field label="Supplier"><select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><div className="rounded-xl border overflow-hidden"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left px-3 py-2">SKU</th><th className="text-right px-3 py-2">Qty</th><th className="text-right px-3 py-2">Unit cost</th><th /></tr></thead><tbody>{items.map((x, i) => <tr key={i} className="border-t"><td className="p-2"><input value={x.sku} onChange={(e) => update(i, "sku", e.target.value)} className={inputCls} /></td><td className="p-2"><input type="number" min="1" value={x.quantity} onChange={(e) => update(i, "quantity", e.target.value)} className={inputCls} /></td><td className="p-2"><input type="number" min="0" value={x.unit_cost} onChange={(e) => update(i, "unit_cost", e.target.value)} className={inputCls} /></td><td className="p-2"><button onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="text-gray-400"><X size={15} /></button></td></tr>)}</tbody></table></div><button onClick={() => setItems([...items, { sku: "", quantity: 1, unit_cost: "" }])} className="text-sm text-plum">+ Add line</button><Field label="Notes"><textarea value={note} onChange={(e) => setNote(e.target.value)} className={inputCls + " min-h-20"} /></Field><div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Cancel</button><button onClick={save} className="px-4 py-2 bg-plum text-white rounded-lg text-sm">Create PO</button></div></div></Modal>;
}

export default function Inventory() {
    const [tab, setTab] = useState("overview");
    const [summary, setSummary] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [forecast, setForecast] = useState([]);
    const [rows, setRows] = useState({ items: [], page: 1, pages: 1, total: 0 });
    const [movements, setMovements] = useState({ items: [], page: 1, pages: 1, total: 0 });
    const [suppliers, setSuppliers] = useState([]);
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState(""); const [status, setStatus] = useState(""); const [category, setCategory] = useState(""); const [supplier, setSupplier] = useState(""); const [sort, setSort] = useState("available_asc");
    const [page, setPage] = useState(1); const [movementPage, setMovementPage] = useState(1); const [days, setDays] = useState(30);
    const [categories, setCategories] = useState([]); const [selected, setSelected] = useState(new Set());
    const [stockModal, setStockModal] = useState(null); const [supplierModal, setSupplierModal] = useState(null); const [poModal, setPoModal] = useState(false);

    const load = useCallback(async () => {
        setLoading(true); try {
            const [s, a, r, m, sup, pos, f, c] = await Promise.all([
                adminApi.get("/inventory/summary"), adminApi.get(`/inventory/analytics?days=${days}`),
                adminApi.get(`/inventory?q=${encodeURIComponent(q)}&status=${status}&category=${encodeURIComponent(category)}&supplier_id=${supplier}&sort=${sort}&page=${page}&page_size=25`),
                adminApi.get(`/inventory/movements?page=${movementPage}&page_size=50`), adminApi.get("/inventory/suppliers"), adminApi.get("/inventory/purchase-orders?limit=50"), adminApi.get(`/inventory/forecast?days=${days}`), api.get("/categories") 
            ]); setSummary(s.data); setAnalytics(a.data); setRows(r.data); setMovements(m.data); setSuppliers(sup.data.items || []); setPurchaseOrders(pos.data.items || []); setForecast(f.data.items || []); setCategories(c.data.items || []);
        } catch (e) { toast.error(apiError(e)); } finally { setLoading(false); }
    }, [q, status, category, supplier, sort, page, movementPage, days]);
    useEffect(() => { const t = setTimeout(load, 180); return () => clearTimeout(t); }, [load]);
    useEffect(() => { setPage(1); }, [q, status, category, supplier, sort]);
    useEffect(() => { setMovementPage(1); }, [days]);

    const exportCsv = async () => { try { const r = await adminApi.get("/inventory/export", { responseType: "blob" }); const u = URL.createObjectURL(r.data); const a = document.createElement("a"); a.href = u; a.download = "artful-inventory.csv"; a.click(); URL.revokeObjectURL(u); } catch (e) { toast.error(apiError(e)); } };
    const bulk = async (type) => { const qty = Number(window.prompt(type === "in" ? "Quantity to receive per selected SKU" : "Quantity to remove per selected SKU", "1")); if (!selected.size || !qty || qty < 0) return; try { await adminApi.post(`/inventory/bulk-${type}`, { ids: [...selected], quantity: qty, reason: type === "in" ? "Bulk stock-in" : "Bulk stock-out" }); toast.success("Bulk inventory updated"); setSelected(new Set()); load(); } catch (e) { toast.error(apiError(e)); } };

    const kpi = summary ? [
        ["Inventory value", money(summary.inventory_value), "At cost", Boxes, "plum"],
        ["Units on hand", num(summary.stock_units), `${num(summary.reserved_units)} reserved`, PackageCheck, "blue"],
        ["Available to sell", num(summary.available_units), "Physical − reserved", Truck, "green"],
        ["Low stock", num(summary.low_stock), `${num(summary.out_of_stock)} out of stock`, AlertTriangle, "amber"],
        ["Stock in (30d)", num(summary.stock_in_30d), "Received units", ArrowDownToLine, "green"],
        ["Stock out (30d)", num(summary.stock_out_30d), "Issued + sales", ArrowUpFromLine, "red"],
        ["Active SKUs", num(summary.active_skus), `${num(summary.total_products)} products`, ClipboardList, "plum"],
        ["At-risk value", money(summary.at_risk_value), "Low + out of stock", TrendingDown, "red"],
    ] : [];

    return <div className="space-y-6">
        <PageHead title="Inventory Control Center" subtitle="Industry-grade stock operations, purchasing, valuation, forecasting and auditability" action={<div className="flex gap-2"><button onClick={() => load()} className="border rounded-lg px-3 py-2 text-sm flex items-center gap-2"><RefreshCw size={14} /> Refresh</button><button onClick={exportCsv} className="bg-plum text-white rounded-lg px-3 py-2 text-sm flex items-center gap-2"><Download size={14} /> Export</button></div>} />
        <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 w-fit">{TABS.map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`px-4 py-2 rounded-lg text-sm ${tab === id ? "bg-white shadow text-gray-900" : "text-gray-500"}`}>{label}</button>)}</div>

        {tab === "overview" && <div className="space-y-6"><div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{kpi.map(([l, v, s, I, t]) => <Metric key={l} label={l} value={v} sub={s} icon={I} tone={t} />)}</div><div className="grid xl:grid-cols-3 gap-6"><Section title="Inventory value & movement" subtitle={`Rolling ${days} day view`} action={<select value={days} onChange={e => setDays(Number(e.target.value))} className="border rounded-lg px-3 py-1.5 text-xs"><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select>}><div className="grid sm:grid-cols-3 gap-3 mb-5"><div><p className="text-xs text-gray-400">Stock in</p><p className="text-xl font-semibold mt-1">{num(analytics?.stock_in || 0)}</p></div><div><p className="text-xs text-gray-400">Stock out</p><p className="text-xl font-semibold mt-1">{num(analytics?.stock_out || 0)}</p></div><div><p className="text-xs text-gray-400">Net movement</p><p className="text-xl font-semibold mt-1">{num((analytics?.stock_in || 0) - (analytics?.stock_out || 0))}</p></div></div><MiniBars series={analytics?.series || []} /></Section><Section title="Stock health" subtitle="Current operational exposure"><div className="space-y-4">{[["Healthy", summary?.healthy || 0, "bg-emerald-500"], ["Low stock", summary?.low_stock || 0, "bg-amber-500"], ["Out of stock", summary?.out_of_stock || 0, "bg-red-500"], ["Reserved", summary?.reserved_skus || 0, "bg-sky-500"]].map(([l, v, c]) => <div key={l}><div className="flex justify-between text-sm mb-1"><span>{l}</span><b>{num(v)}</b></div><div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className={`h-full ${c}`} style={{ width: `${Math.min(100, (Number(v) / (Number(summary?.active_skus) || 1)) * 100)}%` }} /></div></div>)}</div></Section><Section title="Replenishment watch" subtitle="SKUs requiring attention"><div className="space-y-3">{(forecast || []).slice(0, 6).map(x => <div key={x.key} className="flex justify-between gap-3"><div><p className="text-sm font-medium truncate max-w-[210px]">{x.name}</p><p className="text-xs text-gray-400">{x.sku} · {x.days_of_cover == null ? "No sales history" : `${x.days_of_cover} days cover`}</p></div><span className={`text-xs px-2 py-1 rounded-full ${x.status === "Critical" ? "bg-red-50 text-red-700" : x.status === "Watch" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{x.status}</span></div>)}{!forecast?.length && <p className="text-sm text-gray-400">No forecast signals yet.</p>}</div></Section></div></div>}

        {tab === "stock" && <Section title="Stock master" subtitle="SKU-level control with available, reserved and replenishment visibility" action={<div className="text-xs text-gray-400">{rows.total} rows</div>}><div className="flex flex-wrap gap-2 mb-5"><div className="relative flex-1 min-w-[220px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search product, SKU or supplier…" className={inputCls + " pl-9"} /></div><select value={status} onChange={e => setStatus(e.target.value)} className={inputCls + " w-auto"}><option value="">All stock status</option><option value="healthy">Healthy</option><option value="low">Low stock</option><option value="out">Out of stock</option></select><select value={category} onChange={e => setCategory(e.target.value)} className={inputCls + " w-auto"}><option value="">All categories</option>{categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select><select value={supplier} onChange={e => setSupplier(e.target.value)} className={inputCls + " w-auto"}><option value="">All suppliers</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><select value={sort} onChange={e => setSort(e.target.value)} className={inputCls + " w-auto"}><option value="available_asc">Lowest available</option><option value="stock_desc">Highest stock</option><option value="value_desc">Highest value</option><option value="sales_desc">Top sellers</option><option value="updated_desc">Recently updated</option></select></div><div className="flex flex-wrap items-center gap-2 mb-4">{selected.size > 0 && <><button onClick={() => bulk("in")} className="border rounded-lg px-3 py-2 text-xs flex gap-2 items-center"><ArrowDownToLine size={13} /> Bulk stock-in</button><button onClick={() => bulk("out")} className="border rounded-lg px-3 py-2 text-xs flex gap-2 items-center"><ArrowUpFromLine size={13} /> Bulk stock-out</button><span className="text-xs text-gray-400">{selected.size} selected</span></>}</div><DataTable testid="inventory-stock" loading={loading} rows={rows.items} page={rows.page} pages={rows.pages} setPage={setPage} empty="No inventory records" columns={[{ key: "select", label: <input type="checkbox" checked={rows.items.length > 0 && rows.items.every(x => selected.has(x.key))} onChange={() => setSelected(rows.items.every(x => selected.has(x.key)) ? new Set() : new Set(rows.items.map(x => x.key)))} />, render: x => <input type="checkbox" checked={selected.has(x.key)} onChange={() => setSelected(s => { const n = new Set(s); n.has(x.key) ? n.delete(x.key) : n.add(x.key); return n; })} /> }, { key: "name", label: "Product / Variant", render: x => <div><div className="font-medium text-gray-900 artful-product-name">{x.name}</div><div className="text-[11px] text-gray-400 font-mono">{x.sku || "No SKU"}{x.variant_label ? ` · ${x.variant_label}` : ""}</div></div> }, { key: "supplier", label: "Supplier", render: x => x.supplier_name || "—" }, { key: "stock", label: "On hand", render: x => num(x.stock) }, { key: "reserved", label: "Reserved", render: x => num(x.reserved) }, { key: "available", label: "Available", render: x => <span className="font-semibold">{num(x.available)}</span> }, { key: "threshold", label: "Reorder @", render: x => num(x.reorder_level) }, { key: "value", label: "Stock value", align: "right", render: x => money(x.inventory_value) }, { key: "status", label: "Status", render: x => <StatusChip status={x.status_label} /> }, { key: "actions", label: "Actions", render: x => <div className="flex gap-1"><button title="Stock in" onClick={() => setStockModal({ row: x, mode: "in" })} className="w-8 h-8 border rounded-lg text-emerald-700"><ArrowDownToLine size={14} className="mx-auto" /></button><button title="Stock out" onClick={() => setStockModal({ row: x, mode: "out" })} className="w-8 h-8 border rounded-lg text-red-600"><ArrowUpFromLine size={14} className="mx-auto" /></button><button title="Adjust" onClick={() => setStockModal({ row: x, mode: "adjust" })} className="px-2 border rounded-lg text-xs">Adjust</button></div> }]} /></Section>}

        {tab === "movements" && <Section title="Inventory ledger" subtitle="Complete stock movement history with actor, source and balance"><DataTable testid="inventory-movements" loading={loading} rows={movements.items} page={movements.page} pages={movements.pages} setPage={setMovementPage} empty="No inventory movements" columns={[{ key: "at", label: "Date / time", render: x => new Date(x.at).toLocaleString() }, { key: "sku", label: "SKU", render: x => <span className="font-mono text-xs">{x.sku || "—"}</span> }, { key: "name", label: "Item", render: x => <span className="artful-product-name">{x.product_name || x.product_id}</span> }, { key: "type", label: "Movement", render: x => <span className={`px-2 py-1 rounded-full text-[11px] ${x.quantity > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{x.movement_type || "Adjustment"}</span> }, { key: "qty", label: "Qty", render: x => <b className={x.quantity > 0 ? "text-emerald-700" : "text-red-700"}>{x.quantity > 0 ? "+" : ""}{x.quantity}</b> }, { key: "before", label: "Before", render: x => num(x.before_stock) }, { key: "after", label: "After", render: x => num(x.after_stock) }, { key: "reason", label: "Reason", render: x => x.reason || "—" }, { key: "actor", label: "By", render: x => x.admin || x.source || "system" }]} /></Section>}

        {tab === "purchasing" && <Section title="Purchase orders" subtitle="Supplier purchasing and receiving control" action={<button onClick={() => setPoModal(true)} className="bg-plum text-white rounded-lg px-3 py-2 text-sm flex items-center gap-2"><FilePlus2 size={14} /> New PO</button>}><DataTable testid="purchase-orders" loading={loading} rows={purchaseOrders} empty="No purchase orders" columns={[{ key: "po_number", label: "PO", render: x => <span className="font-mono text-xs">{x.po_number}</span> }, { key: "supplier", label: "Supplier", render: x => x.supplier_name }, { key: "created_at", label: "Created", render: x => new Date(x.created_at).toLocaleDateString() }, { key: "items_count", label: "Lines", render: x => x.items_count }, { key: "total", label: "Value", align: "right", render: x => money(x.total_value) }, { key: "status", label: "Status", render: x => <StatusChip status={x.status} /> }, { key: "action", label: "Action", render: x => x.status === "Open" ? <button onClick={async () => { try { await adminApi.post(`/inventory/purchase-orders/${x.id}/receive`); toast.success("PO received and stock increased"); load(); } catch (e) { toast.error(apiError(e)); } }} className="text-xs border rounded-lg px-2 py-1">Receive</button> : <span className="text-xs text-gray-400">—</span> }]} /></Section>}

        {tab === "suppliers" && <Section title="Supplier master" subtitle="Vendors, lead time and purchasing terms" action={<button onClick={() => setSupplierModal({})} className="bg-plum text-white rounded-lg px-3 py-2 text-sm flex items-center gap-2"><Users size={14} /> Add supplier</button>}><DataTable testid="suppliers" loading={loading} rows={suppliers} empty="No suppliers" columns={[{ key: "name", label: "Supplier", render: x => <span className="font-medium">{x.name}</span> }, { key: "code", label: "Code", render: x => x.code || "—" }, { key: "contact_name", label: "Contact", render: x => x.contact_name || "—" }, { key: "phone", label: "Phone", render: x => x.phone || "—" }, { key: "lead_time_days", label: "Lead time", render: x => `${x.lead_time_days || 0} days` }, { key: "open_pos", label: "Open POs", render: x => num(x.open_pos || 0) }, { key: "actions", label: "Actions", render: x => <button onClick={() => setSupplierModal(x)} className="text-xs border rounded-lg px-2 py-1">Edit</button> }]} /></Section>}

        {tab === "forecast" && <div className="space-y-6"><Section title="Replenishment forecast" subtitle="Estimated demand, days of cover and suggested reorder quantity"><DataTable testid="inventory-forecast" loading={loading} rows={forecast} empty="Not enough sales history for a forecast" columns={[{ key: "name", label: "SKU / Product", render: x => <div><div className="font-medium artful-product-name">{x.name}</div><div className="text-[11px] text-gray-400 font-mono">{x.sku}</div></div> }, { key: "stock", label: "Available", render: x => num(x.available) }, { key: "velocity", label: "Daily velocity", render: x => Number(x.daily_velocity || 0).toFixed(2) }, { key: "coverage", label: "Days cover", render: x => x.days_of_cover == null ? "—" : Math.round(x.days_of_cover) }, { key: "reorder", label: "Suggested reorder", render: x => <span className="font-semibold">{num(x.suggested_reorder)}</span> }, { key: "status", label: "Signal", render: x => <span className={`px-2 py-1 rounded-full text-[11px] ${x.status === "Critical" ? "bg-red-50 text-red-700" : x.status === "Watch" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{x.status}</span> }]} /></Section><Section title="Valuation & controls" subtitle="At-cost inventory valuation is used for management reporting"><div className="grid sm:grid-cols-3 gap-4"><Metric label="Inventory at cost" value={money(summary?.inventory_value)} sub="Current physical units" icon={Boxes} /><Metric label="Retail value" value={money(summary?.retail_value)} sub="Current selling price" icon={BarChart3} /><Metric label="Potential gross margin" value={money((summary?.retail_value || 0) - (summary?.inventory_value || 0))} sub="Retail minus cost" icon={TrendingUp} tone="green" /></div></Section></div>}

        {stockModal && <StockModal row={stockModal.row} mode={stockModal.mode} onClose={() => setStockModal(null)} onSaved={() => { setStockModal(null); load(); }} />}
        {supplierModal && <SupplierModal supplier={supplierModal.id ? supplierModal : null} onClose={() => setSupplierModal(null)} onSaved={() => { setSupplierModal(null); load(); }} />}
        {poModal && <PurchaseOrderModal suppliers={suppliers} onClose={() => setPoModal(false)} onSaved={() => { setPoModal(false); load(); }} />}
    </div>;
}
