import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Star, ShieldCheck, Truck, Award, Users } from "lucide-react";
import { api } from "../lib/api";
import ProductCard from "../components/ProductCard";
import { ProductSkeleton } from "../components/Loader";

function ProductRail({ heading, subheading, collectionSlug }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    api.get(`/products?collection=${collectionSlug}&page_size=8`).then(({ data }) => setItems(data.items)).catch(() => setItems([]));
  }, [collectionSlug]);
  return (
    <section className="container-artful py-16 lg:py-20" data-testid={`rail-${collectionSlug}`}>
      <div className="flex items-end justify-between mb-10">
        <div>
          <h2 className="section-title">{heading}</h2>
          {subheading && <p className="text-ink-secondary mt-2 max-w-md">{subheading}</p>}
        </div>
        <Link to={`/collections/${collectionSlug}`} className="btn-ghost !px-0 hidden sm:flex">View All <ArrowRight size={15} /></Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-10">
        {!items ? [0, 1, 2, 3].map((i) => <ProductSkeleton key={i} />)
          : items.slice(0, 4).map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
      </div>
    </section>
  );
}

function Hero({ s }) {
  return (
    <section className="relative bg-plum-wine text-cream overflow-hidden" data-testid="hero-section">
      <div className="grid lg:grid-cols-2 min-h-[78vh] lg:min-h-[86vh]">
        <div className="flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-16 order-2 lg:order-1">
          <p className="label-caption !text-gold-soft mb-6 animate-fadeUp">Artisanal · Handcrafted · Gifting</p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-light leading-[1.05] tracking-tight animate-fadeUp" style={{ animationDelay: "80ms" }}>{s.heading}</h1>
          <p className="mt-6 text-cream/75 text-base sm:text-lg max-w-md leading-relaxed animate-fadeUp" style={{ animationDelay: "160ms" }}>{s.subheading}</p>
          <div className="mt-10 flex flex-wrap gap-4 animate-fadeUp" style={{ animationDelay: "240ms" }}>
            <Link to={s.cta_link || "/shop"} className="bg-gold text-plum-wine text-xs font-medium uppercase tracking-widest2 px-9 py-4 hover:bg-gold-soft transition-colors" data-testid="hero-primary-cta">{s.cta_text}</Link>
            {s.cta_secondary_text && <Link to={s.cta_secondary_link || "/collections"} className="border border-cream/40 text-cream text-xs font-medium uppercase tracking-widest2 px-9 py-4 hover:bg-cream hover:text-plum-wine transition-colors" data-testid="hero-secondary-cta">{s.cta_secondary_text}</Link>}
          </div>
          <div className="mt-12 grid grid-cols-2 sm:flex sm:flex-wrap gap-x-8 gap-y-4 animate-fadeUp" style={{ animationDelay: "320ms" }} data-testid="hero-trust-badges">
            {[[Users, "1000+ Customers"], [ShieldCheck, "100% Trusted"], [Award, "Best Quality"], [Truck, "Fastest Delivery"], [Star, "4.5 Rating"]].map(([Icon, label], i) => (
              <div key={i} className="flex items-center gap-2 text-cream/80"><Icon size={18} className="text-gold-soft shrink-0" /><span className="text-xs sm:text-[13px] font-medium">{label}</span></div>
            ))}
          </div>
        </div>
        <div className="relative order-1 lg:order-2 min-h-[42vh] lg:min-h-full">
          <img src={s.image} alt="ARTFUL" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-plum-wine/40 to-transparent" />
        </div>
      </div>
    </section>
  );
}

