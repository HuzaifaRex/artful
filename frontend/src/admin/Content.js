import React, { useEffect, useState, useCallback } from "react";
import { Plus, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { adminApi, apiError } from "../lib/api";
import { toast } from "sonner";
import { StatusChip, Modal, Field, inputCls, PageHead, Empty } from "./ui";
import { ImageUpload, VideoUpload } from "./ImageUpload";
import { RichEditor } from "./RichEditor";
import { DataTable } from "./DataTable";

function SlidesEditor({ slides = [], onChange }) {
  const setSlide = (i, k, v) => { const n = [...slides]; n[i] = { ...n[i], [k]: v }; onChange(n); };
  const setSlideMedia = (i, key, value) => {
    const n = [...slides];
    n[i] = { ...n[i], [key]: value, media_url: "" };
    if (key === "image") n[i].video_url = "";
    if (key === "video") n[i].video_url = "";
    onChange(n);
  };
  const setDestination = (i, value) => {
    const n = [...slides];
    n[i] = { ...n[i], destination_url: value, url: "", cta_link: "" };
    onChange(n);
  };
  const addSlide = () => onChange([...slides, { media_type: "image", image: "", video: "", destination_url: "" }]);
  const rmSlide = (i) => onChange(slides.filter((_, x) => x !== i));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><label className="text-sm font-semibold text-gray-800">Carousel Slides</label><button onClick={addSlide} className="text-sm text-plum flex items-center gap-1" data-testid="cms-add-slide"><Plus size={14} /> Add slide</button></div>
      {slides.map((s, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3 relative" data-testid={`cms-slide-${i}`}>
          <button onClick={() => rmSlide(i)} className="absolute top-3 right-3 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
          <p className="text-xs font-semibold text-gray-500">Slide {i + 1}</p>
          <Field label="Media type"><select value={s.media_type || (s.video || s.video_url ? "video" : "image")} onChange={(e) => setSlide(i, "media_type", e.target.value)} className={inputCls}><option value="image">Image</option><option value="video">Video</option></select></Field>
          {(s.media_type || (s.video || s.video_url ? "video" : "image")) === "video"
            ? <Field label="Banner video"><VideoUpload value={s.video || s.video_url || s.media_url || ""} onChange={(u) => setSlideMedia(i, "video", u)} testid={`cms-slide-video-${i}`} /></Field>
            : <Field label="Banner image"><ImageUpload value={s.image || s.media_url || ""} onChange={(u) => setSlideMedia(i, "image", u)} testid={`cms-slide-img-${i}`} /></Field>}
          <Field label="Destination URL (optional)"><input type="url" placeholder="/shop or https://example.com" value={s.destination_url || s.url || s.cta_link || ""} onChange={(e) => setDestination(i, e.target.value)} className={inputCls} /></Field>
        </div>
      ))}
    </div>
  );
}


function CardsEditor({ items = [], onChange, sectionKey = "homepage" }) {
  const update = (index, key, value) => onChange(items.map((item, i) => i === index ? { ...item, [key]: value } : item));
  const move = (index, delta) => { const next = [...items]; const target = index + delta; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; onChange(next.map((item, i) => ({ ...item, order: i }))); };
  const add = () => onChange([...items, { icon: "Star", title: "New card", desc: "Add a short description", visible: true, order: items.length }]);
  return <div className="space-y-3 border-t border-gray-200 pt-4">
    <div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold text-gray-800">Section Cards</h3><p className="text-xs text-gray-500 mt-1">Edit content, choose a Lucide icon name, reorder cards and control visibility.</p></div><button type="button" onClick={add} className="flex items-center gap-1 text-xs text-plum border rounded px-3 py-2"><Plus size={14}/> Add Card</button></div>
    {items.map((item, index) => <div key={item.id || `${index}-${item.title}`} className="rounded-lg border border-gray-200 p-3 space-y-3">
      <div className="flex justify-between items-center"><p className="text-xs font-semibold text-gray-500">Card {index + 1}</p><div className="flex gap-1"><button type="button" disabled={index === 0} onClick={() => move(index, -1)} className="text-xs border rounded px-2 py-1 disabled:opacity-30">↑</button><button type="button" disabled={index === items.length - 1} onClick={() => move(index, 1)} className="text-xs border rounded px-2 py-1 disabled:opacity-30">↓</button><button type="button" onClick={() => onChange(items.filter((_, i) => i !== index))} className="text-xs border border-red-200 text-red-600 rounded px-2 py-1">Remove</button></div></div>
      <div className="grid sm:grid-cols-2 gap-3"><Field label="Icon (Lucide name)"><input value={item.icon || "Star"} onChange={(e) => update(index, "icon", e.target.value)} className={inputCls} placeholder="Gift, ShieldCheck, Star"/></Field><Field label="Heading"><input value={item.title || ""} onChange={(e) => update(index, "title", e.target.value)} className={inputCls}/></Field></div>
      <Field label="Description"><RichEditor value={item.desc ?? item.description ?? ""} onChange={(value) => { const key = Object.prototype.hasOwnProperty.call(item, "desc") || !Object.prototype.hasOwnProperty.call(item, "description") ? "desc" : "description"; update(index, key, value); }} testid={`${sectionKey}-card-description-${index}`} /></Field>
      <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={item.visible !== false} onChange={(e) => update(index, "visible", e.target.checked)} className="accent-plum"/> Visible on homepage</label>
    </div>)}
    {!items.length && <p className="text-sm text-gray-400">No cards configured.</p>}
  </div>;
}

