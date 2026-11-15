"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {loadAuthDeployment,loadSignedInAccess} from "@/lib/platform/auth-client";
import {resolveAuthDestination} from "@/lib/platform/auth-routing";

export default function OrganizationOnboarding(){
 const router=useRouter();
 const [status,setStatus]=useState<"checking"|"ready"|"error">("checking");
 const [message,setMessage]=useState("");
 useEffect(()=>{
  let active=true;
  async function check(){
   try{
    const client=getSupabaseBrowserClient();
    if(!client)throw Error("Authentication is unavailable.");
    const {data:{session}}=await client.auth.getSession();
    if(!active)return;
    if(!session){router.replace("/login");return;}
    const config=await loadAuthDeployment();
    if(config.mode!=="combined"||config.legacyDefault){router.replace("/");return;}
    const access=await loadSignedInAccess(config);
    const next=resolveAuthDestination(config,access,null);
    if(!active)return;
    if(next.denied){setMessage(next.denied);setStatus("error");return;}
    if(next.path!=="/onboarding/organization"){router.replace(next.path);return;}
    setStatus("ready");
   }catch{if(active){setMessage("Unable to verify your account. Please sign in again.");setStatus("error");}}
  }
  void check();return()=>{active=false};
 },[router]);
 return <main className="authPage"><section className="authCard">
  <Link href="/" className="authBrand"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/></Link>
  <div className="formStepHead"><span>ORGANIZATION SETUP</span><h1>Set up your academy</h1><p>Your account is signed in. The next step is creating or joining your academy workspace.</p></div>
  {status==="checking"&&<p role="status">Checking your account access…</p>}
  {status==="error"&&<div className="errorBanner" role="alert">{message}</div>}
  {status==="ready"&&<div className="infoBanner" role="status">
    <strong>Organization setup is not available yet.</strong>
    <p>Self-service organization creation, owner membership and module provisioning will be implemented in Milestone A, Phase 3. No workspace or access permissions have been created for this account.</p>
  </div>}
  <p style={{marginTop:22}}><Link href="/login">Return to sign in</Link></p>
 </section></main>;
}
