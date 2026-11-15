"use client";
import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Org={id:string;name:string;role:string};
export default function TeamInvitations(){
 const [orgs,setOrgs]=useState<Org[]>([]),[orgId,setOrgId]=useState("");
 const [email,setEmail]=useState(""),[role,setRole]=useState("trainer");
 const [link,setLink]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;(async()=>{try{
  const c=getSupabaseBrowserClient(),s=(await c?.auth.getSession())?.data.session;
  if(!s)throw Error("Sign in first");
  const {data,error}=await c!.rpc("saas_my_workspaces");if(error)throw error;
  const rows=(Array.isArray(data)?data:[]).filter((x:Org)=>x.role==="owner"||x.role==="admin") as Org[];
  if(live){setOrgs(rows);setOrgId(rows[0]?.id||"");}
 }catch(e){if(live)setMessage(e instanceof Error?e.message:"Unable to load organizations");}})();return()=>{live=false};},[]);
 async function send(e:FormEvent){e.preventDefault();setBusy(true);setMessage("");setLink("");
  try{
   const c=getSupabaseBrowserClient(),s=(await c?.auth.getSession())?.data.session;if(!s)throw Error("Sign in first");
   const r=await fetch("/api/platform/invitations",{method:"POST",headers:{"content-type":"application/json",Authorization:"Bearer "+s.access_token},body:JSON.stringify({organizationId:orgId,email,role})});
   const v=await r.json();if(!r.ok)throw Error(v.error||"Unable to invite");
   setLink(v.invitationUrl);setMessage("Invitation created. Copy this private link and send it only to "+email+".");
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
 {message&&<p role="status">{message}</p>}
 </section></main>;
}