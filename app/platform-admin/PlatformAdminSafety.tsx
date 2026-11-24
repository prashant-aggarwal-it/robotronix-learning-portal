"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Admin={user_id:string;role_key:string;active:boolean;created_at:string};
type Audit={id:string;actor_user_id:string;subject_user_id:string|null;action:string;occurred_at:string};
export default function PlatformAdminSafety(){
 const [administrators,setAdministrators]=useState<Admin[]>([]);
 const [audit,setAudit]=useState<Audit[]>([]);
 const [email,setEmail]=useState("");
 const [verifiedId,setVerifiedId]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const [refresh,setRefresh]=useState(0);
 async function request(query=""){
  const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
  if(!session)throw Error("Sign in first");
  const response=await fetch("/api/platform-admin/administrators"+query,{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
  const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error||"Unable to load platform safety records");
  return body;
 }
 useEffect(()=>{let active=true;void request().then(data=>{if(active){setAdministrators(data.administrators);setAudit(data.audit);setError("");}}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Unable to load")});return()=>{active=false}},[refresh]);
 async function lookup(){
  setBusy(true);setMessage("");setVerifiedId(null);
  try{
   setError("");
   const data=await request("?email="+encodeURIComponent(email.trim()));
   setVerifiedId(data.verifiedUserId);
   setMessage(data.verifiedUserId?"Verified account found. Confirm the required change below.":data.lookupLimited?"The lookup reached its safety limit. This does not prove the account is absent.":"No verified account matches this email. Do not grant access without verification.");
  }catch(e){setError(e instanceof Error?e.message:"Lookup failed")}finally{setBusy(false)}
 }
 async function changeAdmin(action:"grant_platform_admin"|"revoke_platform_admin"){
  if(!verifiedId||busy)return;
  const verb=action==="grant_platform_admin"?"grant":"revoke";
  const confirmation=window.prompt("To "+verb+" platform administrator access for "+email.trim()+", type the email address exactly:");
  if(confirmation!==email.trim())return;
  setBusy(true);setError("");setMessage("");
  try{
   const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
   if(!session)throw Error("Sign in first");
   const response=await fetch("/api/platform-admin/manage",{method:"POST",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({action,targetUserId:verifiedId})});
   const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error||"Access change rejected");
   setMessage(action==="grant_platform_admin"?"Administrator access granted.":"Administrator access revoked.");
   setVerifiedId(null);setRefresh(x=>x+1);
  }catch(e){setError(e instanceof Error?e.message:"Access change failed");}
  finally{setBusy(false)}
 }
 return <section className="platformPanel" aria-label="Platform administrator safety" style={{padding:20,marginBottom:20}}>
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
   <div><h2>Platform administrators and audit</h2><p>Restricted to verified platform administrators. Only audit metadata is displayed.</p></div>
   <button type="button" onClick={()=>setRefresh(v=>v+1)}>Refresh records</button>
  </div>
  {error&&<p role="alert">{error}</p>}
  <form onSubmit={e=>{e.preventDefault();void lookup()}} style={{display:"flex",flexWrap:"wrap",gap:8,alignItems:"end",marginBottom:18}}>
   <label>Find verified account by email <input type="email" required value={email} onChange={e=>{setEmail(e.target.value);setVerifiedId(null);setMessage("");}} placeholder="admin@example.com"/></label>
   <button type="submit" disabled={busy}>{busy?"Checking…":"Find verified user"}</button>
  </form>
  {message&&<p role="status">{message}</p>}
  {verifiedId&&<div className="platformVerifiedAdminActions"><strong>Verified account: {email.trim()}</strong><p>Platform administrator access applies across all customers, not just one academy. The last active administrator cannot be revoked.</p><div><button type="button" disabled={busy} onClick={()=>void changeAdmin("grant_platform_admin")}>Grant platform administrator</button><button type="button" disabled={busy} onClick={()=>void changeAdmin("revoke_platform_admin")}>Revoke platform administrator</button></div><details><summary>Technical account ID</summary><code>{verifiedId}</code></details></div>}
  <h3>Administrators</h3>
  <div className="platformTableScroll"><table><thead><tr><th>User ID</th><th>Role</th><th>Access</th><th>Added</th></tr></thead><tbody>
   {administrators.map(a=><tr key={a.user_id}><td><details><summary>{a.role_key==="super_admin"?"Super Admin":"Administrator"}</summary><code>{a.user_id}</code></details></td><td>{a.role_key}</td><td>{a.active?"Active":"Inactive"}</td><td>{new Date(a.created_at).toLocaleDateString()}</td></tr>)}
  </tbody></table></div>
  <h3 style={{marginTop:18}}>Recent administrator access audit</h3>
  <div className="platformTableScroll"><table><thead><tr><th>When</th><th>Action</th><th>Actor</th><th>Subject</th></tr></thead><tbody>
   {audit.map(a=><tr key={a.id}><td>{new Date(a.occurred_at).toLocaleString()}</td><td>{a.action.replaceAll("_"," ").replace(/:([0-9a-f-]{36})$/i,"")}</td><td><details><summary>Administrator</summary><code>{a.actor_user_id}</code></details></td><td>{a.subject_user_id?<details><summary>View subject ID</summary><code>{a.subject_user_id}</code></details>:"—"}</td></tr>)}
  </tbody></table></div>
  <p>Administrator audit records cover platform access changes; they are not a comprehensive audit of all customer operations.</p>
 </section>
}
