import React, { useEffect, useState } from "react";
import { Routes, Route, Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { User, Package, MapPin, Heart, LogOut, Plus, Trash2, Check, X, AlertTriangle } from "lucide-react";
import { api, apiError } from "../lib/api";
import { useStore } from "../context/StoreContext";
import ProductCard from "../components/ProductCard";
import InvoiceDownloadButton from "../components/InvoiceDownloadButton";
import { inr, formatDate, isValidPhone, isValidEmail, isValidPincode, sanitizePhone, INDIAN_STATES } from "../lib/utils";
import { toast } from "sonner";

const NAV = [
  ["/account", "Profile", User],
  ["/account/orders", "Orders", Package],
  ["/account/addresses", "Addresses", MapPin],
  ["/account/wishlist", "Wishlist", Heart],
];

function Profile() {
  const { customer, setCustomer } = useStore();
  const [form, setForm] = useState({ name: customer?.name || "", email: customer?.email || "", phone: customer?.phone || "" });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (form.phone && !isValidPhone(form.phone)) return toast.error("Enter a valid 10-digit mobile number");
    if (form.email && !isValidEmail(form.email)) return toast.error("Enter a valid email address");
    setSaving(true);
    try { const { data } = await api.put("/customers/me", form); setCustomer((c) => ({ ...c, ...data })); toast.success("Profile updated"); }
    catch (e) { toast.error(apiError(e)); }
    setSaving(false);
  };
  return (
    <div className="max-w-md">
      <h2 className="font-serif text-2xl text-plum mb-6">Profile</h2>
      <div className="space-y-4">
        <div><label className="label-caption block mb-1.5">Name</label><input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" data-testid="profile-name" /></div>
        <div><label className="label-caption block mb-1.5">Mobile</label><input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: sanitizePhone(e.target.value) })} inputMode="numeric" placeholder="Add mobile number" className="input-field" data-testid="profile-phone" /></div>
        <div><label className="label-caption block mb-1.5">Email</label><input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Add email" className="input-field" data-testid="profile-email" /></div>
        <button onClick={save} disabled={saving} className="btn-primary" data-testid="profile-save">{saving ? "Saving…" : "Save Changes"}</button>
      </div>
    </div>
  );
}

function CancelOrderModal({ orderNumber, onClose, onConfirmed }) {
  const [agreed, setAgreed] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const confirm = async () => {
    if (!agreed) return toast.error("Please read & accept the T&C and Refund Policy to continue.");
    setLoading(true);
    try {
      const { data } = await api.post(`/orders/${orderNumber}/cancel`, { reason: reason || "Customer request" });
      toast.success(data.message);
      onConfirmed();
    } catch (e) { toast.error(apiError(e)); }
    setLoading(false);
  };
  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center p-4" data-testid="cancel-order-modal">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-cream rounded-2xl max-w-md w-full p-7 shadow-2xl animate-fadeUp">
        <button onClick={onClose} className="absolute top-4 right-4 text-ink-muted hover:text-plum" data-testid="cancel-modal-close"><X size={20} /></button>
        <div className="w-14 h-14 rounded-full bg-red-50 text-err flex items-center justify-center mb-5"><AlertTriangle size={26} /></div>
        <h3 className="font-serif text-2xl text-plum mb-2">Cancel this order?</h3>
        <p className="text-sm text-ink-secondary leading-relaxed">Order <b className="text-plum">{orderNumber}</b> will be cancelled. If it was prepaid, a refund will be initiated as per our policy.</p>

        <div className="mt-5">
          <label className="label-caption block mb-1.5">Reason (optional)</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="input-field" data-testid="cancel-reason">
            <option value="">Select a reason</option>
            <option>Ordered by mistake</option>
            <option>Found a better price</option>
            <option>Delivery taking too long</option>
            <option>Changed my mind</option>
            <option>Other</option>
          </select>
        </div>

        <label className="flex items-start gap-3 mt-5 cursor-pointer">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 accent-plum w-4 h-4" data-testid="cancel-agree-checkbox" />
          <span className="text-sm text-ink-secondary leading-relaxed">
            I have read and agree to the{" "}
            <Link to="/terms" target="_blank" className="text-plum underline font-medium" data-testid="cancel-terms-link">Terms &amp; Conditions</Link> and{" "}
            <Link to="/returns" target="_blank" className="text-plum underline font-medium" data-testid="cancel-refund-link">Refund Policy</Link>. <span className="text-err">*</span>
          </span>
        </label>

        <div className="flex gap-3 mt-7">
          <button onClick={onClose} className="btn-outline flex-1" data-testid="cancel-modal-keep">Keep Order</button>
          <button onClick={confirm} disabled={!agreed || loading} className="btn-primary flex-1 !bg-err hover:!bg-red-800" data-testid="cancel-modal-confirm">{loading ? "Cancelling…" : "Cancel Order"}</button>
        </div>
      </div>
    </div>
  );
}

