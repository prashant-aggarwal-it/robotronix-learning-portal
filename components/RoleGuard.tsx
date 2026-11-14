"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { appMode } from "@/lib/config";
import { getCurrentProfile } from "@/lib/repository";
import {getSupabaseBrowserClient,setAcademyBrowserOrganizationContext,getAcademyBrowserOrganizationContext} from "@/lib/supabase/browser";
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
        if(profile&&allow.includes(profile.role)){
          // Resolve the selected school BEFORE mounting existing pages that
          // immediately load Supabase records. Database RLS revalidates the
          // organization for every request, not this browser flag.
          const db=getSupabaseBrowserClient();
          const {data:{session}}=await db!.auth.getSession();
          if(!session?.access_token){if(!cancelled)router.replace("/");return}
          let selection:"ready"|"choose"|"unavailable"="ready";
          try{
            const res=await fetch("/api/platform/organizations",{
              cache:"no-store",headers:{Authorization:"Bearer "+session.access_token}
            });
            if(res.ok){
              const payload=await res.json();
              if(Array.isArray(payload.organizations)&&payload.organizations.length>0){
                if(typeof payload.selectedOrganizationId==="string"){
                  setAcademyBrowserOrganizationContext(payload.selectedOrganizationId);
                }else selection="choose";
              }else setAcademyBrowserOrganizationContext(null);
            }else if(res.status===403){
              await fetch("/api/platform/organizations",{method:"DELETE",headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"}).catch(()=>null);
              setAcademyBrowserOrganizationContext(null);
              selection="choose";
            }
            else if(res.status===401){if(!cancelled)router.replace("/");return}
            else if(res.status===503&&getAcademyBrowserOrganizationContext())selection="unavailable";
            // Standalone Academy installations need not install the SaaS module.
          }catch{
            if(getAcademyBrowserOrganizationContext())selection="unavailable";
          }
          if(cancelled)return;
          if(selection!=="ready"){router.replace("/suite");return}
          setReady(true);return
        }
        if(attempt<2)await new Promise(resolve=>window.setTimeout(resolve,250*(attempt+1)));
      }
      if(!cancelled)router.replace("/");
    })();
    return()=>{cancelled=true};
  }, [router, allow.join("|")]);
  if (!ready) return <div className="loginShell"><div className="card">Checking your Robotronix™ account…</div></div>;
  return <>{children}</>;
}
