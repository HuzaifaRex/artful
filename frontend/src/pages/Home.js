import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { api } from "../lib/api";
import ProductCard from "../components/ProductCard";
import { ProductSkeleton } from "../components/Loader";
import { getIcon } from "../lib/icons";
import CategoryMarquee from "../components/CategoryMarquee";

/* ---------------- HERO CAROUSEL (admin-controlled slides + trust badges) ---------------- */
function TrustBadges({ badges }) {
  if (!badges?.length) return null;
  return (
    <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 animate-fadeUp" style={{ animationDelay: "340ms" }} data-testid="hero-trust-badges">
      {badges.map((b, i) => {
        const IconCmp = getIcon(b.icon);
        return (
          <div key={i} className="flex items-center gap-2.5 bg-cream/10 backdrop-blur-sm border border-cream/15 rounded-full pl-2.5 pr-4 py-1.5">
            <span className="w-7 h-7 rounded-full bg-gold/90 text-plum-wine flex items-center justify-center shrink-0"><IconCmp size={15} /></span>
            <span className="text-xs sm:text-[13px] font-medium text-cream">{b.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function HeroCarousel({ section }) {
  const slides = section.slides?.length ? section.slides : [{
    heading: section.heading, subheading: section.subheading, image: section.image,
    eyebrow: "Artisanal · Handcrafted · Gifting", cta_text: section.cta_text, cta_link: section.cta_link,
    cta_secondary_text: section.cta_secondary_text, cta_secondary_link: section.cta_secondary_link, badges: [],
  }];
  const [emblaRef, embla] = useEmblaCarousel({ loop: true, duration: 30 });
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setSelected(embla.selectedScrollSnap());
    embla.on("select", onSelect); onSelect();
    const timer = setInterval(() => embla.scrollNext(), 6000);
    return () => { clearInterval(timer); embla.off("select", onSelect); };
  }, [embla]);

  return (
    <section className="relative bg-plum-wine text-cream overflow-hidden" data-testid="hero-section">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {slides.map((s, idx) => (
            <div key={s.id || idx} className="relative flex-[0_0_100%] min-w-0">
              <div className="grid lg:grid-cols-2 min-h-[78vh] lg:min-h-[86vh]">
                <div className="flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-16 order-2 lg:order-1">
                  {s.eyebrow && <p className="label-caption !text-gold-soft mb-6 animate-fadeUp">{s.eyebrow}</p>}
                  <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-light leading-[1.05] tracking-tight animate-fadeUp" style={{ animationDelay: "80ms" }}>{s.heading}</h1>
                  <p className="mt-6 text-cream/75 text-base sm:text-lg max-w-md leading-relaxed animate-fadeUp" style={{ animationDelay: "160ms" }}>{s.subheading}</p>
                  <div className="mt-10 flex flex-wrap gap-4 animate-fadeUp" style={{ animationDelay: "240ms" }}>
                    <Link to={s.cta_link || "/shop"} className="bg-gold text-plum-wine text-xs font-medium uppercase tracking-widest2 px-9 py-4 hover:bg-gold-soft transition-colors" data-testid={`hero-primary-cta-${idx}`}>{s.cta_text || "Shop Now"}</Link>
                    {s.cta_secondary_text && <Link to={s.cta_secondary_link || "/collections"} className="border border-cream/40 text-cream text-xs font-medium uppercase tracking-widest2 px-9 py-4 hover:bg-cream hover:text-plum-wine transition-colors" data-testid={`hero-secondary-cta-${idx}`}>{s.cta_secondary_text}</Link>}
                  </div>
                  <TrustBadges badges={s.badges} />
                </div>
                <div className="relative order-1 lg:order-2 min-h-[42vh] lg:min-h-full">
                  <img src={s.image} alt={s.heading} className="absolute inset-0 w-full h-full object-cover" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {slides.length > 1 && (
        <>
          <button onClick={() => embla && embla.scrollPrev()} className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-cream/15 backdrop-blur hover:bg-gold hover:text-plum-wine text-cream items-center justify-center transition-colors z-10" data-testid="hero-prev" aria-label="Previous"><ChevronLeft size={20} /></button>
          <button onClick={() => embla && embla.scrollNext()} className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-cream/15 backdrop-blur hover:bg-gold hover:text-plum-wine text-cream items-center justify-center transition-colors z-10" data-testid="hero-next" aria-label="Next"><ChevronRight size={20} /></button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2.5 z-10" data-testid="hero-dots">
            {slides.map((_, i) => (
              <button key={i} onClick={() => embla && embla.scrollTo(i)} className={`h-2 rounded-full transition-all duration-300 ${selected === i ? "w-8 bg-gold" : "w-2 bg-cream/40 hover:bg-cream/70"}`} aria-label={`Slide ${i + 1}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/* ---------------- OTHER SECTIONS ---------------- */
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-10">
        {!items ? [0, 1, 2, 3].map((i) => <ProductSkeleton key={i} />)
          : items.slice(0, 4).map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
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
        {cats.slice(0, 8).map((c, i) => {
          const IconCmp = getIcon(c.icon);
          return (
            <Link key={c.slug} to={`/categories/${c.slug}`} className="group relative overflow-hidden aspect-[3/4] hover-zoom animate-fadeUp" style={{ animationDelay: `${(i % 4) * 60}ms` }} data-testid={`category-${c.slug}`}>
              <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-plum-wine/85 via-plum-wine/15 to-transparent" />
              <div className="absolute top-4 left-4 w-9 h-9 rounded-full bg-cream/90 text-plum flex items-center justify-center opacity-0 group-hover:opacity-100 -translate-y-1 group-hover:translate-y-0 transition-all duration-300"><IconCmp size={17} /></div>
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <h3 className="font-serif text-xl text-cream leading-tight">{c.name}</h3>
                <span className="text-cream/70 text-xs">{c.product_count} pieces</span>
              </div>
            </Link>
          );
        })}
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

/* Redesigned "Why ARTFUL" — eye-catching cards with icons & hover accents */
function ValuesSection({ s }) {
  return (
    <section className="relative bg-plum text-cream py-20 lg:py-28 overflow-hidden" data-testid="why-artful-section">
      <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-accent/10 blur-3xl" />
      <div className="container-artful relative">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="label-caption !text-gold-soft mb-4">The ARTFUL Difference</p>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-light">{s.heading}</h2>
          {s.subheading && <p className="text-cream/70 mt-4">{s.subheading}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
          {(s.items || []).map((v, i) => {
            const IconCmp = getIcon(v.icon);
            return (
              <div key={i} className="group relative bg-cream/[0.06] hover:bg-cream/[0.1] border border-cream/10 rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1.5 animate-fadeUp" style={{ animationDelay: `${i * 80}ms` }} data-testid={`value-card-${i}`}>
                <div className="w-14 h-14 rounded-full bg-gold/90 text-plum-wine flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300"><IconCmp size={24} /></div>
                <span className="absolute top-6 right-7 font-serif text-4xl text-cream/10 group-hover:text-gold/25 transition-colors">0{i + 1}</span>
                <h3 className="font-serif text-xl mb-2">{v.title}</h3>
                <p className="text-cream/65 text-sm leading-relaxed">{v.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* Replaces the old newsletter block — a meaningful trust/promise band */
function PromiseSection({ s }) {
  return (
    <section className="container-artful py-16 lg:py-24" data-testid="artful-promise-section">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h2 className="section-title">{s.heading}</h2>
        {s.subheading && <p className="text-ink-secondary mt-3">{s.subheading}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {(s.items || []).map((it, i) => {
          const IconCmp = getIcon(it.icon);
          return (
            <div key={i} className="flex items-start gap-4 p-6 rounded-2xl border border-line bg-surface hover:border-plum transition-colors animate-fadeUp" style={{ animationDelay: `${i * 70}ms` }} data-testid={`promise-card-${i}`}>
              <span className="w-11 h-11 rounded-full bg-plum-light text-plum flex items-center justify-center shrink-0"><IconCmp size={20} /></span>
              <div><h3 className="text-sm font-semibold text-ink">{it.title}</h3><p className="text-xs text-ink-muted mt-1 leading-relaxed">{it.desc}</p></div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function Home() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/cms/homepage").then(({ data }) => setData(data)).catch(() => setData({ sections: [] })); }, []);
  if (!data) return <div className="min-h-screen" />;

  const heroSection = data.sections.find((s) => s.type === "hero");

  return (
    <div>
      {heroSection && <HeroCarousel section={heroSection} />}
      <CategoryMarquee />
      {data.sections.map((s) => {
        switch (s.type) {
          case "hero": return null; // rendered above, marquee follows
          case "categories": return <CategoriesSection key={s.id} s={s} />;
          case "product_rail": return <ProductRail key={s.id} heading={s.heading} subheading={s.subheading} collectionSlug={s.collection_slug} />;
          case "occasion": return <OccasionSection key={s.id} s={s} />;
          case "banner": return <BannerSection key={s.id} s={s} />;
          case "story": return <StorySection key={s.id} s={s} />;
          case "values": return <ValuesSection key={s.id} s={s} />;
          case "promise": return <PromiseSection key={s.id} s={s} />;
          default: return null;
        }
      })}
    </div>
  );
}
