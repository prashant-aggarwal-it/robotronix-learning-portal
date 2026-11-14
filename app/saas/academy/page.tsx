"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";

type Organization={id:string;slug:string;displayName:string;role:string};
type Kind="students"|"courses"|"trainers"|"enrollments";
type Item={id:string;full_name?:string;grade?:string;school?:string;title?:string;code?:string;status?:string;student_id?:string;course_id?:string;trainer_id?:string};
const kinds:Kind[]=["students","courses","trainers","enrollments"];
const empty:Record<Kind,Item[]>={students:[],courses:[],trainers:[],enrollments:[]};

async function call(path:string,options:RequestInit={}):Promise<any>{
 const supabase=getSupabaseBrowserClient();
 if(!supabase)throw new Error("Supabase authentication is not configured.");
 const {data:{session}}=await supabase.auth.getSession();
 if(!session)throw new Error("Please sign in to use Academy.");
 const response=await fetch(path,{...options,cache:"no-store",
  headers:{"Authorization":"Bearer "+session.access_token,...(options.body?{"Content-Type":"application/json"}:{}),...options.headers}});
 const body=await response.json().catch(()=>null);
 if(!response.ok||!body?.ok)throw new Error(body?.error||"Academy request failed");
 return body;
}
const inputStyle={padding:"0.65rem",border:"1px solid #9ca3af",borderRadius:"6px",width:"100%",maxWidth:360};
const buttonStyle={padding:"0.65rem 1rem",border:"1px solid #64748b",borderRadius:"6px",cursor:"pointer"};

