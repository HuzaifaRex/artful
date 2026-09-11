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
  { title: "Help", links: [["FAQ", "/faq"], ["Shipping", "/shipping"],  ["Contact", "/contact"], ["Track Order", "/track-order"]] },
  { title: "About", links: [["About", "/about"], ["Our Story", "/our-story"], ["Corporate Gifting", "/corporate-gifting"]] },
  { title: "Legal", links: [["Privacy", "/privacy"], ["Terms", "/terms"], ["Returns & Refund", "/returns"]] },
];

function PinterestIcon({ size = 18 }) {
  return (
   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pinterest" viewBox="0 0 16 16">
  <path d="M8 0a8 8 0 0 0-2.915 15.452c-.07-.633-.134-1.606.027-2.297.146-.625.938-3.977.938-3.977s-.239-.479-.239-1.187c0-1.113.645-1.943 1.448-1.943.682 0 1.012.512 1.012 1.127 0 .686-.437 1.712-.663 2.663-.188.796.4 1.446 1.185 1.446 1.422 0 2.515-1.5 2.515-3.664 0-1.915-1.377-3.254-3.342-3.254-2.276 0-3.612 1.707-3.612 3.471 0 .688.265 1.425.595 1.826a.24.24 0 0 1 .056.23c-.061.252-.196.796-.222.907-.035.146-.116.177-.268.107-1-.465-1.624-1.926-1.624-3.1 0-2.523 1.834-4.84 5.286-4.84 2.775 0 4.932 1.977 4.932 4.62 0 2.757-1.739 4.976-4.151 4.976-.811 0-1.573-.421-1.834-.919l-.498 1.902c-.181.695-.669 1.566-.995 2.097A8 8 0 1 0 8 0"/>
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
          <p className="text-xs text-cream/50">© {new Date().getFullYear()} ARTFUL. All rights reserved.</p>
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
