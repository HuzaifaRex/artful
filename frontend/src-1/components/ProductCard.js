import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Plus } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { inr, discountPct, cn } from "../lib/utils";

const badgeStyles = {
  New: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Bestseller: "bg-amber-50 text-amber-700 border-amber-200",
  Limited: "bg-rose-50 text-rose-700 border-rose-200",
  Trending: "bg-violet-50 text-violet-700 border-violet-200",
  Handmade: "bg-sky-50 text-sky-700 border-sky-200",
  Sale: "bg-plum text-white border-plum",
  Featured: "bg-cream text-plum border-plum/20",
};

export default function ProductCard({ product, index = 0 }) {
  const { addToCart, wishlist, toggleWishlist } = useStore();
  const [hover, setHover] = useState(false);
  const imgs = product.images || [];
  const mrp = Number(product.mrp ?? product.compare_at_price ?? 0);
  const price = Number(product.price || 0);
  const disc = discountPct(price, mrp);
  const saved = wishlist.includes(product.id);
  const available = (product.stock || 0) - (product.reserved || 0);
  const soldOut = product.status === "Out of Stock" || available <= 0;
  const description = (product.short_description || "").trim();
  const tags = (Array.isArray(product.tags) ? product.tags : []).slice(0, 2);
  const badges = (Array.isArray(product.badges) ? product.badges : []).slice(0, 2);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg animate-fadeUp" style={{ animationDelay: `${(index % 4) * 70}ms` }} data-testid={`product-card-${product.slug}`}>
      <div className="relative aspect-[4/5] overflow-hidden bg-cream hover-zoom" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <Link to={`/products/${product.slug}`} className="block h-full">
          <img src={imgs[hover && imgs[1] ? 1 : 0]} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
        </Link>
        <div className="absolute left-3 top-3 flex max-w-[78%] flex-wrap gap-1.5">
          {badges.map((b) => <span key={b} className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold", badgeStyles[b] || "border-plum/15 bg-white/90 text-plum")}>{b}</span>)}
          {disc > 0 && <span className="rounded-full border border-accent/20 bg-accent px-2.5 py-1 text-[10px] font-semibold text-white">{disc}% OFF</span>}
        </div>
        <button onClick={() => toggleWishlist(product.id)} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-plum backdrop-blur transition-colors hover:bg-plum hover:text-white" data-testid={`wishlist-btn-${product.slug}`} aria-label="Save">
          <Heart size={15} className={saved ? "fill-accent text-accent" : ""} />
        </button>
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <Link to={`/products/${product.slug}`}>
          <h3 className="artful-product-name line-clamp-2 min-h-[3rem] text-base font-semibold leading-6 text-ink transition-colors hover:text-plum">{product.name}</h3>
        </Link>
        {description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-muted">{description}</p>}
        {tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{tags.map((tag, i) => <span key={`${tag}-${i}`} className="rounded-full bg-surface px-2.5 py-1 text-[10px] font-medium text-ink-secondary">{tag}</span>)}</div>}
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-lg font-semibold text-plum">{inr(price)}</span>
          {mrp > price && <span className="text-xs text-ink-muted line-through">{inr(mrp)}</span>}
        </div>
        {soldOut ? (
          <div className="mt-4 rounded-full border border-line py-3 text-center text-[11px] font-semibold uppercase tracking-widest2 text-ink-muted">Sold Out</div>
        ) : (
          <button onClick={() => addToCart(product, 1)} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-plum px-4 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-plum-wine" data-testid={`quick-add-${product.slug}`}>
            <Plus size={13} /> Add to Cart
          </button>
        )}
      </div>
    </article>
  );
}
