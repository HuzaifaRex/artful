import React, { useEffect, useState, useCallback } from "react";
import { Plus, ShieldCheck, AlertCircle, CheckCircle2 } from "lucide-react";
import { adminApi, apiError } from "../lib/api";
import { toast } from "sonner";
import { formatDateTime } from "../lib/utils";
import { StatusChip, Modal, Field, inputCls, PageHead, Empty } from "./ui";

export function Settings() {
  const [s, setS] = useState(null);
  const load = () => adminApi.get("/settings").then(({ data }) => setS(data)).catch(() => {});
  useEffect(() => { load(); }, []);
  const set = (k, v) => setS((p) => ({ ...p, [k]: v }));
  const setSocial = (k, v) => setS((p) => ({ ...p, social: { ...(p.social || {}), [k]: v } }));
  const save = async () => { try { await adminApi.put("/settings", s); toast.success("Settings saved"); } catch (e) { toast.error(apiError(e)); } };
  if (!s) return null;
  return (
    <div className="max-w-3xl">
      <PageHead title="Store Settings" />
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4 text-sm">Integrations</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <IntegrationRow label="Razorpay Payments" ok={s.integrations?.razorpay_configured} hint="Set RAZORPAY_KEY_ID & SECRET in backend .env" />
          <IntegrationRow label="Twilio SMS (OTP)" ok={s.integrations?.twilio_configured} hint="Set TWILIO_* in backend .env" />
        </div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Store Name"><input value={s.store_name || ""} onChange={(e) => set("store_name", e.target.value)} className={inputCls} data-testid="set-store-name" /></Field>
          <Field label="Contact Email"><input value={s.contact_email || ""} onChange={(e) => set("contact_email", e.target.value)} className={inputCls} /></Field>
          <Field label="Contact Phone"><input value={s.contact_phone || ""} onChange={(e) => set("contact_phone", e.target.value)} className={inputCls} /></Field>
          <Field label="Free Shipping Threshold ₹"><input type="number" value={s.free_shipping_threshold ?? ""} onChange={(e) => set("free_shipping_threshold", Number(e.target.value))} className={inputCls} data-testid="set-free-ship" /></Field>
          <Field label="Flat Shipping ₹"><input type="number" value={s.shipping_flat ?? ""} onChange={(e) => set("shipping_flat", Number(e.target.value))} className={inputCls} /></Field>
          <Field label="COD Fee ₹"><input type="number" value={s.cod_fee ?? ""} onChange={(e) => set("cod_fee", Number(e.target.value))} className={inputCls} /></Field>
        </div>
        <Field label="Announcement Text"><input value={s.announcement_text || ""} onChange={(e) => set("announcement_text", e.target.value)} className={inputCls} data-testid="set-announcement" /></Field>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={!!s.announcement_enabled} onChange={(e) => set("announcement_enabled", e.target.checked)} className="accent-plum" /> Show announcement bar</label>
          <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={!!s.cod_enabled} onChange={(e) => set("cod_enabled", e.target.checked)} className="accent-plum" /> Enable COD</label>
        </div>
        <div className="pt-2">
          <h3 className="font-semibold text-gray-900 mb-3 text-sm">Social Links</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Instagram URL">
              <input
                type="url"
                placeholder="https://instagram.com/yourbrand"
                value={s.social?.instagram || ""}
                onChange={(e) => setSocial("instagram", e.target.value)}
                className={inputCls}
                data-testid="set-instagram-url"
              />
            </Field>
            <Field label="Pinterest URL">
              <input
                type="url"
                placeholder="https://pinterest.com/yourbrand"
                value={s.social?.pinterest || ""}
                onChange={(e) => setSocial("pinterest", e.target.value)}
                className={inputCls}
                data-testid="set-pinterest-url"
              />
            </Field>
            <Field label="YouTube URL">
              <input
                type="url"
                placeholder="https://youtube.com/@yourbrand"
                value={s.social?.youtube || ""}
                onChange={(e) => setSocial("youtube", e.target.value)}
                className={inputCls}
                data-testid="set-youtube-url"
              />
            </Field>
            <Field label="Instagram Handle">
              <input
                value={s.instagram_handle || ""}
                onChange={(e) => set("instagram_handle", e.target.value)}
                className={inputCls}
                placeholder="@yourbrand"
                data-testid="set-instagram-handle"
              />
            </Field>
          </div>
          <p className="text-xs text-gray-500 mt-2">Only Instagram, Pinterest and YouTube are displayed on the storefront.</p>
        </div>
        <Field label="SEO Title"><input value={s.seo_title || ""} onChange={(e) => set("seo_title", e.target.value)} className={inputCls} /></Field>
        <Field label="SEO Description"><textarea rows={2} value={s.seo_description || ""} onChange={(e) => set("seo_description", e.target.value)} className={inputCls} /></Field>
        <button onClick={save} className="bg-plum text-white rounded-md px-5 py-2 text-sm" data-testid="save-settings">Save Settings</button>
      </div>
    </div>
  );
}

function IntegrationRow({ label, ok, hint }) {
  return (
    <div className="flex items-start gap-2 border border-gray-200 rounded-md p-3">
      {ok ? <CheckCircle2 size={18} className="text-emerald-600 mt-0.5" /> : <AlertCircle size={18} className="text-amber-500 mt-0.5" />}
      <div><p className="text-sm font-medium text-gray-900">{label}</p><p className="text-xs text-gray-500">{ok ? "Configured — live mode" : `Not configured — demo mode. ${hint}`}</p></div>
    </div>
  );
}

