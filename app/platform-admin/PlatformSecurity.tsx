"use client";
import {useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";

export default function PlatformSecurity(){
 const [email,setEmail]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 async function changeAccess(action:"grant_platform_admin"|"revoke_platform_admin"){
  if(busy)return;
  const address=email.trim().toLowerCase();
  if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(address)){setError("Enter a valid verified email address.");return;}
  if(action==="revoke_platform_admin"&&!window.confirm("Revoke platform administrator access for "+address+"?"))return;
  setBusy(true);setError("");setMessage("");
  try{
   const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
   if(!session)throw Error("Sign in first");
   const headers={Authorization:"Bearer "+session.access_token};
   const lookupResponse=await fetch("/api/platform-admin/administrators?email="+encodeURIComponent(address),{headers,cache:"no-store"});
   const lookup=await lookupResponse.json();
   if(!lookupResponse.ok||!lookup.ok)throw Error(lookup.error||"Unable to verify account");
   if(!lookup.verifiedUserId)throw Error(lookup.lookupLimited?"Account search limit reached; no change was made.":"No verified account with that email was found.");
   const response=await fetch("/api/platform-admin/manage",{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({action,targetUserId:lookup.verifiedUserId})});
   const result=await response.json();
   if(!response.ok||!result.ok)throw Error(result.error||"Access change failed");
   setMessage(action==="grant_platform_admin"?"Administrator access granted to "+address:"Administrator access revoked for "+address);
  }catch(e){setError(e instanceof Error?e.message:"Access change failed")}
  finally{setBusy(false)}
 }
 return <section className="platformPanel platformSecurity" aria-label="Platform administrator security">
  <h2>Platform administrator access</h2>
  <p>Grant or revoke platform-wide access for an existing, verified account. Changes are audited and the last active administrator is protected.</p>
  <div className="platformSecurityForm">
   <label htmlFor="platform-admin-email">Verified account email</label>
   <input id="platform-admin-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="off" placeholder="admin@example.com" disabled={busy}/>
   <div className="platformSecurityActions">
    <button type="button" disabled={busy||!email.includes("@")} onClick={()=>void changeAccess("grant_platform_admin")}>{busy?"Working…":"Grant access"}</button>
    <button type="button" disabled={busy||!email.includes("@")} onClick={()=>void changeAccess("revoke_platform_admin")}>Revoke access</button>
   </div>
   {error&&<p role="alert">{error}</p>}
   {message&&<p role="status">{message}</p>}
  </div>
 </section>;
}
