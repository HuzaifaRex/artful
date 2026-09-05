import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Instagram, Facebook, Twitter } from "lucide-react";
import { toast } from "sonner";

const COLS = [
  { title: "Shop", links: [["All Products", "/shop"], ["New Arrivals", "/collections/new-arrivals"], ["Bestsellers", "/collections/bestsellers"], ["Gifts", "/collections/festive-gifts"]] },
  { title: "Help", links: [["FAQ", "/faq"], ["Shipping", "/shipping"], ["Returns", "/returns"], ["Contact", "/contact"], ["Track Order", "/track-order"]] },
  { title: "About", links: [["About", "/about"], ["Our Story", "/our-story"], ["Corporate Gifting", "/corporate-gifting"]] },
  { title: "Legal", links: [["Privacy", "/privacy"], ["Terms", "/terms"], ["Returns & Refund", "/returns"]] },
];

export default function Footer() {
  const [email, setEmail] = useState("");
  const subscribe = (e) => {
    e.preventDefault();
    if (!email) return;
    toast.success("You're on the list — welcome to ARTFUL.");
    setEmail("");
  };
  return (
    <footer className="bg-plum-wine text-cream mt-24" data-testid="footer-section">
      <div className="container-artful py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-14">
          <div className="lg:col-span-4">
            <div className="font-serif text-4xl mb-4">Artful</div>
            <p className="text-cream/70 text-sm leading-relaxed max-w-xs">Thoughtfully made. Beautifully given. Handcrafted lifestyle objects and bespoke gift boxes.</p>
            <form onSubmit={subscribe} className="mt-8 flex" data-testid="newsletter-form">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" className="flex-1 bg-transparent border border-cream/30 px-4 py-3 text-sm placeholder:text-cream/40 focus:outline-none focus:border-gold" data-testid="newsletter-input" />
              <button className="bg-gold text-plum-wine px-6 text-xs uppercase tracking-widest font-medium hover:bg-gold-soft transition-colors" data-testid="newsletter-submit">Join</button>
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
          <div className="flex items-center gap-5">
            <a href="#" className="text-cream/60 hover:text-gold" aria-label="Instagram"><Instagram size={18} /></a>
            <a href="#" className="text-cream/60 hover:text-gold" aria-label="Facebook"><Facebook size={18} /></a>
            <a href="#" className="text-cream/60 hover:text-gold" aria-label="Twitter"><Twitter size={18} /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}
