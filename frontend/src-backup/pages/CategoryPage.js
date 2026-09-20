import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import Catalog from "../components/Catalog";

export default function CategoryPage() {
  const { slug } = useParams();
  const [cat, setCat] = useState(null);
  useEffect(() => { api.get(`/categories/${slug}`).then(({ data }) => setCat(data)).catch(() => setCat(null)); }, [slug]);
  return <Catalog key={slug} fixed={{ category: slug }} title={cat?.name || "Category"} subtitle={cat?.description} />;
}
