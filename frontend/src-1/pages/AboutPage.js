import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Icon } from "../lib/icons";

const FALLBACK = {
  hero_eyebrow: "About ARTFUL",
  hero_title: "Art, emotion and thoughtful gifting — together.",
  hero_image: "https://images.unsplash.com/photo-1766499670904-edab815e8fe3?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600",
  body_html: "",
  cards: [],
};

export default function AboutPage() {
  const [p, setP] = useState(null);
  useEffect(() => { api.get("/cms/page/about").then(({ data }) => setP(data)).catch(() => setP(FALLBACK)); }, []);
  const d = p || FALLBACK;
  const cards = d.cards || [];

  return (
    <div data-testid="about-page">
      <section className="relative min-h-[52vh] flex items-center bg-plum-wine text-cream overflow-hidden">
        {d.hero_image && <img src={d.hero_image} alt="ARTFUL" className="absolute inset-0 w-full h-full object-cover opacity-40" />}
        <div className="container-artful relative py-20">
          <p className="label-caption !text-gold-soft mb-4">{d.hero_eyebrow}</p>
          <h1 className="font-serif text-4xl sm:text-6xl font-light max-w-2xl leading-tight">{d.hero_title}</h1>
        </div>
      </section>

      {d.body_html && (
        <section className="container-artful py-16 lg:py-24 max-w-3xl">
          <div className="prose prose-lg max-w-none text-ink-secondary" data-testid="about-body" dangerouslySetInnerHTML={{ __html: d.body_html }} />
        </section>
      )}

      {cards.length > 0 && (
        <section className="bg-surface py-16 lg:py-20">
          <div className="container-artful">
            <h2 className="section-title text-center mb-14">What we stand for</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
              {cards.map((c, i) => (
                <div key={i} className="text-center"><Icon name={c.icon} size={30} className="mx-auto text-plum mb-4" strokeWidth={1.4} /><h3 className="font-serif text-xl text-ink mb-2">{c.title}</h3><p className="text-sm text-ink-secondary leading-relaxed">{c.desc}</p></div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="container-artful py-20 text-center">
        <h2 className="section-title max-w-xl mx-auto mb-6">Discover something worth giving</h2>
        <div className="flex flex-wrap justify-center gap-4"><Link to="/shop" className="btn-primary">Shop the Collection</Link><Link to="/our-story" className="btn-outline">Read Our Story</Link></div>
      </section>
    </div>
  );
}
