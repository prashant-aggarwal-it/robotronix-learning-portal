"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import "./welcome.css";

export default function TasksWelcome(){
 const router=useRouter();const [name,setName]=useState(""),[email,setEmail]=useState(""),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState("");
 useEffect(()=>{let active=true;void(async()=>{const client=getSupabaseBrowserClient();const {data:{session}}=await client?.auth.getSession()||{data:{session:null}};
  if(!active)return;if(!session){router.replace("/login?next=/tasks/welcome");return;}
  setEmail(session.user.email||"");setName(String(session.user.user_metadata?.full_name||session.user.email?.split("@")[0]||""));
  const res=await fetch("/api/tasks/onboarding",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});const body=await res.json().catch(()=>({}));
  if(!active)return;if(body.portalDisabled){setError("This Portal account has been disabled. Contact your administrator.");setLoading(false);return;}
  if(body.account?.status==="active"||body.portalActive){router.replace("/tasks");return;}
  if(!body.verifiedEmail)setError("Verify your sign-in email before activating My Tasks.");setLoading(false);
 })();return()=>{active=false}},[router]);
 const activate=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);setError("");try{const client=getSupabaseBrowserClient();const {data:{session}}=await client!.auth.getSession();if(!session)throw new Error("Sign in again.");
  const res=await fetch("/api/tasks/onboarding",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({display_name:name.trim()})});const result=await res.json();if(!res.ok)throw new Error(result.error||"Could not activate your account.");router.replace("/tasks");
 }catch(e){setError(e instanceof Error?e.message:"Unable to activate account.")}finally{setSaving(false)}};
 return <main className="tw-welcome-shell"><section className="tw-welcome-card"><div className="tw-welcome-mark">✦</div><span className="tw-welcome-overline">YOUR SPACE. YOUR MOMENTUM.</span><h1>Welcome to <em>My Tasks.</em></h1><p>A calmer way to stay on top of everything. Keep your personal work private, then invite colleagues when you are ready.</p>
  {loading?<div className="tw-welcome-loading">Preparing your space…</div>:<form onSubmit={activate}><label>Your name<input value={name} onChange={e=>setName(e.target.value)} required minLength={2} maxLength={100}/></label><small>Signed in as {email}</small>
    {error&&<div className="tw-welcome-error" role="alert">{error}</div>}<button disabled={saving||name.trim().length<2||Boolean(error&&error.includes("disabled"))}>{saving?"Setting up…":"Create my private workspace →"}</button></form>}
  <div className="tw-welcome-assurances"><span>🔒 Private by default</span><span>✦ Personal & team tasks</span><span>↗ Grow at your pace</span></div><Link href="/">Back to Robotronix</Link>
 </section></main>;
}
