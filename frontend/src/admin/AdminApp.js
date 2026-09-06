import React, { useEffect, useState } from "react";
import { Routes, Route, NavLink, useNavigate, Navigate } from "react-router-dom";
import {
  LayoutDashboard, Package, FolderTree, Layers, Boxes, Star, ShoppingCart, Users,
  Ticket, Search as SearchIcon, FileText, Image, Briefcase, Settings as SettingsIcon,
  ScrollText, LogOut, Menu, X, ShieldCheck, CreditCard, Mail, MessageSquare, Eye, Globe, Bell,
} from "lucide-react";
import { adminApi } from "../lib/api";
import Dashboard from "./Dashboard";
import { Products, Categories, Collections, Reviews, Inventory } from "./Catalog";
import Orders from "./Orders";
import Customers from "./Customers";
import { Coupons } from "./Marketing";
import Campaigns from "./Campaigns";
import Refunds from "./Refunds";
import SearchAdmin from "./SearchAdmin";
import { HomepageCMS, Pages, FAQs } from "./Content";
import { Settings, AdminUsers, AuditLogs, Corporate } from "./Settings";
import Transactions from "./Transactions";
import SitePages from "./SitePages";
import { Newsletter, Support, Visitors } from "./Leads";

const NAV = [
  { section: null, items: [["", "Dashboard", LayoutDashboard]] },
  { section: "Catalog", items: [["products", "Products", Package], ["categories", "Categories", FolderTree], ["collections", "Collections", Layers], ["inventory", "Inventory", Boxes], ["reviews", "Reviews", Star]] },
  { section: "Sales", items: [["orders", "Orders", ShoppingCart], ["transactions", "Payments", CreditCard], ["refunds", "Refunds", Ticket], ["customers", "Customers", Users]] },
  { section: "Leads", items: [["visitors", "Visitors", Eye], ["newsletter", "Newsletter", Mail], ["support", "Support Inbox", MessageSquare]] },
  { section: "Marketing", items: [["coupons", "Coupons & Discounts", Ticket], ["campaigns", "Campaigns", Image], ["search", "Search Rules", SearchIcon]] },
  { section: "Content", items: [["homepage", "Homepage CMS", LayoutDashboard], ["site-pages", "Site Pages", Globe], ["pages", "Legal Pages", FileText], ["faqs", "FAQs", FileText]] },
  { section: "Business", items: [["corporate", "Corporate", Briefcase], ["settings", "Settings", SettingsIcon], ["admin-users", "Admin Users", ShieldCheck], ["audit", "Audit Logs", ScrollText]] },
];

export default function AdminApp() {
  const [admin, setAdmin] = useState(undefined);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem("artful_admin_token")) { setAdmin(null); return; }
    adminApi.get("/auth/me").then(({ data }) => setAdmin(data)).catch(() => setAdmin(null));
  }, []);

  useEffect(() => {
    if (!admin) return;
    const poll = () => adminApi.get("/notifications").then(({ data }) => setUnread(data.unread)).catch(() => {});
    poll();
    const t = setInterval(poll, 20000);
    return () => clearInterval(t);
  }, [admin]);

  if (admin === undefined) return <div className="min-h-screen bg-admin-bg flex items-center justify-center text-plum">Loading…</div>;
  if (admin === null) return <Navigate to="/admin/login" replace />;

  const logout = () => { localStorage.removeItem("artful_admin_token"); navigate("/admin/login"); };

  const SidebarContent = () => (
    <>
      <div className="px-6 py-6 border-b border-white/10">
        <div className="font-serif text-3xl text-cream">Artful</div>
        <p className="text-cream/40 text-[10px] uppercase tracking-widest2 mt-1">Operations Console</p>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
        {NAV.map((group, gi) => (
          <div key={gi}>
            {group.section && <p className="px-3 mb-1.5 text-[10px] uppercase tracking-widest2 text-cream/30">{group.section}</p>}
            {group.items.map(([path, label, Icon]) => (
              <NavLink key={path} to={`/admin/${path}`} end={path === ""} onClick={() => setOpen(false)}
                className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-md text-sm mb-0.5 transition-colors ${isActive ? "bg-plum text-white" : "text-cream/70 hover:bg-white/5 hover:text-cream"}`}
                data-testid={`admin-nav-${path || "dashboard"}`}>
                <Icon size={16} /> {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-white/10">
        <div className="text-xs text-cream/60 mb-2">{admin.admin?.email}<br /><span className="text-cream/40">{admin.admin?.role}</span></div>
        <button onClick={logout} className="flex items-center gap-2 text-sm text-cream/70 hover:text-cream" data-testid="admin-logout"><LogOut size={15} /> Sign Out</button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-admin-bg flex">
      <aside className="hidden lg:flex flex-col w-64 bg-admin-sidebar fixed inset-y-0 left-0 z-30"><SidebarContent /></aside>
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 inset-y-0 w-64 bg-admin-sidebar flex flex-col"><SidebarContent /></aside>
        </div>
      )}
      <div className="flex-1 lg:ml-64 min-w-0">
        <header className="lg:hidden bg-admin-sidebar text-cream px-4 py-3 flex items-center justify-between sticky top-0 z-20">
          <button onClick={() => setOpen(true)}><Menu size={22} /></button>
          <span className="font-serif text-2xl">Artful</span>
          <button onClick={logout}><LogOut size={18} /></button>
        </header>
        <div className="hidden lg:flex items-center justify-end gap-4 px-8 py-3 bg-white border-b border-gray-200 sticky top-0 z-20">
          <NavLink to="/admin" className="relative text-gray-500 hover:text-plum" data-testid="admin-notification-bell" title="Notifications">
            <Bell size={19} />
            {unread > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center">{unread}</span>}
          </NavLink>
          <span className="text-sm text-gray-600">{admin.admin?.email}</span>
        </div>
        <main className="p-5 sm:p-8 max-w-7xl">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="categories" element={<Categories />} />
            <Route path="collections" element={<Collections />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="reviews" element={<Reviews />} />
            <Route path="orders" element={<Orders />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="refunds" element={<Refunds />} />
            <Route path="customers" element={<Customers />} />
            <Route path="visitors" element={<Visitors />} />
            <Route path="newsletter" element={<Newsletter />} />
            <Route path="support" element={<Support />} />
            <Route path="coupons" element={<Coupons />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="search" element={<SearchAdmin />} />
            <Route path="homepage" element={<HomepageCMS />} />
            <Route path="site-pages" element={<SitePages />} />
            <Route path="pages" element={<Pages />} />
            <Route path="faqs" element={<FAQs />} />
            <Route path="corporate" element={<Corporate />} />
            <Route path="settings" element={<Settings />} />
            <Route path="admin-users" element={<AdminUsers />} />
            <Route path="audit" element={<AuditLogs />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
