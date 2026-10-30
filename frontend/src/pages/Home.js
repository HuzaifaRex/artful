import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { api } from "../lib/api";
import ProductCard from "../components/ProductCard";
import { ProductSkeleton } from "../components/Loader";
import { getIcon } from "../lib/icons";
import CategoryMarquee from "../components/CategoryMarquee";

/* ---------------- MEDIA-ONLY HERO CAROUSEL (admin controlled) ---------------- */
function safeDestination(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^javascript:/i.test(url)) return "";
  if (url.startsWith("/") || url.startsWith("#")) return url;
  try { const parsed = new URL(url, window.location.origin); return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : ""; } catch { return ""; }
}

function MobileCategoryCircles() {
  const [cats, setCats] = useState([]);
  useEffect(() => { api.get("/categories").then(({ data }) => setCats(data.items || [])).catch(() => setCats([])); }, []);
  if (!cats.length) return null;
  return (
    <section className="artful-mobile-categories px-3 " aria-label="Shop by category" data-testid="mobile-category-circles">
      <div className="artful-mobile-category-track hide-scrollbar">
        {cats.map((c) => <Link key={c.slug} to={`/categories/${c.slug}`} className="artful-mobile-category" data-testid={`mobile-category-${c.slug}`}>
          <div className="artful-mobile-category-image">{c.image ? <img src={c.image} alt={c.name} loading="lazy" /> : <span className="flex w-full h-full items-center justify-center text-plum text-lg">{String(c.name || "?").slice(0,1)}</span>}</div>
          <div className="artful-mobile-category-name text-ink-secondary">{c.name}</div>
        </Link>)}
      </div>
    </section>
  );
}

