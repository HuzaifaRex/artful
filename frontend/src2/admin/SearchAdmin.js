import React, { useEffect, useState, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import { adminApi, apiError } from "../lib/api";
import { toast } from "sonner";
import { inputCls, PageHead, Empty } from "./ui";

export default function SearchAdmin() {
  const [tab, setTab] = useState("analytics");
  return (
    <div>
      <PageHead title="Search Management" subtitle="No code changes needed to tune search" />
      <div className="flex gap-2 mb-5">
        {[["analytics", "Analytics"], ["synonyms", "Synonyms"], ["corrections", "Typo Corrections"]].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} className={`px-4 py-2 text-sm rounded ${tab === v ? "bg-plum text-white" : "bg-white border border-gray-200 text-gray-600"}`} data-testid={`search-tab-${v}`}>{l}</button>
        ))}
      </div>
      {tab === "analytics" && <Analytics />}
      {tab === "synonyms" && <Rules endpoint="search/synonyms" fields={["term", "correct"]} labels={["Search term", "Maps to"]} testid="synonym" />}
      {tab === "corrections" && <Rules endpoint="search/corrections" fields={["wrong", "correct"]} labels={["Wrong spelling", "Correct spelling"]} testid="correction" />}
    </div>
  );
}

function Analytics() {
  const [a, setA] = useState(null);
  useEffect(() => { adminApi.get("/search/analytics").then(({ data }) => setA(data)).catch(() => {}); }, []);
  if (!a) return <p className="text-gray-400">Loading…</p>;
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="bg-white rounded-lg border border-gray-200 p-5"><p className="text-xs text-gray-500">Total Searches</p><p className="text-3xl font-semibold text-gray-900 mt-1">{a.total_searches}</p><p className="text-xs text-gray-400 mt-1">{a.corrected_searches} auto-corrected</p></div>
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h4 className="font-semibold text-gray-900 mb-3 text-sm">Top Searches</h4>
        <ul className="text-sm space-y-1.5">{a.top_searches.slice(0, 8).map((t, i) => <li key={i} className="flex justify-between text-gray-600"><span className="truncate pr-2">{t.query || "(empty)"}</span><b>{t.count}</b></li>)}{a.top_searches.length === 0 && <li className="text-gray-400">No data yet</li>}</ul>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h4 className="font-semibold text-gray-900 mb-3 text-sm">No-Result Searches</h4>
        <ul className="text-sm space-y-1.5">{a.no_result_searches.slice(0, 8).map((t, i) => <li key={i} className="flex justify-between text-gray-600"><span className="truncate pr-2">{t.query}</span><b>{t.count}</b></li>)}{a.no_result_searches.length === 0 && <li className="text-gray-400">None — great!</li>}</ul>
      </div>
    </div>
  );
}

function Rules({ endpoint, fields, labels, testid }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({});
  const load = useCallback(() => adminApi.get(`/${endpoint}`).then(({ data }) => setItems(data.items)).catch(() => {}), [endpoint]);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    if (!form[fields[0]] || !form[fields[1]]) return toast.error("Both fields required");
    try { await adminApi.post(`/${endpoint}`, { [fields[0]]: form[fields[0]].toLowerCase(), [fields[1]]: form[fields[1]].toLowerCase() }); toast.success("Added"); setForm({}); load(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const del = async (it) => { await adminApi.delete(`/${endpoint}/${it.id}`); load(); };
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 max-w-2xl">
      <div className="flex gap-3 mb-5">
        <input value={form[fields[0]] || ""} onChange={(e) => setForm({ ...form, [fields[0]]: e.target.value })} placeholder={labels[0]} className={inputCls} data-testid={`${testid}-a`} />
        <input value={form[fields[1]] || ""} onChange={(e) => setForm({ ...form, [fields[1]]: e.target.value })} placeholder={labels[1]} className={inputCls} data-testid={`${testid}-b`} />
        <button onClick={add} className="bg-plum text-white rounded-md px-4 text-sm flex items-center gap-1 shrink-0" data-testid={`add-${testid}`}><Plus size={15} /></button>
      </div>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2">
            <span className="text-gray-700"><b>{it[fields[0]]}</b> → {it[fields[1]]}</span>
            <button onClick={() => del(it)} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
          </div>
        ))}
        {items.length === 0 && <Empty text="No rules yet" />}
      </div>
    </div>
  );
}
