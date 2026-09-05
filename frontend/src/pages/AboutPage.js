import React from "react";
import { Link } from "react-router-dom";
import { Sparkles, HandHeart, Gift, Leaf } from "lucide-react";

const U = "https://images.unsplash.com/";
const IMG = {
  hero: U + "photo-1766499670904-edab815e8fe3?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600",
  a: U + "photo-1590605095243-072811dbe64c?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
  b: U + "photo-1522065893269-6fd20f6d7438?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000",
};
const VALUES = [
  [Sparkles, "Artful by design", "Every object is chosen for its craft, character and quiet beauty."],
  [HandHeart, "Made by makers", "We work directly with independent artisans and small studios."],
  [Gift, "Made to be given", "Thoughtful packaging and personalization on every eligible piece."],
  [Leaf, "Made to last", "Considered materials, chosen to be kept and treasured."],
];

export default function AboutPage() {
  return (
    <div data-testid="about-page">
      <section className="relative min-h-[52vh] flex items-center bg-plum-wine text-cream overflow-hidden">
        <img src={IMG.hero} alt="ARTFUL" className="absolute inset-0 w-full h-full object-cover opacity-40" />
        <div className="container-artful relative py-20">
          <p className="label-caption !text-gold-soft mb-4">About ARTFUL</p>
          <h1 className="font-serif text-4xl sm:text-6xl font-light max-w-2xl leading-tight">Art, emotion and thoughtful gifting — together.</h1>
        </div>
      </section>

      <section className="container-artful py-16 lg:py-24 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        <div className="relative aspect-[4/3] overflow-hidden hover-zoom"><img src={IMG.a} alt="craft" className="w-full h-full object-cover" /></div>
        <div>
          <h2 className="section-title mb-6">A home for beautiful, meaningful objects</h2>
          <p className="text-ink-secondary text-lg leading-relaxed">ARTFUL curates handcrafted lifestyle pieces and bespoke gift boxes designed to be given and treasured. We believe the most meaningful gifts carry a story — of the hands that made them and the moment they mark.</p>
          <p className="text-ink-secondary text-lg leading-relaxed mt-4">From hand-thrown ceramics to personalized keepsakes, each piece is chosen for its craft and quiet beauty.</p>
        </div>
      </section>

      <section className="bg-surface py-16 lg:py-20">
        <div className="container-artful">
          <h2 className="section-title text-center mb-14">What we stand for</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {VALUES.map(([Icon, t, d], i) => (
              <div key={i} className="text-center"><Icon size={30} className="mx-auto text-plum mb-4" strokeWidth={1.4} /><h3 className="font-serif text-xl text-ink mb-2">{t}</h3><p className="text-sm text-ink-secondary leading-relaxed">{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-artful py-20 text-center">
        <h2 className="section-title max-w-xl mx-auto mb-6">Discover something worth giving</h2>
        <div className="flex flex-wrap justify-center gap-4"><Link to="/shop" className="btn-primary">Shop the Collection</Link><Link to="/our-story" className="btn-outline">Read Our Story</Link></div>
      </section>
    </div>
  );
}
