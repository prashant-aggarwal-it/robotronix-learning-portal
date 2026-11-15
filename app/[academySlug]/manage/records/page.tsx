"use client";
import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";
import {useParams} from "next/navigation";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Kind="students"|"trainers"|"courses"|"enrollments";
type Row={id:string;full_name?:string;grade?:string;school?:string;title?:string;slug?:string;code?:string;status?:string;student_id?:string;course_id?:string;trainer_id?:string};
type Org={id:string;slug:string;role:string;modules:string[]};
const kinds:Kind[]=["students","trainers","courses","enrollments"];
const fields:Record<Kind,string[]>={
 students:["full_name","grade","school"],trainers:["full_name"],
 courses:["title","slug","code","category","grade_from","grade_to","total_sessions"],
 enrollments:["student_id","course_id","trainer_id"]
};
const label=(name:string)=>name.replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase());
export default function AcademyRecords(){
 const {academySlug}=useParams<{academySlug:string}>();
 const [orgId,setOrgId]=useState(""),[kind,setKind]=useState<Kind>("students");
 const [rows,setRows]=useState<Row[]>([]),[lookups,setLookups]=useState<Record<string,Row[]>>({});
 const [form,setForm]=useState<Record<string,string>>({}),[editing,setEditing]=useState("");
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 async function authorizedFetch(url:string,init?:RequestInit){
  const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
  if(!session)throw Error("Sign in first");
  const res=await fetch(url,{...init,headers:{...init?.headers,Authorization:"Bearer "+session.access_token},cache:"no-store"});
  const response=await res.json().catch(()=>null);
  if(!res.ok||!response?.ok)throw Error(response?.error||"Academy operation unavailable");
  return response.data as Row[];
 }
 useEffect(()=>{let live=true;(async()=>{try{
  const client=getSupabaseBrowserClient();if(!client)throw Error("Authentication unavailable");
  const {data:orgs,error}=await client.rpc("saas_my_workspaces");if(error)throw error;
  const org=(Array.isArray(orgs)?orgs:[]).find((x:Org)=>x.slug===academySlug&&["owner","admin"].includes(x.role)&&x.modules.includes("academy")) as Org|undefined;
  if(!org)throw Error("Academy admin access required");
  if(live)setOrgId(org.id);
 }catch(e){if(live)setError(e instanceof Error?e.message:"Academy unavailable");}})();return()=>{live=false};},[academySlug]);
 async function refresh(which:Kind=kind,id:string=orgId){
  if(!id)return;
  try{const data=await authorizedFetch("/api/platform/academy-records?organizationId="+encodeURIComponent(id)+"&kind="+which);
   setRows(Array.isArray(data)?data:[]);
   if(which==="enrollments"){
    const [students,courses,trainers]=await Promise.all(
     (["students","courses","trainers"] as Kind[]).map(k=>authorizedFetch("/api/platform/academy-records?organizationId="+encodeURIComponent(id)+"&kind="+k)));
    setLookups({students,courses,trainers});
   }
  }catch(e){setError(e instanceof Error?e.message:"Unable to load records");}
 }
 useEffect(()=>{void refresh(kind,orgId);setForm({});setEditing("");},[kind,orgId]);
 function edit(row:Row){
  setEditing(row.id);setError("");setMessage("");
  if(kind==="students")setForm({full_name:row.full_name||"",grade:row.grade||"",school:row.school||""});
  else if(kind==="trainers")setForm({full_name:row.full_name||""});
  else if(kind==="courses")setForm({title:row.title||""});
  else setForm({status:row.status||"active"});
 }
 async function save(e:FormEvent){
  e.preventDefault();if(!orgId||busy)return;setBusy(true);setMessage("");setError("");
  try{
   const payload:Record<string,unknown>={...form};
   if(!editing&&kind==="courses"){
    for(const key of ["grade_from","grade_to","total_sessions"])payload[key]=Number(form[key]||0);
   }
   const session=(await getSupabaseBrowserClient()?.auth.getSession())?.data.session;
   if(!session)throw Error("Sign in first");
   const r=await fetch("/api/platform/academy-records",{method:"POST",
    headers:{"content-type":"application/json",Authorization:"Bearer "+session.access_token},
    body:JSON.stringify({organizationId:orgId,kind,action:editing?"update":"create",recordId:editing||null,data:payload})});
   const data=await r.json();if(!r.ok)throw Error(data.error||"Save failed");
   setForm({});setEditing("");setMessage(editing?"Record updated":"Record created");
   await refresh();
  }catch(err){setError(err instanceof Error?err.message:"Unable to save");}
  finally{setBusy(false);}
 }
 const activeFields=editing?(kind==="students"?fields.students:kind==="trainers"?fields.trainers:kind==="courses"?["title"]:["status"]):fields[kind];
 return <main style={{minHeight:"100vh",padding:"40px 22px",background:"#f5f7fd",color:"#17243f"}}><div style={{maxWidth:1080,margin:"auto"}}>
  <Link href={"/"+academySlug+"/manage"}>← Academy management</Link>
  <h1 style={{fontSize:"clamp(30px,4vw,44px)",marginTop:22}}>Academy records</h1>
  <p>These records are retrieved and modified only after server-side organization and role checks.</p>
  <nav aria-label="Record types" style={{display:"flex",gap:10,margin:"24px 0",flexWrap:"wrap"}}>{kinds.map(k=><button key={k} type="button" className={"button "+(k===kind?"":"secondary")} onClick={()=>setKind(k)}>{label(k)}</button>)}</nav>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:24}}>
   <section style={{background:"white",borderRadius:16,padding:24,border:"1px solid #dce4f0"}}>
    <h2>{editing?"Edit record":"Create "+label(kind).slice(0,-1)}</h2>
    <form onSubmit={save} style={{display:"grid",gap:14}}>
    {activeFields.map(field=><label key={field} style={{display:"grid",gap:5}}>{label(field)}
     {field==="status"?<select className="input" value={form.status||"active"} onChange={e=>setForm({...form,status:e.target.value})}>{["active","on_hold","completed","cancelled"].map(v=><option key={v} value={v}>{label(v)}</option>)}</select>:
      ["student_id","course_id","trainer_id"].includes(field)?
      <select className="input" required value={form[field]||""} onChange={e=>setForm({...form,[field]:e.target.value})}>
       <option value="">Select {label(field)}</option>{(lookups[field.replace("_id","")+"s"]||[]).map(item=>
        <option key={item.id} value={item.id}>{item.full_name||item.title||item.id}</option>)}
      </select>:
      <input className="input" required={field==="full_name"||field==="title"||field==="slug"||field==="code"}
       type={["grade_from","grade_to","total_sessions"].includes(field)?"number":"text"}
       min={["grade_from","grade_to","total_sessions"].includes(field)?0:undefined}
       value={form[field]||""} onChange={e=>setForm({...form,[field]:e.target.value})}/>}
     </label>)}
     <button className="button" type="submit" disabled={!orgId||busy}>{busy?"Saving…":editing?"Save changes":"Create record"}</button>
     {editing&&<button className="button secondary" type="button" onClick={()=>{setEditing("");setForm({});}}>Cancel editing</button>}
    </form>
   </section>
   <section style={{background:"white",borderRadius:16,padding:24,border:"1px solid #dce4f0"}}>
    <h2>{label(kind)} ({rows.length})</h2>
    {!rows.length&&<p>No records yet for this academy.</p>}
    <ul style={{listStyle:"none",padding:0}}>{rows.map(row=><li key={row.id} style={{padding:"12px 0",borderBottom:"1px solid #e5e9f2"}}>
      <strong>{row.full_name||row.title||row.id}</strong>
      <p style={{fontSize:13,color:"#667085",margin:"4px 0"}}>{row.grade||row.code||row.status||""}</p>
      <button className="button ghost" type="button" onClick={()=>edit(row)}>Edit</button>
    </li>)}</ul>
   </section>
  </div>
  {error&&<p role="alert" style={{marginTop:20,color:"#a11c35"}}>{error}</p>}
  {message&&<p role="status" style={{marginTop:20}}>{message}</p>}
 </div></main>;
}