export function AdminUsers() {
  const [items, setItems] = useState([]);
  const [roles, setRoles] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = useCallback(() => {
    adminApi.get("/admin-users").then(({ data }) => setItems(data.items)).catch(() => {});
    adminApi.get("/roles").then(({ data }) => setRoles(data.roles)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    try {
      if (editing.id) await adminApi.put(`/admin-users/${editing.id}`, editing);
      else await adminApi.post("/admin-users", editing);
      toast.success("Saved"); setEditing(null); load();
    } catch (e) { toast.error(apiError(e)); }
  };
  return (
    <div>
      <PageHead title="Admin Users & Roles" subtitle="RBAC — permissions enforced server-side" action={<button onClick={() => setEditing({ role: "Order Manager", status: "Active" })} className="bg-plum text-white rounded-md px-4 py-2 text-sm flex items-center gap-2" data-testid="add-admin"><Plus size={16} /> Add Admin</button>} />
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-400 text-xs bg-gray-50 border-b border-gray-200"><th className="px-4 py-3 font-medium">Email</th><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Role</th><th className="px-4 py-3 font-medium">Status</th></tr></thead>
          <tbody>{items.map((u) => <tr key={u.id} className="border-b border-gray-50"><td className="px-4 py-3 text-gray-900">{u.email}</td><td className="px-4 py-3 text-gray-600">{u.name}</td><td className="px-4 py-3 text-gray-600">{u.role}</td><td className="px-4 py-3"><StatusChip status={u.status} /></td></tr>)}</tbody>
        </table>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-3 text-sm flex items-center gap-2"><ShieldCheck size={15} /> Roles & Permissions</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {roles.map((r) => <div key={r.name} className="border border-gray-200 rounded p-3"><p className="font-medium text-gray-800">{r.name}</p><p className="text-gray-500 mt-1">{r.permissions.join(", ")}</p></div>)}
        </div>
      </div>
      {editing && (
        <Modal open title={editing.id ? "Edit Admin" : "Add Admin"} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <Field label="Email"><input value={editing.email || ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} disabled={!!editing.id} className={inputCls} data-testid="admin-user-email" /></Field>
            <Field label="Name"><input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inputCls} /></Field>
            <Field label={editing.id ? "New Password (optional)" : "Password"}><input type="password" value={editing.password || ""} onChange={(e) => setEditing({ ...editing, password: e.target.value })} className={inputCls} data-testid="admin-user-password" /></Field>
            <Field label="Role"><select value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })} className={inputCls} data-testid="admin-user-role">{roles.map((r) => <option key={r.name}>{r.name}</option>)}</select></Field>
            <Field label="Status"><select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })} className={inputCls}><option>Active</option><option>Inactive</option></select></Field>
          </div>
          <div className="flex justify-end gap-3 mt-6"><button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button><button onClick={save} className="bg-plum text-white rounded-md px-5 py-2 text-sm" data-testid="save-admin-user">Save</button></div>
        </Modal>
      )}
    </div>
  );
}

export function AuditLogs() {
  const [items, setItems] = useState([]);
  useEffect(() => { adminApi.get("/audit-logs").then(({ data }) => setItems(data.items)).catch(() => {}); }, []);
  return (
    <div>
      <PageHead title="Audit Logs" subtitle="Every admin action is recorded" />
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-400 text-xs bg-gray-50 border-b border-gray-200"><th className="px-4 py-3 font-medium">Time</th><th className="px-4 py-3 font-medium">Admin</th><th className="px-4 py-3 font-medium">Action</th><th className="px-4 py-3 font-medium">Resource</th></tr></thead>
          <tbody>{items.map((a) => <tr key={a.id} className="border-b border-gray-50"><td className="px-4 py-3 text-gray-500 text-xs">{formatDateTime(a.at)}</td><td className="px-4 py-3 text-gray-700">{a.admin_email}</td><td className="px-4 py-3 text-gray-600">{a.action}</td><td className="px-4 py-3 text-gray-600">{a.resource} {a.resource_id ? `#${String(a.resource_id).slice(0, 8)}` : ""}</td></tr>)}</tbody>
        </table>
        {items.length === 0 && <Empty text="No activity yet" />}
      </div>
    </div>
  );
}

export function Corporate() {
  const [items, setItems] = useState([]);
  const STATUSES = ["New", "Contacted", "In Discussion", "Quoted", "Won", "Lost"];
  const load = () => adminApi.get("/corporate-inquiries").then(({ data }) => setItems(data.items)).catch(() => {});
  useEffect(() => { load(); }, []);
  const update = async (id, status) => { await adminApi.put(`/corporate-inquiries/${id}`, { status }); toast.success("Updated"); load(); };
  return (
    <div>
      <PageHead title="Corporate Inquiries" subtitle="Manage your gifting pipeline" />
      <div className="space-y-3">
        {items.map((c) => (
          <div key={c.id} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex justify-between flex-wrap gap-3">
              <div><p className="font-medium text-gray-900">{c.company_name}</p><p className="text-sm text-gray-600">{c.contact_person} · {c.mobile} {c.email && `· ${c.email}`}</p><p className="text-sm text-gray-500 mt-1">{c.requirement} {c.quantity && `· Qty ${c.quantity}`} {c.budget && `· ₹${c.budget}`}</p>{c.message && <p className="text-sm text-gray-500 mt-1 italic">"{c.message}"</p>}</div>
              <select value={c.status} onChange={(e) => update(c.id, e.target.value)} className={inputCls + " max-w-[160px] h-9"}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
            </div>
          </div>
        ))}
        {items.length === 0 && <Empty text="No inquiries yet" />}
      </div>
    </div>
  );
}
