import React, { useEffect, useState, useCallback } from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
import { adminApi, apiError } from "../lib/api";
import { toast } from "sonner";
import { formatDateTime } from "../lib/utils";
import { StatusChip, Modal, Field, inputCls, PageHead, Empty } from "./ui";
import { ImageUpload } from "./ImageUpload";

const toLocal = (iso) => { if (!iso) return ""; try { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); } catch { return ""; } };
const toIso = (local) => { if (!local) return null; return new Date(local).toISOString(); };

export default function Campaigns() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = useCallback(() => adminApi.get("/promotions").then(({ data }) => setItems(data.items)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing.name) return toast.error("Campaign name required");
    const payload = { ...editing, start_date: toIso(editing._start), end_date: toIso(editing._end) };
    delete payload._start; delete payload._end;
    try {
      if (editing.id) await adminApi.put(`/promotions/${editing.id}`, payload);
      else await adminApi.post("/promotions", payload);
      toast.success("Campaign saved"); setEditing(null); load();
    } catch (e) { toast.error(apiError(e)); }
  };
  const del = async (it) => { if (!window.confirm("Delete campaign?")) return; await adminApi.delete(`/promotions/${it.id}`); load(); };
  const open = (it) => setEditing(it ? { ...it, _start: toLocal(it.start_date), _end: toLocal(it.end_date) } : { status: "Active", countdown: true, cta_text: "Shop Now", cta_link: "/shop" });

  return (
    <div>
      <PageHead title="Festive Campaigns" subtitle="Schedule seasonal banners and countdown promotions" action={<button onClick={() => open(null)} className="bg-plum text-white rounded-md px-4 py-2 text-sm flex items-center gap-2" data-testid="add-campaign"><Plus size={16} /> New Campaign</button>} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((c) => (
          <div key={c.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden" data-testid={`campaign-${c.id}`}>
            {c.banner && <img src={c.banner} alt="" className="w-full h-28 object-cover" />}
            <div className="p-4">
              <div className="flex items-center justify-between"><p className="font-medium text-gray-900">{c.name}</p><StatusChip status={c.status} /></div>
              <p className="text-xs text-gray-500 mt-1">{c.headline || c.description || "—"}</p>
              <p className="text-[11px] text-gray-400 mt-2">{c.start_date ? `From ${formatDateTime(c.start_date)}` : "No start"} · {c.end_date ? `Ends ${formatDateTime(c.end_date)}` : "No end"}{c.countdown ? " · ⏱ countdown" : ""}</p>
              <div className="flex gap-2 mt-3 text-gray-400"><button onClick={() => open(c)} className="hover:text-plum"><Edit size={15} /></button><button onClick={() => del(c)} className="hover:text-red-600"><Trash2 size={15} /></button></div>
            </div>
          </div>
        ))}
      </div>
      {items.length === 0 && <Empty text="No campaigns yet" />}
      {editing && (
        <Modal open title={editing.id ? "Edit Campaign" : "New Campaign"} onClose={() => setEditing(null)} wide>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Campaign Name"><input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inputCls} data-testid="campaign-name" /></Field>
            <Field label="Headline (shows in bar)"><input value={editing.headline || ""} onChange={(e) => setEditing({ ...editing, headline: e.target.value })} className={inputCls} data-testid="campaign-headline" /></Field>
            <div className="sm:col-span-2"><Field label="Description"><input value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className={inputCls} /></Field></div>
            <Field label="CTA Text"><input value={editing.cta_text || ""} onChange={(e) => setEditing({ ...editing, cta_text: e.target.value })} className={inputCls} /></Field>
            <Field label="CTA Link"><input value={editing.cta_link || ""} onChange={(e) => setEditing({ ...editing, cta_link: e.target.value })} className={inputCls} /></Field>
            <Field label="Start (optional)"><input type="datetime-local" value={editing._start || ""} onChange={(e) => setEditing({ ...editing, _start: e.target.value })} className={inputCls} data-testid="campaign-start" /></Field>
            <Field label="End / Countdown to"><input type="datetime-local" value={editing._end || ""} onChange={(e) => setEditing({ ...editing, _end: e.target.value })} className={inputCls} data-testid="campaign-end" /></Field>
            <div className="sm:col-span-2"><Field label="Banner Image"><ImageUpload value={editing.banner} onChange={(u) => setEditing({ ...editing, banner: u })} testid="campaign-banner" /></Field></div>
            <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={!!editing.countdown} onChange={(e) => setEditing({ ...editing, countdown: e.target.checked })} className="accent-plum" /> Show countdown timer</label>
            <Field label="Status"><select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })} className={inputCls}><option>Active</option><option>Archived</option></select></Field>
          </div>
          <div className="flex justify-end gap-3 mt-6"><button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button><button onClick={save} className="bg-plum text-white rounded-md px-5 py-2 text-sm" data-testid="save-campaign">Save</button></div>
        </Modal>
      )}
    </div>
  );
}
