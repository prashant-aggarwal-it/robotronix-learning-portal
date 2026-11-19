"use client";
import {useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Org={id:string;display_name:string;status:string};
type Invitation={id:string;email:string;status:string;expiresAt:string};
export default function PlatformCustomerActions({organizations,onChanged,initialOrganizationId=""}:{organizations:Org[];onChanged:()=>void;initialOrganizationId?:string}){
 const [organizationId,setOrganizationId]=useState(initialOrganizationId);
 const [email,setEmail]=useState("");const [name,setName]=useState("");
 const [adminId,setAdminId]=useState("");
 const [invitations,setInvitations]=useState<Invitation[]>([]);
 const [invitationUrl,setInvitationUrl]=useState("");
 const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
 const selected=organizations.find(o=>o.id===organizationId);
 async function call(action:string,fields:Record<string,unknown>={}){
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
  <h2>Customer management</h2><p>Manage customer status, owner invitations and authorized platform administrators. Changes are audited.</p>
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
   <label>Verified user UUID <input value={adminId} onChange={e=>setAdminId(e.target.value)} style={{width:"100%"}}/></label>
   <div style={{display:"flex",gap:12}}><button disabled={busy||adminId.length!==36} onClick={()=>void call("grant_platform_admin",{targetUserId:adminId})}>Grant administrator</button><button disabled={busy||adminId.length!==36} onClick={()=>void call("revoke_platform_admin",{targetUserId:adminId})}>Revoke administrator</button></div>
  </div>
  {message&&<p role="status">{message}</p>}
 </section>;
}
