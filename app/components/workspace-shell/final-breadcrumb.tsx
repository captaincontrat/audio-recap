"use client";

import { usePushFinalCrumb } from "./breadcrumb-context";

// Tiny client helper that lets a server page override the breadcrumb
// band's final crumb without forcing the rest of the page into
// `"use client"`. Renders nothing — its only job is to call
// `usePushFinalCrumb` so the band shows a meaningful label
// (e.g. "Submit a meeting") instead of the URL segment fallback
// ("New").
export function FinalBreadcrumb({ label }: { label: string }) {
  usePushFinalCrumb(label);
  return null;
}
