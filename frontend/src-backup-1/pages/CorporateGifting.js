import React, { useEffect, useState } from "react";
import { api, apiError } from "../lib/api";
import { toast } from "sonner";
import { isValidPhone, isValidEmail, sanitizePhone } from "../lib/utils";

const EMPTY = { company_name: "", contact_person: "", mobile: "", email: "", quantity: "", budget: "", requirement: "", message: "" };

export default function CorporateGifting() {
  const [form, setForm] = useState(EMPTY);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState({});
  useEffect(() => { api.get("/cms/page/corporate-gifting").then(({ data }) => setPage(data)).catch(() => setPage({})); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.company_name || !form.contact_person || !form.mobile) return toast.error("Please fill company, contact and mobile");
    if (!isValidPhone(form.mobile)) return toast.error("Enter a valid 10-digit mobile number");
    if (form.email && !isValidEmail(form.email)) return toast.error("Enter a valid email address");
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
        : <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: extra.numeric ? sanitizePhone(e.target.value) : e.target.value })} inputMode={extra.numeric ? "numeric" : undefined} className="input-field" data-testid={`corp-${k}`} />}
    </div>
  );
  return (
    <div>
      <div className="relative bg-plum-wine text-cream py-20 overflow-hidden">
        {page.hero_image && <img src={page.hero_image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />}
        <div className="container-artful text-center relative"><p className="label-caption !text-gold-soft mb-4">{page.hero_eyebrow || "Corporate Gifting"}</p><h1 className="font-serif text-4xl lg:text-5xl font-light">{page.hero_title || "Gifting, elevated for business"}</h1><p className="text-cream/75 mt-4 max-w-xl mx-auto">Curated, brandable hampers for clients, teams and milestones. Share your requirement and our team will craft a bespoke proposal.</p></div>
      </div>
      <div className="container-artful py-14 max-w-2xl mx-auto">
        {page.body_html && <div className="prose max-w-none text-ink-secondary mb-10 text-center" dangerouslySetInnerHTML={{ __html: page.body_html }} />}
        {sent ? (
          <div className="text-center py-16"><h2 className="font-serif text-3xl text-plum mb-3">Thank you!</h2><p className="text-ink-secondary">Our corporate gifting team will reach out to you shortly.</p></div>
        ) : (
          <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4" data-testid="corporate-form">
            {f("company_name", "Company Name *")}
            {f("contact_person", "Contact Person *")}
            {f("mobile", "Mobile *", { numeric: true })}
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
