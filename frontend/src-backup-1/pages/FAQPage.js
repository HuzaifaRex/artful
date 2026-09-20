import React, { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { api } from "../lib/api";

export default function FAQPage() {
  const [faqs, setFaqs] = useState([]);
  const [open, setOpen] = useState(null);
  useEffect(() => { api.get("/faqs").then(({ data }) => setFaqs(data.items)).catch(() => {}); }, []);
  const groups = faqs.reduce((acc, f) => { (acc[f.category] = acc[f.category] || []).push(f); return acc; }, {});
  return (
    <div className="container-artful py-16 max-w-3xl mx-auto">
      <h1 className="section-title text-center mb-12">Frequently Asked Questions</h1>
      {Object.entries(groups).map(([cat, items]) => (
        <div key={cat} className="mb-10">
          <h2 className="label-caption mb-4">{cat}</h2>
          <div className="divide-y divide-line border-y border-line">
            {items.map((f) => (
              <div key={f.id}>
                <button onClick={() => setOpen(open === f.id ? null : f.id)} className="w-full flex justify-between items-center py-4 text-left" data-testid={`faq-${f.id}`}>
                  <span className="text-ink font-medium pr-4">{f.question}</span>
                  <ChevronDown size={18} className={`text-plum shrink-0 transition-transform ${open === f.id ? "rotate-180" : ""}`} />
                </button>
                {open === f.id && <p className="pb-4 text-ink-secondary text-sm leading-relaxed">{f.answer}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
