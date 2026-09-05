import React, { useState } from "react";
import { api, apiError } from "../lib/api";
import { toast } from "sonner";

const EMPTY = { company_name: "", contact_person: "", mobile: "", email: "", quantity: "", budget: "", requirement: "", message: "" };

export default function CorporateGifting() {
  const [form, setForm] = useState(EMPTY);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!form.company_name || !form.contact_person || !form.mobile) return toast.error("Please fill company, contact and mobile");
    setLoading(true);
    try { await api.post("/corporate-inquiries", form); setSent(true); }
    catch (err) { toast.error(apiError(err)); }
    setLoading(false);
  };
  const f = (k, label, extra = {}) => (
    <div className={extra.full ? "sm:col-span-2" : ""}>
      <label className="label-caption block mb-1.5">{label}</label>
      {extra.textarea
        ? <textarea value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} rows={4} className="input-field" data-testid={`corp-${k}`} />
        : <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="input-field" data-testid={`corp-${k}`} />}
    </div>
  );
  return (
    <div>
      <div className="bg-plum-wine text-cream py-20"><div className="container-artful text-center"><p className="label-caption !text-gold-soft mb-4">Corporate Gifting</p><h1 className="font-serif text-4xl lg:text-5xl font-light">Gifting, elevated for business</h1><p className="text-cream/75 mt-4 max-w-xl mx-auto">Curated, brandable hampers for clients, teams and milestones. Share your requirement and our team will craft a bespoke proposal.</p></div></div>
      <div className="container-artful py-14 max-w-2xl mx-auto">
        {sent ? (
          <div className="text-center py-16"><h2 className="font-serif text-3xl text-plum mb-3">Thank you!</h2><p className="text-ink-secondary">Our corporate gifting team will reach out to you shortly.</p></div>
        ) : (
          <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4" data-testid="corporate-form">
            {f("company_name", "Company Name *")}
            {f("contact_person", "Contact Person *")}
            {f("mobile", "Mobile *")}
            {f("email", "Email")}
            {f("quantity", "Approx. Quantity")}
            {f("budget", "Budget per gift (₹)")}
            {f("requirement", "Requirement", { full: true })}
            {f("message", "Message", { full: true, textarea: true })}
            <button className="btn-primary sm:col-span-2" disabled={loading} data-testid="corp-submit">{loading ? "Sending…" : "Submit Inquiry"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
