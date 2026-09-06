import React, { useEffect, useState, useCallback } from "react";
import { Mail, MessageSquare, Users, Trash2, Send } from "lucide-react";
import { adminApi, apiError } from "../lib/api";
import { toast } from "sonner";
import { formatDateTime } from "../lib/utils";
import { PageHead, StatusChip, Modal, inputCls } from "./ui";
import { DataTable, KpiCards } from "./DataTable";

/* ---------------- Newsletter Subscribers ---------------- */
export function Newsletter() {
  const [data, setData] = useState({ items: [], stats: {}, pages: 1 });
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    adminApi.get(`/newsletter-subscribers?q=${encodeURIComponent(q)}&page=${page}`)
      .then(({ data }) => setData(data)).catch(() => {}).finally(() => setLoading(false));
  }, [q, page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const del = async (e, id) => {
    e.stopPropagation();
    await adminApi.delete(`/newsletter-subscribers/${id}`);
    toast.success("Removed"); load();
  };

  return (
    <div>
      <PageHead title="Newsletter" subtitle="People who subscribed from the storefront" />
      <KpiCards cards={[
        { label: "Total Subscribers", value: data.stats.total || 0, icon: Mail },
        { label: "New (30 days)", value: data.stats.new_month || 0, icon: Users },
      ]} />
      <DataTable
        testid="newsletter" loading={loading} q={q} setQ={setQ} searchPlaceholder="Search email…"
        page={page} pages={data.pages} setPage={setPage} rows={data.items} empty="No subscribers yet"
        columns={[
          { key: "email", label: "Email", render: (r) => <span className="font-medium text-gray-900">{r.email}</span> },
          { key: "source", label: "Source", render: (r) => <span className="capitalize">{r.source || "footer"}</span> },
          { key: "status", label: "Status", render: (r) => <StatusChip status={r.status || "Subscribed"} /> },
          { key: "created_at", label: "Subscribed", nowrap: true, render: (r) => formatDateTime(r.created_at) },
          { key: "actions", label: "", align: "right", render: (r) => <button onClick={(e) => del(e, r.id)} className="text-gray-400 hover:text-red-600" data-testid={`newsletter-del-${r.id}`}><Trash2 size={15} /></button> },
        ]}
      />
    </div>
  );
}

/* ---------------- Support / Contact messages ---------------- */
export function Support() {
  const [data, setData] = useState({ items: [], stats: {}, pages: 1 });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const [reply, setReply] = useState("");
  const load = useCallback(() => {
    setLoading(true);
    adminApi.get(`/support-messages?q=${encodeURIComponent(q)}&status=${status}&page=${page}`)
      .then(({ data }) => setData(data)).catch(() => {}).finally(() => setLoading(false));
  }, [q, status, page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const save = async (st) => {
    try {
      await adminApi.put(`/support-messages/${open.id}`, { status: st, reply });
      toast.success("Updated"); setOpen(null); setReply(""); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div>
      <PageHead title="Support Inbox" subtitle="Messages submitted from the Contact page" />
      <KpiCards cards={[
        { label: "Total Messages", value: data.stats.total || 0, icon: MessageSquare },
        { label: "Open", value: data.stats.open || 0, icon: MessageSquare },
      ]} />
      <DataTable
        testid="support" loading={loading} q={q} setQ={setQ} searchPlaceholder="Search name, email, message…"
        page={page} pages={data.pages} setPage={setPage} rows={data.items} onRowClick={(r) => { setOpen(r); setReply(r.admin_reply || ""); }}
        empty="No messages yet"
        filters={[{ key: "status", label: "All statuses", value: status, onChange: (v) => { setStatus(v); setPage(1); }, options: ["Open", "In Progress", "Resolved"] }]}
        columns={[
          { key: "name", label: "From", render: (r) => <div><p className="font-medium text-gray-900">{r.name}</p><p className="text-xs text-gray-500">{r.email || r.phone}</p></div> },
          { key: "message", label: "Message", render: (r) => <span className="text-gray-600 line-clamp-1 max-w-xs inline-block">{r.message}</span> },
          { key: "status", label: "Status", render: (r) => <StatusChip status={r.status || "Open"} /> },
          { key: "created_at", label: "Received", nowrap: true, render: (r) => formatDateTime(r.created_at) },
        ]}
      />
      {open && (
        <Modal open title={`Message from ${open.name}`} onClose={() => setOpen(null)}>
          <div className="space-y-3 text-sm">
            <p className="text-gray-600"><b>Email:</b> {open.email || "—"}</p>
            <p className="text-gray-600"><b>Phone:</b> {open.phone || "—"}</p>
            <div className="bg-gray-50 rounded-lg p-3 text-gray-700 whitespace-pre-wrap">{open.message}</div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Internal note / reply</label>
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} className={inputCls} data-testid="support-reply" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => save("In Progress")} className="text-xs bg-sky-600 text-white px-3 py-2 rounded-lg" data-testid="support-inprogress">Mark In Progress</button>
              <button onClick={() => save("Resolved")} className="text-xs bg-emerald-600 text-white px-3 py-2 rounded-lg flex items-center gap-1" data-testid="support-resolve"><Send size={13} /> Resolve</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Visitors ---------------- */
export function Visitors() {
  const [data, setData] = useState({ items: [], stats: {}, pages: 1 });
  const [q, setQ] = useState("");
  const [identified, setIdentified] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    adminApi.get(`/visitors?q=${encodeURIComponent(q)}&identified=${identified}&page=${page}`)
      .then(({ data }) => setData(data)).catch(() => {}).finally(() => setLoading(false));
  }, [q, identified, page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  return (
    <div>
      <PageHead title="Visitors" subtitle="Who's browsing — and who signed in with a phone or email" />
      <KpiCards cards={[
        { label: "Total Visitors", value: data.stats.total || 0, icon: Users },
        { label: "Identified", value: data.stats.identified || 0, icon: Users, sub: "logged in with phone/email" },
        { label: "Active Today", value: data.stats.today || 0, icon: Users },
      ]} />
      <DataTable
        testid="visitors" loading={loading} q={q} setQ={setQ} searchPlaceholder="Search phone, email, name…"
        page={page} pages={data.pages} setPage={setPage} rows={data.items} empty="No visitors tracked yet"
        filters={[{ key: "identified", label: "Everyone", value: identified, onChange: (v) => { setIdentified(v); setPage(1); }, options: [{ value: "yes", label: "Identified only" }] }]}
        columns={[
          { key: "identity", label: "Visitor", render: (r) => {
              const id = r.identity || {};
              const named = id.name || id.phone || id.email;
              return named
                ? <div><p className="font-medium text-gray-900">{id.name || id.phone}</p><p className="text-xs text-gray-500">{id.email || id.phone}</p></div>
                : <span className="text-gray-400">Anonymous · {String(r.visitor_id).slice(0, 8)}</span>;
            } },
          { key: "visit_count", label: "Visits", render: (r) => r.visit_count || 1 },
          { key: "last_path", label: "Last Page", render: (r) => <span className="text-gray-600">{r.last_path || "/"}</span> },
          { key: "referrer", label: "Source", render: (r) => <span className="text-gray-500 text-xs">{r.referrer ? new URL(r.referrer, "http://x").host || "direct" : "direct"}</span> },
          { key: "last_seen", label: "Last Seen", nowrap: true, render: (r) => formatDateTime(r.last_seen) },
        ]}
      />
    </div>
  );
}
