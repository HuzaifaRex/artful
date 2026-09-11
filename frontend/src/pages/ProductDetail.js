import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Heart, Minus, Plus, ChevronDown, Truck, Gift, Star, Check } from "lucide-react";
import { api, apiError } from "../lib/api";
import { useStore } from "../context/StoreContext";
import ProductCard from "../components/ProductCard";
import { PageLoader } from "../components/Loader";
import { inr, discountPct, INDIAN_STATES } from "../lib/utils";
import { toast } from "sonner";

function Accordion({ title, children, open }) {
  const [isOpen, setIsOpen] = useState(open);
  return (
    <div className="border-b border-line">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between py-4 text-left">
        <span className="text-sm font-medium uppercase tracking-widest text-ink">{title}</span>
        <ChevronDown size={18} className={`text-plum transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && <div className="pb-5 text-sm text-ink-secondary leading-relaxed">{children}</div>}
    </div>
  );
}

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToCart, wishlist, toggleWishlist } = useStore();
  const [p, setP] = useState(null);
  const [related, setRelated] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [giftWrap, setGiftWrap] = useState(false);
  const [message, setMessage] = useState("");
  const [deliveryState, setDeliveryState] = useState("");
  const [deliveryResult, setDeliveryResult] = useState(null);
  const [canReview, setCanReview] = useState(null);
  const [rvForm, setRvForm] = useState({ rating: 5, title: "", body: "" });

  useEffect(() => {
    setP(null); setActiveImg(0); setQty(1); setGiftWrap(false); setMessage(""); setDeliveryState(""); setDeliveryResult(null);
    api.get(`/products/${slug}`).then(({ data }) => setP(data)).catch(() => setP(false));
    api.get(`/products/${slug}/related`).then(({ data }) => setRelated(data.items)).catch(() => {});
    api.get(`/products/${slug}/reviews`).then(({ data }) => setReviews(data.items)).catch(() => {});
  }, [slug]);

  useEffect(() => {
    if (localStorage.getItem("artful_token")) {
      api.get(`/products/${slug}/can-review`).then(({ data }) => setCanReview(data)).catch(() => setCanReview(null));
    } else setCanReview(null);
  }, [slug, reviews]);

  useEffect(() => {
    if (!deliveryState) {
      setDeliveryResult(null);
      return undefined;
    }
    let active = true;
    api.get(`/delivery-estimate?state=${encodeURIComponent(deliveryState)}`)
      .then(({ data }) => { if (active) setDeliveryResult(data); })
      .catch(() => { if (active) setDeliveryResult(null); });
    return () => { active = false; };
  }, [deliveryState]);

  const submitReview = async () => {
    try {
      const { data } = await api.post(`/products/${slug}/reviews`, rvForm);
      toast.success(data.message);
      setCanReview({ can_review: false, already_reviewed: true });
      setRvForm({ rating: 5, title: "", body: "" });
    } catch (e) { toast.error(apiError(e)); }
  };

  if (p === null) return <PageLoader />;
  if (p === false) return <div className="container-artful py-24 text-center"><p className="font-serif text-3xl text-plum">Product not found</p><Link to="/shop" className="btn-outline mt-6">Back to Shop</Link></div>;

  const available = (p.stock || 0) - (p.reserved || 0);
  const soldOut = p.status === "Out of Stock" || available <= 0;
  const disc = discountPct(p.price, p.compare_at_price);
  const saved = wishlist.includes(p.id);

  const opts = () => ({ gift_wrap: giftWrap, personalization: message.trim() || null });
  const handleAdd = () => addToCart(p, qty, opts());
  const handleBuy = () => { addToCart(p, qty, opts()); navigate("/checkout"); };

  return (
    <div>
      <div className="container-artful py-6 text-xs text-ink-muted">
        <Link to="/" className="hover:text-plum">Home</Link> / <Link to="/shop" className="hover:text-plum">Shop</Link> / <span className="text-ink">{p.name}</span>
      </div>
      <div className="container-artful pb-16 grid lg:grid-cols-2 gap-10 lg:gap-16">
        {/* Gallery */}
        <div className="flex flex-col-reverse sm:flex-row gap-4">
          <div className="flex sm:flex-col gap-3 overflow-x-auto sm:overflow-visible">
            {(p.images || []).map((img, i) => (
              <button key={i} onClick={() => setActiveImg(i)} className={`w-16 h-20 shrink-0 overflow-hidden border ${activeImg === i ? "border-plum" : "border-line"}`} data-testid={`thumb-${i}`}>
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
          <div className="flex-1 relative overflow-hidden bg-surface aspect-[4/5] hover-zoom">
            <img src={(p.images || [])[activeImg]} alt={p.name} className="w-full h-full object-cover" data-testid="pdp-main-image" />
            {disc && <span className="absolute top-4 left-4 bg-accent text-white text-xs px-3 py-1.5 uppercase tracking-widest2">-{disc}%</span>}
          </div>
        </div>

        {/* Info */}
        <div className="lg:py-4">
          <div className="flex flex-wrap gap-2 mb-3">{(p.badges || []).map((b) => <span key={b} className="text-[10px] uppercase tracking-widest2 px-2.5 py-1 bg-plum-light text-plum">{b}</span>)}</div>
          <h1 className="font-serif text-3xl lg:text-4xl text-ink leading-tight" data-testid="pdp-title">{p.name}</h1>
          {p.review_count > 0 && (
            <div className="flex items-center gap-1 mt-3">{[...Array(5)].map((_, i) => <Star key={i} size={15} className={i < Math.round(p.rating) ? "fill-gold text-gold" : "text-line"} />)}<span className="text-xs text-ink-muted ml-2">{p.rating} ({p.review_count})</span></div>
          )}
          <div className="flex items-baseline gap-3 mt-5">
            <span className="text-2xl text-plum font-medium" data-testid="pdp-price">{inr(p.price)}</span>
            {p.compare_at_price > p.price && <span className="text-ink-muted line-through">{inr(p.compare_at_price)}</span>}
            <span className="text-xs text-ink-muted">(incl. of taxes)</span>
          </div>
          <p className="mt-5 text-ink-secondary leading-relaxed">{p.short_description}</p>

          <div className="mt-4">
            {soldOut ? <span className="text-sm text-err font-medium">Out of Stock</span>
              : available <= (p.low_stock_threshold || 5) ? <span className="text-sm text-warn font-medium">Only {available} left in stock</span>
              : <span className="text-sm text-ok font-medium flex items-center gap-1"><Check size={14} /> In Stock</span>}
          </div>

          {p.personalization?.enabled && (
            <div className="mt-6 bg-surface p-4">
              <label className="label-caption flex items-center gap-2 mb-2"><Gift size={14} /> {p.personalization.label || "Personalize this gift"}</label>
              <input value={message} onChange={(e) => setMessage(e.target.value.slice(0, p.personalization.char_limit || 30))} placeholder="Add a name or short message" className="input-field" data-testid="personalization-input" maxLength={p.personalization.char_limit || 30} />
              <p className="text-xs text-ink-muted mt-1">{message.length}/{p.personalization.char_limit || 30} characters</p>
            </div>
          )}

          <label className="mt-4 flex items-center gap-2 text-sm text-ink-secondary cursor-pointer">
            <input type="checkbox" checked={giftWrap} onChange={(e) => setGiftWrap(e.target.checked)} className="accent-plum" data-testid="gift-wrap-checkbox" />
            Add gift wrapping <span className="text-plum">(+₹199)</span>
          </label>

          <div className="mt-6 flex items-center gap-4">
            <div className="flex items-center border border-line">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-3 text-plum" data-testid="qty-dec"><Minus size={15} /></button>
              <span className="px-5 text-sm" data-testid="qty-value">{qty}</span>
              <button onClick={() => setQty(qty + 1)} className="p-3 text-plum" data-testid="qty-inc"><Plus size={15} /></button>
            </div>
            <button onClick={() => toggleWishlist(p.id)} className="p-3 border border-line text-plum hover:border-plum" data-testid="wishlist-toggle-button"><Heart size={18} className={saved ? "fill-accent text-accent" : ""} /></button>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <button onClick={handleAdd} disabled={soldOut} className="btn-outline flex-1" data-testid="add-to-cart-button">Add to Cart</button>
            <button onClick={handleBuy} disabled={soldOut} className="btn-primary flex-1" data-testid="buy-now-button">Buy Now</button>
          </div>

          <div className="mt-6 bg-surface p-4">
            <label className="label-caption flex items-center gap-2 mb-2"><Truck size={14} /> Check Delivery</label>
            <select value={deliveryState} onChange={(e) => setDeliveryState(e.target.value)} className="input-field w-full" data-testid="delivery-state-select">
              <option value="">Select your state</option>
              {INDIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
            {deliveryResult && (
              <div className="text-sm text-ok mt-2 flex items-start gap-1.5" data-testid="delivery-estimate">
                <Check size={14} className="mt-0.5 shrink-0" />
                <span>{deliveryResult.dispatch_text} · {deliveryResult.delivery_text}</span>
              </div>
            )}
          </div>

          <div className="mt-8">
            <Accordion title="Description" open><p>{p.description}</p></Accordion>
            <Accordion title="Materials & Care"><p><b>Material:</b> {p.material || "—"}<br /><b>Color:</b> {p.color || "—"}<br /><b>Dimensions:</b> {p.dimensions || "—"}<br /><b>Care:</b> {p.care}</p></Accordion>
            <Accordion title="Shipping & Returns"><p>{p.shipping_info} Non-personalized items can be returned within 7 days of delivery.</p></Accordion>
          </div>
        </div>
      </div>

      <div className="container-artful py-10 border-t border-line" data-testid="reviews-section">
        <h2 className="section-title mb-8">Customer Reviews</h2>
        {canReview?.can_review && (
          <div className="bg-surface p-6 mb-8 max-w-2xl" data-testid="write-review-box">
            <p className="label-caption mb-3">Write a review · Verified Buyer</p>
            <div className="flex gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRvForm({ ...rvForm, rating: n })} data-testid={`rv-star-${n}`}><Star size={22} className={n <= rvForm.rating ? "fill-gold text-gold" : "text-line"} /></button>
              ))}
            </div>
            <input value={rvForm.title} onChange={(e) => setRvForm({ ...rvForm, title: e.target.value })} placeholder="Title (optional)" className="input-field mb-3" data-testid="rv-title" />
            <textarea value={rvForm.body} onChange={(e) => setRvForm({ ...rvForm, body: e.target.value })} rows={3} placeholder="Share your experience" className="input-field mb-3" data-testid="rv-body" />
            <button onClick={submitReview} className="btn-primary" data-testid="rv-submit">Submit Review</button>
          </div>
        )}
        {canReview?.already_reviewed && <p className="text-sm text-ok mb-6">Thanks — you've reviewed this product.</p>}
        {reviews.length > 0 ? (
          <div className="space-y-5 max-w-2xl">
            {reviews.map((r) => (
              <div key={r.id} className="border-b border-line-subtle pb-4">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5">{[...Array(5)].map((_, i) => <Star key={i} size={13} className={i < r.rating ? "fill-gold text-gold" : "text-line"} />)}</div>
                  {r.verified_buyer && <span className="text-[10px] uppercase tracking-widest2 text-ok flex items-center gap-1"><Check size={11} /> Verified Buyer</span>}
                </div>
                {r.title && <p className="font-medium text-ink mt-1.5">{r.title}</p>}
                <p className="text-sm text-ink-secondary mt-1">{r.body}</p>
                <p className="text-xs text-ink-muted mt-1">— {r.customer_name}</p>
              </div>
            ))}
          </div>
        ) : <p className="text-ink-secondary">No reviews yet. {canReview?.can_review ? "Be the first to review!" : "Only verified buyers can review."}</p>}
      </div>

      {related.length > 0 && (
        <div className="container-artful py-16 border-t border-line">
          <h2 className="section-title text-center mb-12">You May Also Like</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-10">
            {related.map((rp, i) => <ProductCard key={rp.id} product={rp} index={i} />)}
          </div>
        </div>
      )}
    </div>
  );
}