function Orders() {
  const [orders, setOrders] = useState(null);
  useEffect(() => { api.get("/orders").then(({ data }) => setOrders(data.items)).catch(() => setOrders([])); }, []);
  if (!orders) return <p className="text-ink-muted">Loading…</p>;
  return (
    <div>
      <h2 className="font-serif text-2xl text-plum mb-6">Your Orders</h2>
      {orders.length === 0 ? <p className="text-ink-secondary">You haven't placed any orders yet.</p> : (
        <div className="space-y-4">
          {orders.map((o) => (
            <Link to={`/account/orders/${o.order_number}`} key={o.id} className="block border border-line p-5 hover:border-plum transition-colors" data-testid={`order-${o.order_number}`}>
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div><p className="font-medium text-ink">{o.order_number}</p><p className="text-xs text-ink-muted">{formatDate(o.created_at)} · {o.items.length} item(s)</p></div>
                <div className="text-right"><span className="text-sm bg-plum-light text-plum px-3 py-1">{o.status}</span><p className="text-plum font-medium mt-1">{inr(o.pricing.total)}</p></div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const STEPS = ["Order Placed", "Confirmed", "Processing", "Packed", "Shipped", "Out for Delivery", "Delivered"];
function OrderDetail() {
  const { num } = useParams();
  const [o, setO] = useState(null);
  const [showCancel, setShowCancel] = useState(false);
  const load = () => api.get(`/orders/${num}`).then(({ data }) => setO(data)).catch(() => setO(false));
  useEffect(() => { load(); }, [num]);
  if (!o) return <p className="text-ink-muted">Loading…</p>;

  const normStatus = (st) => (st === "Pending" ? "Order Placed" : st);
  const reachedIdx = Math.max(-1, ...(o.status_history || []).map((h) => STEPS.indexOf(normStatus(h.status))));
  const cancelled = ["Cancelled", "Returned", "Refunded"].includes(o.status);
  const paid = ["paid", "cod_confirmed"].includes(o.payment.status);
  const canCancel = !["Shipped", "Out for Delivery", "Delivered", "Cancelled", "Returned", "Refunded"].includes(o.status);

  return (
    <div>
      <Link to="/account/orders" className="text-sm text-plum">← Back to orders</Link>
      <div className="flex items-center justify-between flex-wrap gap-2 mt-3 mb-1">
        <h2 className="font-serif text-2xl text-plum">{o.order_number}</h2>
        <span className={`text-xs px-3 py-1 ${cancelled ? "bg-red-100 text-err" : "bg-plum-light text-plum"}`}>{o.status}</span>
      </div>
      <p className="text-sm text-ink-muted mb-2">{formatDate(o.created_at)}</p>
      <div className="flex items-center gap-2 mb-6">
        <span className={`text-xs px-2.5 py-1 ${paid ? "bg-emerald-100 text-ok" : "bg-amber-100 text-warn"}`} data-testid="order-payment-status">
          {o.payment.status === "cod_confirmed" ? "Cash on Delivery" : o.payment.status === "paid" ? `Payment Completed${o.payment.dev_mode ? " (Demo)" : ""}` : "Payment " + o.payment.status}
        </span>
        {o.payment_method === "cod" && <span className="text-xs text-ink-muted">Pay on delivery</span>}
      </div>

      {!cancelled && (
        <div className="mb-8 bg-surface p-5" data-testid="order-timeline">
          {STEPS.map((s, i) => {
            const done = i <= reachedIdx;
            return (
              <div key={s} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-3.5 h-3.5 rounded-full ${done ? "bg-plum" : "bg-line border border-ink-muted/30"}`} />
                  {i < STEPS.length - 1 && <div className={`w-px h-7 ${i < reachedIdx ? "bg-plum" : "bg-line"}`} />}
                </div>
                <span className={`text-sm -mt-0.5 ${done ? "text-ink font-medium" : "text-ink-muted"}`}>{s}</span>
              </div>
            );
          })}
        </div>
      )}
      {o.tracking?.number && <p className="text-sm text-ink-secondary mb-4">Courier: {o.tracking.courier} · AWB: {o.tracking.number}</p>}

      <div className="space-y-4 mb-6">
        {o.items.map((i, idx) => (
          <div key={idx} className="flex gap-4"><img src={i.image} alt="" className="w-16 h-20 object-cover bg-surface" /><div className="flex-1"><p className="artful-product-name text-ink">{i.name}</p><p className="text-xs text-ink-muted">Qty {i.qty}</p></div><span className="text-plum">{inr(i.price * i.qty)}</span></div>
        ))}
      </div>
      <div className="border-t border-line pt-4 space-y-1.5 text-sm">
        <div className="flex justify-between text-ink-secondary"><span>Subtotal</span><span>{inr(o.pricing.subtotal)}</span></div>
        {o.pricing.discount > 0 && <div className="flex justify-between text-ok"><span>Discount</span><span>-{inr(o.pricing.discount)}</span></div>}
        <div className="flex justify-between text-ink-secondary"><span>Shipping</span><span>{o.pricing.shipping === 0 ? "Free" : inr(o.pricing.shipping)}</span></div>
        <div className="flex justify-between text-plum font-medium text-lg pt-2 border-t border-line-subtle"><span>Total</span><span>{inr(o.pricing.total)}</span></div>
      </div>
      <div className="mt-6 text-sm text-ink-secondary"><p className="font-medium text-ink mb-1">Delivery Address</p><p>{o.address.name}, {o.address.line1}, {o.address.city}, {o.address.state} — {o.address.pincode}</p></div>
      <div className="flex flex-wrap gap-3 mt-6">
        <InvoiceDownloadButton orderNumber={num} />
        {canCancel && <button onClick={() => setShowCancel(true)} className="btn-outline !border-err !text-err hover:!bg-err hover:!text-white" data-testid="cancel-order-btn">Cancel Order</button>}
      </div>
      {showCancel && <CancelOrderModal orderNumber={num} onClose={() => setShowCancel(false)} onConfirmed={() => { setShowCancel(false); load(); }} />}
    </div>
  );
}

const EMPTY = { name: "", phone: "", line1: "", line2: "", area: "", city: "", state: "", pincode: "", is_default: false };
function Addresses() {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const load = () => api.get("/addresses").then(({ data }) => setItems(data.items)).catch(() => {});
  useEffect(() => { load(); }, []);
  const save = async () => {
    for (const f of ["name", "line1", "city", "state", "pincode"]) if (!form[f]) return toast.error("Please complete required fields");
    if (form.phone && !isValidPhone(form.phone)) return toast.error("Enter a valid 10-digit mobile number");
    if (!isValidPincode(form.pincode)) return toast.error("Enter a valid 6-digit pincode");
    try { await api.post("/addresses", form); toast.success("Address saved"); setShowForm(false); setForm(EMPTY); load(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const del = async (id) => { await api.delete(`/addresses/${id}`); toast.success("Address removed"); load(); };
  return (
    <div>
      <div className="flex justify-between items-center mb-6"><h2 className="font-serif text-2xl text-plum">Addresses</h2><button onClick={() => setShowForm(!showForm)} className="btn-ghost !px-0" data-testid="add-address-btn"><Plus size={15} /> Add New</button></div>
      {showForm && (
        <div className="border border-line p-5 mb-6 grid sm:grid-cols-2 gap-3">
          {["name", "phone", "line1", "line2", "area", "city"].map((f) => (
            <input key={f} value={form[f]} onChange={(e) => setForm({ ...form, [f]: f === "phone" ? sanitizePhone(e.target.value) : e.target.value })} inputMode={f === "phone" ? "numeric" : undefined} placeholder={f === "line1" ? "Address line 1" : f.charAt(0).toUpperCase() + f.slice(1)} className={`input-field ${["line1", "line2"].includes(f) ? "sm:col-span-2" : ""}`} data-testid={`newaddr-${f}`} />
          ))}
          <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="input-field" data-testid="newaddr-state">
            <option value="">Select State</option>
            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" placeholder="Pincode" className="input-field" data-testid="newaddr-pincode" />
          <label className="flex items-center gap-2 text-sm text-ink-secondary sm:col-span-2"><input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} className="accent-plum" /> Set as default</label>
          <button onClick={save} className="btn-primary sm:col-span-2" data-testid="save-address-btn">Save Address</button>
        </div>
      )}
      {items.length === 0 ? <p className="text-ink-secondary">No saved addresses yet.</p> : (
        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((a) => (
            <div key={a.id} className="border border-line p-5 relative">
              {a.is_default && <span className="absolute top-3 right-3 text-[10px] bg-plum-light text-plum px-2 py-0.5 flex items-center gap-1"><Check size={11} /> Default</span>}
              <p className="font-medium text-ink">{a.name}</p>
              <p className="text-sm text-ink-secondary mt-1">{a.line1}, {a.line2} {a.area}</p>
              <p className="text-sm text-ink-secondary">{a.city}, {a.state} — {a.pincode}</p>
              <p className="text-sm text-ink-muted mt-1">{a.phone}</p>
              <button onClick={() => del(a.id)} className="text-err text-xs mt-3 flex items-center gap-1"><Trash2 size={13} /> Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Wishlist() {
  const [items, setItems] = useState(null);
  const { wishlist } = useStore();
  useEffect(() => { api.get("/wishlist").then(({ data }) => setItems(data.items)).catch(() => setItems([])); }, [wishlist]);
  if (!items) return <p className="text-ink-muted">Loading…</p>;
  return (
    <div>
      <h2 className="font-serif text-2xl text-plum mb-6">Wishlist</h2>
      {items.length === 0 ? <p className="text-ink-secondary">Your wishlist is empty. Tap the heart on any product to save it.</p> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-10">{items.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}</div>
      )}
    </div>
  );
}

export default function Account() {
  const { customer, logout, setAuthOpen } = useStore();
  const location = useLocation();
  const navigate = useNavigate();

  if (!customer && !window.location.hash.includes("session_id")) {
    return (
      <div className="container-artful py-24 text-center">
        <User size={44} className="mx-auto text-ink-muted mb-5" strokeWidth={1} />
        <h1 className="section-title mb-3">Sign in to your account</h1>
        <p className="text-ink-secondary mb-8">Access your orders, addresses and wishlist.</p>
        <button onClick={() => setAuthOpen(true)} className="btn-primary" data-testid="account-signin-btn">Sign In</button>
      </div>
    );
  }

  return (
    <div className="container-artful py-12">
      <h1 className="section-title mb-10">My Account</h1>
      <div className="grid lg:grid-cols-4 gap-10">
        <aside className="lg:col-span-1">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto hide-scrollbar">
            {NAV.map(([to, label, Icon]) => {
              const active = to === "/account" ? location.pathname === "/account" : location.pathname.startsWith(to);
              return (
                <Link key={to} to={to} className={`flex items-center gap-3 px-4 py-3 text-sm whitespace-nowrap ${active ? "bg-plum text-white" : "text-ink-secondary hover:bg-surface"}`} data-testid={`account-nav-${label.toLowerCase()}`}>
                  <Icon size={17} /> {label}
                </Link>
              );
            })}
            <button onClick={() => { logout(); navigate("/"); }} className="flex items-center gap-3 px-4 py-3 text-sm text-err hover:bg-surface text-left" data-testid="logout-btn"><LogOut size={17} /> Sign Out</button>
          </nav>
        </aside>
        <div className="lg:col-span-3">
          <Routes>
            <Route index element={<Profile />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:num" element={<OrderDetail />} />
            <Route path="addresses" element={<Addresses />} />
            <Route path="wishlist" element={<Wishlist />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
