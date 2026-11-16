"use client";
import {FormEvent,useState} from "react";
import Link from "next/link";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
export default function OrganizationTrialPage(){
 const [name,setName]=useState("");const [slug,setSlug]=useState("");
 const [kind,setKind]=useState("academy");const [modules,setModules]=useState(["academy"]);
 const [requestKey,setRequestKey]=useState(()=>crypto.randomUUID());
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const [created,setCreated]=useState<{organizationId:string;slug:string}|null>(null);
 async function submit(e:FormEvent){
  e.preventDefault();if(busy)return;setBusy(true);setError("");
  try{
   const client=getSupabaseBrowserClient();if(!client)throw Error("Sign in first");
   const {data:{session}}=await client.auth.getSession();if(!session)throw Error("Sign in first");
   const res=await fetch("/api/platform/onboard",{method:"POST",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({name,slug,kind,modules,requestKey})});
   const data=await res.json();if(!res.ok||!data.ok)throw Error(data.error||"Unable to create organization");
   setCreated({organizationId:data.organizationId,slug:data.slug});
  }catch(e){setError(e instanceof Error?e.message:"Onboarding unavailable")}finally{setBusy(false)}
 }
 return <main style={{maxWidth:620,margin:"48px auto",padding:24,fontFamily:"system-ui"}}>
 <p style={{color:"#6742a1",fontWeight:700}}>ROBOTRONIX EDUCATION SUITE</p>
 <h1>Start your academy or tutor workspace</h1>
 <p>Sign in with a verified account before creating your organization. Your 14-day trial begins when you create it.</p>
 {created?<section role="status"><h2>Organization created</h2><p>{created.slug} is ready for initial setup.</p><Link href="/saas/academy">Continue to your workspace</Link></section>:
 <form onSubmit={submit} style={{display:"grid",gap:18}}>
 <label>Organization name<input required minLength={2} maxLength={160} value={name} onChange={e=>{setName(e.target.value);setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""))}} style={{display:"block",width:"100%",padding:12}}/></label>
 <label>Workspace URL slug<input required minLength={3} maxLength={63} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={e=>setSlug(e.target.value)} style={{display:"block",width:"100%",padding:12}}/></label>
 <label>Business type<select value={kind} onChange={e=>setKind(e.target.value)} style={{display:"block",width:"100%",padding:12}}><option value="academy">Academy</option><option value="institute">Institute</option><option value="tutor">Individual tutor</option></select></label>
 <fieldset><legend>Applications</legend>{(["academy","crm","tasks"] as const).map(m=><label key={m} style={{display:"block",padding:6}}><input type="checkbox" checked={modules.includes(m)} onChange={e=>setModules(old=>e.target.checked?[...old,m]:old.filter(x=>x!==m))}/> {m==="academy"?"Academy":m==="crm"?"CRM":"Tasks"}</label>)}</fieldset>
 {error&&<p role="alert" style={{color:"#a12c47"}}>{error}</p>}
 <button disabled={busy||modules.length===0} style={{padding:14,background:"#6742a1",color:"white",border:0,borderRadius:10}}>{busy?"Creating…":"Start trial"}</button>
 <p><Link href="/login">Sign in</Link> if you have not already.</p>
 </form>}
 </main>;
}
