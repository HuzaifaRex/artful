import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, TrendingUp } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { api } from "../lib/api";
import { inr } from "../lib/utils";

const POPULAR = ["Candles", "Personalized gifts", "Birthday gifts", "Journals", "Gifts for her"];

export default function SearchOverlay() {
  const { searchOpen, setSearchOpen } = useStore();
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const inputRef = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 100);
    else { setQ(""); setRes(null); }
  }, [searchOpen]);

  useEffect(() => {
    if (!q || q.length < 2) { setRes(null); return; }
    const t = setTimeout(async () => {
      try { const { data } = await api.get(`/search/autocomplete?q=${encodeURIComponent(q)}`); setRes(data); }
      catch { setRes(null); }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const go = (term) => {
    setSearchOpen(false);
    navigate(`/search?q=${encodeURIComponent(term)}`);
  };

  if (!searchOpen) return null;
  return (
    <div className="fixed inset-0 z-50" data-testid="search-overlay">
      <div className="absolute inset-0 bg-black/50" onClick={() => setSearchOpen(false)} />
      <div className="relative bg-cream max-h-[85vh] overflow-y-auto animate-fadeIn">
        <div className="container-artful py-6">
          <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) go(q.trim()); }} className="flex items-center gap-4 border-b-2 border-plum pb-4">
            <Search size={24} className="text-plum" />
            <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for gifts, candles, journals…" className="flex-1 bg-transparent text-xl sm:text-2xl font-serif focus:outline-none text-ink placeholder:text-ink-muted" data-testid="search-input-field" />
            <button type="button" onClick={() => setSearchOpen(false)} className="text-plum" data-testid="search-close"><X size={24} /></button>
          </form>

          <div className="py-8">
            {!res && (
              <div>
                <p className="label-caption mb-4 flex items-center gap-2"><TrendingUp size={14} /> Popular Searches</p>
                <div className="flex flex-wrap gap-3">
                  {POPULAR.map((p) => (
                    <button key={p} onClick={() => go(p)} className="px-4 py-2 border border-line text-sm text-ink-secondary hover:border-plum hover:text-plum transition-colors" data-testid={`popular-${p.toLowerCase().replace(/\s/g, "-")}`}>{p}</button>
                  ))}
                </div>
              </div>
            )}
            {res && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2">
                  <p className="label-caption mb-4">Products</p>
                  {res.products.length === 0 ? <p className="text-ink-muted text-sm">No products found. Try a broader term.</p> : (
                    <div className="space-y-3">
                      {res.products.map((p) => (
                        <button key={p.id} onClick={() => { setSearchOpen(false); navigate(`/products/${p.slug}`); }} className="flex items-center gap-4 w-full text-left hover:bg-surface p-2 transition-colors" data-testid={`search-result-${p.slug}`}>
                          <img src={p.image} alt={p.name} className="w-14 h-16 object-cover bg-surface" />
                          <div className="flex-1"><p className="font-serif text-base text-ink">{p.name}</p><p className="text-sm text-plum">{inr(p.price)}</p></div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-8">
                  {res.categories.length > 0 && (
                    <div>
                      <p className="label-caption mb-4">Categories</p>
                      <div className="space-y-2">
                        {res.categories.map((c) => (
                          <button key={c.slug} onClick={() => { setSearchOpen(false); navigate(`/categories/${c.slug}`); }} className="block text-sm text-ink-secondary hover:text-plum">{c.name} <span className="text-ink-muted">({c.product_count})</span></button>
                        ))}
                      </div>
                    </div>
                  )}
                  {res.suggestions.length > 0 && (
                    <div>
                      <p className="label-caption mb-4">Suggestions</p>
                      <div className="space-y-2">
                        {res.suggestions.slice(0, 5).map((s) => (
                          <button key={s} onClick={() => go(s)} className="block text-sm text-ink-secondary hover:text-plum text-left">{s}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button onClick={() => go(q)} className="btn-ghost !px-0">See all results for "{q}" →</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
