import React, { useEffect, useState, useCallback } from "react";
import { Plus, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { adminApi, apiError } from "../lib/api";
import { toast } from "sonner";
import { StatusChip, Modal, Field, inputCls, PageHead, Empty } from "./ui";

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
            {["hero", "banner", "story", "categories"].includes(editing.type) && <Field label="Image URL"><input value={editing.image || ""} onChange={(e) => setEditing({ ...editing, image: e.target.value })} className={inputCls} /></Field>}
            {["hero", "banner", "story"].includes(editing.type) && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="CTA Text"><input value={editing.cta_text || ""} onChange={(e) => setEditing({ ...editing, cta_text: e.target.value })} className={inputCls} /></Field>
                <Field label="CTA Link"><input value={editing.cta_link || ""} onChange={(e) => setEditing({ ...editing, cta_link: e.target.value })} className={inputCls} /></Field>
              </div>
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
                {f.type === "textarea" ? <textarea rows={4} value={editing[f.key] || ""} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} className={inputCls} data-testid={`${testid}-${f.key}`} />
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
    fields={[{ key: "heading", label: "Heading" }, { key: "cta_text", label: "CTA Text" }, { key: "status", label: "Status" }, { key: "description", label: "Description", type: "textarea" }, { key: "image", label: "Desktop Image URL" }, { key: "cta_link", label: "CTA Link" }]}
    defaults={{ status: "Active" }} />;
}

export function Pages() {
  return <Generic title="Pages" endpoint="pages" testid="page"
    columns={["Title", "Slug", "Status"]}
    fields={[{ key: "title", label: "Title" }, { key: "slug", label: "Slug" }, { key: "content", label: "Content", type: "textarea" }, { key: "status", label: "Status" }]}
    defaults={{ status: "Active" }} />;
}

export function FAQs() {
  return <Generic title="FAQs" endpoint="faqs" testid="faq"
    columns={["Question", "Category", "Status"]}
    fields={[{ key: "question", label: "Question" }, { key: "answer", label: "Answer", type: "textarea" }, { key: "category", label: "Category" }, { key: "order", label: "Order", type: "number" }, { key: "status", label: "Status" }]}
    defaults={{ status: "Active", order: 0 }} />;
}
