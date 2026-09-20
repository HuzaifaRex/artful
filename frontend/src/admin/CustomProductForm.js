import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, Eye, Plus, Trash2, Calculator, UploadCloud, Sparkles } from "lucide-react";
import { adminApi, apiError } from "../lib/api";
import { toast } from "sonner";
import { inr } from "../lib/utils";
import { Modal, Field, inputCls } from "./ui";
import { MultiImageUpload, VideoUpload } from "./ImageUpload";

const BADGES = ["New", "Bestseller", "Limited", "Sale", "Featured"];
const STATUSES = ["Draft", "Active", "Inactive", "Out of Stock", "Archived"];

const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const DEFAULT_CUSTOMIZATION = {
  enabled: true,
  unit_definition: { pcs_per_unit: 10, label: "Unit" },
  pricing: {
    mode: "quantity",
    pricing_model: "order_total",
    display_basis: "pcs",
    allow_basis_switch: false,
    quantity_tiers: [],
    default_quantity: "",
    allow_custom_quantity: true,
  },
  size: {
    enabled: false,
    unit: "in",
    display_basis: "pcs",
    price_basis: "per_unit",
    allow_basis_switch: false,
    default_preset_id: "",
    allow_custom: true,
    min_width: 1,
    max_width: 100,
    min_height: 1,
    max_height: 100,
    presets: [],
  },
  options: [],
  artwork: {
    enabled: false,
    required: false,
    formats: ["pdf", "jpg", "jpeg", "png"],
    max_size_mb: 20,
    max_files: 3,
    instructions: "Upload print-ready artwork."
  },
};

function normalizeCustomization(input) {
  const c = input || {};
  return {
    ...DEFAULT_CUSTOMIZATION,
    ...c,
    unit_definition: { ...DEFAULT_CUSTOMIZATION.unit_definition, ...(c.unit_definition || {}) },
    pricing: { ...DEFAULT_CUSTOMIZATION.pricing, ...(c.pricing || {}) },
    size: { ...DEFAULT_CUSTOMIZATION.size, ...(c.size || {}) },
    artwork: { ...DEFAULT_CUSTOMIZATION.artwork, ...(c.artwork || {}) },
    options: Array.isArray(c.options) ? c.options : [],
  };
}

const baseFields = (cats, product, customization) => ({
  name: "",
  sku: "",
  cost_price: "",
  mrp: "",
  stock: 0,
  low_stock_threshold: 5,
  category_slug: cats[0]?.slug || "",
  short_description: "",
  description: "",
  status: "Draft",
  badges: [],
  tags: [],
  occasion: [],
  recipient: [],
  images: [],
  video: null,
  personalization: { enabled: false, char_limit: 30 },
  product_type: "customizable",
  customization,
  ...product,
});

function Section({ title, subtitle, open, onToggle, children, badge }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><h4 className="font-semibold text-gray-900">{title}</h4>{badge && <span className="rounded-full bg-plum/10 text-plum px-2 py-0.5 text-[10px] font-semibold">{badge}</span>}</div>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <ChevronDown size={18} className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-gray-100 p-5">{children}</div>}
    </section>
  );
}

