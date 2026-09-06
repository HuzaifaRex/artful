import React, { useEffect, useState, useCallback } from "react";
import { Plus, Search, Copy, Archive, Edit } from "lucide-react";
import { adminApi, apiError } from "../lib/api";
import { toast } from "sonner";
import { inr } from "../lib/utils";
import { StatusChip, Modal, Field, inputCls, PageHead, Empty } from "./ui";
import { ImageUpload, MultiImageUpload } from "./ImageUpload";

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
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [cats, setCats] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    adminApi.get(`/products?q=${encodeURIComponent(q)}&page_size=100`).then(({ data }) => setItems(data.items)).catch(() => {});
  }, [q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { adminApi.get("/categories").then(({ data }) => setCats(data.items)).catch(() => {}); }, []);

  const archive = async (p) => { if (!window.confirm(`Archive "${p.name}"?`)) return; await adminApi.delete(`/products/${p.id}`); toast.success("Archived"); load(); };
  const duplicate = async (p) => { await adminApi.post(`/products/${p.id}/duplicate`); toast.success("Duplicated"); load(); };

  return (
    <div>
      <PageHead title="Products" subtitle={`${items.length} products`} action={<button onClick={() => setEditing({})} className="bg-plum text-white rounded-md px-4 py-2 text-sm flex items-center gap-2" data-testid="add-product-btn"><Plus size={16} /> Add Product</button>} />
      <div className="relative mb-4 max-w-sm"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className={inputCls + " pl-9"} data-testid="product-search" /></div>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-400 text-xs bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 font-medium">Product</th><th className="px-4 py-3 font-medium">SKU</th><th className="px-4 py-3 font-medium">Price</th><th className="px-4 py-3 font-medium">Stock</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Actions</th></tr></thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50" data-testid={`admin-product-${p.slug}`}>
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><img src={(p.images || [])[0]} alt="" className="w-9 h-11 object-cover rounded bg-gray-100" /><span className="font-medium text-gray-900">{p.name}</span></div></td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.sku}</td>
                  <td className="px-4 py-3 text-gray-900">{inr(p.price)}</td>
                  <td className="px-4 py-3 text-gray-600">{p.stock}</td>
                  <td className="px-4 py-3"><StatusChip status={p.status} /></td>
                  <td className="px-4 py-3"><div className="flex gap-2 text-gray-400">
                    <button onClick={() => setEditing(p)} className="hover:text-plum" data-testid={`edit-${p.slug}`}><Edit size={16} /></button>
                    <button onClick={() => duplicate(p)} className="hover:text-plum"><Copy size={16} /></button>
                    <button onClick={() => archive(p)} className="hover:text-red-600"><Archive size={16} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <Empty text="No products found" />}
        </div>
      </div>
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
    personalization: { enabled: false, char_limit: 30 }, ...product,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggleBadge = (b) => set("badges", f.badges.includes(b) ? f.badges.filter((x) => x !== b) : [...f.badges, b]);

  const save = async () => {
    if (!f.name || f.price === "") return toast.error("Name and price are required");
    setSaving(true);
    const payload = { ...f, price: Number(f.price), compare_at_price: f.compare_at_price ? Number(f.compare_at_price) : null, stock: Number(f.stock), low_stock_threshold: Number(f.low_stock_threshold), tags: typeof f.tags === "string" ? f.tags.split(",").map((x) => x.trim()).filter(Boolean) : f.tags, images: typeof f.images === "string" ? f.images.split("\n").map((x) => x.trim()).filter(Boolean) : f.images, occasion: typeof f.occasion === "string" ? f.occasion.split(",").map((x) => x.trim()).filter(Boolean) : f.occasion, recipient: typeof f.recipient === "string" ? f.recipient.split(",").map((x) => x.trim()).filter(Boolean) : f.recipient };
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
function SimpleManager({ title, endpoint, columns, fields, defaults = {}, testid }) {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = useCallback(() => adminApi.get(`/${endpoint}`).then(({ data }) => setItems(data.items)).catch(() => {}), [endpoint]);
  useEffect(() => { load(); }, [load]);
  const save = async (f) => {
    try {
      if (f.id) await adminApi.put(`/${endpoint}/${f.id}`, f);
      else await adminApi.post(`/${endpoint}`, f);
      toast.success("Saved"); setEditing(null); load();
    } catch (e) { toast.error(apiError(e)); }
  };
  const del = async (it) => { if (!window.confirm("Delete this item?")) return; await adminApi.delete(`/${endpoint}/${it.id}`); toast.success("Deleted"); load(); };
  return (
    <div>
      <PageHead title={title} action={<button onClick={() => setEditing({ ...defaults })} className="bg-plum text-white rounded-md px-4 py-2 text-sm flex items-center gap-2" data-testid={`add-${testid}`}><Plus size={16} /> Add</button>} />
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-400 text-xs bg-gray-50 border-b border-gray-200">{columns.map((c) => <th key={c.key} className="px-4 py-3 font-medium">{c.label}</th>)}<th className="px-4 py-3 font-medium">Actions</th></tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b border-gray-50 hover:bg-gray-50">
                {columns.map((c) => <td key={c.key} className="px-4 py-3 text-gray-700">{c.render ? c.render(it) : String(it[c.key] ?? "—")}</td>)}
                <td className="px-4 py-3"><div className="flex gap-2 text-gray-400"><button onClick={() => setEditing(it)} className="hover:text-plum"><Edit size={15} /></button><button onClick={() => del(it)} className="hover:text-red-600"><Archive size={15} /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <Empty text="Nothing here yet" />}
      </div>
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

export function Collections() {
  return <SimpleManager title="Collections" endpoint="collections" testid="collection"
    columns={[{ key: "name", label: "Name" }, { key: "slug", label: "Slug" }, { key: "type", label: "Type" }, { key: "status", label: "Status", render: (c) => <StatusChip status={c.status} /> }]}
    fields={[{ key: "name", label: "Name" }, { key: "slug", label: "Slug (optional)" }, { key: "description", label: "Description", type: "textarea", full: true }, { key: "image", label: "Image", type: "image", full: true }, { key: "type", label: "Type", type: "select", options: ["dynamic", "manual"] }, { key: "status", label: "Status", type: "select", options: ["Active", "Archived"] }]}
    defaults={{ status: "Active", type: "dynamic" }} />;
}

export function Reviews() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("Pending");
  const load = useCallback(() => adminApi.get(`/reviews?status=${filter}`).then(({ data }) => setItems(data.items)).catch(() => {}), [filter]);
  useEffect(() => { load(); }, [load]);
  const moderate = async (id, status) => { await adminApi.put(`/reviews/${id}`, { status }); toast.success(`Review ${status.toLowerCase()}`); load(); };
  return (
    <div>
      <PageHead title="Reviews" subtitle="Moderate customer reviews" />
      <div className="flex gap-2 mb-4">{["Pending", "Approved", "Rejected"].map((s) => <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 text-sm rounded ${filter === s ? "bg-plum text-white" : "bg-white border border-gray-200 text-gray-600"}`}>{s}</button>)}</div>
      <div className="space-y-3">
        {items.map((r) => (
          <div key={r.id} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex justify-between"><div><p className="font-medium text-gray-900">{r.title || "Review"} · {r.rating}★</p><p className="text-sm text-gray-600 mt-1">{r.body}</p><p className="text-xs text-gray-400 mt-1">by {r.customer_name} · product {r.product_slug}</p></div>
              {filter === "Pending" && <div className="flex gap-2"><button onClick={() => moderate(r.id, "Approved")} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded">Approve</button><button onClick={() => moderate(r.id, "Rejected")} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded">Reject</button></div>}
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
  const load = () => adminApi.get("/products?page_size=100").then(({ data }) => setItems(data.items)).catch(() => {});
  useEffect(() => { load(); }, []);
  const adjust = async (p, change) => { await adminApi.post(`/products/${p.id}/inventory`, { change, reason: "Manual adjustment" }); toast.success("Stock updated"); load(); };
  return (
    <div>
      <PageHead title="Inventory" subtitle="Adjust stock levels" />
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-400 text-xs bg-gray-50 border-b border-gray-200"><th className="px-4 py-3 font-medium">Product</th><th className="px-4 py-3 font-medium">SKU</th><th className="px-4 py-3 font-medium">Stock</th><th className="px-4 py-3 font-medium">Adjust</th></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b border-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.sku}</td>
                <td className="px-4 py-3"><span className={p.stock <= p.low_stock_threshold ? "text-red-600 font-medium" : "text-gray-700"}>{p.stock}</span></td>
                <td className="px-4 py-3"><div className="flex gap-1">
                  <button onClick={() => adjust(p, -1)} className="w-7 h-7 border border-gray-300 rounded text-gray-600">−</button>
                  <button onClick={() => adjust(p, 1)} className="w-7 h-7 border border-gray-300 rounded text-gray-600">+</button>
                  <button onClick={() => adjust(p, 10)} className="px-2 h-7 border border-gray-300 rounded text-gray-600 text-xs">+10</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
