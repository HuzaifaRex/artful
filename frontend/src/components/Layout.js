import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import CartDrawer from "./CartDrawer";
import SearchOverlay from "./SearchOverlay";
import AuthModal from "./AuthModal";
import CampaignBar from "./CampaignBar";
import Chatbot from "./Chatbot";

export default function Layout() {
  const location = useLocation();
  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <Header />
      <CampaignBar />
      <main className="flex-1">
        <Outlet key={location.pathname} />
      </main>
      <Footer />
      <CartDrawer />
      <SearchOverlay />
      <AuthModal />
      <Chatbot />
    </div>
  );
}
