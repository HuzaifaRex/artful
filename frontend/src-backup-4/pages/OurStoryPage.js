import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

const FALLBACK = {
  hero_eyebrow: "Our Story",
  hero_title: "Crafted with intention, given with love.",
  hero_image: "https://images.unsplash.com/photo-1595351298020-038700609878?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600",
  body_html: "",
  chapters: [],
};

export default function OurStoryPage() {
  const [p, setP] = useState(null);
  useEffect(() => { api.get("/cms/page/our-story").then(({ data }) => setP(data)).catch(() => setP(FALLBACK)); }, []);
  const d = p || FALLBACK;
  const chapters = d.chapters || [];

  return (
    <div data-testid="our-story-page">
      <section className="relative min-h-[56vh] flex items-end bg-plum-wine text-cream overflow-hidden">
        {d.hero_image && <img src={d.hero_image} alt="Our Story" className="absolute inset-0 w-full h-full object-cover opacity-45" />}
        <div className="container-artful relative py-16">
          <p className="label-caption !text-gold-soft mb-4">{d.hero_eyebrow}</p>
          <h1 className="font-serif text-4xl sm:text-6xl font-light max-w-2xl leading-tight">{d.hero_title}</h1>
        </div>
      </section>

      {d.body_html && (
        <section className="container-artful pt-16 lg:pt-24 max-w-3xl">
          <div className="prose prose-lg max-w-none text-ink-secondary" data-testid="story-body" dangerouslySetInnerHTML={{ __html: d.body_html }} />
        </section>
      )}

      <section className="container-artful py-16 lg:py-24 space-y-20">
        {chapters.map((c, i) => (
          <div key={i} className={`grid lg:grid-cols-2 gap-12 lg:gap-20 items-center ${i % 2 ? "lg:[direction:rtl]" : ""}`}>
            {c.image && <div className="relative aspect-[4/3] overflow-hidden hover-zoom [direction:ltr]"><img src={c.image} alt={c.title} className="w-full h-full object-cover" /></div>}
            <div className="[direction:ltr]">
              <span className="font-serif text-6xl text-plum/15">0{i + 1}</span>
              <h2 className="section-title -mt-6 mb-5">{c.title}</h2>
              <p className="text-ink-secondary text-lg leading-relaxed">{c.desc}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="bg-plum text-cream py-16 text-center">
        <div className="container-artful">
          <h2 className="font-serif text-3xl sm:text-4xl font-light mb-6">Every ARTFUL piece begins a new story.</h2>
          <Link to="/shop" className="inline-flex bg-gold text-plum-wine text-xs font-medium uppercase tracking-widest2 px-9 py-4 hover:bg-gold-soft transition-colors">Explore the Collection</Link>
        </div>
      </section>
    </div>
  );
}
