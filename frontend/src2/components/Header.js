import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, User, Heart, ShoppingBag, Menu, X, Sun, Moon } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { useTheme } from "../context/ThemeContext";

const NAV = [
  { label: "Shop", to: "/shop" },
  { label: "Collections", to: "/collections" },
  { label: "Gifts", to: "/collections/festive-gifts" },
  { label: "New Arrivals", to: "/collections/new-arrivals" },
  { label: "Bestsellers", to: "/collections/bestsellers" },
  { label: "Corporate Gifting", to: "/corporate-gifting" },
  { label: "About", to: "/about" },
];

function Logo({ className = "" }) {
  return (
    <>
      <img src="/logo-plum.webp" alt="ARTFUL" className={`dark:hidden ${className}`} />
      <img src="/logo-cream.webp" alt="ARTFUL" className={`hidden dark:block ${className}`} />
    </>
  );
}

function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  return (
    <button onClick={toggle} className="p-2 text-plum hover:text-accent transition-colors" data-testid="theme-toggle" aria-label="Toggle theme" title={isDark ? "Switch to light" : "Switch to dark"}>
      {isDark ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}

export default function Header() {
  const { cartCount, wishlist, setSearchOpen, setCartOpen, setAuthOpen, customer, settings } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const accountClick = () => {
    if (customer) navigate("/account");
    else setAuthOpen(true);
  };

  return (
    <header className="sticky top-0 z-40">
      {settings?.announcement_enabled && (
        <div className="bg-plum text-gold-soft text-center text-[11px] sm:text-xs tracking-widest2 uppercase py-2.5 px-4" data-testid="announcement-bar">
          {settings.announcement_text}
        </div>
      )}
      <div className={`transition-all duration-300 border-b border-line ${scrolled ? "bg-cream/90 backdrop-blur-md" : "bg-cream"}`}>
        <div className="container-artful">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <button className="lg:hidden p-2 -ml-2 text-plum" onClick={() => setMenuOpen(true)} data-testid="mobile-menu-btn" aria-label="Menu">
              <Menu size={22} />
            </button>

            <Link to="/" className="lg:flex-none absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0" data-testid="logo">
              <Logo className="h-6 lg:h-7 w-auto" />
            </Link>

            <nav className="hidden lg:flex items-center gap-7 xl:gap-9">
              {NAV.map((n) => (
                <Link key={n.to} to={n.to} className="text-[12px] font-medium uppercase tracking-widest text-ink-secondary hover:text-plum transition-colors link-underline" data-testid={`nav-${n.label.toLowerCase().replace(/\s/g, "-")}`}>
                  {n.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-1 sm:gap-2">
              <ThemeToggle />
              <button className="p-2 text-plum hover:text-accent transition-colors" onClick={() => setSearchOpen(true)} data-testid="search-trigger" aria-label="Search">
                <Search size={20} />
              </button>
              <button className="p-2 text-plum hover:text-accent transition-colors hidden sm:block" onClick={accountClick} data-testid="account-trigger" aria-label="Account">
                <User size={20} />
              </button>
              <button className="p-2 text-plum hover:text-accent transition-colors relative hidden sm:block" onClick={() => customer ? navigate("/account/wishlist") : setAuthOpen(true)} data-testid="wishlist-trigger" aria-label="Wishlist">
                <Heart size={20} />
                {wishlist.length > 0 && <span className="absolute top-0 right-0 bg-accent text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">{wishlist.length}</span>}
              </button>
              <button className="p-2 text-plum hover:text-accent transition-colors relative" onClick={() => setCartOpen(true)} data-testid="cart-trigger" aria-label="Cart">
                <ShoppingBag size={20} />
                {cartCount > 0 && <span className="absolute top-0 right-0 bg-plum text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center" data-testid="cart-count">{cartCount}</span>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[82%] max-w-sm bg-cream animate-slideIn p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <Logo className="h-6 w-auto" />
              <button onClick={() => setMenuOpen(false)} className="p-2 text-plum" data-testid="mobile-menu-close"><X size={22} /></button>
            </div>
            <nav className="flex flex-col gap-1">
              {NAV.map((n) => (
                <Link key={n.to} to={n.to} onClick={() => setMenuOpen(false)} className="py-3 border-b border-line-subtle text-sm uppercase tracking-widest text-ink-secondary">
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="mt-8 flex flex-col gap-3">
              <button className="btn-outline w-full" onClick={() => { setMenuOpen(false); accountClick(); }}>{customer ? "My Account" : "Sign In"}</button>
              <Link to="/track-order" onClick={() => setMenuOpen(false)} className="btn-ghost">Track Order</Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
