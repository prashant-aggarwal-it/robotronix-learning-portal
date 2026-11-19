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
   setMessage(data.verifiedUserId?"Verified account found. Copy the user ID to the customer access panel to grant rights.":data.lookupLimited?"The lookup reached its safety limit. This does not prove the account is absent.":"No verified account matches this email. Do not grant access without verification.");
  }catch(e){setError(e instanceof Error?e.message:"Lookup failed")}finally{setBusy(false)}
 }
 return <section className="platformPanel" aria-label="Platform administrator safety" style={{padding:20,marginBottom:20}}>
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
   <div><h2>Platform administrators and audit</h2><p>Restricted to verified platform administrators. Only audit metadata is displayed.</p></div>
   <button type="button" onClick={()=>setRefresh(v=>v+1)}>Refresh records</button>
  </div>
  {error&&<p role="alert">{error}</p>}
  <form onSubmit={e=>{e.preventDefault();void lookup()}} style={{display:"flex",flexWrap:"wrap",gap:8,alignItems:"end",marginBottom:18}}>
   <label>Verify existing administrator email <input type="email" required value={email} onChange={e=>{setEmail(e.target.value);setVerifiedId(null);setMessage("");}} placeholder="admin@example.com"/></label>
   <button type="submit" disabled={busy}>{busy?"Checking…":"Find verified user"}</button>
  </form>
  {message&&<p role="status">{message}</p>}
  {verifiedId&&<p>Verified user ID: <code>{verifiedId}</code> <button type="button" onClick={()=>void navigator.clipboard.writeText(verifiedId)}>Copy ID</button></p>}
  <h3>Administrators</h3>
  <div className="platformTableScroll"><table><thead><tr><th>User ID</th><th>Role</th><th>Access</th><th>Added</th></tr></thead><tbody>
   {administrators.map(a=><tr key={a.user_id}><td><code>{a.user_id}</code></td><td>{a.role_key}</td><td>{a.active?"Active":"Inactive"}</td><td>{new Date(a.created_at).toLocaleDateString()}</td></tr>)}
  </tbody></table></div>
  <h3 style={{marginTop:18}}>Recent administrator access audit</h3>
  <div className="platformTableScroll"><table><thead><tr><th>When</th><th>Action</th><th>Actor</th><th>Subject</th></tr></thead><tbody>
   {audit.map(a=><tr key={a.id}><td>{new Date(a.occurred_at).toLocaleString()}</td><td>{a.action}</td><td><code>{a.actor_user_id}</code></td><td><code>{a.subject_user_id||"—"}</code></td></tr>)}
  </tbody></table></div>
  <p>Administrator audit records cover platform access changes; they are not a comprehensive audit of all customer operations.</p>
 </section>
}
