import React, { useEffect, useState } from "react";
import { MapPin, Phone, Mail, Clock, MessageCircle, Instagram } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { api, apiError } from "../lib/api";
import { toast } from "sonner";
import { isValidEmail, isValidPhone, sanitizePhone } from "../lib/utils";

const FALLBACK_IMG = "https://images.unsplash.com/photo-1715593947958-ee0ca51de552?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

function PinterestIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-3.64 19.31c-.09-1.64-.02-3.61.41-5.47l1.01-4.28s-.26-.52-.26-1.29c0-1.21.7-2.12 1.57-2.12.74 0 1.1.55 1.1 1.22 0 .74-.47 1.84-.71 2.87-.2.86.43 1.56 1.28 1.56 1.54 0 2.73-1.62 2.73-3.96 0-2.07-1.49-3.52-3.62-3.52-2.46 0-3.91 1.85-3.91 3.76 0 .74.29 1.54.65 1.97.07.08.08.15.06.23l-.24.98c-.04.16-.13.19-.3.11-1.11-.52-1.81-2.14-1.81-3.44 0-2.8 2.04-5.38 5.88-5.38 3.09 0 5.49 2.2 5.49 5.14 0 3.07-1.94 5.54-4.63 5.54-.9 0-1.75-.47-2.04-1.03l-.55 2.08c-.2.76-.74 1.71-1.1 2.29.83.25 1.7.38 2.6.38A10 10 0 0 0 12 2Z"/>
    </svg>
  );
}

function YoutubeIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.51A3.02 3.02 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3.02 3.02 0 0 0 2.12 2.14c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8ZM9.55 15.6V8.4L15.8 12l-6.25 3.6Z"/>
    </svg>
  );
}

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
              {social.pinterest && <a href={social.pinterest} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-plum hover:bg-plum hover:text-white transition-colors"><PinterestIcon size={18} /></a>}
              {social.youtube && <a href={social.youtube} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-plum hover:bg-plum hover:text-white transition-colors"><YoutubeIcon size={18} /></a>}
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
              <button disabled={sending} className="btn-primary w-full" data-testid="contact-submit">Send Message</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
