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
    let cancelled=false;
    (async()=>{
      // OAuth/provider round-trips can restore the browser session a fraction
      // after the protected page mounts. Retry briefly before treating the user
      // as signed out so a successful Zoom connection returns to Admin cleanly.
      for(let attempt=0;attempt<3&&!cancelled;attempt++){
        const profile=await getCurrentProfile();
        if(profile&&allow.includes(profile.role)){setReady(true);return}
        if(attempt<2)await new Promise(resolve=>window.setTimeout(resolve,250*(attempt+1)));
      }
      if(!cancelled)router.replace("/");
    })();
    return()=>{cancelled=true};
  }, [router, allow.join("|")]);
  if (!ready) return <div className="loginShell"><div className="card">Checking your Robotronix™ account…</div></div>;
  return <>{children}</>;
}
