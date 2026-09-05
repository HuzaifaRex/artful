import React from "react";
import { Link } from "react-router-dom";

const U = "https://images.unsplash.com/";
const IMG = {
  hero: U + "photo-1595351298020-038700609878?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600",
  a: U + "photo-1534953342533-7711c98712be?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
  b: U + "photo-1522065893269-6fd20f6d7438?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
};
const CHAPTERS = [
  ["The beginning", "ARTFUL began with a simple belief — that the most meaningful gifts carry a story. We set out to find objects with soul and share them with people who feel the same."],
  ["The makers", "We partner with independent artisans and small studios, championing slow, small-batch craft over mass production. Every piece reflects the hands that made it."],
  ["The gift", "We obsess over the unboxing — considered packaging, a handwritten note, the option to make it personal. Because giving should feel as beautiful as receiving."],
];

export default function OurStoryPage() {
  return (
    <div data-testid="our-story-page">
      <section className="relative min-h-[56vh] flex items-end bg-plum-wine text-cream overflow-hidden">
        <img src={IMG.hero} alt="Our Story" className="absolute inset-0 w-full h-full object-cover opacity-45" />
        <div className="container-artful relative py-16">
          <p className="label-caption !text-gold-soft mb-4">Our Story</p>
          <h1 className="font-serif text-4xl sm:text-6xl font-light max-w-2xl leading-tight">Crafted with intention, given with love.</h1>
        </div>
      </section>

      <section className="container-artful py-16 lg:py-24 space-y-20">
        {CHAPTERS.map(([t, d], i) => (
          <div key={i} className={`grid lg:grid-cols-2 gap-12 lg:gap-20 items-center ${i % 2 ? "lg:[direction:rtl]" : ""}`}>
            <div className="relative aspect-[4/3] overflow-hidden hover-zoom [direction:ltr]"><img src={i % 2 ? IMG.b : IMG.a} alt={t} className="w-full h-full object-cover" /></div>
            <div className="[direction:ltr]">
              <span className="font-serif text-6xl text-plum/15">0{i + 1}</span>
              <h2 className="section-title -mt-6 mb-5">{t}</h2>
              <p className="text-ink-secondary text-lg leading-relaxed">{d}</p>
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
