"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";

type Administrator={user_id:string;role_key:string;active:boolean;created_at:string;email?:string|null;display_name?:string|null};
type Audit={id:string;actor_user_id:string;subject_user_id:string|null;action:string;occurred_at:string};
const readableDate=(date:string)=>{const time=Date.parse(date);return Number.isFinite(time)?new Date(time).toLocaleString():"Not available";};
export default function PlatformSecurity(){
 const [administrators,setAdministrators]=useState<Administrator[]>([]);
 const [audit,setAudit]=useState<Audit[]>([]);
 const [truncated,setTruncated]=useState(false);
 const [email,setEmail]=useState("");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [refresh,setRefresh]=useState(0);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 async function authHeader(){
  const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
  if(!session)throw Error("Sign in first");
  return {Authorization:"Bearer "+session.access_token};
 }
 async function load(){
  const headers=await authHeader();
  const response=await fetch("/api/platform-admin/administrators",{headers,cache:"no-store"});
  const result=await response.json();
  if(!response.ok||!result.ok)throw Error(result.error||"Unable to load administrator directory");
  return result as {administrators:Administrator[];audit:Audit[];truncated:boolean};
 }
 useEffect(()=>{
  let active=true;setLoading(true);
  void load().then(result=>{if(active){
   setAdministrators(result.administrators||[]);setAudit(result.audit||[]);setTruncated(!!result.truncated);setError("");
  }}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Administrator directory unavailable")})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[refresh]);
 async function changeAccess(action:"grant_platform_admin"|"revoke_platform_admin",target?:Administrator){
  if(busy)return;
  const address=(target?.email||email).trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)){setError("Enter a valid verified email address.");return;}
  if(action==="revoke_platform_admin"){
   const confirmation=window.prompt("Revoke platform access for "+address+"? Type the exact email to confirm.");
   if(confirmation?.trim().toLowerCase()!==address)return;
  }
  setBusy(true);setError("");setMessage("");
  try{
   const headers=await authHeader();
   let targetUserId=target?.user_id;
   if(!targetUserId){
    const lookupResponse=await fetch("/api/platform-admin/administrators?email="+encodeURIComponent(address),{headers,cache:"no-store"});
    const lookup=await lookupResponse.json();
    if(!lookupResponse.ok||!lookup.ok)throw Error(lookup.error||"Unable to verify account");
    if(!lookup.verifiedUserId)throw Error(lookup.lookupLimited?"Account lookup reached its safety limit. No changes were made.":"No verified account with this email was found.");
    targetUserId=lookup.verifiedUserId;
   }
   const response=await fetch("/api/platform-admin/manage",{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({action,targetUserId})});
   const result=await response.json();
   if(!response.ok||!result.ok)throw Error(result.error||"Access change failed");
   setMessage(action==="grant_platform_admin"?"Administrator access granted to "+address:"Administrator access revoked for "+address);
   if(action==="grant_platform_admin")setEmail("");
   setRefresh(v=>v+1);
  }catch(e){setError(e instanceof Error?e.message:"Access change failed")}
  finally{setBusy(false)}
 }
 const activeAdmins=administrators.filter(x=>x.active);
 const displayName=(a:Administrator)=>a.display_name||a.email||"Account details unavailable";
 const identity=(id:string|null)=>!id?"—":administrators.find(a=>a.user_id===id)?.email||"Administrator account";
 return <div className="platformSecurityWorkspace">
  <div className="platformSecuritySummary" aria-label="Administrator overview">
   <div className="platformSecurityMetric"><span>Active administrators</span><strong>{loading?"—":activeAdmins.length}</strong><small>Platform-wide privileged access</small></div>
   <div className="platformSecurityMetric"><span>Recent access events</span><strong>{loading?"—":audit.length}</strong><small>Returned by the audit service</small></div>
  </div>
  <section className="platformPanel platformSecurity" aria-label="Platform administrators">
   <div className="platformSecurityHeading"><div><h2>Platform administrators</h2><p>Only verified platform accounts should receive access. The last active administrator cannot be revoked.</p></div>
    <button type="button" disabled={loading||busy} onClick={()=>setRefresh(v=>v+1)}>{loading?"Loading…":"Refresh"}</button>
   </div>
   {error&&<p role="alert" className="platformSecurityError">{error}</p>}
   {loading?<p role="status">Loading administrator records…</p>:administrators.length===0?<p>No administrator records returned.</p>:
    <div className="platformTableScroll"><table className="platformSecurityTable"><thead><tr><th>Administrator</th><th>Role</th><th>Access</th><th>Added</th><th>Action</th></tr></thead><tbody>
    {administrators.map((a,i)=><tr key={a.user_id||i}>
     <td><strong>{displayName(a)}</strong>{a.display_name&&a.email&&<small>{a.email}</small>}</td>
     <td>{a.role_key==="super_admin"?"Super Admin":a.role_key.replaceAll("_"," ")}</td>
     <td><span className={"platformSecurityStatus "+(a.active?"isActive":"")}>{a.active?"Active":"Inactive"}</span></td>
     <td>{readableDate(a.created_at)}</td>
     <td>{a.active?<button type="button" className="platformRevokeButton" disabled={busy||loading||activeAdmins.length<=1||!a.email} title={!a.email?"Email not available for secure confirmation":activeAdmins.length<=1?"The last administrator cannot be revoked":undefined} onClick={()=>void changeAccess("revoke_platform_admin",a)}>Revoke access</button>:<span>—</span>}</td>
    </tr>)}
    </tbody></table></div>}
   {truncated&&<p role="status">The administrator directory is limited. Review additional records through your privileged backend audit.</p>}
  </section>
  <section className="platformPanel platformSecurity" aria-label="Grant administrator access">
   <h2>Grant administrator access</h2>
   <p>Enter an existing, verified account email. Administrator access is platform-wide, not limited to one customer.</p>
   <form className="platformSecurityForm" onSubmit={e=>{e.preventDefault();void changeAccess("grant_platform_admin")}}>
    <label htmlFor="platform-admin-email">Verified account email</label>
    <div className="platformSecurityGrantRow">
     <input id="platform-admin-email" required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="off" placeholder="admin@example.com" disabled={busy}/>
     <button type="submit" disabled={busy||!email.trim()}>{busy?"Working…":"Grant access"}</button>
    </div>
    {message&&<p role="status" className="platformSecuritySuccess">{message}</p>}
   </form>
  </section>
  <section className="platformPanel platformSecurity" aria-label="Recent administrator access activity">
   <h2>Recent access activity</h2><p>Changes recorded in the platform security audit (not a complete customer activity history).</p>
   {loading?<p role="status">Loading security events…</p>:audit.length===0?<p>No recent administrator access events returned.</p>:
   <div className="platformTableScroll"><table className="platformSecurityTable"><thead><tr><th>Time</th><th>Change</th><th>Performed by</th><th>Account</th></tr></thead><tbody>
    {audit.slice(0,12).map((a,i)=><tr key={a.id||i}><td>{readableDate(a.occurred_at)}</td><td>{a.action.replace(/:([0-9a-f-]{36})$/i,"").replaceAll("_"," ")}</td><td>{identity(a.actor_user_id)}</td><td>{identity(a.subject_user_id)}</td></tr>)}
   </tbody></table></div>}
  </section>
 </div>;
}
