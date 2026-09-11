import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { api } from "../lib/api";
import ProductCard from "./ProductCard";
import { ProductSkeleton } from "./Loader";
import { inr } from "../lib/utils";

const SORTS = [
  ["featured", "Featured"], ["newest", "Newest"], ["bestselling", "Bestselling"],
  ["price_asc", "Price: Low to High"], ["price_desc", "Price: High to Low"], ["rating", "Highest Rated"],
];
const OCCASIONS = ["birthday", "anniversary", "wedding", "housewarming", "festive", "corporate"];
const RECIPIENTS = ["her", "him", "couple", "colleague", "friend"];
const PRICE_BANDS = [["", "Any"], ["0-999", "Under ₹999"], ["1000-2000", "₹1,000 – ₹2,000"], ["2000-3500", "₹2,000 – ₹3,500"], ["3500-", "Above ₹3,500"]];

export default function Catalog({ fixed = {}, title, subtitle }) {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [cats, setCats] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  const page = parseInt(params.get("page") || "1");
  const sort = params.get("sort") || "featured";
  const category = fixed.category || params.get("category") || "";
  const occasion = params.get("occasion") || "";
  const recipient = params.get("recipient") || "";
  const priceBand = params.get("price") || "";
  const onSale = params.get("on_sale") === "1";

  useEffect(() => { api.get("/categories").then(({ data }) => setCats(data.items)).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setItems(null);
    const qp = new URLSearchParams();
    qp.set("page", page); qp.set("page_size", "12"); qp.set("sort", sort);
    if (category) qp.set("category", category);
    if (fixed.collection) qp.set("collection", fixed.collection);
    if (occasion) qp.set("occasion", occasion);
    if (recipient) qp.set("recipient", recipient);
    if (onSale) qp.set("on_sale", "true");
    if (priceBand) { const [mn, mx] = priceBand.split("-"); if (mn) qp.set("min_price", mn); if (mx) qp.set("max_price", mx); }
    try {
      const { data } = await api.get(`/products?${qp.toString()}`);
      setItems(data.items); setTotal(data.total); setPages(data.pages);
    } catch { setItems([]); }
  }, [page, sort, category, occasion, recipient, priceBand, onSale, fixed.collection]);

  useEffect(() => { load(); }, [load]);

  const update = (key, val) => {
    const next = new URLSearchParams(params);
    if (val) next.set(key, val); else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };
  const clearAll = () => {
    const next = new URLSearchParams();
    if (params.get("sort")) next.set("sort", params.get("sort"));
    setParams(next);
  };
  const activeCount = [occasion, recipient, priceBand, onSale ? "1" : "", fixed.category ? "" : category].filter(Boolean).length;

  const FilterPanel = () => (
    <div className="space-y-8">
      {!fixed.category && (
        <div>
          <p className="label-caption mb-4">Category</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => update("category", "")}
              className={`px-3 py-1.5 text-xs border capitalize transition-colors ${
                !category ? "bg-plum text-white border-plum" : "border-line text-ink-secondary hover:border-plum hover:text-plum"
              }`}
              data-testid="filter-cat-all"
            >
              All
            </button>
            {cats.map((c) => (
              <button
                key={c.slug}
                onClick={() => update("category", c.slug)}
                className={`px-3 py-1.5 text-xs border capitalize transition-colors ${
                  category === c.slug ? "bg-plum text-white border-plum" : "border-line text-ink-secondary hover:border-plum hover:text-plum"
                }`}
                data-testid={`filter-cat-${c.slug}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="label-caption mb-4">Price</p>
        <div className="flex flex-wrap gap-2">
          {PRICE_BANDS.map(([v, l]) => (
            <button
              key={v}
              onClick={() => update("price", v)}
              className={`px-3 py-1.5 text-xs border transition-colors ${
                priceBand === v ? "bg-plum text-white border-plum" : "border-line text-ink-secondary hover:border-plum hover:text-plum"
              }`}
              data-testid={`filter-price-${v || "any"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="label-caption mb-4">Occasion</p>
        <div className="flex flex-wrap gap-2">
          {OCCASIONS.map((o) => (
            <button key={o} onClick={() => update("occasion", occasion === o ? "" : o)} className={`px-3 py-1.5 text-xs border capitalize transition-colors ${occasion === o ? "bg-plum text-white border-plum" : "border-line text-ink-secondary hover:border-plum hover:text-plum"}`}>{o}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="label-caption mb-4">Recipient</p>
        <div className="flex flex-wrap gap-2">
          {RECIPIENTS.map((r) => (
            <button key={r} onClick={() => update("recipient", recipient === r ? "" : r)} className={`px-3 py-1.5 text-xs border capitalize transition-colors ${recipient === r ? "bg-plum text-white border-plum" : "border-line text-ink-secondary hover:border-plum hover:text-plum"}`}>For {r}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="label-caption mb-4">Availability</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => update("on_sale", onSale ? "" : "1")}
            className={`px-3 py-1.5 text-xs border transition-colors ${
              onSale ? "bg-plum text-white border-plum" : "border-line text-ink-secondary hover:border-plum hover:text-plum"
            }`}
            data-testid="filter-onsale"
          >
            On Sale
          </button>
        </div>
      </div>
      {activeCount > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="px-3 py-1.5 text-xs border border-line text-ink-secondary hover:border-plum hover:text-plum transition-colors"
          data-testid="clear-filters"
        >
          Clear Filters
        </button>
      )}
    </div>
  );

  return (
    <div>
      <div className="bg-surface py-12 lg:py-16">
        <div className="container-artful text-center">
          <h1 className="section-title">{title || "Shop All"}</h1>
          {subtitle && <p className="text-ink-secondary mt-3 max-w-xl mx-auto">{subtitle}</p>}
        </div>
      </div>
      <div className="container-artful py-10">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-line">
          <div className="flex items-center gap-4">
            <button onClick={() => setShowFilters(true)} className="lg:hidden flex items-center gap-2 text-sm text-plum" data-testid="filter-toggle"><SlidersHorizontal size={16} /> Filters {activeCount > 0 && `(${activeCount})`}</button>
            <p className="text-sm text-ink-muted hidden sm:block">{total} products</p>
          </div>
          <div className="relative">
            <select value={sort} onChange={(e) => update("sort", e.target.value)} className="appearance-none bg-transparent border border-line pl-4 pr-10 py-2.5 text-sm text-ink focus:outline-none focus:border-plum cursor-pointer" data-testid="sort-select">
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
          </div>
        </div>

        <div className="flex gap-10">
          <aside className="hidden lg:block w-56 shrink-0"><FilterPanel /></aside>
          <div className="flex-1 min-w-0">
            {items === null ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-10">{[...Array(6)].map((_, i) => <ProductSkeleton key={i} />)}</div>
            ) : items.length === 0 ? (
              <div className="text-center py-24"><p className="font-serif text-2xl text-plum mb-2">No products found</p><p className="text-ink-secondary">Try adjusting your filters.</p><button onClick={clearAll} className="btn-outline mt-6">Clear Filters</button></div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-10" data-testid="product-catalog-grid">
                  {items.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
                </div>
                {pages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-14">
                    {[...Array(pages)].map((_, i) => (
                      <button key={i} onClick={() => update("page", String(i + 1))} className={`w-10 h-10 text-sm ${page === i + 1 ? "bg-plum text-white" : "border border-line text-ink-secondary hover:border-plum"}`} data-testid={`page-${i + 1}`}>{i + 1}</button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowFilters(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-[85%] max-w-xs bg-cream p-6 overflow-y-auto animate-slideIn">
            <div className="flex items-center justify-between mb-6"><h3 className="font-serif text-2xl text-plum">Filters</h3><button onClick={() => setShowFilters(false)}><X size={22} className="text-plum" /></button></div>
            <FilterPanel />
            <button onClick={() => setShowFilters(false)} className="btn-primary w-full mt-8">Show {total} Results</button>
          </div>
        </div>
      )}
    </div>
  );
}
