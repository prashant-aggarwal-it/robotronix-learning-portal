"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Org={id:string;displayName:string;role:string};
type Member={id:string;user_id:string;role_key:string;status:string};
type Invitation={id:string;email:string;role_key:string;status:string;expires_at:string};
const roles=["owner","admin","staff","trainer","member"];
const statuses=["active","suspended","removed"];
async function request(path:string,init:RequestInit={}) {
 const client=getSupabaseBrowserClient();
 if(!client)throw new Error("Authentication unavailable");
 const {data:{session}}=await client.auth.getSession();
 if(!session)throw new Error("Sign in first");
 const response=await fetch(path,{...init,cache:"no-store",headers:{"Authorization":"Bearer "+session.access_token,...(init.body?{"Content-Type":"application/json"}:{}),...init.headers}});
 const json=await response.json().catch(()=>null);
 if(!response.ok||!json?.ok)throw new Error(json?.error||"Access unavailable");
 return json;
}
export default function MembersPage(){
 const [orgs,setOrgs]=useState<Org[]>([]);
 const [organizationId,setOrganizationId]=useState("");
 const [members,setMembers]=useState<Member[]>([]);
 const [invitations,setInvitations]=useState<Invitation[]>([]);
 const [drafts,setDrafts]=useState<Record<string,{role:string;status:string}>>({});
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [newUser,setNewUser]=useState("");
 const [newRole,setNewRole]=useState("member");
 const [inviteEmail,setInviteEmail]=useState("");
 const [inviteRole,setInviteRole]=useState("member");
 const [invitationToken,setInvitationToken]=useState("");
 useEffect(()=>{let active=true;request("/api/platform/organizations").then(x=>{
  if(!active)return;
  setOrgs((x.organizations as Org[]).filter(o=>(o.role==="owner"||o.role==="admin")));
  const selected=(x.organizations as Org[]).find(o=>o.id===x.selectedOrganizationId&&(o.role==="owner"||o.role==="admin"));
  setOrganizationId(selected?.id||"");
 }).catch(e=>{if(active)setError(String(e))});return()=>{active=false}},[]);
 useEffect(()=>{let active=true;setMembers([]);setDrafts({});
  if(organizationId){request("/api/platform/organizations/"+organizationId+"/invitations").then(x=>{if(active)setInvitations(x.invitations as Invitation[])}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Invitations unavailable")});
  request("/api/platform/organizations/"+organizationId+"/members").then(x=>{
   if(!active)return;const rows=x.members as Member[];setMembers(rows);
   setDrafts(Object.fromEntries(rows.map(m=>[m.id,{role:m.role_key,status:m.status}])));
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:"Members unavailable")});
  }else setInvitations([]);
  return()=>{active=false};
 },[organizationId]);
 async function inviteMember(){
  if(busy||!organizationId||!inviteEmail.trim())return;
  setBusy(true);setError("");setInvitationToken("");
  try{
   const result=await request("/api/platform/organizations/"+organizationId+"/invitations",{method:"POST",body:JSON.stringify({email:inviteEmail.trim(),role:inviteRole})});
   setInvitationToken(result.acceptToken);
   const latest=await request("/api/platform/organizations/"+organizationId+"/invitations");
   setInvitations(latest.invitations as Invitation[]);
   setInviteEmail("");
  }catch(e){setError(e instanceof Error?e.message:"Invitation failed")}finally{setBusy(false)}
 }
 async function revokeInvitation(id:string){
  if(busy||!organizationId)return;
  setBusy(true);setError("");
  try{
   await request("/api/platform/organizations/"+organizationId+"/invitations/"+id,{method:"DELETE"});
   const latest=await request("/api/platform/organizations/"+organizationId+"/invitations");
   setInvitations(latest.invitations as Invitation[]);
  }catch(e){setError(e instanceof Error?e.message:"Revocation failed")}finally{setBusy(false)}
 }
 async function addExistingMember(){
  if(busy||!organizationId||!newUser.trim())return;
  setBusy(true);setError("");
  try{
   await request("/api/platform/organizations/"+organizationId+"/members",{method:"POST",body:JSON.stringify({userId:newUser.trim(),role:newRole})});
   const next=await request("/api/platform/organizations/"+organizationId+"/members");
   setMembers(next.members as Member[]);
   setDrafts(Object.fromEntries((next.members as Member[]).map(m=>[m.id,{role:m.role_key,status:m.status}])));
   setNewUser("");
  }catch(e){setError(e instanceof Error?e.message:"Member creation failed")}finally{setBusy(false)}
 }
 async function save(m:Member){
  const draft=drafts[m.id];if(!draft||busy)return;
  setBusy(true);setError("");
  try{
   await request("/api/platform/organizations/"+organizationId+"/members/"+m.id,
    {method:"PATCH",body:JSON.stringify({role:draft.role,status:draft.status})});
   const next=await request("/api/platform/organizations/"+organizationId+"/members");
   const rows=next.members as Member[];
   setMembers(rows);
   setDrafts(Object.fromEntries(rows.map(row=>[row.id,{role:row.role_key,status:row.status}])));
  }catch(e){setError(e instanceof Error?e.message:"Update failed")}finally{setBusy(false)}
 }
 return <main style={{maxWidth:880,margin:"2rem auto",padding:"1rem"}}>
  <h1>Organization members</h1>
  <p>Owners and organization admins can review members and request permitted role changes. Changes are audited. The last active owner cannot be removed.</p>
  {orgs.length===0?<p>No organization member-management access is available.</p>:<>
   <label htmlFor="org-select">Organization</label>{" "}
   <select id="org-select" value={organizationId} onChange={e=>setOrganizationId(e.target.value)}>
    <option value="">Select organization</option>
    {orgs.map(o=><option key={o.id} value={o.id}>{o.displayName}</option>)}
   </select>
   {organizationId&&<section style={{marginTop:20}}>
    <h2>Invite by email</h2>
    <p>Generate a 7-day one-time acceptance code. Share it securely with the intended recipient; email is not sent automatically.</p>
    <label>Email <input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}/></label>{" "}
    <label>Role <select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}>
     {roles.filter(role=>orgs.find(o=>o.id===organizationId)?.role==="owner"||!["owner","admin"].includes(role)).map(role=><option key={role} value={role}>{role}</option>)}
    </select></label>{" "}
    <button type="button" disabled={busy||!inviteEmail.trim()} onClick={()=>void inviteMember()}>Create invitation</button>
    {invitationToken&&<p>One-time token (copy now; it will not be displayed again): <code>{invitationToken}</code></p>}
    <h3>Recent invitations</h3>
    {invitations.map(i=><div key={i.id} style={{marginBottom:8}}>
     {i.email} — {i.role_key} — {i.status}
     {i.status==="pending"&&<button type="button" disabled={busy} onClick={()=>void revokeInvitation(i.id)}>Revoke</button>}
    </div>)}
   </section>}
   {organizationId&&<section style={{marginTop:20}}>
    <h2>Add existing account</h2>
    <p>For a user who already has a registered account; this does not send an invitation.</p>
    <label>User ID <input value={newUser} onChange={e=>setNewUser(e.target.value)} placeholder="Registered user UUID"/></label>{" "}
    <label>Role <select value={newRole} onChange={e=>setNewRole(e.target.value)}>
     {roles.filter(role=>orgs.find(o=>o.id===organizationId)?.role==="owner"||!["owner","admin"].includes(role)).map(role=><option key={role} value={role}>{role}</option>)}
    </select></label>{" "}
    <button type="button" disabled={busy||!newUser.trim()} onClick={()=>void addExistingMember()}>Add member</button>
   </section>}
   {members.map(m=><section key={m.id} style={{border:"1px solid #aaa",borderRadius:8,padding:12,marginTop:12}}>
    <p>Member: {m.user_id}</p>
    <label>Role <select disabled={orgs.find(o=>o.id===organizationId)?.role==="admin"&&["owner","admin"].includes(m.role_key)} aria-label={"Role for "+m.user_id} value={drafts[m.id]?.role??m.role_key}
      onChange={e=>setDrafts(d=>({...d,[m.id]:{...(d[m.id]??{role:m.role_key,status:m.status}),role:e.target.value}}))}>
      {roles.filter(role=>orgs.find(o=>o.id===organizationId)?.role==="owner"||!["owner","admin"].includes(role)).map(role=><option key={role} value={role}>{role}</option>)}
    </select></label>{" "}
    <label>Status <select disabled={orgs.find(o=>o.id===organizationId)?.role==="admin"&&["owner","admin"].includes(m.role_key)} aria-label={"Status for "+m.user_id} value={drafts[m.id]?.status??m.status}
      onChange={e=>setDrafts(d=>({...d,[m.id]:{...(d[m.id]??{role:m.role_key,status:m.status}),status:e.target.value}}))}>
      {statuses.map(status=><option key={status}>{status}</option>)}
    </select></label>{" "}
    <button type="button" disabled={busy||!drafts[m.id]||
      (drafts[m.id].role===m.role_key&&drafts[m.id].status===m.status)} onClick={()=>void save(m)}>Save</button>
   </section>)}
  </>}
  {error&&<p role="alert">{error}</p>}
 </main>;
}
