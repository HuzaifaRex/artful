import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Heart, Minus, Plus, ChevronDown, Truck, Gift, Star, Check } from "lucide-react";
import { api, apiError } from "../lib/api";
import { useStore } from "../context/StoreContext";
import ProductCard from "../components/ProductCard";
import { PageLoader } from "../components/Loader";
import { inr, discountPct, INDIAN_STATES, getBulkUnitPrice } from "../lib/utils";
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
  const [selectedBulkTier, setSelectedBulkTier] = useState(null);
  const [giftWrap, setGiftWrap] = useState(false);
  const [message, setMessage] = useState("");
  const [deliveryState, setDeliveryState] = useState("");
  const [deliveryResult, setDeliveryResult] = useState(null);
  const [canReview, setCanReview] = useState(null);
  const [rvForm, setRvForm] = useState({ rating: 5, title: "", body: "", image_url: "" });
  const [reviewUploading, setReviewUploading] = useState(false);

  useEffect(() => {
    setP(null); setActiveImg(0); setQty(1); setSelectedBulkTier(null); setGiftWrap(false); setMessage(""); setDeliveryState(""); setDeliveryResult(null);
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

  const uploadReviewImage = async (file) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return toast.error("Review image must be 8MB or smaller.");
    const fd = new FormData();
    fd.append("file", file);
    setReviewUploading(true);
    try {
      const { data } = await api.post("/reviews/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setRvForm((f) => ({ ...f, image_url: data.url }));
      toast.success("Review image uploaded");
    } catch (e) { toast.error(apiError(e, "Image upload failed")); }
    finally { setReviewUploading(false); }
  };

  const submitReview = async () => {
    try {
      const { data } = await api.post(`/products/${slug}/reviews`, rvForm);
      toast.success(data.message);
      setCanReview({ can_review: false, already_reviewed: true });
      setRvForm({ rating: 5, title: "", body: "", image_url: "" });
    } catch (e) { toast.error(apiError(e)); }
  };

  if (p === null) return <PageLoader />;
  if (p === false) return <div className="container-artful py-24 text-center"><p className="font-serif text-3xl text-plum">Product not found</p><Link to="/shop" className="btn-outline mt-6">Back to Shop</Link></div>;

  const available = (p.stock || 0) - (p.reserved || 0);
  const soldOut = p.status === "Out of Stock" || available <= 0;
  const disc = discountPct(p.price, p.compare_at_price);
  const saved = wishlist.includes(p.id);

  const bulkTiers = (p.bulk_order?.enabled ? (p.bulk_order?.tiers || []) : [])
    .map((tier) => ({ min_quantity: Number(tier.min_quantity || 0), price: Number(tier.price || 0) }))
    .filter((tier) => tier.min_quantity > 0 && tier.price > 0)
    .sort((a, b) => a.min_quantity - b.min_quantity);
  const selectedTier = selectedBulkTier ? bulkTiers.find((tier) => tier.min_quantity === selectedBulkTier.min_quantity) : null;
  const bulkSelected = !!selectedTier;
  const displayUnitPrice = selectedTier ? selectedTier.price : Number(p.price || 0);
  const bulkProductTotal = selectedTier ? selectedTier.price * selectedTier.min_quantity : 0;
  const opts = () => ({
    gift_wrap: giftWrap,
    personalization: message.trim() || null,
    bulk_locked: bulkSelected,
    bulk_tier_quantity: selectedTier?.min_quantity || null,
    bulk_tier_price: selectedTier?.price || null,
  });
  const handleAdd = () => addToCart(p, qty, opts());
  const handleBuy = () => { addToCart(p, selectedTier?.min_quantity || qty, opts()); navigate("/checkout"); };
  const selectBulkTier = (tier) => {
    if (tier.min_quantity > available) return toast.error(`Only ${available} units are available for this bulk pack.`);
    setSelectedBulkTier(tier);
    setQty(tier.min_quantity);
  };

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
          <h1 className="artful-product-name text-3xl lg:text-4xl text-ink leading-tight" data-testid="pdp-title">{p.name}</h1>
          {p.review_count > 0 && (
            <div className="flex items-center gap-1 mt-3">{[...Array(5)].map((_, i) => <Star key={i} size={15} className={i < Math.round(p.rating) ? "fill-gold text-gold" : "text-line"} />)}<span className="text-xs text-ink-muted ml-2">{p.rating} ({p.review_count})</span></div>
          )}
          <div className="flex items-baseline gap-3 mt-5">
            <span className="text-2xl text-plum font-medium" data-testid="pdp-price">{inr(displayUnitPrice)}</span>
            {selectedTier && <span className="text-ink-muted line-through">{inr(p.price)} / pc</span>}
            {!selectedTier && p.compare_at_price > p.price && <span className="text-ink-muted line-through">{inr(p.compare_at_price)}</span>}
            <span className="text-xs text-ink-muted">(incl. of taxes)</span>
          </div>
          {bulkTiers.length > 0 && (
            <div className="mt-4 rounded-2xl border border-line bg-surface/70 p-4" data-testid="bulk-pricing">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div><p className="text-sm font-semibold text-plum">Bulk ordering</p><p className="text-xs text-ink-muted">Select a pack to unlock the special unit price.</p></div>
                <span className="text-[10px] uppercase tracking-widest2 text-ink-muted">From {p.bulk_order.min_quantity || bulkTiers[0].min_quantity} pcs</span>
              </div>
              <div className="grid gap-2">
                {bulkTiers.map((tier) => {
                  const checked = selectedTier?.min_quantity === tier.min_quantity;
                  const unavailable = tier.min_quantity > available;
                  const saving = Math.max(0, (Number(p.price || 0) - tier.price) * tier.min_quantity);
                  return <label key={tier.min_quantity} className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 transition ${checked ? "border-plum bg-plum/5 ring-1 ring-plum" : "border-line bg-white hover:border-plum/50"} ${unavailable ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                    <span className="flex items-center gap-3 min-w-0">
                      <input type="radio" name="bulk-tier" checked={checked} disabled={unavailable} onChange={() => selectBulkTier(tier)} className="accent-plum" />
                      <span><span className="block text-sm font-semibold text-ink">{tier.min_quantity} pcs</span><span className="block text-xs text-ink-muted">{unavailable ? "Not enough stock" : `${inr(tier.price)} / piece`}</span></span>
                    </span>
                    <span className="text-right shrink-0"><span className="block text-sm font-semibold text-plum">{inr(tier.price * tier.min_quantity)}</span>{saving > 0 && !unavailable && <span className="block text-[11px] text-ok">Save {inr(saving)}</span>}</span>
                  </label>;
                })}
              </div>
              {selectedTier && <div className="mt-3 flex items-center justify-between rounded-xl bg-white border border-plum/20 px-4 py-3 text-sm"><span className="text-ink-secondary">Selected bulk total</span><b className="text-plum text-lg">{inr(bulkProductTotal)}</b></div>}
            </div>
          )}
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
            {!bulkSelected ? <div className="flex items-center border border-line">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-3 text-plum" data-testid="qty-dec"><Minus size={15} /></button>
              <span className="px-5 text-sm" data-testid="qty-value">{qty}</span>
              <button onClick={() => setQty(Math.min(available, qty + 1))} disabled={qty >= available} className="p-3 text-plum disabled:opacity-30" data-testid="qty-inc"><Plus size={15} /></button>
            </div> : <div className="rounded-xl border border-plum/20 bg-plum/5 px-4 py-3 text-sm text-plum font-medium">Bulk pack quantity: {selectedTier.min_quantity} pcs</div>}
            <button onClick={() => toggleWishlist(p.id)} className="p-3 border border-line text-plum hover:border-plum" data-testid="wishlist-toggle-button"><Heart size={18} className={saved ? "fill-accent text-accent" : ""} /></button>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            {!bulkSelected && <button onClick={handleAdd} disabled={soldOut} className="btn-outline flex-1" data-testid="add-to-cart-button">Add to Cart</button>}
            <button onClick={handleBuy} disabled={soldOut || (bulkSelected && selectedTier.min_quantity > available)} className="btn-primary flex-1" data-testid="buy-now-button">{bulkSelected ? `Buy ${selectedTier.min_quantity} pcs · ${inr(bulkProductTotal)}` : "Buy Now"}</button>
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
            <div className="mb-4 rounded-2xl border border-line bg-white p-4">
              <div className="flex items-center justify-between gap-3 mb-2"><div><p className="text-sm font-medium text-ink">Add a photo <span className="text-ink-muted">(optional)</span></p><p className="text-xs text-ink-muted">Your photo is shown publicly only after admin approval.</p></div><label className="cursor-pointer rounded-full border border-line px-3 py-2 text-xs text-plum hover:border-plum"><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" disabled={reviewUploading} onChange={(e) => uploadReviewImage(e.target.files?.[0])} />{reviewUploading ? "Uploading…" : (rvForm.image_url ? "Replace" : "Choose image")}</label></div>
              {rvForm.image_url && <div className="relative w-24 h-24 overflow-hidden rounded-xl border border-line"><img src={rvForm.image_url} alt="Review preview" className="w-full h-full object-cover" /><button type="button" onClick={() => setRvForm((f) => ({ ...f, image_url: "" }))} className="absolute top-1 right-1 rounded-full bg-black/60 text-white w-6 h-6 text-xs">×</button></div>}
            </div>
            <button onClick={submitReview} disabled={reviewUploading || !rvForm.body.trim()} className="btn-primary disabled:opacity-50" data-testid="rv-submit">Submit Review</button>
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
                {r.image_url && <img src={r.image_url} alt="Customer review" className="mt-3 w-40 h-40 object-cover rounded-2xl border border-line" />}
                <p className="text-xs text-ink-muted mt-2">— {r.customer_name}</p>
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
