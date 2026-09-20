import React, { useEffect, useState, useCallback } from "react";
import { Plus, Search, Copy, Archive, Edit, Trash2, Boxes, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, PackageCheck, RotateCcw, Eye, Tag, Layers3, ShoppingBag, Package, Power, Sparkles } from "lucide-react";
import { adminApi, apiError } from "../lib/api";
import { toast } from "sonner";
import { inr } from "../lib/utils";
import { StatusChip, Modal, Field, inputCls, PageHead, Empty } from "./ui";
import { ImageUpload, MultiImageUpload, VideoUpload } from "./ImageUpload";
import { DataTable, KpiCards } from "./DataTable";
import CustomProductForm from "./CustomProductForm";

const BADGES = ["New", "Bestseller", "Limited", "Sale", "Featured"];
const STATUSES = ["Draft", "Active", "Inactive", "Out of Stock", "Archived"];
const SECTIONS = [
  { key: "new-arrivals", label: "New Arrivals" },
  { key: "bestsellers", label: "Best Sellers" },
  { key: "featured", label: "Featured" },
  { key: "trending", label: "Trending" },
];

/* ---------------- PRODUCTS ---------------- */
export function Products() {
  const [data, setData] = useState({ items: [], pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [cats, setCats] = useState([]);
  const [summary, setSummary] = useState(null);
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(new Set());

  const load = useCallback(() => {
    setLoading(true);
    adminApi.get(`/products?q=${encodeURIComponent(q)}&status=${status}&category=${category}&sort=${sort}&page=${page}&page_size=20`)
      .then(({ data }) => setData(data)).catch(() => {}).finally(() => setLoading(false));
  }, [q, status, category, sort, page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { adminApi.get("/categories").then(({ data }) => setCats(data.items)).catch(() => {}); adminApi.get("/products/summary").then(({ data }) => setSummary(data)).catch(() => {}); }, []);

  const archive = async (e, p) => { e.stopPropagation(); if (!window.confirm(`Archive "${p.name}"?`)) return; await adminApi.delete(`/products/${p.id}`); toast.success("Archived"); load(); };
  const duplicate = async (e, p) => { e.stopPropagation(); await adminApi.post(`/products/${p.id}/duplicate`); toast.success("Duplicated"); load(); };
  useEffect(() => { setSelected(new Set()); }, [q, status, category, sort, page]);
  const toggleSelected = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected((prev) => {
    if (data.items.length && data.items.every((p) => prev.has(p.id))) return new Set();
    return new Set(data.items.map((p) => p.id));
  });
  const bulkDelete = async () => {
    if (!selected.size) return;
    if (!window.confirm(`Permanently delete ${selected.size} selected product(s)? This cannot be undone.`)) return;
    try {
      const { data: result } = await adminApi.post("/products/bulk-delete", { ids: [...selected] });
      toast.success(`${result.deleted} product(s) deleted`);
      setSelected(new Set());
      load();
    } catch (e) { toast.error(apiError(e)); }
  };
  const bulkSetStatus = async (action) => {
    if (!selected.size) return;
    const label = action === "deactivate" ? "Deactivate" : "Activate";
    if (!window.confirm(`${label} ${selected.size} selected product(s)?`)) return;
    try {
      const { data: result } = await adminApi.post("/products/bulk", { ids: [...selected], action });
      toast.success(`${result.updated} product(s) ${label.toLowerCase()}d`);
      setSelected(new Set());
      load();
    } catch (e) { toast.error(apiError(e)); }
  };
  const setProductStatus = async (e, product, action) => {
    e.stopPropagation();
    const label = action === "deactivate" ? "Deactivate" : "Activate";
    if (!window.confirm(`${label} "${product.name}"?`)) return;
    try {
      await adminApi.post("/products/bulk", { ids: [product.id], action });
      toast.success(`${product.name} ${label.toLowerCase()}d`);
      load();
    } catch (err) { toast.error(apiError(err)); }
  };
  const exportCsv = async () => {
    try {
      const res = await adminApi.get("/export/products", { responseType: "blob" });
      const url = URL.createObjectURL(res.data); const a = document.createElement("a");
      a.href = url; a.download = "products.csv"; a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div>
      <PageHead title="Products" subtitle={`${data.total} products`} action={<div className="flex items-center gap-2">
        {selected.size > 0 && <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => bulkSetStatus("activate")} className="border border-emerald-200 text-emerald-700 bg-white rounded-md px-3 py-2 text-sm flex items-center gap-2 hover:bg-emerald-50" data-testid="bulk-activate-products"><Power size={15} /> Activate ({selected.size})</button>
          <button onClick={() => bulkSetStatus("deactivate")} className="border border-amber-200 text-amber-700 bg-white rounded-md px-3 py-2 text-sm flex items-center gap-2 hover:bg-amber-50" data-testid="bulk-deactivate-products"><Archive size={15} /> Deactivate ({selected.size})</button>
          <button onClick={bulkDelete} className="border border-red-200 text-red-600 bg-white rounded-md px-3 py-2 text-sm flex items-center gap-2 hover:bg-red-50" data-testid="bulk-delete-products"><Trash2 size={15} /> Delete ({selected.size})</button>
        </div>}
        <div className="flex items-center gap-2">
          <button onClick={() => setEditing({})} className="bg-white border border-gray-300 text-gray-800 rounded-md px-4 py-2 text-sm flex items-center gap-2 hover:border-plum hover:text-plum" data-testid="add-product-btn"><Plus size={16} /> Add Product</button>
          <button onClick={() => setEditing({ product_type: "customizable" })} className="bg-plum text-white rounded-md px-4 py-2 text-sm flex items-center gap-2 hover:bg-plum-wine" data-testid="add-custom-product-btn"><Sparkles size={15} /> Add Customizable Product</button>
        </div>
      </div>} />
      {summary && <KpiCards cards={[
        { label: "Total Products", value: summary.total, icon: Package },
        { label: "Active", value: summary.active, icon: ShoppingBag },
        { label: "Low Stock", value: summary.low_stock, icon: AlertTriangle, sub: `${summary.out_of_stock} out of stock` },
        { label: "Inventory Value", value: inr(summary.inventory_value), icon: Boxes, sub: `${summary.stock_units} units on hand` },
      ]} />}
      <DataTable
        testid="products" loading={loading} q={q} setQ={(v) => { setQ(v); setPage(1); }} searchPlaceholder="Search products or SKU…"
        page={page} pages={data.pages} setPage={setPage} rows={data.items} onExport={exportCsv} empty="No products found"
        filters={[
          { key: "status", label: "All statuses", value: status, onChange: (v) => { setStatus(v); setPage(1); }, options: STATUSES },
          { key: "category", label: "All categories", value: category, onChange: (v) => { setCategory(v); setPage(1); }, options: cats.map((c) => ({ value: c.slug, label: c.name })) },
          { key: "sort", label: "Sort: newest", value: sort, onChange: (v) => { setSort(v); setPage(1); }, options: [{ value: "newest", label: "Newest" }, { value: "name_asc", label: "Name A–Z" }, { value: "updated_desc", label: "Recently updated" }, { value: "price_asc", label: "Price low → high" }, { value: "price_desc", label: "Price high → low" }, { value: "stock_asc", label: "Stock low → high" }, { value: "stock_desc", label: "Stock high → low" }, { value: "sales_desc", label: "Top sellers" }] },
        ]}
        columns={[
          { key: "__select", label: <input type="checkbox" aria-label="Select all products on this page" checked={data.items.length > 0 && data.items.every((p) => selected.has(p.id))} onChange={toggleAll} className="accent-plum w-4 h-4" />, render: (p) => <input type="checkbox" aria-label={`Select ${p.name}`} checked={selected.has(p.id)} onChange={() => toggleSelected(p.id)} onClick={(e) => e.stopPropagation()} className="accent-plum w-4 h-4" /> },
          { key: "name", label: "Product", render: (p) => <div className="flex items-center gap-3"><img src={(p.images || [])[0]} alt="" className="w-9 h-11 object-cover rounded bg-gray-100" /><span className="artful-product-name text-gray-900">{p.name}</span></div> },
          { key: "sku", label: "SKU", render: (p) => <span className="text-gray-500 font-mono text-xs">{p.sku}</span> },
          { key: "price", label: "Price", render: (p) => inr(p.price) },
          { key: "stock", label: "Stock", render: (p) => p.stock },
          { key: "status", label: "Status", render: (p) => <StatusChip status={p.status} /> },
          { key: "actions", label: "Actions", render: (p) => <div className="flex gap-2 text-gray-400" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setEditing(p)} className="hover:text-plum" data-testid={`edit-${p.slug}`} title="Edit"><Edit size={16} /></button>
            <button onClick={(e) => duplicate(e, p)} className="hover:text-plum" title="Duplicate"><Copy size={16} /></button>
            {p.status === "Active" || p.status === "Out of Stock" ? <button onClick={(e) => setProductStatus(e, p, "deactivate")} className="hover:text-amber-600" title="Deactivate"><Archive size={16} /></button> : p.status !== "Archived" ? <button onClick={(e) => setProductStatus(e, p, "activate")} className="hover:text-emerald-600" title="Activate"><Power size={16} /></button> : null}
            <button onClick={(e) => archive(e, p)} className="hover:text-red-600" title="Archive"><Trash2 size={16} /></button>
          </div> },
        ]}
        onRowClick={(p) => setDetail(p)}
      />
      {detail && <ProductDetailModal productId={detail.id} onClose={() => setDetail(null)} />}
      {editing && (editing.product_type === "customizable" || editing.customization?.enabled)
        ? <CustomProductForm product={editing} cats={cats} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
        : editing ? <ProductForm product={editing} cats={cats} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} /> : null}
    </div>
  );
}

function ProductForm({ product, cats, onClose, onSaved }) {
  const isNew = !product.id;
  const defaultCustomization = {
    enabled: false,
    options: [],
    pricing: { mode: "base_addons", quantity_tiers: [], rules: [] },
    artwork: { enabled: false, required: false, formats: ["pdf", "jpg", "png"], max_size_mb: 20, max_files: 1, instructions: "" },
    size: { enabled: false, unit: "mm", allow_custom: true, min_width: 20, max_width: 1000, min_height: 20, max_height: 1000, pricing_mode: "fixed", price_per_area: 0, min_price: 0, presets: [] },
  };
  const [f, setF] = useState({
    name: "", price: "", cost_price: "", mrp: "", compare_at_price: "", stock: 0, low_stock_threshold: 5, sku: "",
    category_slug: cats[0]?.slug || "", short_description: "", description: "", material: "", color: "",
    status: "Draft", badges: [], tags: [], images: [], occasion: [], recipient: [],
    personalization: { enabled: false, char_limit: 30 },
    bulk_order: { enabled: false, min_quantity: 10, tiers: [] },
    customization: defaultCustomization,
    product_type: "standard",
    video: null, ...product,
  });
  const [tab, setTab] = useState("basic");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setF((prev) => ({
      ...prev,
      product_type: prev.product_type || (prev.customization?.enabled ? "customizable" : "standard"),
      customization: {
        ...defaultCustomization,
        ...(prev.customization || {}),
        pricing: { ...defaultCustomization.pricing, ...(prev.customization?.pricing || {}) },
        artwork: { ...defaultCustomization.artwork, ...(prev.customization?.artwork || {}) },
        size: { ...defaultCustomization.size, ...(prev.customization?.size || {}) },
      },
      bulk_order: prev.bulk_order || { enabled: false, min_quantity: 10, tiers: [] },
    }));
  }, []);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const custom = f.customization || defaultCustomization;
  const setCustom = (k, v) => set("customization", { ...custom, [k]: v });
  const toggleBadge = (b) => set("badges", f.badges.includes(b) ? f.badges.filter((x) => x !== b) : [...f.badges, b]);

  const addOption = () => {
    const n = (custom.options?.length || 0) + 1;
    setCustom("options", [...(custom.options || []), {
      id: `option-${Date.now()}`, name: `Option ${n}`, type: "select", required: true,
      values: [{ id: `value-${Date.now()}`, label: "Default", add_on: 0 }],
    }]);
  };
  const updateOption = (idx, patch) => {
    const options = [...(custom.options || [])]; options[idx] = { ...options[idx], ...patch }; setCustom("options", options);
  };
  const removeOption = (idx) => setCustom("options", (custom.options || []).filter((_, i) => i !== idx));

  const addSizePreset = () => {
    const presets = [...(custom.size?.presets || [])];
    presets.push({
      id: `size-${Date.now()}-${presets.length}`,
      label: `Size ${presets.length + 1}`,
      width: 89,
      height: 51,
    });
    setCustom("size", { ...(custom.size || {}), presets });
  };
  const updateSizePreset = (idx, patch) => {
    const presets = [...(custom.size?.presets || [])];
    if (!presets[idx]) return;
    presets[idx] = { ...presets[idx], ...patch };
    setCustom("size", { ...(custom.size || {}), presets });
  };
  const removeSizePreset = (idx) => {
    setCustom("size", {
      ...(custom.size || {}),
      presets: (custom.size?.presets || []).filter((_, i) => i !== idx),
    });
  };
  const addValue = (oi) => {
    const options = [...(custom.options || [])]; const values = [...(options[oi].values || [])];
    values.push({ id: `value-${Date.now()}-${values.length}`, label: `Option ${values.length + 1}`, add_on: 0 });
    options[oi] = { ...options[oi], values }; setCustom("options", options);
  };
  const updateValue = (oi, vi, patch) => {
    const options = [...(custom.options || [])]; const values = [...(options[oi].values || [])];
    values[vi] = { ...values[vi], ...patch }; options[oi] = { ...options[oi], values }; setCustom("options", options);
  };
  const removeValue = (oi, vi) => {
    const options = [...(custom.options || [])]; options[oi] = { ...options[oi], values: options[oi].values.filter((_, i) => i !== vi) }; setCustom("options", options);
  };

  const addTier = () => {
    const tiers = [...(custom.pricing?.quantity_tiers || []), { min_quantity: 100, price: f.price || 0 }];
    setCustom("pricing", { ...(custom.pricing || {}), quantity_tiers: tiers });
  };
  const updateTier = (idx, patch) => {
    const tiers = [...(custom.pricing?.quantity_tiers || [])]; tiers[idx] = { ...tiers[idx], ...patch };
    setCustom("pricing", { ...(custom.pricing || {}), quantity_tiers: tiers });
  };
  const removeTier = (idx) => setCustom("pricing", { ...(custom.pricing || {}), quantity_tiers: (custom.pricing?.quantity_tiers || []).filter((_, i) => i !== idx) });

  const addRule = () => {
    const rules = [...(custom.pricing?.rules || []), { min_quantity: 1, max_quantity: null, selections: {}, price: f.price || 0 }];
    setCustom("pricing", { ...(custom.pricing || {}), rules });
  };
  const updateRule = (idx, patch) => {
    const rules = [...(custom.pricing?.rules || [])]; rules[idx] = { ...rules[idx], ...patch };
    setCustom("pricing", { ...(custom.pricing || {}), rules });
  };
  const removeRule = (idx) => setCustom("pricing", { ...(custom.pricing || {}), rules: (custom.pricing?.rules || []).filter((_, i) => i !== idx) });

  const save = async () => {
    if (!f.name || (f.product_type !== "customizable" && f.price === "")) return toast.error(f.product_type === "customizable" ? "Product name is required" : "Name and price are required");
    setSaving(true);
    const bulk = f.bulk_order?.enabled ? {
      enabled: true, min_quantity: Math.max(2, Number(f.bulk_order?.min_quantity || 2)),
      tiers: (f.bulk_order?.tiers || []).map((t) => ({ min_quantity: Math.max(2, Number(t.min_quantity || 0)), price: Math.max(1, Number(t.price || 0)) })).filter((t) => t.min_quantity > 0 && t.price > 0)
    } : { enabled: false, min_quantity: Number(f.bulk_order?.min_quantity || 10), tiers: [] };
    const payload = {
      ...f,
      product_type: f.product_type,
      price: Number(f.price || ((f.customization?.pricing?.quantity_tiers || []).map(t => Number(t.price || 0)).filter(Boolean).sort((a,b) => a-b)[0] || (f.customization?.pricing?.rules || []).map(r => Number(r.price || 0)).filter(Boolean).sort((a,b) => a-b)[0] || 0)),
      cost_price: Number(f.cost_price || 0),
      mrp: f.mrp ? Number(f.mrp) : (f.compare_at_price ? Number(f.compare_at_price) : null),
      compare_at_price: f.mrp ? Number(f.mrp) : (f.compare_at_price ? Number(f.compare_at_price) : null),
      stock: Number(f.stock), low_stock_threshold: Number(f.low_stock_threshold),
      bulk_order: bulk,
      customization: f.product_type === "customizable" ? {
        ...custom, enabled: true,
        options: (custom.options || []).map(o => ({ ...o, values: (o.values || []).map(v => ({ ...v, add_on: Number(v.add_on || 0) })) })),
        pricing: { ...(custom.pricing || {}), quantity_tiers: (custom.pricing?.quantity_tiers || []).map(t => ({ min_quantity: Number(t.min_quantity || 0), price: Number(t.price || 0) })).filter(t => t.min_quantity > 0 && t.price > 0) },
        size: { ...(custom.size || {}), min_width: Number(custom.size?.min_width || 20), max_width: Number(custom.size?.max_width || 1000), min_height: Number(custom.size?.min_height || 20), max_height: Number(custom.size?.max_height || 1000), price_per_area: Number(custom.size?.price_per_area || 0), min_price: Number(custom.size?.min_price || 0), presets: (custom.size?.presets || []).map(s => ({ ...s, width: Number(s.width || 0), height: Number(s.height || 0) })).filter(s => s.width > 0 && s.height > 0) }
      } : { ...defaultCustomization, enabled: false },
      tags: typeof f.tags === "string" ? f.tags.split(",").map((x) => x.trim()).filter(Boolean) : f.tags,
      images: typeof f.images === "string" ? f.images.split("\n").map((x) => x.trim()).filter(Boolean) : f.images,
      occasion: typeof f.occasion === "string" ? f.occasion.split(",").map((x) => x.trim()).filter(Boolean) : f.occasion,
      recipient: typeof f.recipient === "string" ? f.recipient.split(",").map((x) => x.trim()).filter(Boolean) : f.recipient
    };
    try {
      if (isNew) await adminApi.post("/products", payload);
      else await adminApi.put(`/products/${product.id}`, payload);
      toast.success(isNew ? "Product created" : "Product updated"); onSaved();
    } catch (e) { toast.error(apiError(e)); }
    setSaving(false);
  };

  const tabCls = (key) => `px-4 py-2.5 text-sm font-medium border-b-2 ${tab === key ? "border-plum text-plum" : "border-transparent text-gray-500 hover:text-gray-800"}`;
  return (
    <Modal open title={isNew ? "Add Product" : "Edit Product"} onClose={onClose} wide>
      <div className="border-b border-gray-200 flex items-center gap-1 mb-5">
        <button type="button" className={tabCls("basic")} onClick={() => setTab("basic")}>Basic Details</button>
        {f.product_type === "customizable" && <><button type="button" className={tabCls("custom")} onClick={() => setTab("custom")}>Customization</button><button type="button" className={tabCls("pricing")} onClick={() => setTab("pricing")}>Pricing</button></>}
      </div>

      {tab === "basic" && <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Product Name *"><input value={f.name} onChange={(e) => set("name", e.target.value)} className={inputCls} data-testid="pf-name" /></Field>
        <Field label="SKU"><input value={f.sku} onChange={(e) => set("sku", e.target.value)} className={inputCls} /></Field>
        <Field label="Product Type *"><select value={f.product_type} onChange={(e) => { set("product_type", e.target.value); setTab(e.target.value === "customizable" ? "custom" : "basic"); }} className={inputCls}><option value="standard">Standard Product</option><option value="customizable">Customizable Product</option></select></Field>
        {f.product_type === "standard" && <Field label="Selling Price (₹) *"><input type="number" value={f.price} onChange={(e) => set("price", e.target.value)} className={inputCls} data-testid="pf-price" /></Field>}
        <Field label="Purchase Price / COGS (₹)"><input type="number" min="0" value={f.cost_price ?? ""} onChange={(e) => set("cost_price", e.target.value)} className={inputCls} /></Field>
        <Field label="MRP (₹)"><input type="number" min="0" value={f.mrp ?? ""} onChange={(e) => set("mrp", e.target.value)} className={inputCls} /></Field>
        <Field label="Stock Quantity"><input type="number" min="0" value={f.stock} onChange={(e) => set("stock", e.target.value)} className={inputCls} data-testid="pf-stock" /></Field>
        <Field label="Low stock threshold"><input type="number" value={f.low_stock_threshold} onChange={(e) => set("low_stock_threshold", e.target.value)} className={inputCls} /></Field>
        <Field label="Category"><select value={f.category_slug} onChange={(e) => set("category_slug", e.target.value)} className={inputCls}>{cats.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></Field>
        <Field label="Status"><select value={f.status} onChange={(e) => set("status", e.target.value)} className={inputCls} data-testid="pf-status">{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Material"><input value={f.material || ""} onChange={(e) => set("material", e.target.value)} className={inputCls} /></Field>
        <Field label="Color"><input value={f.color || ""} onChange={(e) => set("color", e.target.value)} className={inputCls} /></Field>
        <div className="sm:col-span-2"><Field label="Short description"><input value={f.short_description || ""} onChange={(e) => set("short_description", e.target.value)} className={inputCls} /></Field></div>
        <div className="sm:col-span-2"><Field label="Description"><textarea rows={3} value={f.description || ""} onChange={(e) => set("description", e.target.value)} className={inputCls} /></Field></div>
        <div className="sm:col-span-2"><Field label="Product Images"><MultiImageUpload value={Array.isArray(f.images) ? f.images : []} onChange={(v) => set("images", v)} testid="product-images" /></Field></div>
        <div className="sm:col-span-2"><Field label="Product Video (Optional)"><VideoUpload value={f.video || ""} onChange={(v) => set("video", v)} testid="product-video" /></Field></div>
        <div className="sm:col-span-2 border border-gray-100 rounded-lg p-4 bg-gray-50">
          <div className="flex items-center justify-between gap-3 mb-3"><div><p className="text-sm font-semibold text-gray-800">Bulk Ordering</p><p className="text-xs text-gray-400">Offer lower per-unit pricing for higher quantities.</p></div><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={!!f.bulk_order?.enabled} onChange={(e) => set("bulk_order", { ...(f.bulk_order || {}), enabled: e.target.checked })} className="accent-plum w-4 h-4" /> Enable bulk ordering</label></div>
          {f.bulk_order?.enabled && <div className="space-y-3"><Field label="Minimum bulk quantity"><input type="number" min="2" value={f.bulk_order?.min_quantity ?? 10} onChange={(e) => set("bulk_order", { ...(f.bulk_order || {}), min_quantity: Math.max(2, Number(e.target.value || 0)) })} className={inputCls} /></Field><div><div className="flex items-center justify-between mb-2"><p className="text-xs font-medium text-gray-600">Quantity pricing tiers</p><button type="button" onClick={() => set("bulk_order", { ...(f.bulk_order || {}), tiers: [...(f.bulk_order?.tiers || []), { min_quantity: f.bulk_order?.min_quantity || 10, price: f.price || "" }] })} className="text-xs text-plum underline">+ Add tier</button></div><div className="space-y-2">{(f.bulk_order?.tiers || []).map((tier, idx) => <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end"><div><label className="text-[11px] text-gray-500">Minimum qty</label><input type="number" min={2} value={tier.min_quantity ?? ""} onChange={(e) => { const tiers=[...(f.bulk_order?.tiers||[])]; tiers[idx]={...tiers[idx],min_quantity:Number(e.target.value||0)}; set("bulk_order",{...(f.bulk_order||{}),tiers}); }} className={inputCls}/></div><div><label className="text-[11px] text-gray-500">Unit price</label><input type="number" min="1" value={tier.price ?? ""} onChange={(e) => { const tiers=[...(f.bulk_order?.tiers||[])]; tiers[idx]={...tiers[idx],price:Number(e.target.value||0)}; set("bulk_order",{...(f.bulk_order||{}),tiers}); }} className={inputCls}/></div><button type="button" onClick={()=>set("bulk_order",{...(f.bulk_order||{}),tiers:(f.bulk_order?.tiers||[]).filter((_,i)=>i!==idx)})} className="px-3 py-2 text-xs text-red-600 border border-red-200 rounded">Remove</button></div>)}</div></div></div>}
        </div>
        <Field label="Tags (comma separated)"><input value={Array.isArray(f.tags) ? f.tags.join(", ") : f.tags} onChange={(e) => set("tags", e.target.value)} className={inputCls} /></Field>
        <Field label="Occasion (comma separated)"><input value={Array.isArray(f.occasion) ? f.occasion.join(", ") : f.occasion} onChange={(e) => set("occasion", e.target.value)} className={inputCls} /></Field>
        <div className="sm:col-span-2"><Field label="Badges"><div className="flex flex-wrap gap-2">{BADGES.map((b) => <button key={b} type="button" onClick={() => toggleBadge(b)} className={`px-3 py-1 text-xs rounded border ${f.badges.includes(b) ? "bg-plum text-white border-plum" : "border-gray-300 text-gray-600"}`}>{b}</button>)}</div></Field></div>
        <div className="sm:col-span-2 rounded-lg border border-gray-100 bg-gray-50 p-4"><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={!!f.personalization?.enabled} onChange={(e) => set("personalization", { ...(f.personalization || {}), enabled: e.target.checked })} className="accent-plum" /> Enable personalization</label>{f.personalization?.enabled && <div className="grid sm:grid-cols-2 gap-3 mt-3"><Field label="Personalisation label"><input value={f.personalization?.label || "Personalise this gift"} onChange={(e) => set("personalization", { ...f.personalization, label: e.target.value })} className={inputCls}/></Field><Field label="Character limit"><input type="number" min="1" max="200" value={f.personalization?.char_limit || 30} onChange={(e) => set("personalization", { ...f.personalization, char_limit: Math.min(200, Math.max(1, Number(e.target.value || 30))) })} className={inputCls}/></Field></div>}</div>
      </div>}

      {tab === "custom" && f.product_type === "customizable" && <div className="space-y-5">
        <div className="rounded-xl border border-plum/20 bg-plum/5 p-4"><p className="font-semibold text-gray-900">Customer customization</p><p className="text-xs text-gray-500 mt-1">Build the options the customer will select before adding the product to cart.</p></div>
        {(custom.options || []).map((o, oi) => <div key={o.id || oi} className="rounded-xl border border-gray-200 p-4">
          <div className="grid sm:grid-cols-[minmax(0,1fr)_130px_auto_auto] gap-3 items-end mb-3">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Option name</label><input value={o.name || ""} onChange={e=>updateOption(oi,{name:e.target.value})} className={inputCls} placeholder="e.g. Material, GSM, Printing"/></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Input type</label><select value={o.type || "select"} onChange={e=>updateOption(oi,{type:e.target.value})} className={inputCls+" !w-[130px]"}><option value="select">Dropdown</option><option value="radio">Radio</option></select></div>
            <label className="flex items-center gap-2 text-xs text-gray-600 h-10 whitespace-nowrap"><input type="checkbox" checked={o.required !== false} onChange={e=>updateOption(oi,{required:e.target.checked})} className="accent-plum w-4 h-4"/> Required</label>
            <button type="button" onClick={()=>removeOption(oi)} className="h-10 px-2 text-xs text-red-600">Remove</button>
          </div>
          <div className="space-y-2">{(o.values || []).map((v,vi)=><div key={v.id || vi} className="grid sm:grid-cols-[minmax(0,1fr)_130px_auto] gap-2 items-end">
            <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Option value</label><input value={v.label || ""} onChange={e=>updateValue(oi,vi,{label:e.target.value})} className={inputCls} placeholder="e.g. 350 GSM"/></div>
            <div><label className="block text-[11px] font-medium text-gray-500 mb-1">Add-on price (₹)</label><input type="number" min="0" value={v.add_on ?? 0} onChange={e=>updateValue(oi,vi,{add_on:Number(e.target.value||0)})} className={inputCls+" !w-[130px]"}/></div>
            <button type="button" onClick={()=>removeValue(oi,vi)} className="h-10 px-2 text-xs text-red-600">Remove</button>
          </div>)}</div>
          <button type="button" onClick={()=>addValue(oi)} className="mt-3 text-xs text-plum font-medium">+ Add value</button>
        </div>)}
        <button type="button" onClick={addOption} className="w-full border border-dashed border-plum/40 text-plum rounded-xl py-3 text-sm font-medium">+ Add customization option</button>
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between"><div><p className="font-semibold text-gray-900">Product size</p><p className="text-xs text-gray-500 mt-1">Add standard sizes and optionally allow a customer-defined size.</p></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!custom.size?.enabled} onChange={e=>setCustom("size",{...(custom.size||{}),enabled:e.target.checked})} className="accent-plum"/> Enable size selection</label></div>
          {custom.size?.enabled && <div className="mt-4 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4"><Field label="Unit"><select value={custom.size?.unit||"mm"} onChange={e=>setCustom("size",{...(custom.size||{}),unit:e.target.value})} className={inputCls}><option value="mm">Millimetres (mm)</option><option value="cm">Centimetres (cm)</option><option value="in">Inches (in)</option></select></Field><Field label="Custom size"><select value={custom.size?.allow_custom!==false?"yes":"no"} onChange={e=>setCustom("size",{...(custom.size||{}),allow_custom:e.target.value==="yes"})} className={inputCls}><option value="yes">Allow custom size</option><option value="no">Preset sizes only</option></select></Field></div>
            <div><div className="flex items-center justify-between mb-2"><p className="text-xs font-medium text-gray-600">Preset sizes</p><button type="button" onClick={addSizePreset} className="text-xs text-plum font-medium">+ Add size</button></div><div className="space-y-2">{(custom.size?.presets||[]).map((sp,idx)=><div key={sp.id||idx} className="grid sm:grid-cols-[minmax(0,1.4fr)_1fr_1fr_auto] gap-2 items-end"><div><label className="block text-[11px] font-medium text-gray-500 mb-1">Size name</label><input value={sp.label||""} onChange={e=>updateSizePreset(idx,{label:e.target.value})} className={inputCls} placeholder="e.g. Standard Visiting Card"/></div><div><label className="block text-[11px] font-medium text-gray-500 mb-1">Width</label><input type="number" min="1" value={sp.width??""} onChange={e=>updateSizePreset(idx,{width:Number(e.target.value||0)})} className={inputCls}/></div><div><label className="block text-[11px] font-medium text-gray-500 mb-1">Height</label><input type="number" min="1" value={sp.height??""} onChange={e=>updateSizePreset(idx,{height:Number(e.target.value||0)})} className={inputCls}/></div><button type="button" onClick={()=>removeSizePreset(idx)} className="h-10 px-2 text-xs text-red-600">Remove</button></div>)}</div></div>
            {custom.size?.allow_custom!==false && <div className="rounded-lg bg-gray-50 border border-gray-100 p-3"><p className="text-xs font-semibold text-gray-700 mb-2">Custom size limits</p><div className="grid grid-cols-2 sm:grid-cols-4 gap-2"><div><label className="block text-[11px] font-medium text-gray-500 mb-1">Minimum width</label><input type="number" min="1" value={custom.size?.min_width??20} onChange={e=>setCustom("size",{...(custom.size||{}),min_width:Number(e.target.value||1)})} className={inputCls}/></div><div><label className="block text-[11px] font-medium text-gray-500 mb-1">Maximum width</label><input type="number" min="1" value={custom.size?.max_width??1000} onChange={e=>setCustom("size",{...(custom.size||{}),max_width:Number(e.target.value||1000)})} className={inputCls}/></div><div><label className="block text-[11px] font-medium text-gray-500 mb-1">Minimum height</label><input type="number" min="1" value={custom.size?.min_height??20} onChange={e=>setCustom("size",{...(custom.size||{}),min_height:Number(e.target.value||1)})} className={inputCls}/></div><div><label className="block text-[11px] font-medium text-gray-500 mb-1">Maximum height</label><input type="number" min="1" value={custom.size?.max_height??1000} onChange={e=>setCustom("size",{...(custom.size||{}),max_height:Number(e.target.value||1000)})} className={inputCls}/></div></div></div>}
            <div className="grid sm:grid-cols-3 gap-3"><Field label="Custom-size pricing"><select value={custom.size?.pricing_mode||"fixed"} onChange={e=>setCustom("size",{...(custom.size||{}),pricing_mode:e.target.value})} className={inputCls}><option value="fixed">Fixed surcharge</option><option value="per_area">Price per area</option></select></Field><Field label="Price per area"><input type="number" min="0" value={custom.size?.price_per_area??0} onChange={e=>setCustom("size",{...(custom.size||{}),price_per_area:Number(e.target.value||0)})} className={inputCls}/></Field><Field label="Minimum custom-size charge"><input type="number" min="0" value={custom.size?.min_price??0} onChange={e=>setCustom("size",{...(custom.size||{}),min_price:Number(e.target.value||0)})} className={inputCls}/></Field></div>
          </div>}
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between"><div><p className="font-semibold text-gray-900">Customer artwork upload</p><p className="text-xs text-gray-500 mt-1">The file is uploaded after customer verification and attached to the order.</p></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!custom.artwork?.enabled} onChange={e=>setCustom("artwork",{...(custom.artwork||{}),enabled:e.target.checked})} className="accent-plum"/> Allow design upload</label></div>
          {custom.artwork?.enabled && <div className="mt-4 grid sm:grid-cols-2 gap-4">
            <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={!!custom.artwork?.required} onChange={e=>setCustom("artwork",{...(custom.artwork||{}),required:e.target.checked})} className="accent-plum"/> Require artwork before order</label>
            <Field label="Maximum file size (MB)"><input type="number" min="1" max="50" value={custom.artwork?.max_size_mb || 20} onChange={e=>setCustom("artwork",{...(custom.artwork||{}),max_size_mb:Number(e.target.value||20)})} className={inputCls}/></Field>
            <Field label="Maximum files"><input type="number" min="1" max="10" value={custom.artwork?.max_files || 1} onChange={e=>setCustom("artwork",{...(custom.artwork||{}),max_files:Number(e.target.value||1)})} className={inputCls}/></Field>
            <div><p className="text-xs font-medium text-gray-600 mb-2">Accepted formats</p><div className="flex gap-3">{["pdf","jpg","png"].map(fmt=><label key={fmt} className="text-sm flex items-center gap-1"><input type="checkbox" checked={(custom.artwork?.formats||[]).includes(fmt)} onChange={e=>{const formats=e.target.checked?[...(custom.artwork?.formats||[]),fmt]:(custom.artwork?.formats||[]).filter(x=>x!==fmt);setCustom("artwork",{...(custom.artwork||{}),formats});}} className="accent-plum"/>{fmt.toUpperCase()}</label>)}</div></div>
            <div className="sm:col-span-2"><Field label="Customer instruction"><textarea rows={2} value={custom.artwork?.instructions||""} onChange={e=>setCustom("artwork",{...(custom.artwork||{}),instructions:e.target.value})} className={inputCls} placeholder="Upload a print-ready design..."/></Field></div>
          </div>}
        </div>
      </div>}

      {tab === "pricing" && f.product_type === "customizable" && <div className="space-y-5">
        <div className="rounded-xl border border-gray-200 p-4">
          <label className="block text-sm font-semibold text-gray-900">Pricing method</label>
          <select value={custom.pricing?.mode || "base_addons"} onChange={e=>setCustom("pricing",{...(custom.pricing||{}),mode:e.target.value})} className={inputCls+" mt-2 !w-[130px]"}>
            <option value="base_addons">Base price + option add-ons</option>
            <option value="quantity">Quantity-based price</option>
            <option value="combination">Exact combination price</option>
          </select>
          <p className="text-xs text-gray-500 mt-2">For customizable products, the server calculates the final price from the selected pricing method.</p>
        </div>
        {custom.pricing?.mode !== "combination" && <div className="rounded-xl border border-gray-200 p-4">
          <Field label="Base price (₹)"><input type="number" min="0" value={f.price ?? 0} onChange={e=>set("price",e.target.value)} className={inputCls}/></Field>
          
          {custom.pricing?.mode === "quantity" && <><div className="mt-4 flex items-center justify-between"><div><p className="text-sm font-semibold">Quantity price tiers</p><p className="text-xs text-gray-500">Set the unit price for each quantity level. The highest matching minimum quantity is used.</p></div><button type="button" onClick={addTier} className="text-xs text-plum">+ Add tier</button></div>
          <div className="space-y-2 mt-3">{(custom.pricing?.quantity_tiers||[]).map((t,i)=><div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end"><Field label="Min quantity"><input type="number" min="1" value={t.min_quantity??""} onChange={e=>updateTier(i,{min_quantity:Number(e.target.value||0)})} className={inputCls}/></Field><Field label="Unit price"><input type="number" min="1" value={t.price??""} onChange={e=>updateTier(i,{price:Number(e.target.value||0)})} className={inputCls}/></Field><button type="button" onClick={()=>removeTier(i)} className="text-xs text-red-600 pb-2">Remove</button></div>)}</div>
        </>}</div>}

        
        {custom.pricing?.mode === "combination" && <div className="rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between"><div><p className="font-semibold">Combination rules</p><p className="text-xs text-gray-500">Set an exact price for a selected combination and quantity range.</p></div><button type="button" onClick={addRule} className="text-xs text-plum">+ Add rule</button></div>
          <div className="space-y-3 mt-3">{(custom.pricing?.rules||[]).map((r,ri)=><div key={ri} className="rounded-lg bg-gray-50 border p-3">
            <div className="grid sm:grid-cols-3 gap-2"><Field label="Min qty"><input type="number" value={r.min_quantity??1} onChange={e=>updateRule(ri,{min_quantity:Number(e.target.value||1)})} className={inputCls}/></Field><Field label="Max qty (optional)"><input type="number" value={r.max_quantity??""} onChange={e=>updateRule(ri,{max_quantity:e.target.value?Number(e.target.value):null})} className={inputCls}/></Field><Field label="Final unit price"><input type="number" min="1" value={r.price??""} onChange={e=>updateRule(ri,{price:Number(e.target.value||0)})} className={inputCls}/></Field></div>
            <div className="grid sm:grid-cols-2 gap-2 mt-2">{(custom.options||[]).map(o=><div key={o.id}><label className="block text-[11px] font-medium text-gray-500 mb-1">{o.name}</label><select value={r.selections?.[o.id]||""} onChange={e=>updateRule(ri,{selections:{...(r.selections||{}),[o.id]:e.target.value}})} className={inputCls}><option value="">Any</option>{(o.values||[]).map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></div>)}</div>
            <button type="button" onClick={()=>removeRule(ri)} className="mt-2 text-xs text-red-600">Remove rule</button>
          </div>)}</div>
        </div>}
      </div>}

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100"><button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button><button onClick={save} disabled={saving} className="bg-plum text-white rounded-md px-5 py-2 text-sm disabled:opacity-50" data-testid="pf-save">{saving ? "Saving…" : "Save Product"}</button></div>
    </Modal>
  );
}

function ProductDetailModal({ productId, onClose }) {
  const [p, setP] = useState(null);
  useEffect(() => { adminApi.get(`/products/${productId}`).then(({ data }) => setP(data)).catch(() => setP(false)); }, [productId]);
  return <Modal open title={p ? `Product · ${p.name}` : "Product details"} onClose={onClose} wide>
    {!p ? <p className="text-sm text-gray-400">Loading…</p> : <div className="space-y-6">
      <div className="grid lg:grid-cols-[120px_1fr] gap-5">
        <div className="w-[120px] h-[140px] rounded-2xl overflow-hidden bg-gray-100 border border-gray-200">{p.images?.[0] ? <img src={p.images[0]} alt="" className="w-full h-full object-cover"/> : null}</div>
        <div><div className="flex flex-wrap items-center gap-2"><StatusChip status={p.status}/>{p.sku && <span className="text-xs font-mono text-gray-500">{p.sku}</span>}</div><h3 className="artful-product-name text-2xl text-gray-900 mt-2">{p.name}</h3><p className="text-sm text-gray-500 mt-1">{p.short_description || "—"}</p><div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">{[["Selling",inr(p.price)],["Purchase",inr(p.cost_price)],["MRP",inr(p.mrp ?? p.compare_at_price)],["Stock",p.stock]].map(([l,v])=><div key={l} className="rounded-xl border border-gray-100 bg-gray-50 p-3"><p className="text-[10px] uppercase tracking-wider text-gray-400">{l}</p><p className="font-semibold text-gray-900 mt-1">{v}</p></div>)}</div></div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {[['Available', Math.max(0, Number(p.stock||0)-Number(p.reserved||0))], ['Reserved', p.reserved||0], ['Low Stock Alert', p.low_stock_threshold ?? 5]].map(([l,v])=><div key={l} className="rounded-xl border border-gray-200 p-4"><p className="text-xs text-gray-500">{l}</p><p className="text-xl font-semibold text-gray-900 mt-1">{v}</p></div>)}
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-gray-200 p-4"><h4 className="font-semibold text-gray-900 flex items-center gap-2"><Layers3 size={15}/> Bulk Ordering</h4>{p.bulk_order?.enabled ? <><p className="text-xs text-emerald-700 mt-1">Enabled · minimum {p.bulk_order.min_quantity || 1} pcs</p><div className="mt-3 space-y-2">{(p.bulk_order.tiers||[]).map((t,i)=><div key={i} className="flex justify-between text-sm"><span>{t.min_quantity}+ pcs</span><b>{inr(t.price)} / pc</b></div>)}</div></> : <p className="text-sm text-gray-400 mt-2">Disabled</p>}</div>
        <div className="rounded-xl border border-gray-200 p-4"><h4 className="font-semibold text-gray-900">Personalisation</h4><p className="text-sm text-gray-600 mt-2">{p.personalization?.enabled ? `Enabled · ${p.personalization.char_limit || 30} characters` : "Disabled"}</p>{p.tags?.length ? <div className="flex flex-wrap gap-2 mt-3">{p.tags.map(t=><span key={t} className="text-[11px] bg-gray-100 rounded-full px-2.5 py-1">{t}</span>)}</div> : null}</div>
      </div>
      <div className="rounded-xl border border-gray-200 p-4"><h4 className="font-semibold text-gray-900 flex items-center gap-2"><Eye size={15}/> Product description</h4><p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{p.description || "No description"}</p></div>
    </div>}
  </Modal>;
}

/* ---------------- GENERIC SIMPLE MANAGER ---------------- */
const SM_PAGE = 10;
function SimpleManager({ title, endpoint, columns, fields, defaults = {}, testid, searchKeys = ["name"], bulkDelete = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const load = useCallback(() => { setLoading(true); adminApi.get(`/${endpoint}`).then(({ data }) => setItems(data.items)).catch(() => {}).finally(() => setLoading(false)); }, [endpoint]);
  useEffect(() => { load(); }, [load]);
  const save = async (f) => {
    try {
      if (f.id) await adminApi.put(`/${endpoint}/${f.id}`, f);
      else await adminApi.post(`/${endpoint}`, f);
      toast.success("Saved"); setEditing(null); load();
    } catch (e) { toast.error(apiError(e)); }
  };
  const del = async (e, it) => { e.stopPropagation(); if (!window.confirm("Delete this item?")) return; try { await adminApi.delete(`/${endpoint}/${it.id}`); toast.success("Deleted"); load(); } catch (e) { toast.error(apiError(e)); } };
  useEffect(() => { setSelected(new Set()); setPage(1); }, [q]);
  const filtered = items.filter((it) => !q || searchKeys.some((k) => String(it[k] ?? "").toLowerCase().includes(q.toLowerCase())));
  const pages = Math.max(1, Math.ceil(filtered.length / SM_PAGE));
  const rows = filtered.slice((page - 1) * SM_PAGE, page * SM_PAGE);
  const toggleSelected = (id) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleAll = () => setSelected((prev) => rows.length && rows.every((it) => prev.has(it.id)) ? new Set() : new Set(rows.map((it) => it.id)));
  const bulkDeleteSelected = async () => {
    if (!bulkDelete || !selected.size) return;
    if (!window.confirm(`Permanently delete ${selected.size} selected ${title.toLowerCase()}? This cannot be undone.`)) return;
    try {
      const { data: result } = await adminApi.post(`/${endpoint}/bulk-delete`, { ids: [...selected] });
      toast.success(`${result.deleted} item(s) deleted`); setSelected(new Set()); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div>
      <PageHead title={title} action={<div className="flex items-center gap-2">
        {bulkDelete && selected.size > 0 && <button onClick={bulkDeleteSelected} className="border border-red-200 text-red-600 bg-white rounded-md px-4 py-2 text-sm flex items-center gap-2 hover:bg-red-50" data-testid={`bulk-delete-${testid}`}><Trash2 size={15} /> Delete selected ({selected.size})</button>}
        <button onClick={() => setEditing({ ...defaults })} className="bg-plum text-white rounded-md px-4 py-2 text-sm flex items-center gap-2" data-testid={`add-${testid}`}><Plus size={16} /> Add</button>
      </div>} />
      <DataTable
        testid={testid} loading={loading} q={q} setQ={(v) => { setQ(v); setPage(1); }} searchPlaceholder={`Search ${title.toLowerCase()}…`}
        page={page} pages={pages} setPage={setPage} rows={rows} empty="Nothing here yet"
        columns={[
          ...(bulkDelete ? [{ key: "__select", label: <input type="checkbox" aria-label={`Select all ${title.toLowerCase()} on this page`} checked={rows.length > 0 && rows.every((it) => selected.has(it.id))} onChange={toggleAll} className="accent-plum w-4 h-4" />, render: (it) => <input type="checkbox" aria-label={`Select ${it.name || title}`} checked={selected.has(it.id)} onChange={() => toggleSelected(it.id)} onClick={(e) => e.stopPropagation()} className="accent-plum w-4 h-4" /> }] : []),
          ...columns,
          { key: "__actions", label: "Actions", render: (it) => <div className="flex gap-2 text-gray-400" onClick={(e) => e.stopPropagation()}><button onClick={() => setEditing(it)} className="hover:text-plum"><Edit size={15} /></button><button onClick={(e) => del(e, it)} className="hover:text-red-600"><Archive size={15} /></button></div> }
        ]}
      />
      {editing && (
        <Modal open title={editing.id ? `Edit ${title}` : `Add ${title}`} onClose={() => setEditing(null)} wide>
          <div className="grid sm:grid-cols-2 gap-4">
            {fields.map((fl) => (
              <div key={fl.key} className={fl.full ? "sm:col-span-2" : ""}>
                <Field label={fl.label}>
                  {fl.type === "image" ? <ImageUpload value={editing[fl.key]} onChange={(u) => setEditing({ ...editing, [fl.key]: u })} testid={`${testid}-${fl.key}`} />
                    : fl.type === "textarea" ? <textarea rows={3} value={editing[fl.key] || ""} onChange={(e) => setEditing({ ...editing, [fl.key]: e.target.value })} className={inputCls} />
                    : fl.type === "select" ? <select value={editing[fl.key] || ""} onChange={(e) => setEditing({ ...editing, [fl.key]: e.target.value })} className={inputCls}>{fl.options.map((o) => <option key={o}>{o}</option>)}</select>
                    : fl.type === "checkbox" ? <input type="checkbox" checked={!!editing[fl.key]} onChange={(e) => setEditing({ ...editing, [fl.key]: e.target.checked })} className="accent-plum w-4 h-4" />
                    : <input type={fl.type || "text"} value={editing[fl.key] ?? ""} onChange={(e) => setEditing({ ...editing, [fl.key]: fl.type === "number" ? Number(e.target.value) : e.target.value })} className={inputCls} />}
                </Field>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 mt-6"><button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button><button onClick={() => save(editing)} className="bg-plum text-white rounded-md px-5 py-2 text-sm" data-testid={`save-${testid}`}>Save</button></div>
        </Modal>
      )}
    </div>
  );
}

export function Categories() {
  return <SimpleManager title="Categories" endpoint="categories" testid="category"
    columns={[{ key: "name", label: "Name" }, { key: "slug", label: "Slug" }, { key: "status", label: "Status", render: (c) => <StatusChip status={c.status} /> }]}
    fields={[{ key: "name", label: "Name" }, { key: "slug", label: "Slug (optional)" }, { key: "description", label: "Description", type: "textarea", full: true }, { key: "image", label: "Image", type: "image", full: true }, { key: "status", label: "Status", type: "select", options: ["Active", "Archived"] }]}
    defaults={{ status: "Active" }} bulkDelete />;
}

const BADGE_OPTIONS = ["", "New", "Bestseller", "Limited", "Sale", "Featured"];

export function Collections() {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [pq, setPq] = useState("");
  const load = useCallback(() => adminApi.get("/collections").then(({ data }) => setItems(data.items)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { adminApi.get("/products?page_size=200").then(({ data }) => setProducts(data.items)).catch(() => {}); }, []);

  const openNew = () => setEditing({ name: "", slug: "", description: "", image: "", type: "dynamic", status: "Active", rules: {}, product_ids: [] });
  const save = async () => {
    if (!editing.name) return toast.error("Name is required");
    const payload = { ...editing, rules: editing.rules || {}, product_ids: editing.product_ids || [] };
    try {
      if (editing.id) await adminApi.put(`/collections/${editing.id}`, payload);
      else await adminApi.post("/collections", payload);
      toast.success("Collection saved"); setEditing(null); load();
    } catch (e) { toast.error(apiError(e)); }
  };
  const del = async (it) => { if (!window.confirm("Delete this collection?")) return; await adminApi.delete(`/collections/${it.id}`); toast.success("Deleted"); load(); };

  const setRule = (k, v) => setEditing((e) => ({ ...e, rules: { ...(e.rules || {}), [k]: v } }));
  const toggleProduct = (id) => setEditing((e) => {
    const ids = e.product_ids || [];
    return { ...e, product_ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] };
  });
  const filteredProducts = products.filter((p) => !pq || p.name.toLowerCase().includes(pq.toLowerCase()));

  return (
    <div>
      <PageHead title="Collections" subtitle="Dynamic collections auto-populate by rules; manual collections use products you pick" action={<button onClick={openNew} className="bg-plum text-white rounded-md px-4 py-2 text-sm flex items-center gap-2" data-testid="add-collection"><Plus size={16} /> Add</button>} />
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-400 text-xs bg-gray-50 border-b border-gray-200"><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Slug</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Rule / Products</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Actions</th></tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b border-gray-50 hover:bg-gray-50" data-testid={`collection-${it.slug}`}>
                <td className="px-4 py-3 artful-product-name text-gray-900">{it.name}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{it.slug}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${it.type === "manual" ? "bg-indigo-100 text-indigo-700" : "bg-sky-100 text-sky-700"}`}>{it.type || "dynamic"}</span></td>
                <td className="px-4 py-3 text-gray-600 text-xs">{it.type === "manual" ? `${(it.product_ids || []).length} products` : Object.entries(it.rules || {}).map(([k, v]) => `${k}: ${v}`).join(", ") || "—"}</td>
                <td className="px-4 py-3"><StatusChip status={it.status} /></td>
                <td className="px-4 py-3"><div className="flex gap-2 text-gray-400"><button onClick={() => setEditing({ ...it, rules: it.rules || {}, product_ids: it.product_ids || [] })} className="hover:text-plum" data-testid={`edit-collection-${it.slug}`}><Edit size={15} /></button><button onClick={() => del(it)} className="hover:text-red-600"><Archive size={15} /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <Empty text="Nothing here yet" />}
      </div>
      {editing && (
        <Modal open title={editing.id ? "Edit Collection" : "Add Collection"} onClose={() => setEditing(null)} wide>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Name"><input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inputCls} data-testid="cf-name" /></Field>
            <Field label="Slug (optional)"><input value={editing.slug || ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className={inputCls} /></Field>
            <div className="sm:col-span-2"><Field label="Description"><textarea rows={2} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className={inputCls} /></Field></div>
            <div className="sm:col-span-2"><Field label="Image"><ImageUpload value={editing.image} onChange={(u) => setEditing({ ...editing, image: u })} testid="cf-image" /></Field></div>
            <Field label="Type"><select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })} className={inputCls} data-testid="cf-type"><option value="dynamic">Dynamic (auto by rules)</option><option value="manual">Manual (pick products)</option></select></Field>
            <Field label="Status"><select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })} className={inputCls}><option>Active</option><option>Archived</option></select></Field>
          </div>

          {editing.type === "dynamic" ? (
            <div className="mt-4 border border-gray-100 rounded-lg p-4 bg-gray-50" data-testid="cf-rules">
              <p className="text-sm font-semibold text-gray-800 mb-3">Dynamic Rules <span className="text-xs font-normal text-gray-400">— products matching ANY set rule are included</span></p>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Badge"><select value={editing.rules?.badge || ""} onChange={(e) => setRule("badge", e.target.value)} className={inputCls} data-testid="cf-rule-badge">{BADGE_OPTIONS.map((b) => <option key={b} value={b}>{b || "— none —"}</option>)}</select></Field>
                <Field label="Occasion"><input value={editing.rules?.occasion || ""} onChange={(e) => setRule("occasion", e.target.value)} placeholder="e.g. birthday" className={inputCls} data-testid="cf-rule-occasion" /></Field>
                <Field label="Recipient"><input value={editing.rules?.recipient || ""} onChange={(e) => setRule("recipient", e.target.value)} placeholder="e.g. her" className={inputCls} data-testid="cf-rule-recipient" /></Field>
                <Field label="Tag"><input value={editing.rules?.tag || ""} onChange={(e) => setRule("tag", e.target.value)} placeholder="e.g. personalized" className={inputCls} data-testid="cf-rule-tag" /></Field>
              </div>
            </div>
          ) : (
            <div className="mt-4 border border-gray-100 rounded-lg p-4" data-testid="cf-products">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-800">Select Products <span className="text-xs font-normal text-gray-400">({(editing.product_ids || []).length} selected)</span></p>
                <div className="relative w-52"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" /><input value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Search products…" className={inputCls + " pl-8 !py-1.5"} data-testid="cf-product-search" /></div>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                {filteredProducts.map((p) => (
                  <label key={p.id} className="flex items-center gap-3 py-2 cursor-pointer" data-testid={`cf-product-${p.slug}`}>
                    <input type="checkbox" checked={(editing.product_ids || []).includes(p.id)} onChange={() => toggleProduct(p.id)} className="accent-plum w-4 h-4" />
                    <img src={(p.images || [])[0]} alt="" className="w-8 h-10 object-cover rounded bg-gray-100" />
                    <span className="artful-product-name text-sm text-gray-800 flex-1">{p.name}</span>
                    <span className="text-xs text-gray-400">{inr(p.price)}</span>
                  </label>
                ))}
                {filteredProducts.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No products</p>}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6"><button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button><button onClick={save} className="bg-plum text-white rounded-md px-5 py-2 text-sm" data-testid="save-collection">Save</button></div>
        </Modal>
      )}
    </div>
  );
}

export function Reviews() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("Pending");
  const load = useCallback(() => adminApi.get(`/reviews?status=${filter}`).then(({ data }) => setItems(data.items)).catch(() => {}), [filter]);
  useEffect(() => { load(); }, [load]);
  const moderate = async (id, status) => { try { await adminApi.put(`/reviews/${id}`, { status }); toast.success(`Review ${status.toLowerCase()}`); load(); } catch (e) { toast.error(apiError(e)); } };
  const moderateImage = async (id, status) => { try { await adminApi.put(`/reviews/${id}/image`, { status }); toast.success(`Review image ${status.toLowerCase()}`); load(); } catch (e) { toast.error(apiError(e)); } };
  return (
    <div>
      <PageHead title="Reviews" subtitle="Moderate customer reviews and images" />
      <div className="flex gap-2 mb-4">{["Pending", "Approved", "Rejected"].map((s) => <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 text-sm rounded ${filter === s ? "bg-plum text-white" : "bg-white border border-gray-200 text-gray-600"}`}>{s}</button>)}</div>
      <div className="space-y-3">
        {items.map((r) => (
          <div key={r.id} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex justify-between gap-4">
              <div className="flex gap-4 min-w-0">
                {r.image_url && <img src={r.image_url} alt="Customer review" className="w-20 h-20 rounded object-cover border border-gray-200 shrink-0" />}
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{r.title || "Review"} · {r.rating}★</p>
                  <p className="text-sm text-gray-600 mt-1">{r.body || "No written message."}</p>
                  <p className="text-xs text-gray-400 mt-1">by {r.customer_name} · product {r.product_slug}</p>
                  <div className="flex flex-wrap gap-2 mt-2 text-[11px]">
                    <span className={`px-2 py-1 rounded-full ${r.status === "Approved" ? "bg-emerald-50 text-emerald-700" : r.status === "Rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>Review: {r.status}</span>
                    {r.image_url && <span className={`px-2 py-1 rounded-full ${r.image_status === "Approved" ? "bg-emerald-50 text-emerald-700" : r.image_status === "Rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>Image: {r.image_status || "Pending"}</span>}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                {filter === "Pending" && <div className="flex gap-2"><button onClick={() => moderate(r.id, "Approved")} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded">Approve review</button><button onClick={() => moderate(r.id, "Rejected")} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded">Reject review</button></div>}
                {r.image_url && r.image_status === "Pending" && <div className="flex gap-2"><button onClick={() => moderateImage(r.id, "Approved")} className="text-xs bg-sky-600 text-white px-3 py-1.5 rounded">Approve image</button><button onClick={() => moderateImage(r.id, "Rejected")} className="text-xs border border-red-200 text-red-600 px-3 py-1.5 rounded">Reject image</button></div>}
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && <Empty text="No reviews" />}
      </div>
    </div>
  );
}

export function Inventory() {
  const [summary, setSummary] = useState(null);
  const [data, setData] = useState({ items: [], pages: 1, total: 0 });
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [sort, setSort] = useState("stock_asc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [adjustOpen, setAdjustOpen] = useState(null);
  const [adjustValue, setAdjustValue] = useState(0);
  const [reason, setReason] = useState("Manual stock adjustment");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sm, rows, mv] = await Promise.all([
        adminApi.get("/inventory/summary"),
        adminApi.get(`/inventory?q=${encodeURIComponent(q)}&level=${level}&sort=${sort}&page=${page}&page_size=25`),
        adminApi.get("/inventory/movements?limit=12"),
      ]);
      setSummary(sm.data); setData(rows.data); setMovements(mv.data.items || []);
    } catch (e) { toast.error(apiError(e)); }
    finally { setLoading(false); }
  }, [q, level, sort, page]);
  useEffect(() => { const t = setTimeout(load, 180); return () => clearTimeout(t); }, [load]);
  useEffect(() => { setPage(1); }, [q, level, sort]);
  useEffect(() => { setSelected(new Set()); }, [q, level, sort, page]);

  const toggle = (id) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected((prev) => data.items.length && data.items.every((p) => prev.has(p.id)) ? new Set() : new Set(data.items.map((p) => p.id)));
  const applyBulk = async () => {
    if (!selected.size || !Number(adjustValue)) return toast.error("Select products and enter an adjustment.");
    try { await adminApi.post("/inventory/bulk-adjust", { ids: [...selected], change: Number(adjustValue), reason }); toast.success("Inventory updated"); setSelected(new Set()); setAdjustValue(0); await load(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const applyOne = async () => {
    try { await adminApi.post("/inventory/adjust", { product_id: adjustOpen.id, change: Number(adjustValue), reason }); toast.success("Stock updated"); setAdjustOpen(null); setAdjustValue(0); await load(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const setThreshold = async (p) => {
    const value = Number(window.prompt("Low-stock threshold", p.low_stock_threshold ?? 5));
    if (!Number.isFinite(value) || value < 0) return;
    try { await adminApi.post("/inventory/set-threshold", { product_id: p.id, threshold: value }); toast.success("Threshold updated"); load(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const kpis = summary ? [
    ["Inventory Value", inr(summary.stock_value), Boxes, "Current stock × selling price"],
    ["Units Available", summary.available_units, PackageCheck, `${summary.reserved_units} reserved`],
    ["Low Stock", summary.low_stock, AlertTriangle, `${summary.out_of_stock} out of stock`],
    ["Inbound / Outbound", `${summary.inbound} / ${summary.outbound}`, ArrowDownToLine, "Movement units"],
  ] : [];

  return (
    <div>
      <PageHead title="Inventory Management" subtitle="Stock, availability, thresholds and movement history in one place" />
      {summary && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">{kpis.map(([label, value, Icon, sub]) => <div key={label} className="bg-white rounded-xl border border-gray-200 p-4"><div className="flex justify-between"><span className="text-xs text-gray-500">{label}</span><span className="w-8 h-8 rounded-lg bg-plum/10 text-plum flex items-center justify-center"><Icon size={16}/></span></div><p className="text-xl font-semibold mt-2">{value}</p><p className="text-[11px] text-gray-400 mt-1">{sub}</p></div>)}</div>}

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search product / SKU…" className={inputCls + " pl-9"}/></div>
          <select value={level} onChange={(e)=>setLevel(e.target.value)} className={inputCls + " w-auto"}><option value="">All stock levels</option><option value="healthy">Healthy</option><option value="low">Low stock</option><option value="out">Out of stock</option></select>
          <select value={sort} onChange={(e)=>setSort(e.target.value)} className={inputCls + " w-auto"}><option value="stock_asc">Lowest stock first</option><option value="stock_desc">Highest stock first</option><option value="available_asc">Lowest available</option><option value="stock_value_desc">Highest inventory value</option><option value="sales_count_desc">Top sellers</option></select>
          {selected.size > 0 && <div className="flex items-center gap-2 ml-auto"><input type="number" value={adjustValue} onChange={(e)=>setAdjustValue(e.target.value)} className={inputCls+" w-24"} placeholder="±Qty"/><input value={reason} onChange={(e)=>setReason(e.target.value)} className={inputCls+" w-48"}/><button onClick={applyBulk} className="px-3 py-2 rounded-lg bg-plum text-white text-sm">Apply to {selected.size}</button></div>}
        </div>
      </div>

      <DataTable testid="inventory" loading={loading} rows={data.items} page={data.page} pages={data.pages} setPage={setPage} empty="No inventory records" columns={[
        { key:"__select", label:<input type="checkbox" checked={data.items.length>0 && data.items.every(p=>selected.has(p.id))} onChange={toggleAll}/>, render:(p)=><input type="checkbox" checked={selected.has(p.id)} onChange={()=>toggle(p.id)} onClick={e=>e.stopPropagation()} /> },
        { key:"name", label:"Product", render:p=><div><div className="artful-product-name text-gray-900">{p.name}</div><div className="text-[11px] text-gray-400">{p.sku || "No SKU"}</div></div> },
        { key:"stock", label:"On Hand", render:p=><span className={p.inventory_status === "out" ? "text-red-600 font-semibold" : p.inventory_status === "low" ? "text-amber-600 font-semibold" : "text-gray-800"}>{p.stock}</span> },
        { key:"reserved", label:"Reserved", render:p=><span>{p.reserved || 0}</span> },
        { key:"available", label:"Available", render:p=><span className="font-semibold">{p.available}</span> },
        { key:"threshold", label:"Low Stock @", render:p=><button onClick={(e)=>{e.stopPropagation();setThreshold(p)}} className="text-xs text-plum underline">{p.low_stock_threshold ?? 5}</button> },
        { key:"value", label:"Stock Value", align:"right", render:p=>inr(p.stock_value) },
        { key:"adjust", label:"Actions", render:p=><div className="flex gap-1" onClick={e=>e.stopPropagation()}><button onClick={()=>{setAdjustOpen(p);setAdjustValue(1);setReason("Manual restock")}} title="Restock" className="w-8 h-8 border rounded-lg text-emerald-700"><ArrowDownToLine size={14} className="mx-auto"/></button><button onClick={()=>{setAdjustOpen(p);setAdjustValue(-1);setReason("Manual issue")}} title="Issue stock" className="w-8 h-8 border rounded-lg text-red-600"><ArrowUpFromLine size={14} className="mx-auto"/></button><button onClick={()=>{setAdjustOpen(p);setAdjustValue(0);setReason("Manual adjustment")}} className="px-2 border rounded-lg text-xs">Adjust</button></div>},
      ]} />

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5"><h3 className="font-semibold mb-3 flex items-center gap-2"><RotateCcw size={15} className="text-plum"/> Recent stock movements</h3><div className="space-y-2 text-sm">{movements.map(m=><div key={m.id} className="flex justify-between gap-3 border-b border-gray-50 pb-2"><div><p className="text-gray-800 truncate">{m.product_name || m.product_id}</p><p className="text-[11px] text-gray-400">{m.reason} · {m.admin || "system"}</p></div><b className={m.change > 0 ? "text-emerald-600" : "text-red-600"}>{m.change > 0 ? "+" : ""}{m.change}</b></div>)}{movements.length===0&&<p className="text-gray-400">No movements yet.</p>}</div></div>
        <div className="bg-white rounded-xl border border-gray-200 p-5"><h3 className="font-semibold mb-3">Inventory health</h3><div className="space-y-4 text-sm"><div><div className="flex justify-between mb-1"><span>Available units</span><b>{summary?.available_units || 0}</b></div><div className="h-2 bg-gray-100 rounded-full"><div className="h-2 rounded-full bg-plum" style={{width:`${summary?.stock_units ? Math.min(100, ((summary.available_units/summary.stock_units)*100)) : 0}%`}}/></div></div><div className="flex justify-between"><span>SKUs tracked</span><b>{summary?.total_skus || 0}</b></div><div className="flex justify-between"><span>Low stock SKUs</span><b className="text-amber-600">{summary?.low_stock || 0}</b></div><div className="flex justify-between"><span>Out of stock SKUs</span><b className="text-red-600">{summary?.out_of_stock || 0}</b></div></div></div>
      </div>

      {adjustOpen && <Modal open title={`Adjust stock — ${adjustOpen.name}`} onClose={()=>setAdjustOpen(null)}><div className="space-y-4"><Field label="Quantity change"><input type="number" value={adjustValue} onChange={e=>setAdjustValue(e.target.value)} className={inputCls}/></Field><Field label="Reason"><input value={reason} onChange={e=>setReason(e.target.value)} className={inputCls}/></Field><p className="text-xs text-gray-400">Current stock: {adjustOpen.stock} · Available: {adjustOpen.available}</p><div className="flex justify-end gap-2"><button onClick={()=>setAdjustOpen(null)} className="px-4 py-2 text-sm">Cancel</button><button onClick={applyOne} className="px-4 py-2 bg-plum text-white rounded-lg text-sm">Save adjustment</button></div></div></Modal>}
    </div>
  );
}
