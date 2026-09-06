import React, { useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { StoreProvider } from "./context/StoreContext";
import { ThemeProvider } from "./context/ThemeContext";
import Layout from "./components/Layout";
import ScrollToTop from "./components/ScrollToTop";
import { BrandLoader } from "./components/Loader";
import CookieConsent from "./components/CookieConsent";

import Home from "./pages/Home";
import Shop from "./pages/Shop";
import ProductDetail from "./pages/ProductDetail";
import CategoryPage from "./pages/CategoryPage";
import CollectionsList from "./pages/CollectionsList";
import CollectionPage from "./pages/CollectionPage";
import SearchPage from "./pages/SearchPage";
import CartPage from "./pages/CartPage";
import Checkout from "./pages/Checkout";
import OrderSuccess from "./pages/OrderSuccess";
import TrackOrder from "./pages/TrackOrder";
import Account from "./pages/Account";
import CorporateGifting from "./pages/CorporateGifting";
import FAQPage from "./pages/FAQPage";
import StaticPage from "./pages/StaticPage";
import AboutPage from "./pages/AboutPage";
import OurStoryPage from "./pages/OurStoryPage";
import ContactPage from "./pages/ContactPage";
import NotFound from "./pages/NotFound";

import AdminLogin from "./admin/AdminLogin";
import AdminApp from "./admin/AdminApp";

// Branded loader on first load + on every storefront route change.
function RouteLoader() {
  const location = useLocation();
  const noLoader = typeof window !== "undefined" && window.location.search.includes("noloader");
  const [show, setShow] = useState(!window.location.pathname.startsWith("/admin") && !noLoader);
  const isAdmin = location.pathname.startsWith("/admin");
  const isFirst = useRef(true);

  useEffect(() => {
    if (location.pathname.startsWith("/admin") || noLoader) { setShow(false); return; }
    const duration = isFirst.current ? 900 : 450;
    isFirst.current = false;
    setShow(true);
    const hide = () => setShow(false);
    const t = setTimeout(hide, duration);
    // Also dismiss on the first interaction (robust even if timers are throttled).
    const opts = { once: true, passive: true };
    window.addEventListener("pointerdown", hide, opts);
    window.addEventListener("keydown", hide, opts);
    window.addEventListener("wheel", hide, opts);
    window.addEventListener("touchstart", hide, opts);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", hide);
      window.removeEventListener("keydown", hide);
      window.removeEventListener("wheel", hide);
      window.removeEventListener("touchstart", hide);
    };
  }, [location.pathname]);

  if (isAdmin || !show) return null;
  return <BrandLoader minDuration={450} onDone={() => setShow(false)} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <StoreProvider>
        <BrowserRouter>
          <ScrollToTop />
          <RouteLoader />
          <Toaster position="top-center" richColors closeButton />
          <Routes>
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/*" element={<AdminApp />} />

            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/products/:slug" element={<ProductDetail />} />
              <Route path="/categories" element={<Shop />} />
              <Route path="/categories/:slug" element={<CategoryPage />} />
              <Route path="/collections" element={<CollectionsList />} />
              <Route path="/collections/:slug" element={<CollectionPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/order-success/:orderNumber" element={<OrderSuccess />} />
              <Route path="/track-order" element={<TrackOrder />} />
              <Route path="/account/*" element={<Account />} />
              <Route path="/gifts" element={<CollectionPage />} />
              <Route path="/corporate-gifting" element={<CorporateGifting />} />
              <Route path="/faq" element={<FAQPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/our-story" element={<OurStoryPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/shipping" element={<StaticPage slug="shipping" />} />
              <Route path="/returns" element={<StaticPage slug="returns" />} />
              <Route path="/privacy" element={<StaticPage slug="privacy" />} />
              <Route path="/terms" element={<StaticPage slug="terms" />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
          <CookieConsent />
        </BrowserRouter>
      </StoreProvider>
    </ThemeProvider>
  );
}
