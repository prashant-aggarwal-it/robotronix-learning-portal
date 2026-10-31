"use client";
import Link from "next/link";
import {useCallback,useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";

type FamilyAccount={parentId:string;email:string;relationship:string;active:boolean;lastLoginAt:string|null;children:Array<{id:string;name:string}>};
type FamilyResponse={ok:boolean;email:string;status:string;accounts:FamilyAccount[];error?:string};
const formatDate=(value:string|null)=>value?new Date(value).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}):"Never signed in";
export function FamilyStudentAccess({studentId}:{studentId:string}){
 const [accounts,setAccounts]=useState<FamilyAccount[]>([]);
 const [primaryEmail,setPrimaryEmail]=useState("");
 const [newEmail,setNewEmail]=useState("");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const load=useCallback(async()=>{
  const client=getSupabaseBrowserClient();
  if(!client)throw new Error("Supabase is not configured.");
  const {data:{session}}=await client.auth.getSession();
  if(!session)throw new Error("Your administrator session has expired.");
  const response=await fetch(`/api/admin/portal-access?type=student&id=${encodeURIComponent(studentId)}&view=family`,{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});
  const data:FamilyResponse=await response.json();
  if(!response.ok||!data.ok)throw new Error(data.error||"Unable to load family access.");
  setAccounts(data.accounts||[]);
  setPrimaryEmail(data.email||"");
 },[studentId]);
 useEffect(()=>{let active=true;setLoading(true);setError("");load().catch(e=>{if(active)setError(e instanceof Error?e.message:"Unable to load family access.")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[load]);
 async function perform(action:"family_link"|"family_unlink"|"family_primary",email:string){
  const normalized=email.trim().toLowerCase();
  if(!normalized)return;
  if(action==="family_link"&&!window.confirm(`Give ${normalized} access to this learner? Verify they are an authorized guardian first.`))return;
  if(action==="family_unlink"&&!window.confirm(`Remove ${normalized}'s access to this learner only? Their access to other children will be preserved.`))return;
  if(action==="family_primary"&&!window.confirm(`Make ${normalized} the primary family login? The previous primary remains an additional guardian until explicitly removed.`))return;
  setBusy(true);setError("");setNotice("");
  try{
   const client=getSupabaseBrowserClient();
   if(!client)throw new Error("Supabase is not configured.");
   const {data:{session}}=await client.auth.getSession();
   if(!session)throw new Error("Sign in again.");
   const response=await fetch("/api/admin/portal-access",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({type:"student",id:studentId,action,email:normalized})});
   const data=await response.json();
   if(!response.ok||!data.ok)throw new Error(data.error||"Could not update family access.");
   await load();
   if(action==="family_link")setNewEmail("");
   setNotice("Family relationship updated. Access changes apply to this learner.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to save family access.");}
  finally{setBusy(false);}
 }
 const primary=accounts.filter(a=>a.email===primaryEmail.toLowerCase());
 const suspicious=accounts.filter(a=>a.relationship!=="Additional guardian"&&a.email!==primaryEmail.toLowerCase());
 const duplicates=accounts.length!==new Set(accounts.map(a=>a.email)).size;
 return <section className="panel" id="family-student-access" aria-label="Family and student access">
  <div className="panelHeader"><div><div className="eyebrow">FAMILY RELATIONSHIPS</div><h2>Family & Student Access</h2><p>Admin-only view of linked guardians, sibling access and sign-in history. Managing a relationship never deletes an account.</p></div><button className="button ghost smallButton" type="button" disabled={loading||busy} onClick={()=>{setLoading(true);setError("");void load().catch(e=>setError(e instanceof Error?e.message:"Refresh failed.")).finally(()=>setLoading(false))}}>Refresh</button></div>
  {error&&<div className="errorBanner" role="alert">{error}</div>}
  {notice&&<div className="successBanner" role="status">{notice}</div>}
  {loading?<p>Loading linked family accounts…</p>:<>
   {(suspicious.length>0||duplicates)&&<div className="warningBanner" role="alert">Family records require review: {suspicious.length>0?"an older primary relationship does not match the saved login email. ":""}{duplicates?"duplicate email links exist.":""} Check the linked accounts before making changes.</div>}
   <p className="fieldHint">Primary family login on student profile: <b>{primaryEmail||"Not specified"}</b> {primary.length===0?"· No matching linked account yet":""}</p>
   {accounts.length===0?<div className="emptyState compact">No linked parent accounts. Use Parent portal access below to provision or link the primary family login.</div>:<div className="stack" style={{gap:12}}>
    {accounts.map(account=><div className="panel" key={account.parentId} style={{padding:14,border:"1px solid var(--border, #e2e8f0)"}}>
     <div className="row" style={{justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
      <div><b>{account.email||"Email unavailable"}</b><div className="cellSub">{account.email===primaryEmail.toLowerCase()?"Primary family login":account.relationship} · {account.active?"Account enabled":"Account disabled"} · {account.lastLoginAt?"Signed in":"Awaiting first sign-in"}</div><div className="cellSub">Last sign-in: {formatDate(account.lastLoginAt)}</div></div>
      <div className="row" style={{gap:8,flexWrap:"wrap"}}>
       {account.email!==primaryEmail.toLowerCase()&&<button className="button secondary smallButton" type="button" disabled={busy} onClick={()=>void perform("family_primary",account.email)}>Make primary</button>}
       {account.relationship==="Additional guardian"&&<button className="button ghost smallButton" type="button" disabled={busy} onClick={()=>void perform("family_unlink",account.email)}>Remove link</button>}
      </div>
     </div>
     <div className="fieldHint" style={{marginTop:10}}>Children on this account ({account.children.length}): {account.children.map((child,i)=><span key={child.id}>{i>0?", ":""}<Link className="textLink" href={`/admin/students/${encodeURIComponent(child.id)}`}>{child.name}</Link></span>)}</div>
    </div>)}
   </div>}
   <div className="formGroup" style={{marginTop:18}}><label htmlFor="additional-guardian-email">Link another authorized guardian's existing parent account</label><div className="row" style={{gap:10,flexWrap:"wrap"}}><input id="additional-guardian-email" className="input" type="email" style={{flex:"1 1 230px"}} value={newEmail} placeholder="guardian@example.com" onChange={e=>setNewEmail(e.target.value)} disabled={busy}/><button className="button secondary" type="button" disabled={busy||!newEmail.trim()||accounts.some(a=>a.email===newEmail.trim().toLowerCase())} onClick={()=>void perform("family_link",newEmail)}>Link guardian</button></div><small className="fieldHint">This action links an existing, active parent account only. For a new parent login, use Parent portal access. Verify guardian authorization before linking.</small></div>
  </>}
 </section>;
}
