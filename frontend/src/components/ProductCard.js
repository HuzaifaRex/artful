import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Plus } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { inr, discountPct, cn } from "../lib/utils";

export default function ProductCard({ product, index = 0 }) {
  const { addToCart, wishlist, toggleWishlist } = useStore();
  const [hover, setHover] = useState(false);
  const imgs = product.images || [];
  const disc = discountPct(product.price, product.compare_at_price);
  const saved = wishlist.includes(product.id);
  const available = (product.stock || 0) - (product.reserved || 0);
  const soldOut = product.status === "Out of Stock" || available <= 0;

  return (
    <div className="group animate-fadeUp" style={{ animationDelay: `${(index % 4) * 70}ms` }} data-testid={`product-card-${product.slug}`}>
      <div className="relative overflow-hidden bg-surface aspect-[4/5] hover-zoom" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <Link to={`/products/${product.slug}`}>
          <img src={imgs[hover && imgs[1] ? 1 : 0]} alt={product.name} loading="lazy" className="w-full h-full object-cover" />
        </Link>
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {(product.badges || []).slice(0, 2).map((b) => (
            <span key={b} className={cn("text-[9px] uppercase tracking-widest2 px-2.5 py-1 font-medium",
              b === "Sale" ? "bg-accent text-white" : b === "New" ? "bg-plum text-white" : "bg-cream text-plum border border-plum/20")}>{b}</span>
          ))}
          {disc && !product.badges?.includes("Sale") && <span className="text-[9px] uppercase tracking-widest2 px-2.5 py-1 bg-accent text-white font-medium">-{disc}%</span>}
        </div>
        <button onClick={() => toggleWishlist(product.id)} className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center bg-cream/90 backdrop-blur text-plum hover:bg-plum hover:text-white transition-colors rounded-full" data-testid={`wishlist-btn-${product.slug}`} aria-label="Save">
          <Heart size={15} className={saved ? "fill-accent text-accent" : ""} />
        </button>
        {soldOut ? (
          <div className="absolute inset-x-0 bottom-0 bg-plum-wine/85 text-cream text-center text-[11px] uppercase tracking-widest2 py-2.5">Sold Out</div>
        ) : (
          <button onClick={() => addToCart(product, 1)} className="absolute inset-x-3 bottom-3 bg-plum text-white text-[11px] uppercase tracking-widest2 py-3 flex items-center justify-center gap-2 opacity-0 translate-y-3 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300" data-testid={`quick-add-${product.slug}`}>
            <Plus size={13} /> Add to Cart
          </button>
        )}
      </div>
      <div className="pt-4 text-center">
        <Link to={`/products/${product.slug}`}>
          <h3 className="font-serif text-lg text-ink leading-snug hover:text-plum transition-colors">{product.name}</h3>
        </Link>
        <div className="mt-1.5 flex items-center justify-center gap-2 text-sm">
          <span className="text-plum font-medium">{inr(product.price)}</span>
          {product.compare_at_price > product.price && <span className="text-ink-muted line-through text-xs">{inr(product.compare_at_price)}</span>}
        </div>
      </div>
    </div>
  );
}
