import React, { useEffect, useState, useCallback } from "react";
import { Plus, Search, Copy, Archive, Edit } from "lucide-react";
import { adminApi, apiError } from "../lib/api";
import { toast } from "sonner";
import { inr } from "../lib/utils";
import { StatusChip, Modal, Field, inputCls, PageHead, Empty } from "./ui";
import { ImageUpload, MultiImageUpload, VideoUpload } from "./ImageUpload";
import { DataTable } from "./DataTable";

const BADGES = ["New", "Bestseller", "Limited", "Sale", "Featured"];
const STATUSES = ["Draft", "Active", "Out of Stock", "Archived"];
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
  const [page, setPage] = useState(1);
  const [cats, setCats] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.get(`/products?q=${encodeURIComponent(q)}&status=${status}&category=${category}&page=${page}&page_size=20`)
      .then(({ data }) => setData(data)).catch(() => {}).finally(() => setLoading(false));
  }, [q, status, category, page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { adminApi.get("/categories").then(({ data }) => setCats(data.items)).catch(() => {}); }, []);

  const archive = async (e, p) => { e.stopPropagation(); if (!window.confirm(`Archive "${p.name}"?`)) return; await adminApi.delete(`/products/${p.id}`); toast.success("Archived"); load(); };
  const duplicate = async (e, p) => { e.stopPropagation(); await adminApi.post(`/products/${p.id}/duplicate`); toast.success("Duplicated"); load(); };
  const exportCsv = async () => {
    try {
      const res = await adminApi.get("/export/products", { responseType: "blob" });
      const url = URL.createObjectURL(res.data); const a = document.createElement("a");
      a.href = url; a.download = "products.csv"; a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div>
      <PageHead title="Products" subtitle={`${data.total} products`} action={<button onClick={() => setEditing({})} className="bg-plum text-white rounded-md px-4 py-2 text-sm flex items-center gap-2" data-testid="add-product-btn"><Plus size={16} /> Add Product</button>} />
      <DataTable
        testid="products" loading={loading} q={q} setQ={(v) => { setQ(v); setPage(1); }} searchPlaceholder="Search products or SKU…"
        page={page} pages={data.pages} setPage={setPage} rows={data.items} onExport={exportCsv} empty="No products found"
        filters={[
          { key: "status", label: "All statuses", value: status, onChange: (v) => { setStatus(v); setPage(1); }, options: STATUSES },
          { key: "category", label: "All categories", value: category, onChange: (v) => { setCategory(v); setPage(1); }, options: cats.map((c) => ({ value: c.slug, label: c.name })) },
        ]}
        columns={[
          { key: "name", label: "Product", render: (p) => <div className="flex items-center gap-3"><img src={(p.images || [])[0]} alt="" className="w-9 h-11 object-cover rounded bg-gray-100" /><span className="font-medium text-gray-900">{p.name}</span></div> },
          { key: "sku", label: "SKU", render: (p) => <span className="text-gray-500 font-mono text-xs">{p.sku}</span> },
          { key: "price", label: "Price", render: (p) => inr(p.price) },
          { key: "stock", label: "Stock", render: (p) => p.stock },
          { key: "status", label: "Status", render: (p) => <StatusChip status={p.status} /> },
          { key: "actions", label: "Actions", render: (p) => <div className="flex gap-2 text-gray-400" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setEditing(p)} className="hover:text-plum" data-testid={`edit-${p.slug}`}><Edit size={16} /></button>
            <button onClick={(e) => duplicate(e, p)} className="hover:text-plum"><Copy size={16} /></button>
            <button onClick={(e) => archive(e, p)} className="hover:text-red-600"><Archive size={16} /></button>
          </div> },
        ]}
      />
      {editing && <ProductForm product={editing} cats={cats} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function ProductForm({ product, cats, onClose, onSaved }) {
  const isNew = !product.id;
  const [f, setF] = useState({
    name: "", price: "", compare_at_price: "", stock: 0, low_stock_threshold: 5, sku: "",
    category_slug: cats[0]?.slug || "", short_description: "", description: "", material: "", color: "",
    status: "Active", badges: [], tags: [], images: [], occasion: [], recipient: [],
    personalization: { enabled: false, char_limit: 30 },
    bulk_order: { enabled: false, min_quantity: 10, tiers: [] },
    video: null, ...product,
  });
  useEffect(() => {
    setF((prev) => ({ ...prev, bulk_order: prev.bulk_order || { enabled: false, min_quantity: 10, tiers: [] } }));
  }, []);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggleBadge = (b) => set("badges", f.badges.includes(b) ? f.badges.filter((x) => x !== b) : [...f.badges, b]);

  const save = async () => {
    if (!f.name || f.price === "") return toast.error("Name and price are required");
    setSaving(true);
    const bulk = f.bulk_order?.enabled ? { enabled: true, min_quantity: Math.max(2, Number(f.bulk_order?.min_quantity || 2)), tiers: (f.bulk_order?.tiers || []).map((t) => ({ min_quantity: Math.max(2, Number(t.min_quantity || 0)), price: Math.max(1, Number(t.price || 0)) })).filter((t) => t.min_quantity > 0 && t.price > 0) } : { enabled: false, min_quantity: Number(f.bulk_order?.min_quantity || 10), tiers: [] };
    const payload = { ...f, price: Number(f.price), compare_at_price: f.compare_at_price ? Number(f.compare_at_price) : null, stock: Number(f.stock), low_stock_threshold: Number(f.low_stock_threshold), bulk_order: bulk, tags: typeof f.tags === "string" ? f.tags.split(",").map((x) => x.trim()).filter(Boolean) : f.tags, images: typeof f.images === "string" ? f.images.split("\n").map((x) => x.trim()).filter(Boolean) : f.images, occasion: typeof f.occasion === "string" ? f.occasion.split(",").map((x) => x.trim()).filter(Boolean) : f.occasion, recipient: typeof f.recipient === "string" ? f.recipient.split(",").map((x) => x.trim()).filter(Boolean) : f.recipient };
    try {
      if (isNew) await adminApi.post("/products", payload);
      else await adminApi.put(`/products/${product.id}`, payload);
      toast.success(isNew ? "Product created" : "Product updated");
      onSaved();
    } catch (e) { toast.error(apiError(e)); }
    setSaving(false);
  };

  return (
    <Modal open title={isNew ? "Add Product" : "Edit Product"} onClose={onClose} wide>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Name *"><input value={f.name} onChange={(e) => set("name", e.target.value)} className={inputCls} data-testid="pf-name" /></Field>
        <Field label="SKU"><input value={f.sku} onChange={(e) => set("sku", e.target.value)} className={inputCls} /></Field>
        <Field label="Price (₹) *"><input type="number" value={f.price} onChange={(e) => set("price", e.target.value)} className={inputCls} data-testid="pf-price" /></Field>
        <Field label="Compare-at Price (₹)"><input type="number" value={f.compare_at_price || ""} onChange={(e) => set("compare_at_price", e.target.value)} className={inputCls} /></Field>
        <Field label="Stock"><input type="number" value={f.stock} onChange={(e) => set("stock", e.target.value)} className={inputCls} data-testid="pf-stock" /></Field>
        <Field label="Low stock threshold"><input type="number" value={f.low_stock_threshold} onChange={(e) => set("low_stock_threshold", e.target.value)} className={inputCls} /></Field>
        <Field label="Category"><select value={f.category_slug} onChange={(e) => set("category_slug", e.target.value)} className={inputCls}>{cats.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></Field>
        <Field label="Status"><select value={f.status} onChange={(e) => set("status", e.target.value)} className={inputCls} data-testid="pf-status">{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Material"><input value={f.material || ""} onChange={(e) => set("material", e.target.value)} className={inputCls} /></Field>
        <Field label="Color"><input value={f.color || ""} onChange={(e) => set("color", e.target.value)} className={inputCls} /></Field>
        <div className="sm:col-span-2"><Field label="Short description"><input value={f.short_description || ""} onChange={(e) => set("short_description", e.target.value)} className={inputCls} /></Field></div>
        <div className="sm:col-span-2"><Field label="Description"><textarea rows={3} value={f.description || ""} onChange={(e) => set("description", e.target.value)} className={inputCls} /></Field></div>
        <div className="sm:col-span-2"><Field label="Product Images"><MultiImageUpload value={Array.isArray(f.images) ? f.images : []} onChange={(v) => set("images", v)} testid="product-images" /></Field></div>
        <div className="sm:col-span-2">
          <Field label="Product Video (Optional)"><VideoUpload value={f.video || ""} onChange={(v) => set("video", v)} testid="product-video" /></Field>
        </div>
        <div className="sm:col-span-2 border border-gray-100 rounded-lg p-4 bg-gray-50">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div><p className="text-sm font-semibold text-gray-800">Bulk Ordering</p><p className="text-xs text-gray-400">Offer lower per-unit pricing for higher quantities.</p></div>
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={!!f.bulk_order?.enabled} onChange={(e) => set("bulk_order", { ...(f.bulk_order || {}), enabled: e.target.checked })} className="accent-plum w-4 h-4" /> Enable bulk ordering</label>
          </div>
          {f.bulk_order?.enabled && (
            <div className="space-y-3">
              <Field label="Minimum bulk quantity"><input type="number" min="2" value={f.bulk_order?.min_quantity ?? 10} onChange={(e) => set("bulk_order", { ...(f.bulk_order || {}), min_quantity: Math.max(2, Number(e.target.value || 0)) })} className={inputCls} /></Field>
              <div>
                <div className="flex items-center justify-between mb-2"><p className="text-xs font-medium text-gray-600">Quantity pricing tiers</p><button type="button" onClick={() => set("bulk_order", { ...(f.bulk_order || {}), tiers: [...(f.bulk_order?.tiers || []), { min_quantity: f.bulk_order?.min_quantity || 10, price: f.price || "" }] })} className="text-xs text-plum underline">+ Add tier</button></div>
                <div className="space-y-2">
                  {(f.bulk_order?.tiers || []).map((tier, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                      <div><label className="text-[11px] text-gray-500">Minimum qty</label><input type="number" min={f.bulk_order?.min_quantity || 2} value={tier.min_quantity ?? ""} onChange={(e) => { const tiers = [...(f.bulk_order?.tiers || [])]; tiers[idx] = { ...tiers[idx], min_quantity: Number(e.target.value || 0) }; set("bulk_order", { ...(f.bulk_order || {}), tiers }); }} className={inputCls} /></div>
                      <div><label className="text-[11px] text-gray-500">Unit price (₹)</label><input type="number" min="1" value={tier.price ?? ""} onChange={(e) => { const tiers = [...(f.bulk_order?.tiers || [])]; tiers[idx] = { ...tiers[idx], price: Number(e.target.value || 0) }; set("bulk_order", { ...(f.bulk_order || {}), tiers }); }} className={inputCls} /></div>
                      <button type="button" onClick={() => set("bulk_order", { ...(f.bulk_order || {}), tiers: (f.bulk_order?.tiers || []).filter((_, i) => i !== idx) })} className="px-3 py-2 text-xs text-red-600 border border-red-200 rounded">Remove</button>
                    </div>
                  ))}
                  {(f.bulk_order?.tiers || []).length === 0 && <p className="text-xs text-gray-400">Add at least one pricing tier. Example: 25 pcs → ₹900 each.</p>}
                </div>
              </div>
            </div>
          )}
        </div>
        <Field label="Tags (comma separated)"><input value={Array.isArray(f.tags) ? f.tags.join(", ") : f.tags} onChange={(e) => set("tags", e.target.value)} className={inputCls} /></Field>
        <Field label="Occasion (comma separated)"><input value={Array.isArray(f.occasion) ? f.occasion.join(", ") : f.occasion} onChange={(e) => set("occasion", e.target.value)} className={inputCls} /></Field>
        <div className="sm:col-span-2">
          <Field label="Badges"><div className="flex flex-wrap gap-2">{BADGES.map((b) => <button key={b} type="button" onClick={() => toggleBadge(b)} className={`px-3 py-1 text-xs rounded border ${f.badges.includes(b) ? "bg-plum text-white border-plum" : "border-gray-300 text-gray-600"}`}>{b}</button>)}</div></Field>
        </div>
        <label className="sm:col-span-2 flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={f.personalization?.enabled} onChange={(e) => set("personalization", { ...f.personalization, enabled: e.target.checked })} className="accent-plum" /> Enable personalization</label>
      </div>
      <div className="flex justify-end gap-3 mt-6"><button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button><button onClick={save} disabled={saving} className="bg-plum text-white rounded-md px-5 py-2 text-sm disabled:opacity-50" data-testid="pf-save">{saving ? "Saving…" : "Save Product"}</button></div>
    </Modal>
  );
}

/* ---------------- GENERIC SIMPLE MANAGER ---------------- */
const SM_PAGE = 10;
function SimpleManager({ title, endpoint, columns, fields, defaults = {}, testid, searchKeys = ["name"] }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const load = useCallback(() => { setLoading(true); adminApi.get(`/${endpoint}`).then(({ data }) => setItems(data.items)).catch(() => {}).finally(() => setLoading(false)); }, [endpoint]);
  useEffect(() => { load(); }, [load]);
  const save = async (f) => {
    try {
      if (f.id) await adminApi.put(`/${endpoint}/${f.id}`, f);
      else await adminApi.post(`/${endpoint}`, f);
      toast.success("Saved"); setEditing(null); load();
    } catch (e) { toast.error(apiError(e)); }
  };
  const del = async (e, it) => { e.stopPropagation(); if (!window.confirm("Delete this item?")) return; await adminApi.delete(`/${endpoint}/${it.id}`); toast.success("Deleted"); load(); };

  const filtered = items.filter((it) => !q || searchKeys.some((k) => String(it[k] ?? "").toLowerCase().includes(q.toLowerCase())));
  const pages = Math.max(1, Math.ceil(filtered.length / SM_PAGE));
  const rows = filtered.slice((page - 1) * SM_PAGE, page * SM_PAGE);

  return (
    <div>
      <PageHead title={title} action={<button onClick={() => setEditing({ ...defaults })} className="bg-plum text-white rounded-md px-4 py-2 text-sm flex items-center gap-2" data-testid={`add-${testid}`}><Plus size={16} /> Add</button>} />
      <DataTable
        testid={testid} loading={loading} q={q} setQ={(v) => { setQ(v); setPage(1); }} searchPlaceholder={`Search ${title.toLowerCase()}…`}
        page={page} pages={pages} setPage={setPage} rows={rows} empty="Nothing here yet"
        columns={[...columns, { key: "__actions", label: "Actions", render: (it) => <div className="flex gap-2 text-gray-400" onClick={(e) => e.stopPropagation()}><button onClick={() => setEditing(it)} className="hover:text-plum"><Edit size={15} /></button><button onClick={(e) => del(e, it)} className="hover:text-red-600"><Archive size={15} /></button></div> }]}
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
    defaults={{ status: "Active" }} />;
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
                <td className="px-4 py-3 font-medium text-gray-900">{it.name}</td>
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
                    <span className="text-sm text-gray-800 flex-1">{p.name}</span>
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
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const load = () => { setLoading(true); adminApi.get("/products?page_size=200").then(({ data }) => setItems(data.items)).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  const adjust = async (e, p, change) => { e.stopPropagation(); await adminApi.post(`/products/${p.id}/inventory`, { change, reason: "Manual adjustment" }); toast.success("Stock updated"); load(); };
  const filtered = items.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.sku || "").toLowerCase().includes(q.toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / 15));
  const rows = filtered.slice((page - 1) * 15, page * 15);
  return (
    <div>
      <PageHead title="Inventory" subtitle="Adjust stock levels" />
      <DataTable
        testid="inventory" loading={loading} q={q} setQ={(v) => { setQ(v); setPage(1); }} searchPlaceholder="Search product or SKU…"
        page={page} pages={pages} setPage={setPage} rows={rows} empty="No products"
        columns={[
          { key: "name", label: "Product", render: (p) => <span className="font-medium text-gray-900">{p.name}</span> },
          { key: "sku", label: "SKU", render: (p) => <span className="text-gray-500 font-mono text-xs">{p.sku}</span> },
          { key: "stock", label: "Stock", render: (p) => <span className={p.stock <= p.low_stock_threshold ? "text-red-600 font-medium" : "text-gray-700"}>{p.stock}</span> },
          { key: "adjust", label: "Adjust", render: (p) => <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <button onClick={(e) => adjust(e, p, -1)} className="w-7 h-7 border border-gray-300 rounded text-gray-600">−</button>
            <button onClick={(e) => adjust(e, p, 1)} className="w-7 h-7 border border-gray-300 rounded text-gray-600">+</button>
            <button onClick={(e) => adjust(e, p, 10)} className="px-2 h-7 border border-gray-300 rounded text-gray-600 text-xs">+10</button>
          </div> },
        ]}
      />
    </div>
  );
}
