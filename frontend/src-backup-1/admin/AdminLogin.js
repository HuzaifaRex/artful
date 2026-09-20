import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi, apiError } from "../lib/api";
import { toast } from "sonner";
import { inputCls } from "./ui";

export default function AdminLogin() {
  const [email, setEmail] = useState("admin@artful.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem("artful_admin_token")) {
      adminApi.get("/auth/me").then(() => navigate("/admin")).catch(() => localStorage.removeItem("artful_admin_token"));
    }
  }, [navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await adminApi.post("/auth/login", { email, password });
      localStorage.setItem("artful_admin_token", data.token);
      toast.success("Welcome back");
      navigate("/admin");
    } catch (err) { toast.error(apiError(err)); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-admin-sidebar flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="font-serif text-5xl text-cream mb-2">Artful</div>
          <p className="text-cream/50 text-sm uppercase tracking-widest2">Operations Console</p>
        </div>
        <form onSubmit={submit} className="bg-white rounded-xl p-8 shadow-2xl space-y-4">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Admin Sign In</h1>
          <div><label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} data-testid="admin-email" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1.5">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} data-testid="admin-password" /></div>
          <button className="w-full bg-plum text-white rounded-md py-2.5 text-sm font-medium hover:bg-plum-hover disabled:opacity-50" disabled={loading} data-testid="admin-login-btn">{loading ? "Signing in…" : "Sign In"}</button>
        </form>
      </div>
    </div>
  );
}
