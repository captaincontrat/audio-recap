"use client";

import { useEffect, useState } from "react";

// Detect macOS so the visible kbd hint and the suppress-while-IME
// guard can render the right modifier (`⌘` on macOS, `Ctrl`
// elsewhere). Defaults to non-macOS on the server so SSR output is
// stable; the value flips to `true` on the first client-side render
// when applicable, matching the platform the user actually has.
export function useIsMacOs(): boolean {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent;
    setIsMac(/Mac|iPhone|iPad|iPod/i.test(ua));
  }, []);
  return isMac;
}
