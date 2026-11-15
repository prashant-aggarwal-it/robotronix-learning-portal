"use client";
import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Org={id:string;name:string;role:string};
type Invitation={id:string;email:string;role_key:string;status:string;expires_at:string};
type Member={id:string;email:string|null;role_key:string;status:string};
export default function TeamInvitations(){
 const [orgs,setOrgs]=useState<Org[]>([]),[orgId,setOrgId]=useState("");
 const [email,setEmail]=useState(""),[role,setRole]=useState("trainer");
 const [invitations,setInvitations]=useState<Invitation[]>([]);
 const [members,setMembers]=useState<Member[]>([]);
 const [link,setLink]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;(async()=>{try{
  const c=getSupabaseBrowserClient(),s=(await c?.auth.getSession())?.data.session;
  if(!s)throw Error("Sign in first");
  const {data,error}=await c!.rpc("saas_my_workspaces");if(error)throw error;
  const rows=(Array.isArray(data)?data:[]).filter((x:Org)=>x.role==="owner"||x.role==="admin") as Org[];
  if(live){setOrgs(rows);setOrgId(rows[0]?.id||"");}
 }catch(e){if(live)setMessage(e instanceof Error?e.message:"Unable to load organizations");}})();return()=>{live=false};},[]);
 async function loadInvitations(id:string){
  if(!id)return;
  const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
  if(!session)return;
  const res=await fetch("/api/platform/invitations?organizationId="+encodeURIComponent(id),{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
  const body=await res.json();
  if(res.ok)setInvitations(body.invitations||[]);
 }
 async function loadMembers(id:string){
  if(!id)return;
  const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
  if(!session)return;
  const r=await fetch("/api/platform/memberships?organizationId="+encodeURIComponent(id),{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
  const v=await r.json();if(r.ok)setMembers(v.members||[]);
 }
 useEffect(()=>{void loadInvitations(orgId);void loadMembers(orgId);},[orgId]);
 async function manage(member:Member,role:string,status:string){
  setBusy(true);setMessage("");
  try{
   const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
   if(!session)throw Error("Sign in first");
   const r=await fetch("/api/platform/memberships",{method:"PATCH",headers:{"content-type":"application/json",Authorization:"Bearer "+session.access_token},
   body:JSON.stringify({organizationId:orgId,membershipId:member.id,role,status})});
   const v=await r.json();if(!r.ok)throw Error(v.error||"Membership update rejected");
   await loadMembers(orgId);setMessage("Membership updated");
  }catch(e){setMessage(e instanceof Error?e.message:"Unable to update member");}
  finally{setBusy(false);}
 }
 async function revoke(id:string){
  setBusy(true);setMessage("");
  try{
   const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
   if(!session)throw Error("Sign in first");
   const res=await fetch("/api/platform/invitations",{method:"DELETE",headers:{"content-type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({organizationId:orgId,invitationId:id})});
   const result=await res.json();if(!res.ok)throw Error(result.error||"Unable to revoke invitation");
   await loadInvitations(orgId);setMessage("Invitation revoked");
  }catch(e){setMessage(e instanceof Error?e.message:"Unable to revoke invitation");}
  finally{setBusy(false);}
 }
 async function send(e:FormEvent){e.preventDefault();setBusy(true);setMessage("");setLink("");
  try{
   const c=getSupabaseBrowserClient(),s=(await c?.auth.getSession())?.data.session;if(!s)throw Error("Sign in first");
   const r=await fetch("/api/platform/invitations",{method:"POST",headers:{"content-type":"application/json",Authorization:"Bearer "+s.access_token},body:JSON.stringify({organizationId:orgId,email,role})});
   const v=await r.json();if(!r.ok)throw Error(v.error||"Unable to invite");
   setLink(v.invitationUrl);void loadInvitations(orgId);setMessage("Invitation created. Copy this private link and send it only to "+email+".");
  }catch(e){setMessage(e instanceof Error?e.message:"Unable to invite");}finally{setBusy(false);}
 }
 return <main className="authPage"><section className="authCard">
 <Link href="/workspace">← Back to workspace</Link>
 <div className="formStepHead"><span>ACADEMY TEAM</span><h1>Invite a team member</h1><p>Invitations are valid only for the recipient's verified email address. They do not automatically grant access to unrelated modules.</p></div>
 {orgs.length>0&&<form className="formStack" onSubmit={send}>
 <label>Organization<select className="input" value={orgId} onChange={e=>setOrgId(e.target.value)}>{orgs.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
 <label>Recipient's email<input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
 <label>Organization role<select className="input" value={role} onChange={e=>setRole(e.target.value)}><option value="trainer">Trainer</option><option value="staff">Staff</option><option value="member">Member</option><option value="admin">Administrator</option></select></label>
 <button className="button" disabled={busy||!orgId}>{busy?"Creating invitation…":"Create invitation link"}</button></form>}
 {link&&<div className="infoBanner"><p>Copy and share this link securely:</p><input className="input" readOnly value={link} onFocus={e=>e.target.select()}/><button className="button secondary" onClick={()=>void navigator.clipboard.writeText(link)}>Copy invitation link</button></div>}
 {invitations.length>0&&<section style={{marginTop:24}}><h2>Invitations</h2><ul>{invitations.map(i=><li key={i.id} style={{marginBottom:12}}><strong>{i.email}</strong> · {i.role_key} · {i.status} {i.status==="pending"&&<button type="button" className="button ghost" disabled={busy} onClick={()=>void revoke(i.id)}>Revoke</button>}</li>)}</ul></section>}
 {members.length>0&&<section style={{marginTop:24}}><h2>Team members</h2>
 <ul>{members.map(m=><li key={m.id} style={{marginBottom:16}}>
 <strong>{m.email||m.id}</strong> · {m.role_key} · {m.status}
 {m.role_key!=="owner"&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:6}}>
 <label>Role <select className="input" disabled={busy} value={m.role_key} onChange={e=>void manage(m,e.target.value,m.status)}><option value="admin">Administrator</option><option value="staff">Staff</option><option value="trainer">Trainer</option><option value="member">Member</option>{orgs.find(o=>o.id===orgId)?.role==="owner"&&<option value="owner">Owner</option>}</select></label>
 <button type="button" className="button ghost" disabled={busy||m.status==="suspended"} onClick={()=>void manage(m,m.role_key,"suspended")}>Suspend</button>
 <button type="button" className="button ghost" disabled={busy||m.status==="active"} onClick={()=>void manage(m,m.role_key,"active")}>Activate</button>
 <button type="button" className="button ghost" disabled={busy||m.status==="removed"} onClick={()=>void manage(m,m.role_key,"removed")}>Remove</button>
 </div>}</li>)}</ul></section>}
 {message&&<p role="status">{message}</p>}
 </section></main>;
}