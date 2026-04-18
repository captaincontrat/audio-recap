"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

// Lets a page push a human-readable label for the breadcrumb's final
// (page-title) crumb so the band never shows a raw id (for example a
// transcript's display title or a meeting's status title). The hook
// is a no-op outside the shell so existing pages do not throw when
// rendered without it.
type BreadcrumbContextValue = {
  finalCrumbLabel: string | null;
  setFinalCrumbLabel(label: string | null): void;
};

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [finalCrumbLabel, setFinalCrumbLabel] = useState<string | null>(null);
  const value = useMemo<BreadcrumbContextValue>(() => ({ finalCrumbLabel, setFinalCrumbLabel }), [finalCrumbLabel]);
  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

export function useBreadcrumbContext(): BreadcrumbContextValue | null {
  return useContext(BreadcrumbContext);
}

// Page-side helper. Pages call this with the full label; the band
// truncates and adds the tooltip itself. Resetting on unmount keeps
// stale labels from leaking into the next route.
export function usePushFinalCrumb(label: string | null) {
  const ctx = useBreadcrumbContext();
  useEffect(() => {
    if (!ctx) return;
    ctx.setFinalCrumbLabel(label);
    return () => {
      ctx.setFinalCrumbLabel(null);
    };
  }, [ctx, label]);
}
