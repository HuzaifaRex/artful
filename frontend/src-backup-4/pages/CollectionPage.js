import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useStore } from "../context/StoreContext";
import { api } from "../lib/api";
import Catalog from "../components/Catalog";

export default function CollectionPage() {
  const { slug } = useParams();
  const location = useLocation();
  const { settings } = useStore();
  const key = slug || "bestsellers";
  const [col, setCol] = useState(null);
  useEffect(() => { api.get(`/collections/${key}`).then(({ data }) => setCol(data)).catch(() => setCol(null)); }, [key]);
  const fallbackTitle = key ? key.split("-").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") : "Shop All";
  const pageConfig = (settings?.navigation_menu || []).find((entry) => entry.to === location.pathname || entry.to === `/collections/${key}`);
  return <Catalog key={key || "all"} fixed={key ? { collection: key } : {}} title={pageConfig?.page_heading || col?.name || fallbackTitle} subtitle={pageConfig?.page_subheading || col?.description || "Discover pieces thoughtfully selected for you."} />;
}
