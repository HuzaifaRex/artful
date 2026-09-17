import React from "react";
import { X } from "lucide-react";

export function StatusChip({ status }) {
  const map = {
    Active: "bg-emerald-100 text-emerald-800", Draft: "bg-gray-100 text-gray-700",
    "Out of Stock": "bg-red-100 text-red-800", Archived: "bg-gray-200 text-gray-600",
    Pending: "bg-amber-100 text-amber-800", Confirmed: "bg-sky-100 text-sky-800",
    Processing: "bg-sky-100 text-sky-800", Packed: "bg-indigo-100 text-indigo-800",
    Shipped: "bg-violet-100 text-violet-800", "Out for Delivery": "bg-violet-100 text-violet-800",
    Delivered: "bg-emerald-100 text-emerald-800", Cancelled: "bg-red-100 text-red-800",
    Returned: "bg-orange-100 text-orange-800", Refunded: "bg-gray-100 text-gray-700",
    Failed: "bg-red-100 text-red-800", New: "bg-sky-100 text-sky-800", VIP: "bg-amber-100 text-amber-800",
    Blocked: "bg-red-100 text-red-800", paid: "bg-emerald-100 text-emerald-800",
    created: "bg-amber-100 text-amber-800", cod_pending: "bg-amber-100 text-amber-800",
    cod_confirmed: "bg-emerald-100 text-emerald-800", Requested: "bg-amber-100 text-amber-800",
    Approved: "bg-emerald-100 text-emerald-800", Rejected: "bg-red-100 text-red-800", Completed: "bg-emerald-100 text-emerald-800",
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${map[status] || "bg-gray-100 text-gray-700"}`}>{status}</span>;
}

export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative bg-white rounded-lg shadow-xl w-full ${wide ? "max-w-3xl" : "max-w-lg"} my-8`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return <div><label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>{children}</div>;
}

export const inputCls = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-plum/30 focus:border-plum";

export function PageHead({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
      <div><h1 className="text-2xl font-semibold text-gray-900">{title}</h1>{subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}</div>
      {action}
    </div>
  );
}

export function Empty({ text }) {
  return <div className="text-center py-16 text-gray-400 text-sm">{text}</div>;
}