function HeroCarousel({ section, banners = [] }) {
  const cmsSlides = section?.slides?.length ? section.slides : (section ? [{ ...section }] : []);
  const activeBanners = banners.filter((b) => String(b.status || "Active").toLowerCase() === "active");
  const source = activeBanners.length ? activeBanners : cmsSlides;
  const slides = source.map((s, idx) => {
    const mediaType = String(s.media_type || (s.video || s.video_url ? "video" : "image")).toLowerCase() === "video" ? "video" : "image";
    const media = mediaType === "video" ? (s.video_url || s.video || s.media_url || "") : (s.image || s.media_url || "");
    return { id: s.id || idx, mediaType, media, destination: safeDestination(s.destination_url || s.url || s.cta_link) };
  }).filter((s) => !!s.media);
  const [emblaRef, embla] = useEmblaCarousel({ loop: slides.length > 1, duration: 30 });
  const [selected, setSelected] = useState(0);
  useEffect(() => {
    if (!embla || slides.length < 2) return;
    const onSelect = () => setSelected(embla.selectedScrollSnap());
    embla.on("select", onSelect); onSelect();
    const timer = setInterval(() => embla.scrollNext(), 6000);
    return () => { clearInterval(timer); embla.off("select", onSelect); };
  }, [embla, slides.length]);

  if (!slides.length) return null;
  return (
    <section className="bg-surface" data-testid="hero-section">
      <div className="artful-hero-media-wrap">
        <div className="overflow-hidden rounded-[15px]" ref={emblaRef}>
          <div className="flex">
            {slides.map((slide, idx) => {
              const media = slide.mediaType === "video"
                ? <video src={slide.media} muted autoPlay loop playsInline preload="metadata" className="artful-hero-media" data-testid={`hero-video-${idx}`} />
                : <img src={slide.media} alt="ARTFUL home banner" loading={idx === 0 ? "eager" : "lazy"} className="artful-hero-media" data-testid={`hero-image-${idx}`} />;
              return <div key={slide.id || idx} className="min-w-0 flex-0-0-70 mx-auto px-1 md:px-2">
                {slide.destination ? <a href={slide.destination} className="block" aria-label="Open banner destination">{media}</a> : media}
              </div>;
            })}
          </div>
        </div>
      </div>
      {slides.length > 1 && <div className="flex items-center justify-center gap-2 py-2" data-testid="hero-dots">{slides.map((slide, i) => <button key={slide.id || i} onClick={() => embla?.scrollTo(i)} aria-label={`Go to banner ${i + 1}`} className={`h-1.5 rounded-full transition-all ${selected === i ? "w-7 bg-plum" : "w-2 bg-plum/30"}`} />)}</div>}
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
      <div className="artful-product-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 sm:gap-x-5 gap-y-6 sm:gap-y-10">
        {!items ? [0, 1, 2, 3].map((i) => <ProductSkeleton key={i} />)
          : items.slice(0, 4).map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
      </div>
    </section>
  );
}

function CategoriesSection({ s }) {
  const [cats, setCats] = useState([]);
  useEffect(() => { api.get("/categories").then(({ data }) => setCats(data.items || [])).catch(() => {}); }, []);

  return (
    <section className="container-artful py-16 lg:py-20 disp" data-testid="featured-categories-section">
      <style>{`
        @font-face {
          font-family: 'Arcon';
          src: url('/src/fonts/Arcon-Regular.otf') format('opentype');
          font-style: normal;
          font-weight: 400;
          font-display: swap;
        }
        .artful-category-name { font-family: 'Arcon', serif; }
      `}</style>

      <div className="text-center mb-10 lg:mb-12">
        <h2 className="section-title">{s.heading}</h2>
        {s.subheading && <p className="text-ink-secondary mt-2 max-w-xl mx-auto">{s.subheading}</p>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-6" data-testid="featured-categories-grid">
        {cats.slice(0, 8).map((c, i) => {
          const IconCmp = getIcon(c.icon);
          return (
            <Link
              key={c.slug}
              to={`/categories/${c.slug}`}
              className="group overflow-hidden rounded-3xl border border-line bg-white shadow-[0_8px_28px_rgba(55,28,40,0.07)] hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(55,28,40,0.12)] transition-all duration-500 animate-fadeUp"
              style={{ animationDelay: `${(i % 4) * 60}ms` }}
              data-testid={`category-${c.slug}`}
            >
              <div className="relative aspect-[4/4.7] overflow-hidden bg-surface">
                <img
                  src={c.image}
                  alt={c.name}
                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />
                <div className="absolute inset-x-3 top-3 flex items-center justify-between">
                  <div className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm border border-white/70 text-plum flex items-center justify-center shadow-sm">
                    <IconCmp size={16} strokeWidth={1.7} />
                  </div>
                  <div className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm border border-white/70 text-plum flex items-center justify-center opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 shadow-sm">
                    <ArrowUpRight size={16} strokeWidth={1.7} />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 px-3 py-3.5 sm:px-5 sm:py-5">
                <div className="min-w-0">
                  <h3 className="artful-category-name text-[0.92rem] sm:text-[1.25rem] text-plum-wine leading-tight truncate">{c.name}</h3>
                  <p className="mt-1 text-[11px] sm:text-xs uppercase tracking-[0.12em] text-ink-muted">{c.product_count} pieces</p>
                </div>
                <span className="shrink-0 text-ink-muted group-hover:text-plum transition-colors duration-300" aria-hidden="true">
                  <ArrowRight size={15} strokeWidth={1.6} />
                </span>
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
  const mediaType = String(s.media_type || (s.video || s.video_url ? "video" : "image")).toLowerCase();
  const src = mediaType === "video" ? (s.video_url || s.video) : s.image;
  const href = safeDestination(s.destination_url || s.url || s.cta_link);
  if (!src) return null;
  const media = mediaType === "video"
    ? <video src={src} muted autoPlay loop playsInline className="artful-hero-media" />
    : <img src={src} alt="ARTFUL featured banner" loading="lazy" className="artful-hero-media" />;
  return <section className="container-artful py-5 lg:py-8" data-testid="featured-collection-banner"><div className="artful-hero-media-wrap rounded-[15px] overflow-hidden">{href ? <a href={href} className="block">{media}</a> : media}</div></section>;
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
          {(s.items || []).slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0)).filter((v) => v.visible !== false).map((v, i) => {
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {(s.items || []).slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0)).filter((it) => it.visible !== false).map((it, i) => {
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
      <MobileCategoryCircles />
      {heroSection && <HeroCarousel section={heroSection} banners={data.banners || []} />}
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
