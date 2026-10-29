import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { PageLoader } from "../components/Loader";
import { sanitizeHtml } from "../lib/sanitizeHtml";

export default function StaticPage({ slug }) {
  const [page, setPage] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const canonical = ({ "privacy-policy": "privacy", "terms-and-conditions": "terms", "refund-policy": "returns", "refund-return-policy": "returns", "returns-and-refunds": "returns", "shipping-policy": "shipping" })[slug] || slug;
    setPage(null);
    api.get(`/pages/${canonical}`).then(({ data }) => { if (!cancelled) setPage(data); }).catch(() => {
      api.get(`/cms/page/${canonical}`).then(({ data }) => { if (!cancelled) setPage(data); }).catch(() => { if (!cancelled) setPage(false); });
    });
    return () => { cancelled = true; };
  }, [slug]);
  if (page === null) return <PageLoader />;
  if (page === false) return <div className="container-artful py-24 text-center"><h1 className="section-title">Page not found</h1></div>;
  return (
    <div>
      <div className="bg-surface py-14"><div className="container-artful text-center"><h1 className="section-title">{page.title}</h1></div></div>
      <div className="container-artful py-14 max-w-3xl mx-auto">
        <div className="prose prose-lg max-w-none text-ink-secondary leading-relaxed" data-testid="static-page-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.content || "") }} />
      </div>
    </div>
  );
}
