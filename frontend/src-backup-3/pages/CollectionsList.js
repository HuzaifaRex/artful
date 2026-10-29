import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

export default function CollectionsList() {
  const [cols, setCols] = useState([]);
  useEffect(() => { api.get("/collections").then(({ data }) => setCols(data.items)).catch(() => {}); }, []);
  return (
    <div>
      <div className="bg-surface py-12 lg:py-16"><div className="container-artful text-center"><h1 className="section-title">Collections</h1><p className="text-ink-secondary mt-3">Curated edits for every occasion and every kind of gifting.</p></div></div>
      <div className="container-artful py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cols.map((c, i) => (
            <Link key={c.slug} to={`/collections/${c.slug}`} className="group relative overflow-hidden aspect-[4/3] hover-zoom animate-fadeUp" style={{ animationDelay: `${(i % 3) * 70}ms` }} data-testid={`collection-${c.slug}`}>
              <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-plum-wine/45 group-hover:bg-plum-wine/55 transition-colors" />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-cream p-6">
                <h3 className="font-serif text-2xl lg:text-3xl">{c.name}</h3>
                <p className="text-cream/75 text-sm mt-2 max-w-xs">{c.description}</p>
                <span className="mt-4 text-xs uppercase tracking-widest2 border-b border-cream/60 pb-0.5">Explore</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
