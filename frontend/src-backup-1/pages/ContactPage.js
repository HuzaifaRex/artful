import React, { useEffect, useState } from "react";
import { MapPin, Phone, Mail, Clock, MessageCircle, Instagram } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { api, apiError } from "../lib/api";
import { toast } from "sonner";
import { isValidEmail, isValidPhone, sanitizePhone } from "../lib/utils";

const FALLBACK_IMG = "https://images.unsplash.com/photo-1715593947958-ee0ca51de552?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

function PinterestIcon({ size = 18 }) {
  return (
   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pinterest" viewBox="0 0 16 16">
  <path d="M8 0a8 8 0 0 0-2.915 15.452c-.07-.633-.134-1.606.027-2.297.146-.625.938-3.977.938-3.977s-.239-.479-.239-1.187c0-1.113.645-1.943 1.448-1.943.682 0 1.012.512 1.012 1.127 0 .686-.437 1.712-.663 2.663-.188.796.4 1.446 1.185 1.446 1.422 0 2.515-1.5 2.515-3.664 0-1.915-1.377-3.254-3.342-3.254-2.276 0-3.612 1.707-3.612 3.471 0 .688.265 1.425.595 1.826a.24.24 0 0 1 .056.23c-.061.252-.196.796-.222.907-.035.146-.116.177-.268.107-1-.465-1.624-1.926-1.624-3.1 0-2.523 1.834-4.84 5.286-4.84 2.775 0 4.932 1.977 4.932 4.62 0 2.757-1.739 4.976-4.151 4.976-.811 0-1.573-.421-1.834-.919l-.498 1.902c-.181.695-.669 1.566-.995 2.097A8 8 0 1 0 8 0"/>
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
