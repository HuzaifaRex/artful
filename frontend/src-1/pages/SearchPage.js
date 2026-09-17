import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import ProductCard from "../components/ProductCard";
import { PageLoader } from "../components/Loader";

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!q) { setData({ results: [], total: 0 }); return; }
    setData(null);
    api.get(`/search?q=${encodeURIComponent(q)}`).then(({ data }) => setData(data)).catch(() => setData({ results: [], total: 0 }));
  }, [q]);

  const searchInstead = () => setParams({ q: data.original_query, force: "1" });

  return (
    <div className="container-artful py-12 min-h-[60vh]">
      {!data ? <PageLoader /> : (
        <>
          <div className="mb-10 border-b border-line pb-8">
            {data.corrected_query ? (
              <>
                <h1 className="section-title">Showing results for "{data.corrected_query}"</h1>
                <p className="text-ink-muted mt-2 text-sm">Search instead for <button onClick={searchInstead} className="text-accent underline" data-testid="search-instead">"{data.original_query}"</button></p>
              </>
            ) : (
              <h1 className="section-title">Results for "{q}"</h1>
            )}
            <p className="text-ink-muted mt-2 text-sm" data-testid="search-count">{data.total} product{data.total !== 1 ? "s" : ""} found</p>
            {data.detected && (data.detected.recipient || data.detected.occasion || data.detected.max_price) && (
              <div className="flex flex-wrap gap-2 mt-4">
                {data.detected.occasion && <span className="text-xs bg-plum-light text-plum px-3 py-1 capitalize">Occasion: {data.detected.occasion}</span>}
                {data.detected.recipient && <span className="text-xs bg-plum-light text-plum px-3 py-1 capitalize">For: {data.detected.recipient}</span>}
                {data.detected.max_price && <span className="text-xs bg-plum-light text-plum px-3 py-1">Under ₹{data.detected.max_price}</span>}
              </div>
            )}
          </div>

          {data.results.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-10">
              {data.results.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="font-serif text-2xl text-plum mb-2">We couldn't find exactly what you're looking for.</p>
              <p className="text-ink-secondary mb-10">Here are some of our bestsellers you might love.</p>
              {data.fallback_suggestions?.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-10 text-left">
                  {data.fallback_suggestions.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
