import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Heart, Minus, Plus, ChevronDown, Truck, Gift, Star, Check, FileText, X } from "lucide-react";
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
  const { addToCart, wishlist, toggleWishlist, setAuthOpen } = useStore();
  const [p, setP] = useState(null);
  const [related, setRelated] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [customQtyMode, setCustomQtyMode] = useState(false);
  const [quantityDisplayBasis, setQuantityDisplayBasis] = useState("pcs");
  const [sizeDisplayBasis, setSizeDisplayBasis] = useState("per_unit");
  const [selectedBulkTier, setSelectedBulkTier] = useState(null);
  const [customSelections, setCustomSelections] = useState({});
  const [selectedSize, setSelectedSize] = useState("");
  const [customSize, setCustomSize] = useState({ width: "", height: "" });
  const [giftWrap, setGiftWrap] = useState(false);
  const [message, setMessage] = useState("");
  const [deliveryState, setDeliveryState] = useState("");
  const [deliveryResult, setDeliveryResult] = useState(null);
  const [canReview, setCanReview] = useState(null);
  const [rvForm, setRvForm] = useState({ rating: 5, title: "", body: "", image_url: "" });
  const [reviewUploading, setReviewUploading] = useState(false);
  const [artwork, setArtwork] = useState([]);
  const [artworkUploading, setArtworkUploading] = useState(false);

  useEffect(() => {
    setP(null); setActiveImg(0); setQty(1); setCustomQtyMode(false); setQuantityDisplayBasis("pcs"); setSizeDisplayBasis("per_unit"); setSelectedBulkTier(null); setCustomSelections({}); setSelectedSize(""); setCustomSize({ width: "", height: "" }); setGiftWrap(false); setMessage(""); setDeliveryState(""); setDeliveryResult(null); setArtwork([]);
    api.get(`/products/${slug}`).then(({ data }) => setP(data)).catch(() => setP(false));
    api.get(`/products/${slug}/related`).then(({ data }) => setRelated(data.items)).catch(() => {});
    api.get(`/products/${slug}/reviews`).then(({ data }) => setReviews(data.items)).catch(() => {});
  }, [slug]);

  useEffect(() => {
    if (!p || p === false) return;
    const cfg = p.customization || {};
    if (!(p.product_type === "customizable" || cfg.enabled)) return;
    const pricing = cfg.pricing || {};
    const tiers = (pricing.quantity_tiers || []).map(t => ({ quantity: Number(t.quantity ?? t.min_quantity ?? 0), price: Number(t.price || 0) })).filter(t => t.quantity > 0);
    const defaultQty = Number(pricing.default_quantity || tiers[0]?.quantity || 1);
    if (defaultQty > 0) { setQty(defaultQty); setCustomQtyMode(false); }
    setQuantityDisplayBasis(pricing.display_basis || "pcs");
    const configuredSizeBasis = cfg.size?.price_basis || (cfg.size?.display_basis === "pcs" ? "per_pcs" : cfg.size?.display_basis === "unit" ? "per_unit" : "per_unit");
    setSizeDisplayBasis(configuredSizeBasis);
    const defaultOptions = {};
    (cfg.options || []).forEach(o => {
      const value = (o.default_value_id && (o.values || []).find(v => v.id === o.default_value_id)) || (o.values || [])[0];
      if (value) defaultOptions[o.id] = value.id;
    });
    setCustomSelections(defaultOptions);
    const defaultSize = cfg.size?.default_preset_id || cfg.size?.presets?.[0]?.id || "";
    setSelectedSize(defaultSize);
    setCustomSize({ width: "", height: "" });
  }, [p]);

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

  const isCustomProduct = p.product_type === "customizable" || p.customization?.enabled;
  const available = isCustomProduct ? 999999 : (p.stock || 0) - (p.reserved || 0);
  const soldOut = p.status === "Out of Stock" || (!isCustomProduct && available <= 0);
  const disc = discountPct(p.price, p.compare_at_price);
  const saved = wishlist.includes(p.id);

  const bulkTiers = (p.bulk_order?.enabled ? (p.bulk_order?.tiers || []) : [])
    .map((tier) => ({ min_quantity: Number(tier.min_quantity || 0), price: Number(tier.price || 0) }))
    .filter((tier) => tier.min_quantity > 0 && tier.price > 0)
    .sort((a, b) => a.min_quantity - b.min_quantity);
  const selectedTier = selectedBulkTier ? bulkTiers.find((tier) => tier.min_quantity === selectedBulkTier.min_quantity) : null;
  const bulkSelected = !!selectedTier;
  const customization = (p.product_type === "customizable" || p.customization?.enabled) ? (p.customization || {}) : null;
  const customOptions = customization?.enabled ? (customization.options || []) : [];
  const customPricing = customization?.pricing || {};
  const sizeConfig = customization?.size || {};
  const isOrderTotalPricing = customPricing.pricing_model === "order_total";
  const quantityTiers = (customPricing.quantity_tiers || [])
    .map((t) => ({ quantity: Number(t.quantity ?? t.min_quantity ?? 0), price: Number(t.price || 0) }))
    .filter((t) => t.quantity > 0 && t.price >= 0)
    .sort((a, b) => a.quantity - b.quantity);
  const exactQuantityTier = quantityTiers.find(t => t.quantity === qty);
  const applicableQuantityTier = quantityTiers.filter(t => t.quantity <= qty && t.price >= 0).sort((a,b) => b.quantity - a.quantity)[0] || quantityTiers[0];
  const pcsPerUnit = Math.max(1, Number(customization?.unit_definition?.pcs_per_unit || 10));
  const pricingMultiplier = (basis) => basis === "per_pcs" ? Math.max(1, qty) : Math.max(1, Math.ceil(Math.max(1, qty) / pcsPerUnit));
  const customAddons = customOptions.reduce((sum, o) => {
    const selected = customSelections[o.id];
    const ids = Array.isArray(selected) ? selected : [selected];
    return sum + ids.reduce((s, id) => {
      const value = (o.values || []).find(v => v.id === id);
      const raw = Number(value?.add_on ?? value?.price ?? 0);
      return s + raw * pricingMultiplier(o.price_basis || "per_unit");
    }, 0);
  }, 0);
  const customBasePrice = Number(p.price || 0);
  const selectedPresetSize = (sizeConfig.presets || []).find(s => s.id === selectedSize);
  const hasCustomDimensions = sizeConfig.enabled && selectedSize === "__custom__";
  const customSizeValid = !hasCustomDimensions || (Number(customSize.width) > 0 && Number(customSize.height) > 0);
  const sizeAddon = (() => {
    if (!hasCustomDimensions || !customSizeValid) return 0;
    if (sizeConfig.pricing_mode === "per_area") {
      const unit = sizeConfig.unit || "mm";
      const factor = unit === "mm" ? 0.01 : unit === "in" ? 2.54 : 1;
      const areaCm2 = Number(customSize.width) * factor * Number(customSize.height) * factor;
      return Math.max(Number(sizeConfig.min_price || 0), Math.round(areaCm2 * Number(sizeConfig.price_per_area || 0))) * pricingMultiplier(sizeDisplayBasis || "per_unit");
    }
    return Number(sizeConfig.min_price || 0) * pricingMultiplier(sizeDisplayBasis || "per_unit");
  })();
  const presetSizeAddon = Number(selectedPresetSize?.price || selectedPresetSize?.add_on || 0) * pricingMultiplier(sizeDisplayBasis || "per_unit");
  const customQuantityTotal = (() => {
    if (!customization?.enabled) return customBasePrice;
    if (isOrderTotalPricing) {
      if (exactQuantityTier) return exactQuantityTier.price;
      if (applicableQuantityTier && customPricing.allow_custom_quantity !== false) {
        return Math.max(0, Math.round((qty / applicableQuantityTier.quantity) * applicableQuantityTier.price));
      }
      return 0;
    }
    const oldTier = (customPricing.quantity_tiers || []).filter(t => Number(t.min_quantity || 0) <= qty && Number(t.price || 0) > 0).sort((a,b) => Number(b.min_quantity)-Number(a.min_quantity))[0];
    return Number(oldTier?.price || customBasePrice) * (oldTier ? 1 : 1);
  })();
  const customOrderTotal = isOrderTotalPricing
    ? Math.max(0, customQuantityTotal + customAddons + (hasCustomDimensions ? sizeAddon : presetSizeAddon))
    : Math.max(0, customQuantityTotal + customAddons + (hasCustomDimensions ? sizeAddon : presetSizeAddon));
  const displayPrice = customization?.enabled ? customOrderTotal : (selectedTier ? selectedTier.price : customBasePrice);
  const bulkProductTotal = selectedTier ? selectedTier.price * selectedTier.min_quantity : 0;
  const opts = () => ({
    gift_wrap: giftWrap,
    personalization: message.trim() || null,
    bulk_locked: !customization?.enabled && bulkSelected,
    bulk_tier_quantity: selectedTier?.min_quantity || null,
    bulk_tier_price: selectedTier?.price || null,
    customization: customization?.enabled ? customSelections : null,
    custom_size: sizeConfig.enabled ? (selectedPresetSize ? { preset_id: selectedPresetSize.id, label: selectedPresetSize.label, width: Number(selectedPresetSize.width), height: Number(selectedPresetSize.height), unit: sizeConfig.unit || "mm" } : hasCustomDimensions ? { custom: true, width: Number(customSize.width), height: Number(customSize.height), unit: sizeConfig.unit || "mm" } : null) : null,
    artwork: artwork,
    custom_total: customization?.enabled && isOrderTotalPricing ? customOrderTotal : null,
    custom_unit_price: customization?.enabled ? (isOrderTotalPricing && qty > 0 ? customOrderTotal / qty : customOrderTotal) : null,
  });
  const validateCustomization = () => {
    if (!customization?.enabled) return true;
    if (customPricing.allow_custom_quantity === false && quantityTiers.length && !exactQuantityTier) {
      toast.error("Please choose one of the available quantities.");
      return false;
    }
    if (!qty || qty < 1) { toast.error("Please select a valid quantity."); return false; }
    for (const o of customOptions) {
      if (o.required !== false && !customSelections[o.id]) {
        toast.error(`Please select ${o.name}.`);
        return false;
      }
    }
    if (sizeConfig.enabled) {
      if (!selectedSize) { toast.error("Please select a size."); return false; }
      if (hasCustomDimensions) {
        const w = Number(customSize.width), h = Number(customSize.height);
        if (!(w > 0 && h > 0)) { toast.error("Please enter a valid custom width and height."); return false; }
        const u = sizeConfig.unit || "mm";
        const minW = Number(sizeConfig.min_width || 0), maxW = Number(sizeConfig.max_width || Infinity), minH = Number(sizeConfig.min_height || 0), maxH = Number(sizeConfig.max_height || Infinity);
        if (w < minW || w > maxW || h < minH || h > maxH) { toast.error(`Custom size must be within ${minW}–${maxW} × ${minH}–${maxH} ${u}.`); return false; }
      }
    }
    if (customPricing.mode === "combination") {
      const match = (customPricing.rules || []).find(r => Number(r.min_quantity || 1) <= qty && (!r.max_quantity || qty <= Number(r.max_quantity)) && Object.entries(r.selections || {}).every(([k,v]) => !v || customSelections[k] === v));
      if (!match) { toast.error("This customization and quantity combination is not available."); return false; }
    }
    if (customization?.artwork?.enabled && customization.artwork.required && artwork.length === 0) {
      toast.error("Please upload your design file.");
      return false;
    }
    return true;
  };
  const handleAdd = () => { if (validateCustomization()) addToCart(p, qty, opts()); };
  const handleBuy = () => { if (validateCustomization()) { addToCart(p, qty, opts()); navigate("/checkout"); } };
  const selectBulkTier = (tier) => {
    if (tier.min_quantity > available) return toast.error(`Only ${available} units are available for this bulk pack.`);
    setSelectedBulkTier(tier);
    setQty(tier.min_quantity);
  };
  const uploadArtwork = async (file) => {
    if (!file) return;
    if (!localStorage.getItem("artful_token")) { setAuthOpen(true); toast.info("Sign in to upload your design."); return; }
    const cfg = customization?.artwork || {};
    const formats = cfg.formats?.length ? cfg.formats : ["pdf", "jpg", "jpeg", "png"];
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!formats.includes(ext)) return toast.error(`Please upload: ${formats.map(x => x.toUpperCase()).join(", ")}`);
    const maxMb = Number(cfg.max_size_mb || 20);
    if (file.size > maxMb * 1024 * 1024) return toast.error(`File must be ${maxMb}MB or smaller.`);
    if (artwork.length >= Math.max(1, Number(cfg.max_files || 1))) return toast.error(`Maximum ${cfg.max_files || 1} artwork files allowed.`);
    const fd = new FormData(); fd.append("file", file); setArtworkUploading(true);
    try {
      const { data } = await api.post("/artwork/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setArtwork(prev => [...prev, { url: data.url, filename: data.filename, size: data.size, content_type: data.content_type, path: data.path }]);
      toast.success("Design uploaded");
    } catch (e) { toast.error(apiError(e, "Design upload failed")); }
    finally { setArtworkUploading(false); }
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
          <div className="mt-5 rounded-2xl border border-plum/15 bg-plum/5 p-4" data-testid="pdp-price-summary">
            {customization?.enabled ? <>
              <div className="flex items-center justify-between gap-3"><span className="text-xs text-ink-muted">Base Price</span><span className="text-sm font-medium text-ink-muted">{inr(p.price)}</span></div>
              <div className="flex items-end justify-between gap-3 mt-1"><div><p className="text-[10px] uppercase tracking-widest2 text-plum/70">Current Price</p><p className="text-3xl text-plum font-semibold" data-testid="pdp-price">{inr(displayPrice)}</p></div><span className="text-xs text-ink-muted">{isOrderTotalPricing ? `for ${qty.toLocaleString("en-IN")} pcs` : "per piece"}</span></div>
            </> : <div className="flex items-baseline gap-3"><span className="text-2xl text-plum font-medium" data-testid="pdp-price">{inr(displayPrice)}</span>{selectedTier && <span className="text-ink-muted line-through">{inr(p.price)} / pc</span>}{!selectedTier && p.compare_at_price > p.price && <span className="text-ink-muted line-through">{inr(p.compare_at_price)}</span>}<span className="text-xs text-ink-muted">(incl. of taxes)</span></div>}
          </div>
          {customization?.enabled && quantityTiers.length > 0 ? (
            <div className="mt-5 rounded-2xl border border-line bg-white p-4 space-y-3" data-testid="custom-quantity-selector">
              <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-plum">Quantity</p><p className="text-xs text-ink-muted mt-1">Choose the quantity you need.</p></div>{customPricing.allow_basis_switch ? <select value={quantityDisplayBasis} onChange={e => setQuantityDisplayBasis(e.target.value)} className="border border-line rounded-lg px-2.5 py-2 text-[11px] font-medium text-plum bg-white"><option value="pcs">Pcs</option><option value="unit">Unit</option></select> : <span className="text-[10px] uppercase tracking-wider text-ink-muted">{quantityDisplayBasis === "unit" ? `1 Unit = ${customization.unit_definition?.pcs_per_unit || 10} pcs` : "Pcs"}</span>}</div>
              <select value={customQtyMode ? "__custom__" : String(qty)} onChange={e => { if (e.target.value === "__custom__") { setCustomQtyMode(true); return; } setCustomQtyMode(false); setQty(Math.max(1, Number(e.target.value || 1))); }} className="input-field w-full">
                {quantityTiers.map(t => <option key={t.quantity} value={t.quantity}>{quantityDisplayBasis === "unit" ? `${Math.ceil(t.quantity / Math.max(1, Number(customization.unit_definition?.pcs_per_unit || 10))).toLocaleString("en-IN")} Unit (${t.quantity.toLocaleString("en-IN")} pcs)` : `${t.quantity.toLocaleString("en-IN")} Pcs`}</option>)}
                {customPricing.allow_custom_quantity !== false && <option value="__custom__">Custom quantity</option>}
              </select>
              {customQtyMode && <div className="flex items-center gap-2"><input type="number" min="1" value={qty} onChange={e => setQty(Math.max(1, Number(e.target.value || 1)))} className="input-field flex-1" /><span className="text-sm text-ink-muted">Pcs</span></div>}
            </div>
          ) : null}
          {!customization?.enabled && bulkTiers.length > 0 && (
            <div className="mt-4 rounded-2xl border border-line bg-surface/70 p-4" data-testid="bulk-pricing">
              <div className="flex items-center justify-between gap-3 mb-3"><div><p className="text-sm font-semibold text-plum">Bulk ordering</p><p className="text-xs text-ink-muted">Select a pack to unlock the special unit price.</p></div><span className="text-[10px] uppercase tracking-widest2 text-ink-muted">From {p.bulk_order.min_quantity || bulkTiers[0].min_quantity} pcs</span></div>
              <div className="grid gap-2">{bulkTiers.map((tier) => { const checked = selectedTier?.min_quantity === tier.min_quantity; const unavailable = tier.min_quantity > available; const saving = Math.max(0, (Number(p.price || 0) - tier.price) * tier.min_quantity); return <label key={tier.min_quantity} className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 transition ${checked ? "border-plum bg-plum/5 ring-1 ring-plum" : "border-line bg-white hover:border-plum/50"} ${unavailable ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}><span className="flex items-center gap-3 min-w-0"><input type="radio" name="bulk-tier" checked={checked} disabled={unavailable} onChange={() => selectBulkTier(tier)} className="accent-plum" /><span><span className="block text-sm font-semibold text-ink">{tier.min_quantity} pcs</span><span className="block text-xs text-ink-muted">{unavailable ? "Not enough stock" : `${inr(tier.price)} / piece`}</span></span></span><span className="text-right shrink-0"><span className="block text-sm font-semibold text-plum">{inr(tier.price * tier.min_quantity)}</span>{saving > 0 && !unavailable && <span className="block text-[11px] text-ok">Save {inr(saving)}</span>}</span></label>; })}</div>
              {selectedTier && <div className="mt-3 flex items-center justify-between rounded-xl bg-white border border-plum/20 px-4 py-3 text-sm"><span className="text-ink-secondary">Selected bulk total</span><b className="text-plum text-lg">{inr(bulkProductTotal)}</b></div>}
            </div>
          )}
          {customization?.enabled && sizeConfig.enabled && (
            <div className="mt-5 rounded-2xl border border-line bg-surface/70 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-plum">Size *</p><p className="text-xs text-ink-muted mt-1">Choose a standard size or enter your own dimensions.</p></div>{sizeConfig.allow_basis_switch ? <select value={sizeDisplayBasis} onChange={e => setSizeDisplayBasis(e.target.value)} className="border border-line rounded-lg px-2.5 py-2 text-[11px] font-medium text-plum bg-white"><option value="per_pcs">Per Pcs</option><option value="per_unit">Per Unit</option></select> : null}</div>
              <select value={selectedSize} onChange={e=>{setSelectedSize(e.target.value); if(e.target.value !== "__custom__") setCustomSize({width:"",height:""});}} className="input-field w-full"><option value="">Select size</option>{(sizeConfig.presets||[]).map(sp=><option key={sp.id} value={sp.id}>{sp.label} · {sp.width} × {sp.height} {sizeConfig.unit||"mm"}</option>)}{sizeConfig.allow_custom!==false && <option value="__custom__">Custom size</option>}</select>
              {hasCustomDimensions && <div className="grid grid-cols-2 gap-3"><div><label className="label-caption block mb-1">Width ({sizeConfig.unit||"mm"})</label><input type="number" min={sizeConfig.min_width||1} max={sizeConfig.max_width||1000} value={customSize.width} onChange={e=>setCustomSize(v=>({...v,width:e.target.value}))} className="input-field w-full" placeholder="Width"/></div><div><label className="label-caption block mb-1">Height ({sizeConfig.unit||"mm"})</label><input type="number" min={sizeConfig.min_height||1} max={sizeConfig.max_height||1000} value={customSize.height} onChange={e=>setCustomSize(v=>({...v,height:e.target.value}))} className="input-field w-full" placeholder="Height"/></div></div>}

            </div>
          )}
          {customization?.enabled && customOptions.length > 0 && (
            <div className="mt-5 rounded-2xl border border-line bg-surface/70 p-4 space-y-4" data-testid="customization-options">
              <div><p className="text-sm font-semibold text-plum">Customize your product</p><p className="text-xs text-ink-muted mt-1">Choose the options you want. Your final price is calculated from your selections.</p></div>
              {customOptions.map((o) => (
                <div key={o.id}>
                  <label className="label-caption block mb-2">{o.name}{o.required !== false ? " *" : ""}</label>
                  {o.type === "radio" ? (
                    <div className="grid sm:grid-cols-2 gap-2">
                      {(o.values || []).map(v => {
                        const checked = customSelections[o.id] === v.id;
                        return <label key={v.id} className={`flex items-center justify-between gap-3 border rounded-xl px-3 py-2.5 cursor-pointer ${checked ? "border-plum bg-plum/5" : "border-line bg-white"}`}>
                          <span className="flex items-center gap-2"><input type="radio" name={`custom-${o.id}`} checked={checked} onChange={() => setCustomSelections(s => ({...s, [o.id]: v.id}))} className="accent-plum"/><span className="text-sm">{v.label}</span></span>
                        </label>;
                      })}
                    </div>
                  ) : (
                    <select value={customSelections[o.id] || ""} onChange={e => setCustomSelections(s => ({...s, [o.id]: e.target.value}))} className="input-field w-full">
                      <option value="">Select {o.name}</option>
                      {(o.values || []).map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}
          {customization?.artwork?.enabled && (
            <div className="mt-5 rounded-2xl border border-line bg-surface/60 p-4" data-testid="pdp-artwork-upload">
              <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-plum">Upload your design {customization.artwork.required ? "*" : ""}</p><p className="text-xs text-ink-muted mt-1">{customization.artwork.instructions || `PDF, JPG, JPEG or PNG · max ${customization.artwork.max_size_mb || 20}MB · up to ${customization.artwork.max_files || 1} files`}</p></div><label className="cursor-pointer shrink-0 rounded-xl border border-plum px-3 py-2 text-xs font-semibold text-plum hover:bg-plum-light"><input type="file" className="hidden" accept={(customization.artwork.formats || ["pdf","jpg","jpeg","png"]).map(x => ({ pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" }[x] || `.${x}`)).join(",")} disabled={artworkUploading || artwork.length >= Math.max(1, Number(customization.artwork.max_files || 1))} onChange={e => uploadArtwork(e.target.files?.[0])} />{artworkUploading ? "Uploading…" : "Upload Design"}</label></div>
              <div className="mt-3 space-y-2">{artwork.map((a, i) => <div key={`${a.path || a.url}-${i}`} className="flex items-center gap-3 rounded-xl bg-white border border-line px-3 py-2"><FileText size={15} className="text-plum shrink-0" /><span className="text-xs text-ink truncate flex-1">{a.filename}</span><button type="button" onClick={() => setArtwork(prev => prev.filter((_, idx) => idx !== i))} className="text-ink-muted hover:text-err" aria-label="Remove design"><X size={14} /></button></div>)}</div>
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
            {!customization?.enabled && !bulkSelected ? <div className="flex items-center border border-line rounded-full">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-3 text-plum" data-testid="qty-dec"><Minus size={15} /></button>
              <span className="px-5 text-sm" data-testid="qty-value">{qty}</span>
              <button onClick={() => setQty(Math.min(available, qty + 1))} disabled={qty >= available} className="p-3 text-plum disabled:opacity-30" data-testid="qty-inc"><Plus size={15} /></button>
            </div> : customization?.enabled ? <div className="rounded-full bg-surface border border-line px-4 py-2.5 text-xs font-medium text-ink-secondary">{qty.toLocaleString("en-IN")} pcs selected</div> : <div className="rounded-xl border border-plum/20 bg-plum/5 px-4 py-3 text-sm text-plum font-medium">Bulk pack quantity: {selectedTier.min_quantity} pcs</div>}
            <button onClick={() => toggleWishlist(p.id)} className="p-3 border border-line text-plum hover:border-plum rounded-full" data-testid="wishlist-toggle-button"><Heart size={18} className={saved ? "fill-accent text-accent" : ""} /></button>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <button onClick={handleAdd} disabled={soldOut} className="btn-outline flex-1" data-testid="add-to-cart-button">Add to Cart</button>
            <button onClick={handleBuy} disabled={soldOut || (!customization?.enabled && bulkSelected && selectedTier.min_quantity > available)} className="btn-primary flex-1" data-testid="buy-now-button">Buy Now</button>
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
