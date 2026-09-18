import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function inr(value) {
  if (value == null || isNaN(value)) return "₹0";
  return "₹" + Number(value).toLocaleString("en-IN");
}

export function getBulkUnitPrice(product, qty) {
  const base = Number(product?.price || 0);
  const cfg = product?.bulk_order || {};
  if (!cfg.enabled || !Array.isArray(cfg.tiers) || !cfg.tiers.length) return base;
  const minQty = Number(cfg.min_quantity || 0);
  if (minQty <= 0 || Number(qty || 0) < minQty) return base;
  const applicable = cfg.tiers
    .map((t) => ({ min_quantity: Number(t.min_quantity || 0), price: Number(t.price || 0) }))
    .filter((t) => t.min_quantity >= minQty && t.min_quantity <= Number(qty || 0) && t.price > 0)
    .sort((a, b) => b.min_quantity - a.min_quantity);
  return applicable[0]?.price || base;
}

export function discountPct(price, compareAt) {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

export function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export function formatDateTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

// ---------------- Validation helpers ----------------
export function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim());
}
// Indian mobile: 10 digits starting 6-9 (optionally +91 prefix)
export function isValidPhone(v) {
  const d = (v || "").replace(/\D/g, "").replace(/^91/, "");
  return /^[6-9]\d{9}$/.test(d);
}
export function isValidPincode(v) {
  return /^[1-9]\d{5}$/.test((v || "").trim());
}
// Keep only digits, cap length (used for mobile inputs)
export function sanitizePhone(v, max = 10) {
  return (v || "").replace(/\D/g, "").slice(0, max);
}
// Sum of gift-wrap charges across priced line items
export function giftWrapTotal(items) {
  return (items || []).reduce((s, i) => s + (i.gift_wrap ? (i.wrap_price || 0) : 0), 0);
}

// Indian States & UTs for address dropdowns
export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];