function CategoriesSection({ s }) {
  const [cats, setCats] = useState([]);
  useEffect(() => { api.get("/categories").then(({ data }) => setCats(data.items)).catch(() => {}); }, []);
  return (
    <section className="container-artful py-16 lg:py-20">
      <div className="text-center mb-12"><h2 className="section-title">{s.heading}</h2>{s.subheading && <p className="text-ink-secondary mt-2">{s.subheading}</p>}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6" data-testid="featured-categories-grid">
        {cats.slice(0, 8).map((c, i) => (
          <Link key={c.slug} to={`/categories/${c.slug}`} className="group relative overflow-hidden aspect-[3/4] hover-zoom animate-fadeUp" style={{ animationDelay: `${(i % 4) * 60}ms` }} data-testid={`category-${c.slug}`}>
            <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-plum-wine/80 via-plum-wine/10 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <h3 className="font-serif text-xl text-cream leading-tight">{c.name}</h3>
              <span className="text-cream/70 text-xs">{c.product_count} pieces</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function OccasionSection({ s }) {
  return (
    <section className="bg-surface py-16 lg:py-20" data-testid="gift-by-occasion-section">
      <div className="container-artful text-center">
        <h2 className="section-title">{s.heading}</h2>
        <p className="text-ink-secondary mt-2 mb-10">{s.subheading}</p>
        <div className="flex flex-wrap justify-center gap-3">
          {(s.items || []).map((it) => (
            <Link key={it.label} to={it.link} className="px-7 py-3.5 bg-cream border border-line text-sm text-plum hover:bg-plum hover:text-white transition-colors" data-testid={`occasion-${it.label.toLowerCase()}`}>{it.label}</Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function BannerSection({ s }) {
  return (
    <section className="container-artful py-16 lg:py-20">
      <div className="relative overflow-hidden min-h-[380px] flex items-center hover-zoom" data-testid="featured-collection-banner">
        <img src={s.image} alt={s.heading} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-plum-wine/55" />
        <div className="relative px-8 sm:px-16 py-16 max-w-xl text-cream">
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-light leading-tight">{s.heading}</h2>
          <p className="mt-4 text-cream/80">{s.subheading}</p>
          <Link to={s.cta_link || "/shop"} className="inline-flex mt-8 bg-gold text-plum-wine text-xs font-medium uppercase tracking-widest2 px-8 py-4 hover:bg-gold-soft transition-colors">{s.cta_text}</Link>
        </div>
      </div>
    </section>
  );
}

function StorySection({ s }) {
  return (
    <section className="container-artful py-16 lg:py-24" data-testid="brand-story-vignette">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        <div className="relative aspect-[4/3] overflow-hidden hover-zoom"><img src={s.image} alt="story" className="w-full h-full object-cover" /></div>
        <div>
          <p className="label-caption mb-5">Our Story</p>
          <h2 className="section-title mb-6">{s.heading}</h2>
          <p className="text-ink-secondary text-lg leading-relaxed">{s.subheading}</p>
          <Link to={s.cta_link || "/our-story"} className="btn-outline mt-8">{s.cta_text}</Link>
        </div>
      </div>
    </section>
  );
}

function ValuesSection({ s }) {
  return (
    <section className="bg-plum text-cream py-16 lg:py-20">
      <div className="container-artful">
        <h2 className="font-serif text-3xl sm:text-4xl font-light text-center mb-14">{s.heading}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
          {(s.items || []).map((v, i) => (
            <div key={i} className="text-center">
              <div className="font-serif text-5xl text-gold-soft/40 mb-3">0{i + 1}</div>
              <h3 className="font-serif text-xl mb-2">{v.title}</h3>
              <p className="text-cream/65 text-sm leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function NewsletterSection({ s }) {
  return (
    <section className="container-artful py-20 text-center">
      <h2 className="section-title max-w-lg mx-auto">{s.heading}</h2>
      <p className="text-ink-secondary mt-3 mb-8">{s.subheading}</p>
      <form onSubmit={(e) => e.preventDefault()} className="flex max-w-md mx-auto">
        <input type="email" placeholder="Your email address" className="flex-1 border border-line px-4 py-4 text-sm focus:outline-none focus:border-plum" />
        <button className="btn-primary">Subscribe</button>
      </form>
    </section>
  );
}

export default function Home() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/cms/homepage").then(({ data }) => setData(data)).catch(() => setData({ sections: [] })); }, []);
  if (!data) return <div className="min-h-screen" />;

  return (
    <div>
      {data.sections.map((s) => {
        switch (s.type) {
          case "hero": return <Hero key={s.id} s={s} />;
          case "categories": return <CategoriesSection key={s.id} s={s} />;
          case "product_rail": return <ProductRail key={s.id} heading={s.heading} subheading={s.subheading} collectionSlug={s.collection_slug} />;
          case "occasion": return <OccasionSection key={s.id} s={s} />;
          case "banner": return <BannerSection key={s.id} s={s} />;
          case "story": return <StorySection key={s.id} s={s} />;
          case "values": return <ValuesSection key={s.id} s={s} />;
          case "newsletter": return <NewsletterSection key={s.id} s={s} />;
          default: return null;
        }
      })}
    </div>
  );
}
