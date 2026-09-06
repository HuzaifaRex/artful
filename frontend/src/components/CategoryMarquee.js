import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { getIcon } from "../lib/icons";

// Auto-running, clickable category marquee shown right after the hero.
export default function CategoryMarquee() {
  const [cats, setCats] = useState([]);
  useEffect(() => { api.get("/categories").then(({ data }) => setCats(data.items || [])).catch(() => {}); }, []);
  if (!cats.length) return null;

  const row = [...cats, ...cats]; // duplicate for seamless loop

  return (
    <section className="bg-plum text-cream py-4 overflow-hidden border-y border-plum-wine/40" data-testid="category-marquee">
      <div className="flex animate-marquee marquee-track whitespace-nowrap will-change-transform">
        {row.map((c, i) => {
          const IconCmp = getIcon(c.icon);
          return (
            <Link
              key={c.slug + i}
              to={`/categories/${c.slug}`}
              className="group inline-flex items-center gap-2.5 mx-3 px-5 py-2.5 rounded-full bg-cream/5 hover:bg-gold hover:text-plum-wine transition-colors duration-300"
              data-testid={`marquee-cat-${c.slug}`}
            >
              <IconCmp size={17} className="text-gold-soft group-hover:text-plum-wine transition-colors shrink-0" />
              <span className="text-[13px] font-medium tracking-wide">{c.name}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
