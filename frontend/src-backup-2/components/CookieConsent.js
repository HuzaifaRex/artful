import React, { useEffect, useState } from "react";
import { Cookie, X, ShieldCheck, BarChart3, Megaphone } from "lucide-react";

const KEY = "artful_cookie_consent_v1";

export function getConsent() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}

// Only fire non-essential scripts once consent is granted for that category.
function loadNonEssential(consent) {
  if (consent?.analytics) window.__artful_analytics_enabled = true;
  if (consent?.marketing) window.__artful_marketing_enabled = true;
  window.dispatchEvent(new CustomEvent("artful-consent", { detail: consent }));
}

export default function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = useState({ essential: true, analytics: false, marketing: false });

  useEffect(() => {
    const existing = getConsent();
    if (!existing) setOpen(true);
    else loadNonEssential(existing);
    const handler = () => { setPrefs({ essential: true, ...(getConsent() || {}) }); setShowSettings(true); setOpen(true); };
    window.addEventListener("artful-open-cookie-settings", handler);
    return () => window.removeEventListener("artful-open-cookie-settings", handler);
  }, []);

  const persist = (consent) => {
    const value = { ...consent, essential: true, at: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(value));
    loadNonEssential(value);
    setOpen(false);
    setShowSettings(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9998] p-3 sm:p-5 animate-fadeUp" data-testid="cookie-consent">
      <div className="max-w-4xl mx-auto bg-cream border border-line shadow-2xl rounded-2xl overflow-hidden">
        <div className="p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 shrink-0 rounded-full bg-plum-light flex items-center justify-center text-plum"><Cookie size={20} /></div>
            <div className="flex-1">
              <h3 className="font-serif text-xl text-plum">Your privacy, your choice</h3>
              <p className="text-sm text-ink-secondary mt-1.5 leading-relaxed">
                We use cookies to run the store (essential) and, with your consent, to understand traffic and
                personalise offers. In line with India's DPDP Act, non-essential cookies stay off until you allow them.
                Read our <a href="/privacy" className="underline text-plum">Privacy Policy</a>.
              </p>
            </div>
            {getConsent() && <button onClick={() => setOpen(false)} className="text-ink-muted hover:text-plum" data-testid="cookie-dismiss"><X size={18} /></button>}
          </div>

          {showSettings && (
            <div className="mt-5 space-y-3 border-t border-line pt-5" data-testid="cookie-settings-panel">
              {[
                ["essential", "Strictly Essential", "Required for cart, checkout & security. Always on.", ShieldCheck, true],
                ["analytics", "Analytics", "Helps us understand how the store is used.", BarChart3, false],
                ["marketing", "Marketing", "Personalised offers and relevant ads.", Megaphone, false],
              ].map(([key, title, desc, Icon, locked]) => (
                <label key={key} className="flex items-start gap-3 p-3 rounded-xl border border-line cursor-pointer hover:bg-surface transition-colors">
                  <input type="checkbox" checked={prefs[key]} disabled={locked}
                    onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })}
                    className="mt-1 accent-plum" data-testid={`cookie-toggle-${key}`} />
                  <Icon size={18} className="text-plum mt-0.5 shrink-0" />
                  <div><p className="text-sm font-medium text-ink">{title}{locked && <span className="ml-2 text-[10px] uppercase tracking-widest text-ink-muted">Always on</span>}</p><p className="text-xs text-ink-muted">{desc}</p></div>
                </label>
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-col sm:flex-row gap-2.5 sm:justify-end">
            {!showSettings && (
              <button onClick={() => setShowSettings(true)} className="btn-outline !py-3 order-3 sm:order-1" data-testid="cookie-settings-btn">Cookie Settings</button>
            )}
            <button onClick={() => persist({ analytics: false, marketing: false })} className="btn-outline !py-3 order-2" data-testid="cookie-reject-btn">Reject Optional</button>
            {showSettings
              ? <button onClick={() => persist(prefs)} className="btn-primary !py-3 order-1 sm:order-3" data-testid="cookie-save-btn">Save Preferences</button>
              : <button onClick={() => persist({ analytics: true, marketing: true })} className="btn-primary !py-3 order-1 sm:order-3" data-testid="cookie-accept-btn">Accept All</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
