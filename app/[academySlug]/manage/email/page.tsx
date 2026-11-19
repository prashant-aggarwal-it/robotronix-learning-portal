"use client";
import Link from "next/link";
import {useParams} from "next/navigation";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Connection={provider:string;status:string;sender_email:string|null;sender_verified_at:string|null;last_checked_at:string|null;last_error_code:string|null};
const providers=[{key:"google",name:"Gmail / Google Workspace"},{key:"microsoft",name:"Microsoft 365 / Outlook"},{key:"smtp",name:"Hostinger / Other SMTP"}];
export default function AcademyEmailSettings(){
 const {academySlug}=useParams<{academySlug:string}>();
 const [name,setName]=useState(""),[connections,setConnections]=useState<Connection[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(true);
 useEffect(()=>{let active=true;(async()=>{try{
  const client=getSupabaseBrowserClient();if(!client)throw Error("Authentication unavailable");
  const {data:{session}}=await client.auth.getSession();if(!session)throw Error("Sign in first");
  const {data:rows,error:membershipError}=await client.rpc("saas_my_workspaces");
  if(membershipError)throw membershipError;
  const org=(Array.isArray(rows)?rows:[]).find((x:{slug:string;role:string;modules:string[]})=>x.slug===academySlug&&x.modules.includes("academy")&&["owner","admin"].includes(x.role));
  if(!org)throw Error("Academy owner or administrator access required");
  const response=await fetch("/api/academy/email-connections?organizationId="+encodeURIComponent(org.id),{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
  const body=await response.json();
  if(!response.ok)throw Error(body.error||"Email settings unavailable");
  if(active){setName(body.organization.displayName);setConnections(body.connections||[]);}
 }catch(e){if(active)setError(e instanceof Error?e.message:"Unable to load email settings");}
 finally{if(active)setBusy(false);}})();return()=>{active=false};},[academySlug]);
 return <main style={{minHeight:"100vh",background:"#f4f7fd",padding:"32px 20px",fontFamily:"system-ui",color:"#192541"}}>
  <div style={{maxWidth:900,margin:"auto"}}>
   <Link href={"/"+academySlug+"/manage"}>← Academy management</Link>
   <h1 style={{fontSize:32,marginBottom:8}}>Academy email</h1>
   <p style={{color:"#526179"}}>Your academy will send emails only through its own authorized account. Robotronix platform SMTP is never used for academy notifications.</p>
   {busy&&<p role="status">Loading email connection status…</p>}
   {error&&<p role="alert" style={{color:"#a32347"}}>{error}</p>}
   {!busy&&!error&&<><h2>{name}</h2>
    <p style={{padding:16,background:"#fff8e8",borderRadius:12,border:"1px solid #ead6a8"}}>Academy email sending is disabled until a provider is securely connected and verified. Connection setup is being implemented in the next integration phases.</p>
    <div style={{display:"grid",gap:14}}>
     {providers.map(p=>{const c=connections.find(x=>x.provider===p.key);return <section key={p.key} style={{padding:22,background:"white",border:"1px solid #dce3ef",borderRadius:16}}>
      <h3 style={{margin:"0 0 8px"}}>{p.name}</h3>
      <p style={{margin:"0 0 6px"}}>Status: <strong>{c?.status||"Not connected"}</strong></p>
      {c?.sender_email&&<p>Sender: {c.sender_email}</p>}
      {c?.last_error_code&&<p role="status">Connection issue: {c.last_error_code}</p>}
      <small style={{color:"#526179"}}>Connection setup not yet available. No email will be sent through this provider.</small>
     </section>})}
    </div>
   </>}
  </div>
 </main>;
}
