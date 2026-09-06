import React, { useEffect, useState } from "react";
import { MapPin, Phone, Mail, Clock, MessageCircle, Instagram, Facebook, Twitter } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { api, apiError } from "../lib/api";
import { toast } from "sonner";
import { isValidEmail, isValidPhone, sanitizePhone } from "../lib/utils";

const FALLBACK_IMG = "https://images.unsplash.com/photo-1715593947958-ee0ca51de552?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

export default function ContactPage() {
  const { settings } = useStore();
  const s = settings || {};
  const social = s.social || {};
  const [page, setPage] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [sending, setSending] = useState(false);

  useEffect(() => { api.get("/cms/page/contact").then(({ data }) => setPage(data)).catch(() => setPage({})); }, []);

  const p = page || {};
  const address = p.contact_address || s.office_address;
  const phone = p.contact_phone || s.contact_phone;
  const whatsapp = p.contact_whatsapp || s.whatsapp_number;
  const email = p.contact_email || s.contact_email;
  const hours = p.office_hours || s.office_hours;
  const wa = (whatsapp || "").replace(/\D/g, "");

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.message) return toast.error("Please add your name and message");
    if (form.email && !isValidEmail(form.email)) return toast.error("Enter a valid email address");
    if (form.phone && !isValidPhone(form.phone)) return toast.error("Enter a valid 10-digit mobile number");
    setSending(true);
    try {
      const { data } = await api.post("/contact/submit", form);
      toast.success(data.message);
      setForm({ name: "", email: "", phone: "", message: "" });
    } catch (err) { toast.error(apiError(err)); }
    setSending(false);
  };

  const rows = [
    [MapPin, "Visit us", address],
    [Phone, "Call us", phone],
    [MessageCircle, "WhatsApp", whatsapp],
    [Mail, "Email", email],
    [Clock, "Office hours", hours],
  ];

  return (
    <div data-testid="contact-page">
      <div className="bg-surface py-14"><div className="container-artful text-center">
        {p.hero_eyebrow && <p className="label-caption mb-3">{p.hero_eyebrow}</p>}
        <h1 className="section-title">{p.hero_title || "Get in Touch"}</h1>
        <p className="text-ink-secondary mt-3 max-w-lg mx-auto">We'd love to hear from you — for orders, gifting help or just to say hello.</p>
      </div></div>

      <div className="container-artful py-14 grid lg:grid-cols-2 gap-12 lg:gap-16">
        <div>
          <div className="relative aspect-[16/10] overflow-hidden mb-8 hover-zoom"><img src={p.hero_image || FALLBACK_IMG} alt="ARTFUL Studio" className="w-full h-full object-cover" /></div>
          {p.body_html && <div className="prose max-w-none text-ink-secondary mb-8" dangerouslySetInnerHTML={{ __html: p.body_html }} />}
          <div className="space-y-5">
            {rows.map(([Icon, label, val], i) => val && (
              <div key={i} className="flex gap-4" data-testid={`contact-${label.toLowerCase().replace(/\s/g, "-")}`}>
                <div className="w-10 h-10 shrink-0 rounded-full bg-plum-light flex items-center justify-center text-plum"><Icon size={18} /></div>
                <div><p className="label-caption">{label}</p><p className="text-ink mt-0.5">{val}</p></div>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <p className="label-caption mb-3">Follow us</p>
            <div className="flex gap-3">
              {social.instagram && <a href={social.instagram} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-plum hover:bg-plum hover:text-white transition-colors"><Instagram size={18} /></a>}
              {social.facebook && <a href={social.facebook} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-plum hover:bg-plum hover:text-white transition-colors"><Facebook size={18} /></a>}
              {social.twitter && <a href={social.twitter} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-plum hover:bg-plum hover:text-white transition-colors"><Twitter size={18} /></a>}
            </div>
          </div>
          {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-8 bg-[#25D366] text-white text-sm px-6 py-3 rounded-full font-medium hover:opacity-90" data-testid="whatsapp-btn"><MessageCircle size={17} /> Chat on WhatsApp</a>}
        </div>

        <div>
          <div className="bg-surface p-6 sm:p-8">
            <h2 className="font-serif text-2xl text-plum mb-6">Send a message</h2>
            <form onSubmit={submit} className="space-y-4" data-testid="contact-form">
              <div><label className="label-caption block mb-1.5">Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" data-testid="contact-name" /></div>
              <div><label className="label-caption block mb-1.5">Email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" data-testid="contact-email" /></div>
              <div><label className="label-caption block mb-1.5">Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: sanitizePhone(e.target.value) })} inputMode="numeric" className="input-field" data-testid="contact-phone-input" /></div>
              <div><label className="label-caption block mb-1.5">Message</label><textarea rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="input-field" data-testid="contact-message" /></div>
              <button disabled={sending} className="btn-primary w-full" data-testid="contact-submit">{sending ? "Sending…" : "Send Message"}</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
