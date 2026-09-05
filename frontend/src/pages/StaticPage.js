import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { PageLoader } from "../components/Loader";

export default function StaticPage({ slug }) {
  const [page, setPage] = useState(null);
  useEffect(() => { setPage(null); api.get(`/pages/${slug}`).then(({ data }) => setPage(data)).catch(() => setPage(false)); }, [slug]);
  if (page === null) return <PageLoader />;
  if (page === false) return <div className="container-artful py-24 text-center"><h1 className="section-title">Page not found</h1></div>;
  return (
    <div>
      <div className="bg-surface py-14"><div className="container-artful text-center"><h1 className="section-title">{page.title}</h1></div></div>
      <div className="container-artful py-14 max-w-3xl mx-auto">
        <div className="prose text-ink-secondary leading-relaxed text-lg whitespace-pre-line">{page.content}</div>
      </div>
    </div>
  );
}
