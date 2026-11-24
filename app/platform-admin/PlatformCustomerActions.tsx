"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Org={id:string;display_name:string;status:string};
type Invitation={id:string;email:string;status:string;expiresAt:string};
export default function PlatformCustomerActions({organizations,onChanged,initialOrganizationId=""}:{organizations:Org[];onChanged:(updatedName?:string)=>void;initialOrganizationId?:string}){
 const [organizationId,setOrganizationId]=useState(initialOrganizationId);
 const [email,setEmail]=useState("");const [name,setName]=useState("");
 const [invitations,setInvitations]=useState<Invitation[]>([]);
 const [invitationUrl,setInvitationUrl]=useState("");
 const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
 const selected=organizations.find(o=>o.id===organizationId);
 useEffect(()=>{if(initialOrganizationId)setOrganizationId(initialOrganizationId)},[initialOrganizationId]);
 useEffect(()=>{if(organizationId)void loadInvitations();else setInvitations([]);},[organizationId]);
 async function call(action:string,fields:Record<string,unknown>={}){
  const guarded=["set_organization_status","revoke_owner_invitation"];
  if(guarded.includes(action)){
   const target=action==="set_organization_status"?selected?.display_name||organizationId:(invitations.find(i=>i.id===fields.invitationId)?.email||"the invitation");
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
   setMessage(action==="rename_organization"?"Customer name updated.":action==="set_organization_status"?"Customer status updated.":action==="invite_owner"?"Owner invitation created. Email is not sent automatically for this workflow; share its secure link privately.":"Customer invitation updated.");onChanged(action==="rename_organization"?String(fields.value||""):undefined);
   if(action==="rename_organization")setName("");
   if(action==="invite_owner"||action==="resend_owner"||action==="revoke_owner_invitation")await loadInvitations(false);
  }catch(e){setMessage(e instanceof Error?e.message:"Operation failed")}finally{setBusy(false)}
 }
 async function loadInvitations(clearMessage=true){
  setBusy(true);if(clearMessage)setMessage("");
  try{
   const client=getSupabaseBrowserClient();if(!client)throw Error("Sign in first");
   const {data:{session}}=await client.auth.getSession();if(!session)throw Error("Sign in first");
   const response=await fetch("/api/platform-admin/manage?organizationId="+encodeURIComponent(organizationId),{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||"Unable to list invitations");
   setInvitations(result.invitations);
  }catch(e){setMessage(e instanceof Error?e.message:"Unable to load invitations")}finally{setBusy(false)}
 }
 return <section className="platformCustomerManagement" aria-label="Customer access and status">
  <div className="platformCustomerManagementIntro"><h2>Customer access & status</h2><p>Update customer details and manage owner access. Platform-wide administrator access is managed separately under System Health → Security & Incidents.</p></div>
  {initialOrganizationId?<p className="platformSelectedCustomer"><strong>Customer:</strong> {selected?.display_name||"Selected customer"}</p>:<label>Customer <select value={organizationId} onChange={e=>{setOrganizationId(e.target.value);setInvitations([])}}><option value="">Select customer</option>{organizations.map(o=><option key={o.id} value={o.id}>{o.display_name}</option>)}</select></label>}
  {selected&&<>
   <div className="platformCustomerManagementGrid">
    <div className="platformCustomerManagementCard">
     <h3>Workspace status</h3><p><span className={"platformStatus "+(selected.status==="active"?"platformStatusActive":"")}>{selected.status.charAt(0).toUpperCase()+selected.status.slice(1)}</span></p>
     <p>Suspending a workspace may interrupt customer access.</p>
     <button type="button" disabled={busy||selected.status==="archived"} onClick={()=>void call("set_organization_status",{value:selected.status==="active"?"suspended":"active"})}>{selected.status==="active"?"Suspend customer":"Reactivate customer"}</button>
    </div>
    <div className="platformCustomerManagementCard">
     <h3>Customer name</h3>
     <label>Display name<input value={name} maxLength={160} onChange={e=>setName(e.target.value)} placeholder={selected.display_name}/></label>
     <button type="button" disabled={busy||name.trim().length<2||name.trim()===selected.display_name} onClick={()=>void call("rename_organization",{value:name.trim()})}>Save customer name</button>
    </div>
   </div>
   <section className="platformCustomerManagementCard platformCustomerInvitationCard">
    <h3>Owner access</h3><p>Invite an owner to this existing customer workspace. This process creates a secure link but does not send an email automatically.</p>
    <div className="platformCustomerInviteRow"><label>Owner email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="owner@example.com"/></label><button type="button" disabled={busy||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())} onClick={()=>void call("invite_owner",{email:email.trim()})}>Create owner invitation</button></div>
    {invitationUrl&&<details open className="platformOwnerRecovery" role="status"><summary>Secure invitation link (manual delivery)</summary><p>Share privately with the intended owner only. This link provides access to the invitation process; it is not evidence of email delivery.</p><div><input readOnly value={invitationUrl} aria-label="Secure owner invitation link"/><button type="button" onClick={()=>void navigator.clipboard.writeText(invitationUrl)}>Copy link</button></div></details>}
    <div className="platformCustomerInvitationHeading"><h4>Existing owner invitations</h4><button type="button" disabled={busy} onClick={()=>void loadInvitations()}>{busy?"Refreshing…":"Refresh invitations"}</button></div>
    {invitations.length===0&&!busy&&<p>No owner invitations recorded for this customer.</p>}
    {invitations.length>0&&<div className="platformTableScroll"><table><thead><tr><th>Owner email</th><th>Status</th><th>Expires</th><th>Action</th></tr></thead><tbody>{invitations.map(inv=><tr key={inv.id}><td>{inv.email}</td><td>{inv.status==="pending"&&Date.parse(inv.expiresAt)<Date.now()?"Expired":inv.status.replaceAll("_"," ")}</td><td>{new Date(inv.expiresAt).toLocaleDateString("en-GB")}</td><td>{inv.status==="pending"&&<div className="platformCustomerInvitationActions"><button type="button" disabled={busy} onClick={()=>void call("resend_owner",{email:inv.email,invitationId:inv.id})}>Renew link</button><button type="button" disabled={busy} onClick={()=>void call("revoke_owner_invitation",{invitationId:inv.id})}>Revoke</button></div>}</td></tr>)}</tbody></table></div>}
   </section>
  </>}
  {message&&<p role="status" className="platformInlineMessage">{message}</p>}
 </section>;
}
