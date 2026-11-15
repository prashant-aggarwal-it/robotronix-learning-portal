"use client";
import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Org={id:string;name:string;role:string;modules:string[]};
type Student={studentId:string;name:string;grade:string};
export default function FamilyInvitations(){
 const [orgs,setOrgs]=useState<Org[]>([]),[orgId,setOrgId]=useState("");
 const [students,setStudents]=useState<Student[]>([]),[studentId,setStudentId]=useState("");
 const [email,setEmail]=useState(""),[role,setRole]=useState<"parent"|"student">("parent");
 const [link,setLink]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;(async()=>{try{
  const client=getSupabaseBrowserClient();if(!client)throw Error("Authentication unavailable");
  const {data,error}=await client.rpc("saas_my_workspaces");
  if(error)throw error;
  const rows=(Array.isArray(data)?data:[]).filter((o:Org)=>(o.role==="owner"||o.role==="admin")&&o.modules.includes("academy")) as Org[];
  if(active){setOrgs(rows);setOrgId(rows[0]?.id||"");}
 }catch(e){if(active)setMessage(e instanceof Error?e.message:"Unable to load academies");}})();return()=>{active=false};},[]);
 useEffect(()=>{let active=true;setStudents([]);setStudentId("");if(!orgId)return;
  const client=getSupabaseBrowserClient();void client?.rpc("saas_admin_academy_students",{p_organization_id:orgId}).then(({data,error})=>{
   if(active&&!error&&Array.isArray(data)){setStudents(data);setStudentId(data[0]?.studentId||"");}
  });return()=>{active=false};},[orgId]);
 async function submit(e:FormEvent){
  e.preventDefault();if(!orgId||!studentId||busy)return;setBusy(true);setLink("");setMessage("");
  try{
   const client=getSupabaseBrowserClient();if(!client)throw Error("Authentication unavailable");
   const bytes=crypto.getRandomValues(new Uint8Array(32));
   const token=Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");
   const hashed=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
   const hash=Array.from(new Uint8Array(hashed),x=>x.toString(16).padStart(2,"0")).join("");
   const {error}=await client.rpc("saas_invite_academy_family",{
    p_organization_id:orgId,p_student_id:studentId,p_email:email.trim().toLowerCase(),
    p_access_role:role,p_token_sha256:hash
   });
   if(error)throw error;
   setLink(location.origin+"/invite/family?token="+token);
   setMessage("Family invitation created. Share this private link only with "+email.trim()+".");
  }catch(e){setMessage(e instanceof Error?e.message:"Unable to create invitation");}
  finally{setBusy(false);}
 }
 return <main className="authPage"><section className="authCard">
  <Link href="/workspace">← Back to workspace</Link>
  <div className="formStepHead"><span>ACADEMY FAMILIES</span><h1>Invite parent or student</h1><p>Invitations link a verified account to one existing learner in one academy. They cannot grant access to unrelated students.</p></div>
  {orgs.length>0&&<form className="formStack" onSubmit={submit}>
   <label>Academy<select className="input" value={orgId} onChange={e=>setOrgId(e.target.value)}>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
   <label>Student<select className="input" value={studentId} onChange={e=>setStudentId(e.target.value)} required>{students.map(s=><option key={s.studentId} value={s.studentId}>{s.name} ({s.grade})</option>)}</select></label>
   <label>Invite as<select className="input" value={role} onChange={e=>setRole(e.target.value as "parent"|"student")}><option value="parent">Parent/guardian</option><option value="student">Student</option></select></label>
   <label>Recipient email<input type="email" className="input" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <button className="button" disabled={busy||!studentId}>{busy?"Creating…":"Create family invitation link"}</button>
  </form>}
  {orgs.length===0&&<p>No Academy owner/admin workspace is available to your account.</p>}
  {link&&<div className="infoBanner"><p>Invitation link (share privately):</p><input className="input" readOnly value={link} onFocus={e=>e.target.select()}/><button type="button" className="button secondary" onClick={()=>void navigator.clipboard.writeText(link)}>Copy link</button></div>}
  {message&&<p role="status">{message}</p>}
 </section></main>;
}