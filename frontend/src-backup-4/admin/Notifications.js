import React, { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, Trash2, ExternalLink, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { adminApi, apiError } from "../lib/api";
import { toast } from "sonner";
import { PageHead, Empty } from "./ui";

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await adminApi.get("/notifications"); setItems(data.items || []); }
    catch (e) { toast.error(apiError(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const changeRead = async (n, read) => {
    try { await adminApi.post(`/notifications/${encodeURIComponent(n.id)}/read`, { read }); setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, read } : x)); }
    catch (e) { toast.error(apiError(e)); }
  };
  const remove = async (n) => {
    try { await adminApi.delete(`/notifications/${encodeURIComponent(n.id)}`); setItems((prev) => prev.filter((x) => x.id !== n.id)); toast.success("Notification deleted"); }
    catch (e) { toast.error(apiError(e)); }
  };
  const markAll = async () => { try { await adminApi.post("/notifications/read"); setItems((prev) => prev.map((x) => ({ ...x, read: true }))); toast.success("All notifications marked read"); } catch (e) { toast.error(apiError(e)); } };
  const destination = (n) => n.link || (n.order_number ? `/admin/orders` : n.product_id ? `/admin/products` : n.inquiry_id ? `/admin/corporate` : "");
  return <div>
    <PageHead title="Notifications" subtitle="Important order, inventory and inquiry activity" />
    <div className="flex justify-end gap-2 mb-4">
      <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-sm border rounded-md"><RefreshCw size={14}/> Refresh</button>
      <button onClick={markAll} disabled={!items.some((x) => !x.read)} className="flex items-center gap-2 px-3 py-2 text-sm border rounded-md disabled:opacity-40"><CheckCheck size={14}/> Mark all read</button>
    </div>
    {loading ? <p className="text-sm text-gray-500 py-10 text-center">Loading notifications…</p> : items.length === 0 ? <Empty text="You're all caught up. No notifications yet."/> : <div className="space-y-2">
      {items.map((n) => <article key={n.id} className={`bg-white border rounded-xl p-4 flex gap-3 ${n.read ? "border-gray-200" : "border-plum/40 bg-plum/[0.025]"}`}>
        <span className={`mt-0.5 w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${n.read ? "bg-gray-100 text-gray-500" : "bg-plum/10 text-plum"}`}><Bell size={17}/></span>
        <div className="flex-1 min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-sm text-gray-900">{n.title || "Notification"}</h3>{!n.read && <span className="w-2 h-2 rounded-full bg-plum"/>}</div><p className="text-sm text-gray-600 mt-1 break-words">{n.description || n.message || (n.order_number ? `Order ${n.order_number}` : "An update is available.")}</p><p className="text-xs text-gray-400 mt-2">{n.at ? new Date(n.at).toLocaleString() : "Time not available"}</p>
          {destination(n) && <Link to={destination(n)} className="inline-flex items-center gap-1 mt-2 text-xs text-plum underline"><ExternalLink size={12}/> Open related page</Link>}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0"><button title={n.read ? "Mark unread" : "Mark read"} onClick={() => changeRead(n, !n.read)} className="text-xs border rounded px-2 py-1.5">{n.read ? "Mark unread" : "Mark read"}</button><button title="Delete notification" onClick={() => remove(n)} className="text-xs border border-red-200 text-red-600 rounded px-2 py-1.5"><Trash2 size={14}/></button></div>
      </article>)}
    </div>}
  </div>;
}
