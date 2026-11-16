"use client";
import {useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Org={id:string;display_name:string;slug:string};
export default function PlatformTenantBranding({organizations}:{organizations:Org[]}){
 const [organizationId,setOrganizationId]=useState("");
 const [tagline,setTagline]=useState("Thinkers, Creators & Innovators");
 const [logoUrl,setLogoUrl]=useState("");
 const [accentColor,setAccentColor]=useState("#4537a5");
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 async function save(){
  setBusy(true);setMessage("");
  try{
   const client=getSupabaseBrowserClient();if(!client)throw Error("Sign in first");
   const {data:{session}}=await client.auth.getSession();if(!session)throw Error("Sign in first");
   const response=await fetch("/api/platform-admin/branding",{method:"POST",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({organizationId,tagline,logoUrl,accentColor})});
   const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||"Branding unavailable");
   setMessage("Branding saved for "+result.slug);
  }catch(e){setMessage(e instanceof Error?e.message:"Branding unavailable")}finally{setBusy(false)}
 }
 return <section style={{border:"1px solid #ddd5eb",borderRadius:16,padding:20,marginBottom:24}}>
 <h2>Tenant branding</h2><p>Configure Academy identity only after creating the organization and verified Owner through the standard onboarding process.</p>
 <div style={{display:"grid",gap:12,maxWidth:560}}>
 <label>Organization<select value={organizationId} onChange={e=>setOrganizationId(e.target.value)}><option value="">Select tenant</option>{organizations.map(o=><option key={o.id} value={o.id}>{o.display_name} ({o.slug})</option>)}</select></label>
 <label>Tagline<input value={tagline} maxLength={180} onChange={e=>setTagline(e.target.value)} style={{display:"block",width:"100%"}}/></label>
 <label>HTTPS logo URL<input type="url" value={logoUrl} onChange={e=>setLogoUrl(e.target.value)} placeholder="https://…" style={{display:"block",width:"100%"}}/></label>
 <label>Accent color<input type="color" value={accentColor} onChange={e=>setAccentColor(e.target.value)}/></label>
 <button disabled={busy||!organizationId} onClick={()=>void save()}>{busy?"Saving…":"Save tenant branding"}</button>
 {message&&<p role="status">{message}</p>}
 </div></section>;
}
