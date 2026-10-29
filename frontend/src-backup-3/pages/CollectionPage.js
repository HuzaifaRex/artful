import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import Catalog from "../components/Catalog";

export default function CollectionPage() {
  const { slug } = useParams();
  const key = slug || "bestsellers";
  const [col, setCol] = useState(null);
  useEffect(() => { api.get(`/collections/${key}`).then(({ data }) => setCol(data)).catch(() => setCol(null)); }, [key]);
  return <Catalog key={key} fixed={{ collection: key }} title={col?.name || "Collection"} subtitle={col?.description} />;
}
