import React, { useEffect, useState, useCallback } from "react";
import { Plus, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { adminApi, apiError } from "../lib/api";
import { toast } from "sonner";
import { StatusChip, Modal, Field, inputCls, PageHead, Empty } from "./ui";
import { ImageUpload } from "./ImageUpload";
import { RichEditor } from "./RichEditor";

function SlidesEditor({ slides = [], onChange }) {
  const setSlide = (i, k, v) => { const n = [...slides]; n[i] = { ...n[i], [k]: v }; onChange(n); };
  const setBadge = (si, bi, k, v) => { const n = [...slides]; const b = [...(n[si].badges || [])]; b[bi] = { ...b[bi], [k]: v }; n[si] = { ...n[si], badges: b }; onChange(n); };
  const addSlide = () => onChange([...slides, { heading: "New slide", badges: [] }]);
  const rmSlide = (i) => onChange(slides.filter((_, x) => x !== i));
  const addBadge = (si) => { const n = [...slides]; n[si] = { ...n[si], badges: [...(n[si].badges || []), { icon: "Award", label: "New badge" }] }; onChange(n); };
  const rmBadge = (si, bi) => { const n = [...slides]; n[si] = { ...n[si], badges: (n[si].badges || []).filter((_, x) => x !== bi) }; onChange(n); };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><label className="text-sm font-semibold text-gray-800">Carousel Slides</label><button onClick={addSlide} className="text-sm text-plum flex items-center gap-1" data-testid="cms-add-slide"><Plus size={14} /> Add slide</button></div>
      {slides.map((s, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3 relative" data-testid={`cms-slide-${i}`}>
          <button onClick={() => rmSlide(i)} className="absolute top-3 right-3 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
          <p className="text-xs font-semibold text-gray-500">Slide {i + 1}</p>
          <Field label="Eyebrow"><input value={s.eyebrow || ""} onChange={(e) => setSlide(i, "eyebrow", e.target.value)} className={inputCls} /></Field>
          <Field label="Heading"><input value={s.heading || ""} onChange={(e) => setSlide(i, "heading", e.target.value)} className={inputCls} /></Field>
          <Field label="Subheading"><textarea rows={2} value={s.subheading || ""} onChange={(e) => setSlide(i, "subheading", e.target.value)} className={inputCls} /></Field>
          <Field label="Image"><ImageUpload value={s.image} onChange={(u) => setSlide(i, "image", u)} testid={`cms-slide-img-${i}`} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Primary CTA text"><input value={s.cta_text || ""} onChange={(e) => setSlide(i, "cta_text", e.target.value)} className={inputCls} /></Field>
            <Field label="Primary CTA link"><input value={s.cta_link || ""} onChange={(e) => setSlide(i, "cta_link", e.target.value)} className={inputCls} /></Field>
            <Field label="Secondary CTA text"><input value={s.cta_secondary_text || ""} onChange={(e) => setSlide(i, "cta_secondary_text", e.target.value)} className={inputCls} /></Field>
            <Field label="Secondary CTA link"><input value={s.cta_secondary_link || ""} onChange={(e) => setSlide(i, "cta_secondary_link", e.target.value)} className={inputCls} /></Field>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2"><label className="text-xs font-semibold text-gray-600">Trust Badges</label><button onClick={() => addBadge(i)} className="text-xs text-plum flex items-center gap-1" data-testid={`cms-add-badge-${i}`}><Plus size={12} /> Add badge</button></div>
            {(s.badges || []).map((b, bi) => (
              <div key={bi} className="flex items-center gap-2 mb-2">
                <input value={b.icon || ""} onChange={(e) => setBadge(i, bi, "icon", e.target.value)} placeholder="Icon (e.g. Award)" className={inputCls + " !py-1.5 w-40"} />
                <input value={b.label || ""} onChange={(e) => setBadge(i, bi, "label", e.target.value)} placeholder="Label (e.g. Best Price)" className={inputCls + " !py-1.5 flex-1"} />
                <button onClick={() => rmBadge(i, bi)} className="text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="text-[11px] text-gray-400">Icon names use lucide-react (e.g. Award, RefreshCw, Truck, ShieldCheck, Gift, Star, BadgeIndianRupee).</p>
    </div>
  );
}

export function HomepageCMS() {
  const [sections, setSections] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = useCallback(() => adminApi.get("/cms/homepage").then(({ data }) => setSections(data.sections)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const toggle = async (s) => { await adminApi.put(`/cms/homepage/${s.id}`, { enabled: !s.enabled }); load(); };
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
              <button onClick={() => setEditing(s)} className="text-gray-400 hover:text-plum"><Edit size={17} /></button>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <Modal open title="Edit Section" onClose={() => setEditing(null)} wide>
          <div className="space-y-4">
            <Field label="Heading"><input value={editing.heading || ""} onChange={(e) => setEditing({ ...editing, heading: e.target.value })} className={inputCls} data-testid="cms-heading" /></Field>
            <Field label="Subheading"><textarea rows={2} value={editing.subheading || ""} onChange={(e) => setEditing({ ...editing, subheading: e.target.value })} className={inputCls} /></Field>
            {["hero", "banner", "story", "categories"].includes(editing.type) && <Field label="Image"><ImageUpload value={editing.image} onChange={(u) => setEditing({ ...editing, image: u })} testid="cms-image" /></Field>}
            {["hero", "banner", "story"].includes(editing.type) && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="CTA Text"><input value={editing.cta_text || ""} onChange={(e) => setEditing({ ...editing, cta_text: e.target.value })} className={inputCls} /></Field>
                <Field label="CTA Link"><input value={editing.cta_link || ""} onChange={(e) => setEditing({ ...editing, cta_link: e.target.value })} className={inputCls} /></Field>
              </div>
            )}
            {editing.type === "hero" && (
              <SlidesEditor slides={editing.slides || []} onChange={(slides) => setEditing({ ...editing, slides })} />
            )}
          </div>
          <div className="flex justify-end gap-3 mt-6"><button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button><button onClick={save} className="bg-plum text-white rounded-md px-5 py-2 text-sm" data-testid="cms-save">Save</button></div>
        </Modal>
      )}
    </div>
  );
}

function Generic({ title, endpoint, columns, fields, defaults, testid }) {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = useCallback(() => adminApi.get(`/${endpoint}`).then(({ data }) => setItems(data.items)).catch(() => {}), [endpoint]);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    try { if (editing.id) await adminApi.put(`/${endpoint}/${editing.id}`, editing); else await adminApi.post(`/${endpoint}`, editing); toast.success("Saved"); setEditing(null); load(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const del = async (it) => { if (!window.confirm("Delete?")) return; await adminApi.delete(`/${endpoint}/${it.id}`); load(); };
  return (
    <div>
      <PageHead title={title} action={<button onClick={() => setEditing({ ...defaults })} className="bg-plum text-white rounded-md px-4 py-2 text-sm flex items-center gap-2" data-testid={`add-${testid}`}><Plus size={16} /> Add</button>} />
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-400 text-xs bg-gray-50 border-b border-gray-200">{columns.map((c) => <th key={c} className="px-4 py-3 font-medium">{c}</th>)}<th className="px-4 py-3 font-medium">Actions</th></tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b border-gray-50 hover:bg-gray-50">
                {fields.map((f) => <td key={f.key} className="px-4 py-3 text-gray-700 max-w-xs truncate">{String(it[f.key] ?? "—")}</td>)}
                <td className="px-4 py-3"><div className="flex gap-2 text-gray-400"><button onClick={() => setEditing(it)} className="hover:text-plum"><Edit size={15} /></button><button onClick={() => del(it)} className="hover:text-red-600"><Trash2 size={15} /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <Empty text="Nothing yet" />}
      </div>
      {editing && (
        <Modal open title={editing.id ? `Edit ${title}` : `Add ${title}`} onClose={() => setEditing(null)} wide>
          <div className="space-y-4">
            {fields.map((f) => (
              <Field key={f.key} label={f.label}>
                {f.type === "image" ? <ImageUpload value={editing[f.key]} onChange={(u) => setEditing({ ...editing, [f.key]: u })} testid={`${testid}-${f.key}`} />
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
    columns={["Heading", "CTA", "Status"]}
    fields={[{ key: "heading", label: "Heading" }, { key: "cta_text", label: "CTA Text" }, { key: "status", label: "Status" }, { key: "description", label: "Description", type: "textarea" }, { key: "image", label: "Desktop Image", type: "image" }, { key: "cta_link", label: "CTA Link" }]}
    defaults={{ status: "Active" }} />;
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
