"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      if (!response.ok) {
        setSubmitting(false);
        return;
      }
      router.push("/sign-in");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Button type="button" onClick={handleClick} disabled={submitting} className={className}>
      {submitting ? "Signing out…" : "Sign out"}
    </Button>
  );
}