export default function TenantAcademyPage(){
 const [organizations,setOrganizations]=useState<Organization[]>([]);
 const [selected,setSelected]=useState<string>("");
 const [kind,setKind]=useState<Kind>("students");
 const [rows,setRows]=useState<Record<Kind,Item[]>>(empty);
 const [draft,setDraft]=useState<Record<string,string>>({});
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [ready,setReady]=useState(false);
 const [version,setVersion]=useState(0);
 useEffect(()=>{
  let current=true;
  call("/api/platform/organizations").then(data=>{
   if(!current)return;
   setOrganizations(data.organizations||[]);
   setSelected(data.selectedOrganizationId||"");
   setReady(true);
  }).catch(e=>{if(current){setError(String(e.message));setReady(true);}});
  return ()=>{current=false;};
 },[]);
 useEffect(()=>{
  if(!selected){setRows(empty);return;}
  let current=true;
  Promise.all(kinds.map(k=>call("/api/platform/academy/"+k+"?organizationId="+encodeURIComponent(selected))))
  .then(result=>{if(current){setRows(Object.fromEntries(kinds.map((k,i)=>[k,Array.isArray(result[i].data)?result[i].data:[]])) as Record<Kind,Item[]>);setError("");}})
  .catch(e=>{if(current){setRows(empty);setError(String(e.message));}});
  return ()=>{current=false;};
 },[selected,version]);
 async function switchOrg(id:string){
  setBusy(true);setError("");setRows(empty);
  try{
   if(id)await call("/api/platform/organizations",{method:"POST",body:JSON.stringify({organizationId:id})});
   else await call("/api/platform/organizations",{method:"DELETE"});
   setSelected(id);setDraft({});setVersion(n=>n+1);
  }catch(e){setError(e instanceof Error?e.message:"Cannot switch organizations");}
  finally{setBusy(false);}
 }
 async function create(){
  if(!selected)return;
  setBusy(true);setError("");
  try{
   let data:Record<string,unknown>={};
   if(kind==="students")data={full_name:draft.full_name,grade:draft.grade,school:draft.school};
   else if(kind==="trainers")data={full_name:draft.full_name};
   else if(kind==="courses")data={
    title:draft.title,slug:draft.slug,code:draft.code,category:draft.category||"Robotics",
    grade_from:Number(draft.grade_from),grade_to:Number(draft.grade_to),total_sessions:Number(draft.total_sessions)
   };
   else data={student_id:draft.student_id,course_id:draft.course_id,trainer_id:draft.trainer_id};
   await call("/api/platform/academy/"+kind,{method:"POST",body:JSON.stringify({organizationId:selected,...data})});
   setDraft({});setVersion(n=>n+1);
  }catch(e){setError(e instanceof Error?e.message:"Unable to save record");}
  finally{setBusy(false);}
 }
 async function update(item:Item){
  if(!selected)return;
  const name=kind==="courses"?"title":kind==="enrollments"?"status":"full_name";
  const value=window.prompt("Enter new "+name,item[name]||"");
  if(value===null)return;
  setBusy(true);setError("");
  try{
   await call("/api/platform/academy/"+kind+"/"+item.id,{method:"PATCH",body:JSON.stringify({organizationId:selected,[name]:value})});
   setVersion(n=>n+1);
  }catch(e){setError(e instanceof Error?e.message:"Unable to update record");}
  finally{setBusy(false);}
 }
 const field=(name:string,label:string,type="text")=>(
  <label key={name} style={{display:"block",marginBottom:"0.6rem"}}>
   <span style={{display:"block",marginBottom:"0.25rem"}}>{label}</span>
   <input type={type} aria-label={label} style={inputStyle} value={draft[name]||""}
    onChange={e=>setDraft(v=>({...v,[name]:e.target.value}))}/>
  </label>);
 const choice=(name:string,label:string,options:Item[],render:(v:Item)=>string)=>(
  <label key={name} style={{display:"block",marginBottom:"0.6rem"}}>
   <span style={{display:"block",marginBottom:"0.25rem"}}>{label}</span>
   <select aria-label={label} style={inputStyle} value={draft[name]||""}
    onChange={e=>setDraft(v=>({...v,[name]:e.target.value}))}>
    <option value="">Choose {label.toLowerCase()}</option>
    {options.map(v=><option value={v.id} key={v.id}>{render(v)}</option>)}
   </select>
  </label>);
 return <main style={{maxWidth:1000,margin:"2rem auto",padding:"1rem",fontFamily:"system-ui"}}>
  <h1>Robotronix SaaS Academy</h1>
  <p>Organization-scoped Academy administration. Data is authorized by the server for each request.</p>
  {!ready&&<p>Checking organization access…</p>}
  {ready&&organizations.length===0&&<p>No active Academy organizations are assigned to your account.</p>}
  {error&&<p role="alert" style={{color:"#b91c1c"}}>{error}</p>}
  {organizations.length>0&&<>
   <label style={{display:"block",marginBottom:"1rem"}}>Active organization
    <select style={{...inputStyle,marginLeft:"0.75rem"}} value={selected} disabled={busy} onChange={e=>void switchOrg(e.target.value)}>
     <option value="">Select organization</option>
     {organizations.map(org=><option key={org.id} value={org.id}>{org.displayName} ({org.role})</option>)}
    </select>
   </label>
   {selected&&<>
    <nav aria-label="Academy resources" style={{display:"flex",gap:8,flexWrap:"wrap",margin:"1rem 0"}}>
     {kinds.map(k=><button key={k} style={buttonStyle} type="button" disabled={busy} aria-pressed={kind===k}
      onClick={()=>{setKind(k);setDraft({});}}>{k.charAt(0).toUpperCase()+k.slice(1)}</button>)}
    </nav>
    <section>
     <h2>{kind.charAt(0).toUpperCase()+kind.slice(1)} — {rows[kind].length} records</h2>
     <ul>{rows[kind].map(item=><li key={item.id} style={{padding:"0.55rem 0",borderBottom:"1px solid #ddd"}}>
      {item.full_name||item.title||item.id} {item.code?"("+item.code+")":""} {item.status?"— "+item.status:""}
      <button type="button" style={{...buttonStyle,marginLeft:12}} disabled={busy} onClick={()=>void update(item)}>Edit</button>
     </li>)}</ul>
     <h3>Add {kind.slice(0,-1)}</h3>
     {kind==="students"&&<>{field("full_name","Student name")}{field("grade","Grade")}{field("school","School")}</>}
     {kind==="trainers"&&field("full_name","Trainer name")}
     {kind==="courses"&&<>{field("title","Course title")}{field("slug","Unique course slug")}{field("code","Course code")}
       {field("category","Category")}{field("grade_from","From grade","number")}{field("grade_to","To grade","number")}
       {field("total_sessions","Total sessions","number")}</>}
     {kind==="enrollments"&&<>
      {choice("student_id","Student",rows.students,v=>v.full_name||v.id)}
      {choice("course_id","Course",rows.courses,v=>v.title||v.id)}
      {choice("trainer_id","Trainer",rows.trainers,v=>v.full_name||v.id)}
     </>}
     <button style={buttonStyle} type="button" disabled={busy} onClick={()=>void create()}>Create {kind.slice(0,-1)}</button>
    </section>
   </>}
  </>}
 </main>;
}
