import React, { useEffect, useState } from "react";
import { Save, Plus, Trash2 } from "lucide-react";
import { adminApi, apiError } from "../lib/api";
import { toast } from "sonner";
import { PageHead, Field, inputCls } from "./ui";
import { RichEditor } from "./RichEditor";
import { ImageUpload } from "./ImageUpload";

const PAGES = [
  { slug: "about", label: "About", listKey: "cards", listLabel: "Highlight Cards", listFields: ["icon", "title", "desc"] },
  { slug: "our-story", label: "Our Story", listKey: "chapters", listLabel: "Story Chapters", listFields: ["title", "desc", "image"] },
  { slug: "contact", label: "Contact", listKey: null },
  { slug: "corporate-gifting", label: "Corporate Gifting", listKey: null },
];

const CONTACT_FIELDS = [
  ["contact_address", "Address"],
  ["contact_phone", "Phone number"],
  ["contact_whatsapp", "WhatsApp number"],
  ["contact_email", "Email"],
  ["office_hours", "Office hours"],
];

export default function SitePages() {
  const [active, setActive] = useState("about");
  const [doc, setDoc] = useState(null);
  const [saving, setSaving] = useState(false);
  const cfg = PAGES.find((p) => p.slug === active);

  const load = (slug) => { setDoc(null); adminApi.get(`/cms/pages/${slug}`).then(({ data }) => setDoc(data)).catch(() => setDoc({ slug })); };
  useEffect(() => { load(active); }, [active]);

  const set = (k, v) => setDoc((d) => ({ ...d, [k]: v }));
  const setListItem = (i, k, v) => setDoc((d) => { const list = [...(d[cfg.listKey] || [])]; list[i] = { ...list[i], [k]: v }; return { ...d, [cfg.listKey]: list }; });
  const addItem = () => setDoc((d) => ({ ...d, [cfg.listKey]: [...(d[cfg.listKey] || []), {}] }));
  const removeItem = (i) => setDoc((d) => ({ ...d, [cfg.listKey]: (d[cfg.listKey] || []).filter((_, idx) => idx !== i) }));

  const save = async () => {
    setSaving(true);
    try { await adminApi.put(`/cms/pages/${active}`, doc); toast.success("Page saved — live on the website"); }
    catch (e) { toast.error(apiError(e)); }
    setSaving(false);
  };

  return (
    <div>
      <PageHead title="Site Pages" subtitle="Full control over About, Our Story & Contact content"
        action={<button onClick={save} disabled={saving || !doc} className="bg-plum text-white rounded-lg px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50" data-testid="sitepage-save"><Save size={15} /> {saving ? "Saving…" : "Save Changes"}</button>} />

      <div className="flex gap-2 mb-6">
        {PAGES.map((p) => (
          <button key={p.slug} onClick={() => setActive(p.slug)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${active === p.slug ? "bg-plum text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            data-testid={`sitepage-tab-${p.slug}`}>{p.label}</button>
        ))}
      </div>

      {!doc ? <p className="text-gray-400">Loading…</p> : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h3 className="font-semibold text-gray-900">Hero</h3>
              <Field label="Eyebrow"><input value={doc.hero_eyebrow || ""} onChange={(e) => set("hero_eyebrow", e.target.value)} className={inputCls} data-testid="sitepage-eyebrow" /></Field>
              <Field label="Title"><input value={doc.hero_title || ""} onChange={(e) => set("hero_title", e.target.value)} className={inputCls} data-testid="sitepage-title" /></Field>
              <Field label="Hero Image"><ImageUpload value={doc.hero_image || ""} onChange={(u) => set("hero_image", u)} testid="sitepage-hero-image" /></Field>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h3 className="font-semibold text-gray-900">Body Content</h3>
              <RichEditor value={doc.body_html} onChange={(v) => set("body_html", v)} testid="sitepage-body" />
            </div>

            {active === "contact" && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4" data-testid="sitepage-contact-details">
                <h3 className="font-semibold text-gray-900">Contact Details</h3>
                {CONTACT_FIELDS.map(([key, label]) => (
                  <Field key={key} label={label}><input value={doc[key] || ""} onChange={(e) => set(key, e.target.value)} className={inputCls} data-testid={`sitepage-${key}`} /></Field>
                ))}
              </div>
            )}

            {cfg.listKey && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{cfg.listLabel}</h3>
                  <button onClick={addItem} className="text-sm text-plum flex items-center gap-1" data-testid="sitepage-add-item"><Plus size={15} /> Add</button>
                </div>
                {(doc[cfg.listKey] || []).map((item, i) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-3 space-y-2 relative">
                    <button onClick={() => removeItem(i)} className="absolute top-2 right-2 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                    {cfg.listFields.map((f) => (
                      <Field key={f} label={f === "image" ? "Image" : f}>
                        {f === "image"
                          ? <ImageUpload value={item[f] || ""} onChange={(u) => setListItem(i, f, u)} testid={`sitepage-${cfg.slug}-image-${i}`} />
                          : f === "desc"
                            ? <textarea value={item[f] || ""} onChange={(e) => setListItem(i, f, e.target.value)} rows={2} className={inputCls} />
                            : <input value={item[f] || ""} onChange={(e) => setListItem(i, f, e.target.value)} className={inputCls} placeholder={f === "icon" ? "lucide icon name e.g. Sparkles" : ""} />}
                      </Field>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Preview</h3>
              {doc.hero_image && <img src={doc.hero_image} alt="" className="w-full h-32 object-cover rounded-lg mb-3" />}
              <p className="text-[11px] uppercase tracking-widest text-plum">{doc.hero_eyebrow}</p>
              <p className="font-serif text-lg text-gray-900 mb-2">{doc.hero_title}</p>
              <div className="prose prose-sm max-w-none text-gray-600" dangerouslySetInnerHTML={{ __html: doc.body_html || "" }} />
            </div>
            <a href={`/${active}`} target="_blank" rel="noreferrer" className="block text-center text-sm text-plum underline">View live page ↗</a>
          </div>
        </div>
      )}
    </div>
  );
}
