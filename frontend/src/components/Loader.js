import React, { useEffect, useRef, useState } from "react";

const LOGO_LIGHT = "/logo-plum.webp";  // plum wordmark for cream bg
const LOGO_DARK = "/logo-cream.webp";  // cream wordmark for dark bg

// Full-screen branded loader: centered logo + percentage counter at the bottom.
export function BrandLoader({ onDone, minDuration = 900 }) {
  const [pct, setPct] = useState(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const start = Date.now();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setPct(100);
      if (onDoneRef.current) setTimeout(() => onDoneRef.current && onDoneRef.current(), 240);
    };
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const target = Math.min(100, Math.round((elapsed / minDuration) * 100));
      setPct(target);
      if (elapsed >= minDuration) { clearInterval(id); finish(); }
    }, 40);
    const guard = setTimeout(finish, minDuration + 500);
    return () => { clearInterval(id); clearTimeout(guard); };
  }, [minDuration]);

  return (
    <div className={`fixed inset-0 z-[9999] bg-cream flex flex-col items-center justify-center ${minDuration <= 500 ? "loader-autohide-fast" : "loader-autohide"}`} data-testid="brand-loader">
      <div className="flex-1 flex items-center justify-center px-10">
        <div className="relative">
          <img src={LOGO_LIGHT} alt="ARTFUL" className="dark:hidden w-48 sm:w-60 animate-pulse-soft" />
          <img src={LOGO_DARK} alt="ARTFUL" className="hidden dark:block w-48 sm:w-60 animate-pulse-soft" />
        </div>
      </div>
      <div className="w-full max-w-xs mb-16 px-8">
        <div className="h-[3px] w-full bg-line overflow-hidden rounded-full">
          <div className="h-full bg-plum transition-all duration-150 ease-out" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-4 text-center font-mono text-sm text-plum tracking-[0.3em]" data-testid="loader-percent">{pct}%</div>
      </div>
    </div>
  );
}

export function Spinner({ className = "" }) {
  return <div className={`inline-block w-6 h-6 border-2 border-plum/30 border-t-plum rounded-full animate-spin ${className}`} />;
}

export function PageLoader() {
  return (
    <div className="min-h-[55vh] flex flex-col items-center justify-center gap-4" data-testid="page-loader">
      <img src={LOGO_LIGHT} alt="ARTFUL" className="dark:hidden w-32 animate-pulse-soft" />
      <img src={LOGO_DARK} alt="ARTFUL" className="hidden dark:block w-32 animate-pulse-soft" />
      <Spinner />
    </div>
  );
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
