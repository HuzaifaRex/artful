import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, X } from "lucide-react";
import { api } from "../lib/api";

function useCountdown(target) {
  const [left, setLeft] = useState(null);
  useEffect(() => {
    if (!target) return;
    const tick = () => {
      const diff = new Date(target).getTime() - Date.now();
      if (diff <= 0) { setLeft(null); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLeft({ d, h, m, s });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return left;
}

export default function CampaignBar() {
  const [c, setC] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const left = useCountdown(c?.countdown ? c?.end_date : null);
  useEffect(() => { api.get("/cms/active-campaign").then(({ data }) => setC(data.campaign)).catch(() => {}); }, []);
  if (!c || dismissed) return null;

  const seg = (v, l) => (
    <span className="inline-flex flex-col items-center leading-none">
      <span className="font-mono font-semibold text-sm sm:text-base tabular-nums">{String(v).padStart(2, "0")}</span>
      <span className="text-[8px] uppercase tracking-wider opacity-70">{l}</span>
    </span>
  );

  return (
    <div className="bg-gold text-plum-wine relative" data-testid="campaign-bar">
      <div className="container-artful py-2.5 flex items-center justify-center gap-4 flex-wrap text-center">
        <span className="text-xs sm:text-sm font-medium">{c.headline || c.name}</span>
        {c.countdown && left && (
          <span className="flex items-center gap-1.5 sm:gap-2"><Clock size={14} />{seg(left.d, "d")}<span className="opacity-50">:</span>{seg(left.h, "h")}<span className="opacity-50">:</span>{seg(left.m, "m")}<span className="opacity-50">:</span>{seg(left.s, "s")}</span>
        )}
        {c.cta_text && <Link to={c.cta_link || "/shop"} className="text-xs font-semibold uppercase tracking-widest border-b border-plum-wine/50 hover:border-plum-wine" data-testid="campaign-cta">{c.cta_text} →</Link>}
      </div>
      <button onClick={() => setDismissed(true)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100" aria-label="Dismiss"><X size={16} /></button>
    </div>
  );
}
