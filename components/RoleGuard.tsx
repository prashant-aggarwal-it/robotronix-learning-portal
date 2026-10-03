"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { appMode } from "@/lib/config";
import { getCurrentProfile } from "@/lib/repository";
import type { UserRole } from "@/lib/types";

export function RoleGuard({ allow, children }: { allow: UserRole[]; children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(appMode === "demo");
  useEffect(() => {
    if (appMode === "demo") return;
    getCurrentProfile().then(profile => {
      if (!profile || !allow.includes(profile.role)) router.replace("/");
      else setReady(true);
    });
  }, [router, allow.join("|")]);
  if (!ready) return <div className="loginShell"><div className="card">Checking your Robotronix™ account…</div></div>;
  return <>{children}</>;
}
