import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { StoreProvider } from "./context/StoreContext";
import Layout from "./components/Layout";
import ScrollToTop from "./components/ScrollToTop";

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

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <ScrollToTop />
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
      </BrowserRouter>
    </StoreProvider>
  );
}