export function HomepageCMS() {
  const [sections, setSections] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = useCallback(() => adminApi.get("/cms/homepage").then(({ data }) => setSections(data.sections)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const toggle = async (s) => { await adminApi.put(`/cms/homepage/${s.id}`, { enabled: !s.enabled }); load(); };
  const openEditor = (section) => {
    const next = { ...section };
    if (section.type === "hero" && (!Array.isArray(section.slides) || !section.slides.length) && (section.image || section.video || section.video_url)) {
      next.slides = [{
        id: "legacy-hero-slide",
        media_type: section.media_type || (section.video || section.video_url ? "video" : "image"),
        image: section.image || "",
        video: section.video || section.video_url || "",
        destination_url: section.destination_url || section.url || section.cta_link || "",
      }];
    }
    setEditing(next);
  };
  const save = async () => { await adminApi.put(`/cms/homepage/${editing.id}`, editing); toast.success("Section updated"); setEditing(null); load(); };

  return (
    <div>
      <PageHead title="Homepage CMS" subtitle="Manage homepage sections without code" />
      <div className="space-y-3">
        {sections.map((s) => (
          <div key={s.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between" data-testid={`cms-section-${s.key}`}>
            <div>
              <p className="font-medium text-gray-900 capitalize">{s.key.replace(/_/g, " ")} <span className="text-xs text-gray-400">· {s.type}</span></p>
              {s.heading && <p className="text-sm text-gray-500 mt-0.5">{s.heading}</p>}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => toggle(s)} className={s.enabled ? "text-emerald-600" : "text-gray-400"} title={s.enabled ? "Enabled" : "Disabled"} data-testid={`cms-toggle-${s.key}`}>{s.enabled ? <Eye size={18} /> : <EyeOff size={18} />}</button>
              <button onClick={() => openEditor(s)} className="text-gray-400 hover:text-plum"><Edit size={17} /></button>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <Modal open title="Edit Section" onClose={() => setEditing(null)} wide>
          <div className="space-y-4">
            {editing.type !== "hero" && <>
              <Field label="Heading"><input value={editing.heading || ""} onChange={(e) => setEditing({ ...editing, heading: e.target.value })} className={inputCls} data-testid="cms-heading" /></Field>
              <Field label="Subheading"><textarea rows={2} value={editing.subheading || ""} onChange={(e) => setEditing({ ...editing, subheading: e.target.value })} className={inputCls} /></Field>
            </>}
            {editing.type !== "hero" && ["banner", "story", "categories"].includes(editing.type) && <Field label="Image"><ImageUpload value={editing.image} onChange={(u) => setEditing({ ...editing, image: u })} testid="cms-image" /></Field>}
            {editing.type !== "hero" && ["banner", "story"].includes(editing.type) && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="CTA Text"><input value={editing.cta_text || ""} onChange={(e) => setEditing({ ...editing, cta_text: e.target.value })} className={inputCls} /></Field>
                <Field label="CTA Link"><input value={editing.cta_link || ""} onChange={(e) => setEditing({ ...editing, cta_link: e.target.value })} className={inputCls} /></Field>
              </div>
            )}
            {editing.type === "hero" && (
              <SlidesEditor slides={editing.slides || []} onChange={(slides) => setEditing({ ...editing, slides })} />
            )}
            {Array.isArray(editing.items) && <CardsEditor items={editing.items || []} sectionKey={editing.key || editing.id || "homepage"} onChange={(items) => setEditing({ ...editing, items })} />}
          </div>
          <div className="flex justify-end gap-3 mt-6"><button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button><button onClick={save} className="bg-plum text-white rounded-md px-5 py-2 text-sm" data-testid="cms-save">Save</button></div>
        </Modal>
      )}
    </div>
  );
}

const GEN_PAGE = 10;
function Generic({ title, endpoint, columns, fields, defaults, testid }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const load = useCallback(() => { setLoading(true); adminApi.get(`/${endpoint}`).then(({ data }) => setItems(data.items)).catch(() => {}).finally(() => setLoading(false)); }, [endpoint]);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    try { if (editing.id) await adminApi.put(`/${endpoint}/${editing.id}`, editing); else await adminApi.post(`/${endpoint}`, editing); toast.success("Saved"); setEditing(null); load(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const del = async (e, it) => { e.stopPropagation(); if (!window.confirm("Delete?")) return; await adminApi.delete(`/${endpoint}/${it.id}`); load(); };

  const displayFields = fields.filter((f) => !["rich", "textarea", "image"].includes(f.type)).slice(0, 3);
  const searchKeys = displayFields.map((f) => f.key);
  const filtered = items.filter((it) => !q || searchKeys.some((k) => String(it[k] ?? "").toLowerCase().includes(q.toLowerCase())));
  const pages = Math.max(1, Math.ceil(filtered.length / GEN_PAGE));
  const rows = filtered.slice((page - 1) * GEN_PAGE, page * GEN_PAGE);

  return (
    <div>
      <PageHead title={title} action={<button onClick={() => setEditing({ ...defaults })} className="bg-plum text-white rounded-md px-4 py-2 text-sm flex items-center gap-2" data-testid={`add-${testid}`}><Plus size={16} /> Add</button>} />
      <DataTable
        testid={testid} loading={loading} q={q} setQ={(v) => { setQ(v); setPage(1); }} searchPlaceholder={`Search ${title.toLowerCase()}…`}
        page={page} pages={pages} setPage={setPage} rows={rows} empty="Nothing yet"
        columns={[
          ...displayFields.map((f) => ({ key: f.key, label: f.label, render: (it) => f.key === "status" ? <StatusChip status={it.status} /> : <span className="max-w-xs truncate inline-block">{String(it[f.key] ?? "—")}</span> })),
          { key: "__actions", label: "Actions", render: (it) => <div className="flex gap-2 text-gray-400" onClick={(e) => e.stopPropagation()}><button onClick={() => setEditing(it)} className="hover:text-plum"><Edit size={15} /></button><button onClick={(e) => del(e, it)} className="hover:text-red-600"><Trash2 size={15} /></button></div> },
        ]}
      />
      {editing && (
        <Modal open title={editing.id ? `Edit ${title}` : `Add ${title}`} onClose={() => setEditing(null)} wide>
          <div className="space-y-4">
            {fields.map((f) => (
              <Field key={f.key} label={f.label}>
                {f.type === "image" ? <ImageUpload value={editing[f.key]} onChange={(u) => setEditing({ ...editing, [f.key]: u })} testid={`${testid}-${f.key}`} />
                  : f.type === "video" ? <VideoUpload value={editing[f.key]} onChange={(u) => setEditing({ ...editing, [f.key]: u })} testid={`${testid}-${f.key}`} />
                  : f.type === "select" ? <select value={editing[f.key] ?? (f.options || [])[0] ?? ""} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} className={inputCls}>{(f.options || []).map((option) => <option key={option} value={option}>{option}</option>)}</select>
                  : f.type === "rich" ? <RichEditor value={editing[f.key]} onChange={(v) => setEditing({ ...editing, [f.key]: v })} testid={`${testid}-${f.key}`} />
                  : f.type === "textarea" ? <textarea rows={4} value={editing[f.key] || ""} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} className={inputCls} data-testid={`${testid}-${f.key}`} />
                  : <input type={f.type === "number" ? "number" : "text"} value={editing[f.key] ?? ""} onChange={(e) => setEditing({ ...editing, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value })} className={inputCls} data-testid={`${testid}-${f.key}`} />}
              </Field>
            ))}
          </div>
          <div className="flex justify-end gap-3 mt-6"><button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button><button onClick={save} className="bg-plum text-white rounded-md px-5 py-2 text-sm" data-testid={`save-${testid}`}>Save</button></div>
        </Modal>
      )}
    </div>
  );
}

export function Banners() {
  return <Generic title="Banners" endpoint="banners" testid="banner"
    columns={["Media type", "Destination URL", "Status"]}
    fields={[{ key: "media_type", label: "Media type", type: "select", options: ["image", "video"] }, { key: "image", label: "Banner image", type: "image" }, { key: "video", label: "Banner video", type: "video" }, { key: "destination_url", label: "Destination URL" }, { key: "status", label: "Status", type: "select", options: ["Active", "Draft", "Archived"] }, { key: "order", label: "Display order", type: "number" }]}
    defaults={{ status: "Active", media_type: "image", destination_url: "", order: 0 }} />;
}

export function Filters() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = useCallback(() => adminApi.get("/product-filters").then(({ data }) => setItems(data.items || [])).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    if (!String(editing?.name || "").trim()) return toast.error("Filter name is required.");
    const payload = { ...editing, name: editing.name.trim(), values: (Array.isArray(editing.values) ? editing.values : String(editing.values || "").split("\n")).map((v) => String(v).trim()).filter(Boolean), category_slugs: (Array.isArray(editing.category_slugs) ? editing.category_slugs : String(editing.category_slugs || "").split(",")).map((v) => String(v).trim()).filter(Boolean), order: Number(editing.order || 0), status: editing.status || "Active", type: editing.type || "multi" };
    try { if (payload.id) await adminApi.put(`/product-filters/${payload.id}`, payload); else await adminApi.post("/product-filters", payload); toast.success("Product filter saved"); setEditing(null); load(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const remove = async (item) => { if (!window.confirm(`Delete filter ${item.name}?`)) return; try { await adminApi.delete(`/product-filters/${item.id}`); toast.success("Filter deleted"); load(); } catch (e) { toast.error(apiError(e)); } };
  return <div><PageHead title="Product Filters" subtitle="Configure structured filters used on product listings" action={<button onClick={() => setEditing({ name: "", type: "multi", values: [], category_slugs: [], status: "Active", order: items.length })} className="bg-plum text-white rounded-md px-4 py-2 text-sm flex items-center gap-2"><Plus size={16}/> Add Filter</button>} />
    <div className="space-y-3">{items.map((item) => <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4 flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><p className="font-medium text-gray-900">{item.name}</p><StatusChip status={item.status}/></div><p className="text-xs text-gray-500 mt-1">{item.type === "single" ? "Single select" : "Multi select"} · Order {item.order || 0}</p><p className="text-sm text-gray-600 mt-2">{(item.values || []).join(", ") || "No values configured"}</p>{(item.category_slugs || []).length > 0 && <p className="text-xs text-gray-400 mt-1">Categories: {item.category_slugs.join(", ")}</p>}</div><div className="flex gap-2"><button onClick={() => setEditing({ ...item, values: [...(item.values || [])], category_slugs: [...(item.category_slugs || [])] })} className="border rounded px-3 py-1.5 text-xs">Edit</button><button onClick={() => remove(item)} className="border border-red-200 text-red-600 rounded px-3 py-1.5 text-xs">Delete</button></div></div>)}{!items.length && <Empty text="No product filters configured"/>}</div>
    {editing && <Modal open title={editing.id ? "Edit Product Filter" : "Add Product Filter"} onClose={() => setEditing(null)} wide><div className="space-y-4"><div className="grid sm:grid-cols-2 gap-3"><Field label="Filter Name"><input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inputCls} placeholder="e.g. Material"/></Field><Field label="Filter Type"><select value={editing.type || "multi"} onChange={(e) => setEditing({ ...editing, type: e.target.value })} className={inputCls}><option value="single">Single select</option><option value="multi">Multi select</option></select></Field><Field label="Status"><select value={editing.status || "Active"} onChange={(e) => setEditing({ ...editing, status: e.target.value })} className={inputCls}><option>Active</option><option>Archived</option></select></Field><Field label="Display Order"><input type="number" value={editing.order ?? 0} onChange={(e) => setEditing({ ...editing, order: Number(e.target.value || 0) })} className={inputCls}/></Field></div><Field label="Filter Values (one per line)"><textarea rows={6} value={(Array.isArray(editing.values) ? editing.values : String(editing.values || "").split("\n")).join("\n")} onChange={(e) => setEditing({ ...editing, values: e.target.value.split("\n") })} className={inputCls} placeholder="Cotton\nPaper\nLeather"/></Field><Field label="Category Slugs (comma separated; blank = all categories)"><input value={(Array.isArray(editing.category_slugs) ? editing.category_slugs : String(editing.category_slugs || "").split(",")).join(", ")} onChange={(e) => setEditing({ ...editing, category_slugs: e.target.value.split(",") })} className={inputCls} placeholder="gifts, home-decor"/></Field></div><div className="flex justify-end gap-2 mt-5"><button onClick={() => setEditing(null)} className="px-4 py-2 text-sm">Cancel</button><button onClick={save} className="bg-plum text-white rounded px-4 py-2 text-sm">Save Filter</button></div></Modal>}
  </div>;
}

export function Pages() {
  return <Generic title="Legal Pages" endpoint="pages" testid="page"
    columns={["Title", "Slug", "Status"]}
    fields={[{ key: "title", label: "Title" }, { key: "slug", label: "Slug" }, { key: "content", label: "Content", type: "rich" }, { key: "status", label: "Status" }]}
    defaults={{ status: "Active" }} />;
}

export function FAQs() {
  return <Generic title="FAQs" endpoint="faqs" testid="faq"
    columns={["Question", "Category", "Status"]}
    fields={[{ key: "question", label: "Question" }, { key: "answer", label: "Answer", type: "textarea" }, { key: "category", label: "Category" }, { key: "order", label: "Order", type: "number" }, { key: "status", label: "Status" }]}
    defaults={{ status: "Active", order: 0 }} />;
}
