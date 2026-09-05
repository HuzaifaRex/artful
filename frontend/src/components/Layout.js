import React, { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../context/StoreContext";
import Header from "./Header";
import Footer from "./Footer";
import CartDrawer from "./CartDrawer";
import SearchOverlay from "./SearchOverlay";
import AuthModal from "./AuthModal";
import CampaignBar from "./CampaignBar";
import { api, apiError } from "../lib/api";
import { toast } from "sonner";

export default function Layout() {
  const { loginSuccess } = useStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Emergent Google Auth callback (session_id in URL fragment)
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  useEffect(() => {
    const hash = window.location.hash || "";
    if (hash.includes("session_id=")) {
      const sid = new URLSearchParams(hash.replace("#", "")).get("session_id");
      if (sid) {
        api.post("/auth/google/session", { session_id: sid })
          .then(({ data }) => {
            loginSuccess(data.token, data.customer);
            toast.success(`Welcome${data.customer?.name ? ", " + data.customer.name : ""}!`);
            window.history.replaceState(null, "", window.location.pathname);
            navigate("/account");
          })
          .catch((e) => toast.error(apiError(e, "Google sign-in failed")));
      }
    }
  }, [loginSuccess, navigate]);

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
    </div>
  );
}
