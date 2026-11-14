"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/repository";
import {setAcademyBrowserOrganizationContext} from "@/lib/supabase/browser";

export function SignOutButton({ className = "button ghost smallButton", label = "Sign out" }: { className?: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
    } finally {
      setAcademyBrowserOrganizationContext(null);
      router.replace("/");
      router.refresh();
      setBusy(false);
    }
  }

  return <button type="button" className={className} onClick={handleSignOut} disabled={busy}>{busy ? "Signing out…" : label}</button>;
}
