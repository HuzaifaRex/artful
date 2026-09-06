import React, { useState } from "react";
import { Search, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Empty } from "./ui";

export function KpiCards({ cards }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow" data-testid={`kpi-${c.label.toLowerCase().replace(/\s/g, "-")}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{c.label}</span>
            {c.icon && <span className="w-8 h-8 rounded-lg bg-plum/10 text-plum flex items-center justify-center"><c.icon size={16} /></span>}
          </div>
          <p className="text-2xl font-semibold text-gray-900 mt-2">{c.value}</p>
          {c.sub && <p className="text-xs text-gray-400 mt-1">{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}

// Reusable data table: search + dropdown filters + pagination + optional row click.
export function DataTable({
  columns, rows, loading, q, setQ, searchPlaceholder = "Search…",
  filters = [], page = 1, pages = 1, setPage, onRowClick, empty = "Nothing here yet",
  onExport, testid = "table",
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {setQ && (
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder}
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-plum/30 focus:border-plum"
              data-testid={`${testid}-search`} />
          </div>
        )}
        {filters.map((f) => (
          <select key={f.key} value={f.value} onChange={(e) => f.onChange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-plum/30"
            data-testid={`${testid}-filter-${f.key}`}>
            <option value="">{f.label}</option>
            {f.options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
          </select>
        ))}
        {onExport && (
          <button onClick={onExport} className="ml-auto border border-gray-300 rounded-lg px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50" data-testid={`${testid}-export`}>
            <Download size={15} /> Export
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs bg-gray-50 border-b border-gray-200">
                {columns.map((c) => <th key={c.key} className={`px-4 py-3 font-medium ${c.align === "right" ? "text-right" : ""}`}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50 animate-pulse">
                    {columns.map((c) => <td key={c.key} className="px-4 py-3"><div className="h-3 bg-gray-100 rounded w-2/3" /></td>)}
                  </tr>
                ))
              ) : rows.map((row, ri) => (
                <tr key={row.id || row.order_number || ri}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-gray-50 ${onRowClick ? "hover:bg-plum/5 cursor-pointer" : ""}`}
                  data-testid={`${testid}-row-${ri}`}>
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 text-gray-700 ${c.align === "right" ? "text-right" : ""} ${c.nowrap ? "whitespace-nowrap" : ""}`}>
                      {c.render ? c.render(row) : String(row[c.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && rows.length === 0 && <Empty text={empty} />}
      </div>

      {pages > 1 && setPage && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>Page {page} of {pages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="border border-gray-300 rounded-lg px-3 py-1.5 disabled:opacity-40 hover:bg-gray-50 flex items-center gap-1" data-testid={`${testid}-prev`}><ChevronLeft size={15} /> Prev</button>
            <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="border border-gray-300 rounded-lg px-3 py-1.5 disabled:opacity-40 hover:bg-gray-50 flex items-center gap-1" data-testid={`${testid}-next`}>Next <ChevronRight size={15} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
