import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { getBulkUnitPrice } from "../lib/utils";

const StoreContext = createContext(null);
export const useStore = () => useContext(StoreContext);

const CART_KEY = "artful_cart";

export function StoreProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
  });
  const [customer, setCustomer] = useState(null);
  const [wishlist, setWishlist] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [settings, setSettings] = useState({ currency_symbol: "₹", free_shipping_threshold: 999 });

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  const refreshCustomer = useCallback(async () => {
    const token = localStorage.getItem("artful_token");
    if (!token) { setCustomer(null); setWishlist([]); return; }
    try {
      const { data } = await api.get("/auth/me");
      setCustomer(data);
      setWishlist(data.wishlist || []);
    } catch {
      localStorage.removeItem("artful_token");
      setCustomer(null);
    }
  }, []);

  useEffect(() => {
    refreshCustomer();
    api.get("/settings").then(({ data }) => setSettings(data)).catch(() => {});
  }, [refreshCustomer]);

  const loginSuccess = useCallback((token, cust) => {
    localStorage.setItem("artful_token", token);
    setCustomer(cust);
    setWishlist(cust.wishlist || []);
    setAuthOpen(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("artful_token");
    setCustomer(null);
    setWishlist([]);
    toast.success("Signed out");
  }, []);

  const addToCart = useCallback((product, qty = 1, opts = {}) => {
    setCart((prev) => {
      const key = product.id + (opts.variant_id || "") + (opts.gift_wrap ? "gw" : "") + (opts.personalization || "");
      const idx = prev.findIndex((i) => i.key === key);
      if (idx >= 0) {
        const next = [...prev];
        const nextQty = next[idx].qty + qty;
        next[idx] = { ...next[idx], qty: nextQty, price: getBulkUnitPrice(next[idx], nextQty) };
        return next;
      }
      return [...prev, {
        key, product_id: product.id, name: product.name, slug: product.slug,
        image: (product.images || [])[0], price: getBulkUnitPrice(product, qty),
        base_price: product.price, bulk_order: product.bulk_order || null,
        compare_at_price: product.compare_at_price, qty,
        variant_id: opts.variant_id || null, gift_wrap: !!opts.gift_wrap,
        personalization: opts.personalization || null,
      }];
    });
    setCartOpen(true);
    toast.success("Added to cart", { description: product.name });
  }, []);

  const updateQty = useCallback((key, qty) => {
    setCart((prev) => prev.map((i) => {
      if (i.key !== key) return i;
      const nextQty = Math.max(1, qty);
      return { ...i, qty: nextQty, price: getBulkUnitPrice({ price: i.base_price ?? i.price, bulk_order: i.bulk_order }, nextQty) };
    }));
  }, []);

  const removeItem = useCallback((key) => {
    setCart((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const toggleWishlist = useCallback(async (productId) => {
    if (!localStorage.getItem("artful_token")) {
      setAuthOpen(true);
      toast.info("Sign in to save favourites");
      return;
    }
    const inList = wishlist.includes(productId);
    try {
      const { data } = inList
        ? await api.delete(`/wishlist/${productId}`)
        : await api.post(`/wishlist/${productId}`);
      setWishlist(data.wishlist);
      toast.success(inList ? "Removed from wishlist" : "Saved to wishlist");
    } catch {
      toast.error("Could not update wishlist");
    }
  }, [wishlist]);

  const cartPayload = cart.map((i) => ({
    product_id: i.product_id, variant_id: i.variant_id, qty: i.qty,
    gift_wrap: i.gift_wrap, personalization: i.personalization,
  }));

  return (
    <StoreContext.Provider value={{
      cart, cartPayload, cartCount, addToCart, updateQty, removeItem, clearCart,
      customer, setCustomer, loginSuccess, logout, refreshCustomer,
      wishlist, toggleWishlist,
      cartOpen, setCartOpen, searchOpen, setSearchOpen, authOpen, setAuthOpen,
      settings,
    }}>
      {children}
    </StoreContext.Provider>
  );
}