export default function CustomProductForm({ product = {}, cats = [], onClose, onSaved }) {
  const isNew = !product.id;
  const [f, setF] = useState(baseFields(cats, product, normalizeCustomization(product.customization)));
  const [open, setOpen] = useState({ basic: true, pricing: true, size: false, options: false, artwork: false, marketing: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setF((prev) => ({ ...prev, customization: normalizeCustomization(prev.customization) }));
  }, []);

  const custom = f.customization || DEFAULT_CUSTOMIZATION;
  const set = (key, value) => setF((prev) => ({ ...prev, [key]: value }));
  const setCustom = (key, value) => set("customization", { ...custom, [key]: value });
  const setPricing = (key, value) => setCustom("pricing", { ...(custom.pricing || {}), [key]: value });
  const setSize = (key, value) => setCustom("size", { ...(custom.size || {}), [key]: value });
  const toggleBadge = (b) => set("badges", f.badges.includes(b) ? f.badges.filter((x) => x !== b) : [...f.badges, b]);

  const quantityTiers = (custom.pricing?.quantity_tiers || []).map((t) => ({
    quantity: Number(t.quantity ?? t.min_quantity ?? 0),
    price: Number(t.price || 0),
    id: t.id || makeId("qty"),
  })).filter((t) => t.quantity > 0 && t.price >= 0);

  const defaultQuantity = Number(custom.pricing?.default_quantity || quantityTiers[0]?.quantity || 0);
  const defaultTier = quantityTiers.find((t) => t.quantity === defaultQuantity) || quantityTiers[0];
  const defaultSize = (custom.size?.presets || []).find((s) => s.id === custom.size?.default_preset_id) || (custom.size?.presets || [])[0];
  const defaultOptions = (custom.options || []).map((o) => ({
    option: o,
    value: (o.values || []).find((v) => v.id === o.default_value_id) || (o.values || [])[0],
  }));
  const basePrice = useMemo(() => {
    const qty = Math.max(1, Number(defaultQuantity || 1));
    const pcsPerUnit = Math.max(1, Number(custom.unit_definition?.pcs_per_unit || 10));
    const multiplier = (basis) => basis === "per_pcs" ? qty : Math.max(1, Math.ceil(qty / pcsPerUnit));
    let total = Number(defaultTier?.price || 0);
    if (custom.size?.enabled) total += Number(defaultSize?.price || 0) * multiplier(custom.size?.display_basis || "per_unit");
    defaultOptions.forEach(({ option, value }) => { total += Number(value?.add_on ?? value?.price ?? 0) * multiplier(option?.price_basis || "per_unit"); });
    return Math.max(0, Math.round(total));
  }, [defaultQuantity, defaultTier, custom.size?.enabled, custom.size?.display_basis, custom.size?.presets, custom.unit_definition?.pcs_per_unit, defaultSize, defaultOptions]);

  const updateTier = (idx, patch) => {
    const tiers = quantityTiers.slice(); tiers[idx] = { ...tiers[idx], ...patch };
    setPricing("quantity_tiers", tiers);
  };
  const addTier = () => {
    const qty = quantityTiers.length ? Math.max(...quantityTiers.map((t) => t.quantity)) * 2 : 1000;
    const tiers = [...quantityTiers, { id: makeId("qty"), quantity: qty, price: quantityTiers[0]?.price || 1000 }];
    setPricing("quantity_tiers", tiers);
    if (!custom.pricing?.default_quantity) setPricing("default_quantity", String(qty));
  };
  const removeTier = (idx) => setPricing("quantity_tiers", quantityTiers.filter((_, i) => i !== idx));

  const addSize = () => {
    const idx = (custom.size?.presets || []).length + 1;
    const preset = { id: makeId("size"), label: `Size ${idx}`, width: 3, height: 7, price: 0 };
    const presets = [...(custom.size?.presets || []), preset];
    setSize("presets", presets);
    if (!custom.size?.default_preset_id) setSize("default_preset_id", preset.id);
  };
  const updateSizePreset = (idx, patch) => {
    const presets = [...(custom.size?.presets || [])]; presets[idx] = { ...presets[idx], ...patch }; setSize("presets", presets);
  };
  const removeSizePreset = (idx) => {
    const presets = (custom.size?.presets || []).filter((_, i) => i !== idx);
    setSize("presets", presets);
    if (!presets.some((p) => p.id === custom.size?.default_preset_id)) setSize("default_preset_id", presets[0]?.id || "");
  };

  const addOption = () => {
    const firstValue = { id: makeId("value"), label: "None", add_on: 0 };
    const option = { id: makeId("option"), name: `Option ${(custom.options?.length || 0) + 1}`, type: "select", required: true, price_basis: "per_unit", default_value_id: firstValue.id, values: [firstValue] };
    const options = [...(custom.options || []), option];
    setCustom("options", options);
  };
  const updateOption = (idx, patch) => {
    const options = [...(custom.options || [])]; options[idx] = { ...options[idx], ...patch }; setCustom("options", options);
  };
  const removeOption = (idx) => setCustom("options", (custom.options || []).filter((_, i) => i !== idx));
  const addValue = (oi) => {
    const options = [...(custom.options || [])];
    const option = options[oi];
    const value = { id: makeId("value"), label: `Value ${(option.values || []).length + 1}`, add_on: 0 };
    option.values = [...(option.values || []), value];
    options[oi] = option;
    setCustom("options", options);
  };
  const updateValue = (oi, vi, patch) => {
    const options = [...(custom.options || [])];
    options[oi] = { ...options[oi], values: (options[oi].values || []).map((v, i) => i === vi ? { ...v, ...patch } : v) };
    setCustom("options", options);
  };
  const removeValue = (oi, vi) => {
    const options = [...(custom.options || [])];
    const values = (options[oi].values || []).filter((_, i) => i !== vi);
    options[oi] = { ...options[oi], values };
    if (options[oi].default_value_id && !values.some(v => v.id === options[oi].default_value_id)) options[oi].default_value_id = values[0]?.id || "";
    setCustom("options", options);
  };

  const save = async () => {
    if (!f.name.trim()) return toast.error("Product name is required.");
    if (!quantityTiers.length) return toast.error("Add at least one quantity & price row.");
    if (quantityTiers.some((t) => t.price <= 0)) return toast.error("Quantity prices must be greater than ₹0.");
    if (!defaultTier) return toast.error("Select a default quantity.");
    if (custom.size?.enabled && !(custom.size?.presets || []).length && !custom.size?.allow_custom) return toast.error("Add at least one size or allow custom size.");
    for (const o of custom.options || []) {
      if (!o.name?.trim()) return toast.error("Every option needs a heading.");
      if (!(o.values || []).length) return toast.error(`${o.name} needs at least one value.`);
    }

    const normalized = normalizeCustomization({
      ...custom,
      pricing: {
        ...custom.pricing,
        mode: "quantity",
        pricing_model: "order_total",
        default_quantity: Number(custom.pricing?.default_quantity || defaultTier.quantity),
        quantity_tiers: quantityTiers.map((t) => ({ id: t.id, min_quantity: t.quantity, quantity: t.quantity, price: t.price })),
      },
      size: {
        ...custom.size,
        price_basis: custom.size?.price_basis || "per_unit",
        presets: (custom.size?.presets || []).map((s) => ({ ...s, width: Number(s.width || 0), height: Number(s.height || 0), price: Number(s.price || 0) })),
      },
      options: (custom.options || []).map((o) => ({ ...o, values: (o.values || []).map((v) => ({ ...v, add_on: Number(v.add_on ?? v.price ?? 0), price: Number(v.add_on ?? v.price ?? 0) })) })),
    });

    setSaving(true);
    try {
      const payload = {
        ...f,
        name: f.name.trim(),
        product_type: "customizable",
        price: basePrice,
        cost_price: Number(f.cost_price || 0),
        mrp: f.mrp ? Number(f.mrp) : null,
        compare_at_price: f.mrp ? Number(f.mrp) : null,
        stock: Number(f.stock || 0),
        low_stock_threshold: Number(f.low_stock_threshold || 5),
        customization: normalized,
        tags: typeof f.tags === "string" ? f.tags.split(",").map(x => x.trim()).filter(Boolean) : f.tags,
        occasion: typeof f.occasion === "string" ? f.occasion.split(",").map(x => x.trim()).filter(Boolean) : f.occasion,
        images: Array.isArray(f.images) ? f.images : [],
      };
      if (isNew) await adminApi.post("/products", payload);
      else await adminApi.put(`/products/${product.id}`, payload);
      toast.success(isNew ? "Customizable product created" : "Customizable product updated");
      onSaved();
    } catch (e) { toast.error(apiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <Modal open title={isNew ? "Add Customizable Product" : "Edit Customizable Product"} onClose={onClose} xwide>
      <div className="grid xl:grid-cols-[minmax(0,1fr)_300px] gap-5">
        <div className="space-y-4 min-w-0">
          <div className="rounded-2xl bg-gradient-to-r from-plum to-plum-wine text-white p-5">
            <div className="flex items-start gap-3"><Sparkles size={20} className="mt-0.5" /><div><p className="font-semibold">Print-ready product builder</p><p className="text-xs text-white/75 mt-1">Set defaults once. Customers will only see simple selections and the live final price.</p></div></div>
          </div>

          <Section title="Basic information" subtitle="Product identity, category and media." open={open.basic} onToggle={() => setOpen(s => ({ ...s, basic: !s.basic }))}>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Product Name *"><input value={f.name} onChange={e => set("name", e.target.value)} className={inputCls} /></Field>
              <Field label="SKU"><input value={f.sku || ""} onChange={e => set("sku", e.target.value)} className={inputCls} /></Field>
              <Field label="Category"><select value={f.category_slug} onChange={e => set("category_slug", e.target.value)} className={inputCls}>{cats.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></Field>
              <Field label="Status"><select value={f.status} onChange={e => set("status", e.target.value)} className={inputCls}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Purchase Price / COGS (₹)"><input type="number" min="0" value={f.cost_price ?? ""} onChange={e => set("cost_price", e.target.value)} className={inputCls} /></Field>
              <Field label="MRP (₹)"><input type="number" min="0" value={f.mrp ?? ""} onChange={e => set("mrp", e.target.value)} className={inputCls} /></Field>
              <Field label="Stock Capacity"><input type="number" min="0" value={f.stock ?? 0} onChange={e => set("stock", e.target.value)} className={inputCls} /></Field>
              <Field label="Low stock threshold"><input type="number" min="0" value={f.low_stock_threshold ?? 5} onChange={e => set("low_stock_threshold", e.target.value)} className={inputCls} /></Field>
              <div className="sm:col-span-2"><Field label="Short Description"><input value={f.short_description || ""} onChange={e => set("short_description", e.target.value)} className={inputCls} /></Field></div>
              <div className="sm:col-span-2"><Field label="Product Description"><textarea rows={4} value={f.description || ""} onChange={e => set("description", e.target.value)} className={inputCls} /></Field></div>
              <div className="sm:col-span-2"><Field label="Product Images"><MultiImageUpload value={Array.isArray(f.images) ? f.images : []} onChange={v => set("images", v)} testid="custom-product-images" /></Field></div>
              <div className="sm:col-span-2"><Field label="Product Video"><VideoUpload value={f.video || ""} onChange={v => set("video", v)} testid="custom-product-video" /></Field></div>
            </div>
          </Section>

          <Section title="Pricing & quantity" subtitle="Define how much the default configuration costs." badge="Core" open={open.pricing} onToggle={() => setOpen(s => ({ ...s, pricing: !s.pricing }))}>
            <div className="space-y-5">
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="1 Unit ="><div className="flex"><input type="number" min="1" value={custom.unit_definition?.pcs_per_unit || 10} onChange={e => setCustom("unit_definition", { ...(custom.unit_definition || {}), pcs_per_unit: Math.max(1, Number(e.target.value || 1)) })} className={inputCls} /><span className="flex items-center px-3 text-xs text-gray-500 border border-l-0 border-gray-300 rounded-r-md bg-gray-50">Pcs</span></div></Field>
                <Field label="Customer quantity display"><select value={custom.pricing?.display_basis || "pcs"} onChange={e => setPricing("display_basis", e.target.value)} className={inputCls}><option value="pcs">Pcs</option><option value="unit">Unit</option></select></Field>
                <Field label="Default quantity"><select value={String(custom.pricing?.default_quantity || "")} onChange={e => setPricing("default_quantity", e.target.value)} className={inputCls}><option value="">Select default</option>{quantityTiers.map(t => <option key={t.id} value={t.quantity}>{t.quantity} Pcs</option>)}</select></Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"><input type="checkbox" checked={!!custom.pricing?.allow_basis_switch} onChange={e => setPricing("allow_basis_switch", e.target.checked)} className="accent-plum w-4 h-4" /> Let customer switch between Pcs and Unit display</label>

              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="grid grid-cols-[minmax(0,1fr)_140px_40px] gap-2 px-3 py-2.5 bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-500"><span>Quantity</span><span>Total Price</span><span /></div>
                <div className="divide-y divide-gray-100">
                  {quantityTiers.length === 0 && <div className="px-3 py-6 text-center text-sm text-gray-400">Add your first quantity tier.</div>}
                  {quantityTiers.map((t, i) => <div key={t.id} className="grid grid-cols-[minmax(0,1fr)_140px_40px] gap-2 p-3 items-center">
                    <div className="flex items-center gap-2"><input type="number" min="1" value={t.quantity} onChange={e => updateTier(i, { quantity: Math.max(1, Number(e.target.value || 0)) })} className={inputCls} /><span className="text-xs text-gray-500 shrink-0">Pcs</span></div>
                    <div className="relative"><span className="absolute left-3 top-2 text-xs text-gray-400">₹</span><input type="number" min="0" value={t.price} onChange={e => updateTier(i, { price: Math.max(0, Number(e.target.value || 0)) })} className={inputCls + " pl-7"} /></div>
                    <button type="button" onClick={() => removeTier(i)} className="h-9 w-9 grid place-items-center text-gray-400 hover:text-red-600" aria-label="Remove quantity"><Trash2 size={15} /></button>
                  </div>)}
                </div>
                <button type="button" onClick={addTier} className="w-full border-t border-gray-200 py-3 text-sm font-medium text-plum hover:bg-plum/5 flex items-center justify-center gap-2"><Plus size={15} /> Add quantity</button>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"><input type="checkbox" checked={custom.pricing?.allow_custom_quantity !== false} onChange={e => setPricing("allow_custom_quantity", e.target.checked)} className="accent-plum w-4 h-4" /> Allow customer to enter custom quantity</label>
              <p className="text-xs text-gray-500">Tier prices are order totals for that quantity. For a custom quantity, the selected tier's per-piece rate is used to estimate the total.</p>
            </div>
          </Section>

          <Section title="Size variation" subtitle="Offer standard sizes and an optional custom size." open={open.size} onToggle={() => setOpen(s => ({ ...s, size: !s.size }))}>
            <div className="space-y-4">
              <label className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 cursor-pointer"><span><span className="block text-sm font-semibold">Enable size variation</span><span className="block text-xs text-gray-500 mt-1">Customers will see a single simple size selector.</span></span><input type="checkbox" checked={!!custom.size?.enabled} onChange={e => setSize("enabled", e.target.checked)} className="accent-plum w-5 h-5" /></label>
              {custom.size?.enabled && <>
                <div className="grid sm:grid-cols-3 gap-3">
                  <Field label="Size unit"><select value={custom.size?.unit || "in"} onChange={e => setSize("unit", e.target.value)} className={inputCls}><option value="in">inch</option><option value="mm">mm</option><option value="cm">cm</option></select></Field>
                  <Field label="Price basis"><select value={custom.size?.price_basis || "per_unit"} onChange={e => setSize("price_basis", e.target.value)} className={inputCls}><option value="per_unit">Per Unit</option><option value="per_pcs">Per Pcs</option></select></Field>
                  <Field label="Default size"><select value={custom.size?.default_preset_id || ""} onChange={e => setSize("default_preset_id", e.target.value)} className={inputCls}><option value="">Select default</option>{(custom.size?.presets || []).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"><input type="checkbox" checked={!!custom.size?.allow_basis_switch} onChange={e => setSize("allow_basis_switch", e.target.checked)} className="accent-plum w-4 h-4" /> Let customer switch between Pcs and Unit display</label>
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="grid grid-cols-[1.2fr_1fr_1fr_120px_40px] gap-2 px-3 py-2.5 bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-500"><span>Name</span><span>Width</span><span>Height</span><span>Price</span><span /></div>
                  <div className="divide-y divide-gray-100">
                    {(custom.size?.presets || []).map((s, i) => <div key={s.id} className="grid grid-cols-[1.2fr_1fr_1fr_120px_40px] gap-2 p-3 items-center">
                      <input value={s.label || ""} onChange={e => updateSizePreset(i, { label: e.target.value })} className={inputCls} />
                      <input type="number" min="0" value={s.width ?? ""} onChange={e => updateSizePreset(i, { width: Number(e.target.value || 0) })} className={inputCls} />
                      <input type="number" min="0" value={s.height ?? ""} onChange={e => updateSizePreset(i, { height: Number(e.target.value || 0) })} className={inputCls} />
                      <input type="number" min="0" value={s.price ?? 0} onChange={e => updateSizePreset(i, { price: Math.max(0, Number(e.target.value || 0)) })} className={inputCls} />
                      <button type="button" onClick={() => removeSizePreset(i)} className="h-9 w-9 grid place-items-center text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                    </div>)}
                  </div>
                  <button type="button" onClick={addSize} className="w-full border-t border-gray-200 py-3 text-sm font-medium text-plum hover:bg-plum/5 flex items-center justify-center gap-2"><Plus size={15} /> Add size</button>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"><input type="checkbox" checked={custom.size?.allow_custom !== false} onChange={e => setSize("allow_custom", e.target.checked)} className="accent-plum w-4 h-4" /> Allow customer custom size</label>
                {custom.size?.allow_custom && <div className="grid sm:grid-cols-4 gap-3"><Field label="Min width"><input type="number" value={custom.size?.min_width ?? 1} onChange={e => setSize("min_width", Number(e.target.value || 1))} className={inputCls} /></Field><Field label="Max width"><input type="number" value={custom.size?.max_width ?? 100} onChange={e => setSize("max_width", Number(e.target.value || 100))} className={inputCls} /></Field><Field label="Min height"><input type="number" value={custom.size?.min_height ?? 1} onChange={e => setSize("min_height", Number(e.target.value || 1))} className={inputCls} /></Field><Field label="Max height"><input type="number" value={custom.size?.max_height ?? 100} onChange={e => setSize("max_height", Number(e.target.value || 100))} className={inputCls} /></Field></div>}
              </>}
            </div>
          </Section>

          <Section title="Custom options" subtitle="Material, lamination, printing, finishing and more." badge={`${custom.options?.length || 0}`} open={open.options} onToggle={() => setOpen(s => ({ ...s, options: !s.options }))}>
            <div className="space-y-4">
              {(custom.options || []).map((o, oi) => <div key={o.id} className="rounded-2xl border border-gray-200 bg-gray-50/60 p-4">
                <div className="grid sm:grid-cols-[minmax(0,1fr)_140px_140px_auto] gap-3 items-end">
                  <Field label="Heading"><input value={o.name || ""} onChange={e => updateOption(oi, { name: e.target.value })} className={inputCls} placeholder="Material" /></Field>
                  <Field label="Customer control"><select value={o.type || "select"} onChange={e => updateOption(oi, { type: e.target.value })} className={inputCls}><option value="select">Dropdown</option><option value="radio">Radio</option></select></Field>
                  <Field label="Price basis"><select value={o.price_basis || "per_unit"} onChange={e => updateOption(oi, { price_basis: e.target.value })} className={inputCls}><option value="per_unit">Per Unit</option><option value="per_pcs">Per Pcs</option></select></Field>
                  <button type="button" onClick={() => removeOption(oi)} className="h-10 px-3 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg">Remove</button>
                </div>
                <div className="mt-4 rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <div className="grid grid-cols-[minmax(0,1fr)_130px_40px] gap-2 px-3 py-2 bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-500"><span>Value</span><span>Price</span><span /></div>
                  <div className="divide-y divide-gray-100">
                    {(o.values || []).map((v, vi) => <div key={v.id} className="grid grid-cols-[minmax(0,1fr)_130px_40px] gap-2 p-3 items-center">
                      <div className="flex items-center gap-2"><input type="radio" name={`default-${o.id}`} checked={o.default_value_id === v.id} onChange={() => updateOption(oi, { default_value_id: v.id })} className="accent-plum" /><input value={v.label || ""} onChange={e => updateValue(oi, vi, { label: e.target.value })} className={inputCls} placeholder="350 GSM" /></div>
                      <input type="number" min="0" value={v.add_on ?? v.price ?? 0} onChange={e => updateValue(oi, vi, { add_on: Math.max(0, Number(e.target.value || 0)), price: Math.max(0, Number(e.target.value || 0)) })} className={inputCls} />
                      <button type="button" onClick={() => removeValue(oi, vi)} className="h-9 w-9 grid place-items-center text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                    </div>)}
                  </div>
                  <button type="button" onClick={() => addValue(oi)} className="w-full border-t border-gray-200 py-3 text-xs font-semibold text-plum flex items-center justify-center gap-2"><Plus size={14} /> Add value</button>
                </div>
                <label className="mt-3 flex items-center gap-2 text-xs text-gray-600 cursor-pointer"><input type="checkbox" checked={o.required !== false} onChange={e => updateOption(oi, { required: e.target.checked })} className="accent-plum" /> Required selection</label>
              </div>)}
              <button type="button" onClick={addOption} className="w-full rounded-xl border-2 border-dashed border-plum/30 py-4 text-sm font-semibold text-plum hover:bg-plum/5 flex items-center justify-center gap-2"><Plus size={16} /> Add Option</button>
            </div>
          </Section>

          <Section title="Customer design upload" subtitle="Control artwork requirements for this product." open={open.artwork} onToggle={() => setOpen(s => ({ ...s, artwork: !s.artwork }))}>
            <div className="space-y-4">
              <label className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 cursor-pointer"><span><span className="block text-sm font-semibold">Allow customer to upload design</span><span className="block text-xs text-gray-500 mt-1">Upload is kept with the order item.</span></span><input type="checkbox" checked={!!custom.artwork?.enabled} onChange={e => setCustom("artwork", { ...(custom.artwork || {}), enabled: e.target.checked })} className="accent-plum w-5 h-5" /></label>
              {custom.artwork?.enabled && <>
                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="Maximum file size (MB)"><input type="number" min="1" max="20" value={custom.artwork?.max_size_mb ?? 20} onChange={e => setCustom("artwork", { ...(custom.artwork || {}), max_size_mb: Math.min(20, Math.max(1, Number(e.target.value || 20))) })} className={inputCls} /></Field>
                  <Field label="Maximum files"><input type="number" min="1" max="3" value={custom.artwork?.max_files ?? 3} onChange={e => setCustom("artwork", { ...(custom.artwork || {}), max_files: Math.min(3, Math.max(1, Number(e.target.value || 1))) })} className={inputCls} /></Field>
                  <Field label="Required"><label className="h-10 border border-gray-300 rounded-md px-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!custom.artwork?.required} onChange={e => setCustom("artwork", { ...(custom.artwork || {}), required: e.target.checked })} className="accent-plum" /> Yes, before ordering</label></Field>
                </div>
                <div><p className="text-xs font-medium text-gray-600 mb-2">Accepted formats</p><div className="flex flex-wrap gap-2">{["pdf","jpg","jpeg","png"].map(ext => <label key={ext} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs cursor-pointer"><input type="checkbox" checked={(custom.artwork?.formats || []).includes(ext)} onChange={e => { const formats = (custom.artwork?.formats || []).slice(); e.target.checked ? formats.push(ext) : formats.splice(formats.indexOf(ext), 1); setCustom("artwork", { ...(custom.artwork || {}), formats: [...new Set(formats)] }); }} className="accent-plum" /> {ext.toUpperCase()}</label>)}</div></div>
                <Field label="Customer instructions"><textarea rows={2} value={custom.artwork?.instructions || ""} onChange={e => setCustom("artwork", { ...(custom.artwork || {}), instructions: e.target.value })} className={inputCls} placeholder="Upload a print-ready file with 3mm bleed…" /></Field>
              </>}
            </div>
          </Section>

          <Section title="Tags, badges & personalisation" subtitle="Existing product marketing controls." open={open.marketing} onToggle={() => setOpen(s => ({ ...s, marketing: !s.marketing }))}>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Tags (comma separated)"><input value={Array.isArray(f.tags) ? f.tags.join(", ") : f.tags} onChange={e => set("tags", e.target.value)} className={inputCls} /></Field>
              <Field label="Occasion (comma separated)"><input value={Array.isArray(f.occasion) ? f.occasion.join(", ") : f.occasion} onChange={e => set("occasion", e.target.value)} className={inputCls} /></Field>
              <div className="sm:col-span-2"><Field label="Badges"><div className="flex flex-wrap gap-2">{BADGES.map(b => <button key={b} type="button" onClick={() => toggleBadge(b)} className={`px-3 py-1.5 text-xs rounded-full border ${f.badges.includes(b) ? "bg-plum text-white border-plum" : "border-gray-300 text-gray-600"}`}>{b}</button>)}</div></Field></div>
              <div className="sm:col-span-2 rounded-xl border border-gray-200 bg-gray-50 p-4"><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={!!f.personalization?.enabled} onChange={e => set("personalization", { ...(f.personalization || {}), enabled: e.target.checked })} className="accent-plum" /> Enable personalisation</label>{f.personalization?.enabled && <div className="grid sm:grid-cols-2 gap-3 mt-3"><Field label="Label"><input value={f.personalization?.label || "Personalise this product"} onChange={e => set("personalization", { ...f.personalization, label: e.target.value })} className={inputCls} /></Field><Field label="Character limit"><input type="number" min="1" max="200" value={f.personalization?.char_limit || 30} onChange={e => set("personalization", { ...f.personalization, char_limit: Math.min(200, Math.max(1, Number(e.target.value || 30))) })} className={inputCls} /></Field></div>}</div>
            </div>
          </Section>

          <div className="flex items-center justify-between gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600">Cancel</button>
            <button type="button" onClick={save} disabled={saving} className="bg-plum hover:bg-plum-wine text-white rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50">{saving ? "Saving…" : (isNew ? "Create Product" : "Save Changes")}</button>
          </div>
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-2 space-y-4">
            <div className="rounded-2xl border border-plum/20 bg-plum/5 p-4">
              <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Calculator size={16} className="text-plum" /><p className="text-sm font-semibold text-plum">Live pricing preview</p></div><span className="text-[10px] uppercase tracking-wider text-plum/70">Auto</span></div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-xs"><span className="text-gray-500">Quantity</span><span className="font-semibold text-gray-900">{defaultTier ? `${defaultTier.quantity} Pcs` : "—"}</span></div>
                {custom.size?.enabled && <div className="flex items-center justify-between text-xs"><span className="text-gray-500">Size</span><span className="font-semibold text-gray-900">{defaultSize ? `${defaultSize.label} · ${defaultSize.width} × ${defaultSize.height}` : "—"}</span></div>}
                {defaultOptions.map(({ option, value }) => <div key={option.id} className="flex items-center justify-between gap-3 text-xs"><span className="text-gray-500">{option.name || "Option"}</span><span className="font-semibold text-gray-900 text-right">{value?.label || "—"}</span></div>)}
              </div>
              <div className="mt-4 pt-4 border-t border-plum/15"><p className="text-[10px] uppercase tracking-wider text-plum/70">Base Price</p><p className="text-3xl font-semibold text-plum mt-1">{inr(basePrice)}</p><p className="text-[11px] text-gray-500 mt-1">Calculated from default selections.</p></div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3 mb-3"><div className="flex items-center gap-2"><Eye size={16} className="text-gray-500" /><p className="text-sm font-semibold text-gray-900">Customer view</p></div><span className="text-[10px] text-gray-400">Preview</span></div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className="font-semibold text-sm text-gray-900">{f.name || "Visiting Card"}</p>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{f.short_description || "Beautiful High Quality Business Cards"}</p>
                <p className="text-xl font-semibold text-plum mt-3">{inr(basePrice)}</p>
                <div className="space-y-2 mt-3">
                  <div className="h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-between px-3 text-xs"><span>{defaultTier ? `${defaultTier.quantity} Pcs` : "Select quantity"}</span><ChevronDown size={14} /></div>
                  {custom.size?.enabled && <div className="h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-between px-3 text-xs"><span>{defaultSize?.label || "Select size"}</span><ChevronDown size={14} /></div>}
                  {defaultOptions.slice(0, 3).map(({ option, value }) => <div key={option.id} className="h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-between px-3 text-xs"><span>{value?.label || option.name}</span><ChevronDown size={14} /></div>)}
                </div>
                {custom.artwork?.enabled && <div className="mt-3 rounded-lg border border-dashed border-gray-300 py-3 text-center text-[11px] text-gray-500"><UploadCloud size={15} className="mx-auto mb-1" />Upload design</div>}
                <div className="mt-3 h-9 rounded-lg bg-plum text-white text-xs font-semibold grid place-items-center">Add to Cart</div>
              </div>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-[11px] text-gray-500 leading-relaxed">Customer never sees option prices. They see one live product price that updates as selections change.</div>
          </div>
        </aside>
      </div>
    </Modal>
  );
}
