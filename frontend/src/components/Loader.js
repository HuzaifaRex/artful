import React from "react";

export function Spinner({ className = "" }) {
  return <div className={`inline-block w-6 h-6 border-2 border-plum/30 border-t-plum rounded-full animate-spin ${className}`} />;
}

export function PageLoader() {
  return <div className="min-h-[50vh] flex items-center justify-center"><Spinner className="!w-8 !h-8" /></div>;
}

export function ProductSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[4/5] bg-surface" />
      <div className="h-4 bg-surface mt-4 w-3/4 mx-auto" />
      <div className="h-3 bg-surface mt-2 w-1/3 mx-auto" />
    </div>
  );
}
