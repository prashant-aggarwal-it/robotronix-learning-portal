"use client";
import {formatPlatformLabel} from "./formatPlatformLabel";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Org={id:string;display_name:string;status:string};
type Level="standard"|"custom"|"white_label";
const descriptions:Record<Level,string>={
 standard:"Robotronix theme; saved customer branding is retained but not available to Owners",
 custom:"Customer logo, colors and tagline; Robotronix platform identity remains",
 white_label:"Full white-label branding access; effective appearance depends on the customer theme configuration"
};
async function authHeader(){
 const client=getSupabaseBrowserClient();if(!client)throw Error("Sign in first");
 const {data:{session}}=await client.auth.getSession();if(!session)throw Error("Sign in first");
 return {Authorization:"Bearer "+session.access_token};
}
export default function PlatformBrandingEntitlements({organizations,initialOrganizationId=""}:{organizations:Org[];initialOrganizationId?:string}){
 const [orgId,setOrgId]=useState(initialOrganizationId),[level,setLevel]=useState<Level|null>(null),[draft,setDraft]=useState<Level>("standard");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const [error,setError]=useState(""),[message,setMessage]=useState("");
 const selected=organizations.find(o=>o.id===orgId);
 useEffect(()=>{setOrgId(initialOrganizationId)},[initialOrganizationId]);
 useEffect(()=>{
  let current=true;setLevel(null);setDraft("standard");setError("");setMessage("");
  if(!orgId)return;
  setLoading(true);
  void (async()=>{
   const response=await fetch("/api/platform/branding-entitlements?organizationId="+encodeURIComponent(orgId),{headers:await authHeader(),cache:"no-store"});
   const json=await response.json();
   if(!response.ok||!json.ok||!["standard","custom","white_label"].includes(json.level))throw Error(json.error||"Unable to load branding level");
   return json.level as Level;
  })().then(value=>{if(current){setLevel(value);setDraft(value)}})
   .catch(e=>{if(current)setError(e instanceof Error?e.message:"Unable to load branding level")})
   .finally(()=>{if(current)setLoading(false)});
  return()=>{current=false};
 },[orgId]);
 async function save(){
  if(!selected||!level||draft===level||busy||loading)return;
  const isDowngrade=(level==="white_label"&&draft!=="white_label")||(level==="custom"&&draft==="standard");
  if(isDowngrade&&!window.confirm("Downgrade "+selected.display_name+"? Its saved logo, colors and tagline will be retained, but customization access may be disabled."))return;
  setBusy(true);setError("");setMessage("");
  try{
   const response=await fetch("/api/platform/branding-entitlements",{method:"POST",headers:{...await authHeader(),"Content-Type":"application/json"},body:JSON.stringify({organizationId:orgId,level:draft})});
   const json=await response.json();
   if(!response.ok||!json.ok)throw Error(json.error||"Could not update entitlement");
   // Re-read server state instead of trusting a stale selection.
   const refreshed=await fetch("/api/platform/branding-entitlements?organizationId="+encodeURIComponent(orgId),{headers:await authHeader(),cache:"no-store"});
   const current=await refreshed.json();
   if(!refreshed.ok||!current.ok)throw Error(current.error||"Could not verify saved entitlement");
   setLevel(current.level as Level);setDraft(current.level as Level);
   setMessage("Branding access updated. Existing logo, colors and tagline were retained.");
  }catch(e){setError(e instanceof Error?e.message:"Could not update entitlement")}
  finally{setBusy(false)}
 }
 return <section className="platformBrandingEntitlements" aria-label="Customer branding entitlements">
  <h2>Branding entitlements</h2>
  <p>Control customer branding access separately from Academy, CRM and Tasks subscriptions.</p>
  <label>Customer organization
   <select value={orgId} disabled={busy} onChange={e=>setOrgId(e.target.value)} aria-label="Branding customer">
    <option value="">Choose a customer</option>
    {organizations.map(o=><option key={o.id} value={o.id}>{o.display_name} ({formatPlatformLabel(o.status)})</option>)}
   </select>
  </label>
  {selected&&<div className="platformBrandingTierCard">
   <p role="status">{loading?"Loading branding entitlement…":level?"Current level: "+formatPlatformLabel(level):"Level unavailable"}</p>
   <label>Branding level
    <select aria-label="Branding level" disabled={busy||loading||!level||selected.status==="archived"} value={draft} onChange={e=>setDraft(e.target.value as Level)}>
     <option value="standard">Standard</option><option value="custom">Custom Branding</option><option value="white_label">Full White-label</option>
    </select>
   </label>
   <p>{descriptions[draft]}</p>
   <button type="button" disabled={busy||loading||!level||draft===level||selected.status==="archived"} onClick={()=>void save()}>{busy?"Saving…":"Update branding access"}</button>
  </div>}
  {error&&<p role="alert">{error}</p>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
