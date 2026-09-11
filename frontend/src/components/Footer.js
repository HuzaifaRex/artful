import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Instagram, Cookie, PartyPopper, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "../context/StoreContext";
import { api, apiError } from "../lib/api";
import { popConfetti } from "../lib/confetti";
import { isValidEmail } from "../lib/utils";

const COLS = [
  { title: "Shop", links: [["All Products", "/shop"], ["New Arrivals", "/collections/new-arrivals"], ["Bestsellers", "/collections/bestsellers"], ["Gifts", "/collections/festive-gifts"]] },
  { title: "Help", links: [["FAQ", "/faq"], ["Shipping", "/shipping"], ["Returns", "/returns"], ["Contact", "/contact"], ["Track Order", "/track-order"]] },
  { title: "About", links: [["About", "/about"], ["Our Story", "/our-story"], ["Corporate Gifting", "/corporate-gifting"]] },
  { title: "Legal", links: [["Privacy", "/privacy"], ["Terms", "/terms"], ["Returns & Refund", "/returns"]] },
];

function PinterestIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-3.64 19.31c-.09-1.64-.02-3.61.41-5.47l1.01-4.28s-.26-.52-.26-1.29c0-1.21.7-2.12 1.57-2.12.74 0 1.1.55 1.1 1.22 0 .74-.47 1.84-.71 2.87-.2.86.43 1.56 1.28 1.56 1.54 0 2.73-1.62 2.73-3.96 0-2.07-1.49-3.52-3.62-3.52-2.46 0-3.91 1.85-3.91 3.76 0 .74.29 1.54.65 1.97.07.08.08.15.06.23l-.24.98c-.04.16-.13.19-.3.11-1.11-.52-1.81-2.14-1.81-3.44 0-2.8 2.04-5.38 5.88-5.38 3.09 0 5.49 2.2 5.49 5.14 0 3.07-1.94 5.54-4.63 5.54-.9 0-1.75-.47-2.04-1.03l-.55 2.08c-.2.76-.74 1.71-1.1 2.29.83.25 1.7.38 2.6.38A10 10 0 0 0 12 2Z"/>
    </svg>
  );
}

function YoutubeIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.51A3.02 3.02 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3.02 3.02 0 0 0 2.12 2.14c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8ZM9.55 15.6V8.4L15.8 12l-6.25 3.6Z"/>
    </svg>
  );
}

function ThankYouModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center p-4" data-testid="newsletter-thankyou">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-cream rounded-2xl max-w-md w-full p-8 text-center shadow-2xl animate-fadeUp">
        <button onClick={onClose} className="absolute top-4 right-4 text-ink-muted hover:text-plum" data-testid="newsletter-thankyou-close"><X size={20} /></button>
        <div className="w-16 h-16 mx-auto rounded-full bg-plum-light flex items-center justify-center text-plum mb-5"><PartyPopper size={30} /></div>
        <h3 className="font-serif text-2xl text-plum mb-2">You're on the list!</h3>
        <p className="text-ink-secondary text-sm leading-relaxed">Welcome to the ARTFUL circle. You'll be first to see new arrivals, seasonal edits and members-only offers.</p>
        <div className="flex items-center justify-center gap-2 text-xs text-ok mt-5"><CheckCircle2 size={15} /> Subscription confirmed</div>
        <button onClick={onClose} className="btn-primary w-full mt-6" data-testid="newsletter-thankyou-continue">Continue Shopping</button>
      </div>
    </div>
  );
}

export default function Footer() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [thankYou, setThankYou] = useState(false);
  const { settings } = useStore();
  const social = settings?.social || {};
  const handle = settings?.instagram_handle || "@artful";

  const subscribe = async (e) => {
    e.preventDefault();
    if (!isValidEmail(email)) return toast.error("Please enter a valid email address");
    setLoading(true);
    try {
      const { data } = await api.post("/newsletter/subscribe", { email, source: "footer" });
      setEmail("");
      if (data.already) { toast.info(data.message); }
      else { popConfetti({ y: 0.8 }); setThankYou(true); }
    } catch (err) { toast.error(apiError(err)); }
    setLoading(false);
  };

  return (
    <footer className="bg-plum-wine text-cream mt-24" data-testid="footer-section">
      <div className="container-artful py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-14">
          <div className="lg:col-span-4">
            <img src="/logo-cream.webp" alt="ARTFUL" className="h-7 w-auto mb-5" data-testid="footer-logo" />
            <p className="text-cream/70 text-sm leading-relaxed max-w-xs">Thoughtfully made. Beautifully given. Handcrafted lifestyle objects and bespoke gift boxes.</p>
            <form onSubmit={subscribe} className="mt-8 flex" data-testid="newsletter-form">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" className="flex-1 bg-transparent border border-cream/30 px-4 py-3 text-sm placeholder:text-cream/40 focus:outline-none focus:border-gold" data-testid="newsletter-input" />
              <button disabled={loading} className="bg-gold text-plum-wine px-6 text-xs uppercase tracking-widest font-medium hover:bg-gold-soft transition-colors disabled:opacity-60" data-testid="newsletter-submit">Join</button>
            </form>
          </div>
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
            {COLS.map((c) => (
              <div key={c.title}>
                <h4 className="text-[11px] uppercase tracking-widest2 text-gold-soft mb-5">{c.title}</h4>
                <ul className="space-y-3">
                  {c.links.map(([label, to]) => (
                    <li key={label + to}><Link to={to} className="text-sm text-cream/70 hover:text-cream transition-colors">{label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-cream/15 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-cream/50">© {new Date().getFullYear()} ARTFUL. All rights reserved. · Prices in ₹ INR</p>
          <div className="flex items-center gap-4">
            <button onClick={() => window.dispatchEvent(new Event("artful-open-cookie-settings"))} className="text-xs text-cream/60 hover:text-gold flex items-center gap-1.5" data-testid="footer-cookie-settings"><Cookie size={14} /> Cookie Settings</button>
            <span className="text-xs text-cream/60">{handle}</span>
            {social.instagram && <a href={social.instagram} target="_blank" rel="noreferrer" className="text-cream/60 hover:text-gold" aria-label="Instagram"><Instagram size={18} /></a>}
            {social.pinterest && <a href={social.pinterest} target="_blank" rel="noreferrer" className="text-cream/60 hover:text-gold" aria-label="Pinterest"><PinterestIcon size={18} /></a>}
            {social.youtube && <a href={social.youtube} target="_blank" rel="noreferrer" className="text-cream/60 hover:text-gold" aria-label="YouTube"><YoutubeIcon size={18} /></a>}
          </div>
        </div>
      </div>
      {thankYou && <ThankYouModal onClose={() => setThankYou(false)} />}
    </footer>
  );
}
