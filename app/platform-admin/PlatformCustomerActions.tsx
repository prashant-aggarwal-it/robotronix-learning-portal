"use client";
import {useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Org={id:string;display_name:string;status:string};
type Invitation={id:string;email:string;status:string;expiresAt:string};
export default function PlatformCustomerActions({organizations,onChanged,initialOrganizationId=""}:{organizations:Org[];onChanged:()=>void;initialOrganizationId?:string}){
 const [organizationId,setOrganizationId]=useState(initialOrganizationId);
 const [email,setEmail]=useState("");const [name,setName]=useState("");
 const [adminEmail,setAdminEmail]=useState("");
 const [invitations,setInvitations]=useState<Invitation[]>([]);
 const [invitationUrl,setInvitationUrl]=useState("");
 const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
 const selected=organizations.find(o=>o.id===organizationId);
 async function call(action:string,fields:Record<string,unknown>={}){
  const guarded=["set_organization_status","revoke_platform_admin","revoke_owner_invitation"];
  if(guarded.includes(action)){
   const target=action==="set_organization_status"?selected?.display_name||organizationId:action==="revoke_platform_admin"?adminEmail.trim().toLowerCase():String(fields.invitationId||"");
   if(action==="set_organization_status"&&fields.value!=="suspended"){}else{
    const confirmation=window.prompt("Sensitive platform operation: "+action.replaceAll("_"," ")+". Type the exact target to confirm:\\n"+target);
    if(confirmation!==target)return;
   }
  }
  setBusy(true);setMessage("");setInvitationUrl("");
  try{
   const client=getSupabaseBrowserClient();if(!client)throw Error("Sign in first");
   const {data:{session}}=await client.auth.getSession();if(!session)throw Error("Sign in first");
   const response=await fetch("/api/platform-admin/manage",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({action,organizationId,...fields})});
   const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||"Operation failed");
   if(result.invitationUrl)setInvitationUrl(result.invitationUrl);
   setMessage("Operation completed: "+action);onChanged();
  }catch(e){setMessage(e instanceof Error?e.message:"Operation failed")}finally{setBusy(false)}
 }
 async function changeAdministrator(action:"grant_platform_admin"|"revoke_platform_admin"){
  if(busy)return;
  const targetEmail=adminEmail.trim().toLowerCase();
  if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(targetEmail)){setMessage("Enter a valid administrator email.");return;}
  setBusy(true);setMessage("");
  try{
   const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
   if(!session)throw Error("Sign in first");
   const response=await fetch("/api/platform-admin/administrators?email="+encodeURIComponent(targetEmail),{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   const lookup=await response.json();
   if(!response.ok||!lookup.ok)throw Error(lookup.error||"Email lookup unavailable");
   if(!lookup.verifiedUserId)throw Error(lookup.lookupLimited?"Verified user lookup is limited; contact an administrator.":"No verified user was found for this email.");
   if(action==="revoke_platform_admin"&&!window.confirm("Revoke platform administrator access for "+targetEmail+"?"))return;
   const update=await fetch("/api/platform-admin/manage",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({action,organizationId,targetUserId:lookup.verifiedUserId})});
   const result=await update.json();if(!update.ok||!result.ok)throw Error(result.error||"Administrator update failed");
   setMessage(action==="grant_platform_admin"?"Administrator access granted to "+targetEmail:"Administrator access revoked for "+targetEmail);onChanged();
  }catch(e){setMessage(e instanceof Error?e.message:"Administrator update failed")}
  finally{setBusy(false)}
 }
 async function loadInvitations(){
  setBusy(true);setMessage("");
  try{
   const client=getSupabaseBrowserClient();if(!client)throw Error("Sign in first");
   const {data:{session}}=await client.auth.getSession();if(!session)throw Error("Sign in first");
   const response=await fetch("/api/platform-admin/manage?organizationId="+encodeURIComponent(organizationId),{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||"Unable to list invitations");
   setInvitations(result.invitations);
  }catch(e){setMessage(e instanceof Error?e.message:"Unable to load invitations")}finally{setBusy(false)}
 }
 return <section style={{border:"1px solid #ddd5eb",borderRadius:16,padding:20,marginBottom:24}}>
  <h2>Customer management</h2><p>Manage workspace status and owner invitations. Changes are audited.</p>
  <label>Organization <select value={organizationId} onChange={e=>{setOrganizationId(e.target.value);setInvitations([])}}><option value="">Select organization</option>{organizations.map(o=><option key={o.id} value={o.id}>{o.display_name}</option>)}</select></label>
  {selected&&<div style={{display:"grid",gap:12,marginTop:18,maxWidth:620}}>
   <div><strong>Status: {selected.status}</strong>{" "}<button disabled={busy} onClick={()=>void call("set_organization_status",{value:selected.status==="active"?"suspended":"active"})}>{selected.status==="active"?"Suspend":"Activate"}</button></div>
   <label>Rename organization <input value={name} maxLength={160} onChange={e=>setName(e.target.value)} placeholder={selected.display_name}/></label>
   <button disabled={busy||name.trim().length<2} onClick={()=>void call("rename_organization",{value:name.trim()})}>Save name</button>
   <label>Invite owner by verified email <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="owner@example.com"/></label>
   <button disabled={busy||!email.includes("@")} onClick={()=>void call("invite_owner",{email})}>Create owner invitation</button>
   {invitationUrl&&<div role="status"><p>One-time invitation link (share securely; email is not sent automatically):</p><input readOnly value={invitationUrl} style={{width:"100%"}}/><button onClick={()=>void navigator.clipboard.writeText(invitationUrl)}>Copy link</button></div>}
   <button disabled={busy} onClick={()=>void loadInvitations()}>Refresh invitations</button>
   {invitations.map(inv=><div key={inv.id} style={{borderTop:"1px solid #ddd",paddingTop:10}}>{inv.email} — {inv.status} — expires {new Date(inv.expiresAt).toLocaleDateString()} {inv.status==="pending"&&<><button disabled={busy} onClick={()=>void call("resend_owner",{email:inv.email,invitationId:inv.id})}>Rotate / resend link</button><button disabled={busy} onClick={()=>void call("revoke_owner_invitation",{invitationId:inv.id})}>Revoke</button></>}</div>)}
  </div>}
  <div style={{marginTop:24,borderTop:"1px solid #ddd",paddingTop:16,display:"grid",gap:10,maxWidth:620}}>
   <h3>Platform administrator access</h3><p>Grant access only to an existing verified Auth user. The last active administrator cannot be revoked.</p>
   <label>Verified account email <input type="email" value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} placeholder="admin@example.com" autoComplete="off" style={{width:"100%"}}/></label>
   <div style={{display:"flex",flexWrap:"wrap",gap:12}}><button type="button" disabled={busy||!adminEmail.includes("@")} onClick={()=>void changeAdministrator("grant_platform_admin")}>Grant administrator</button><button type="button" disabled={busy||!adminEmail.includes("@")} onClick={()=>void changeAdministrator("revoke_platform_admin")}>Revoke administrator</button></div>
  </div>
  {message&&<p role="status">{message}</p>}
 </section>;
}
