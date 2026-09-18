import * as Lucide from "lucide-react";
import { Sparkles } from "lucide-react";

// Resolve a lucide icon component by its string name (sent from the backend/admin).
export function Icon({ name, ...props }) {
  const Cmp = (name && Lucide[name]) || Sparkles;
  return <Cmp {...props} />;
}

export function getIcon(name) {
  return (name && Lucide[name]) || Sparkles;
}
