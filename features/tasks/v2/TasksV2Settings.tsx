"use client";
import Link from "next/link";
import {useCallback,useEffect,useMemo,useState,type FormEvent} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {ApplicationSwitcher} from "@/components/ApplicationSwitcher";
import {parseCsv,TASK_CSV_FIELDS,type ImportRow} from "@/lib/server/tasks/csv";
import {TasksNotifications} from "./TasksNotifications";
import {TasksPrimaryNav} from "./TasksPrimaryNav";

type Health={service:string;response_ms:number;counts:{personal_tasks:number;open_tasks:number;workspaces:number;linked_records:number}};
type Mapping=Record<string,string>;
export function TasksV2Settings(){
 const [headers,setHeaders]=useState<string[]>([]);
 const [rows,setRows]=useState<string[][]>([]);
 const [mapping,setMapping]=useState<Mapping>({});
 const [health,setHealth]=useState<Health|null>(null);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const [mobileNav,setMobileNav]=useState(false);
 const request=useCallback(async <T,>(url:string,init:RequestInit={}):Promise<T>=>{
  const client=getSupabaseBrowserClient();if(!client)throw new Error("Supabase is unavailable.");
  const {data:{session}}=await client.auth.getSession();if(!session)throw new Error("Please sign in.");
  const res=await fetch(url,{...init,cache:"no-store",headers:{
   Authorization:"Bearer "+session.access_token,"Content-Type":"application/json",...(init.headers||{})
  }});
  const result=await res.json().catch(()=>({}));
  if(!res.ok||result.ok===false)throw new Error(result.error||"Request failed.");
  return result as T;
 },[]);
 const loadHealth=useCallback(async()=>{try{setHealth(await request<Health>("/api/tasks/diagnostics"))}catch(e){setError(e instanceof Error?e.message:"Account snapshot unavailable.")}},[request]);
 useEffect(()=>{void loadHealth()},[loadHealth]);
 const imported=useMemo(()=>rows.map(row=>Object.fromEntries(
  TASK_CSV_FIELDS.filter(key=>mapping[key]).map(key=>[key,row[headers.indexOf(mapping[key])]||""])
 ) as ImportRow),[rows,headers,mapping]);
 const titleCount=imported.filter(row=>row.title?.trim()).length;
 async function selectCsv(file:File){
  setError("");setNotice("");setRows([]);setHeaders([]);
  if(file.size>256000){setError("CSV file must be smaller than 250 KB.");return;}
  try{
   const data=parseCsv(await file.text());
   if(data.length<2||data.length>201)throw new Error("CSV must have a header and between 1 and 200 tasks.");
   const cols=data[0].map((x,i)=>x.trim()||"Column "+(i+1));
   setHeaders(cols);setRows(data.slice(1));setMapping(Object.fromEntries(
    TASK_CSV_FIELDS.map(key=>[key,cols.find(h=>h.toLowerCase().replace(/\s+/g,"_")===key)||""])
   ));
  }catch(e){setError(e instanceof Error?e.message:"Invalid CSV file.");}
 }
 async function confirmImport(e:FormEvent){
  e.preventDefault();
  if(!rows.length||titleCount!==rows.length||busy)return;
  if(!window.confirm("Import "+rows.length+" personal tasks? Existing tasks will remain unchanged."))return;
  setBusy(true);setError("");
  try{
   const result=await request<{imported:number}>("/api/tasks/data",{method:"POST",body:JSON.stringify({rows:imported})});
   setNotice(result.imported+" tasks imported.");setRows([]);setHeaders([]);await loadHealth();
  }catch(e){setError(e instanceof Error?e.message:"Import failed.");}
  finally{setBusy(false)}
 }
 async function exportTasks(format:"csv"|"json"){
  if(busy)return;setBusy(true);setError("");
  try{
   const client=getSupabaseBrowserClient();if(!client)throw new Error("Supabase unavailable.");
   const {data:{session}}=await client.auth.getSession();if(!session)throw new Error("Sign in again.");
   const res=await fetch("/api/tasks/data?format="+format,{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   if(!res.ok)throw new Error("Export unavailable.");
   const url=URL.createObjectURL(await res.blob());
   const a=document.createElement("a");a.href=url;a.download="my-tasks."+format;
   document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){setError(e instanceof Error?e.message:"Export failed.");}
  finally{setBusy(false)}
 }
 return <div className="mt2-shell">
  {mobileNav&&<button className="mt2-scrim" aria-label="Close navigation" onClick={()=>setMobileNav(false)}/>}
  <aside className={"mt2-sidebar "+(mobileNav?"mt2-sidebar-open":"")}>
   <Link href="/tasks" className="mt2-brand"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/></Link>
   <div className="mt2-product">My Tasks <span>YOUR WORKSPACE</span></div>
   <ApplicationSwitcher current="tasks"/>
   <div className="mt2-sidebar-heading">TASKS</div>
   <TasksPrimaryNav section="settings"/>
  </aside>
  <main className="mt2-main">
   <header className="mt2-header">
    <button className="mt2-mobile-menu" aria-label="Open navigation" onClick={()=>setMobileNav(true)}>☰</button>
    <div className="mt2-breadcrumb">MY TASKS <span>/</span> Settings & Data</div>
    <div className="mt2-header-actions"><TasksNotifications/></div>
   </header>
   <div className="mt2-page mt2-settings-page">
    <div className="mt2-heading"><div><p className="mt2-eyebrow">YOUR DATA, YOUR CONTROL</p><h1>Settings & data.</h1><p className="mt2-subtitle">Keep a portable copy of your tasks or bring work from another list.</p></div></div>
    {error&&<div className="mt2-error" role="alert">{error}<button onClick={()=>setError("")} aria-label="Dismiss">✕</button></div>}
    {notice&&<div className="mt2-notice" role="status">{notice}<button onClick={()=>setNotice("")} aria-label="Dismiss">✕</button></div>}
    <div className="mt2-settings-grid">
     <section className="mt2-panel"><div className="mt2-panel-head"><div><p className="mt2-eyebrow">PORTABLE DATA</p><h2>Export my tasks</h2><small>Exports only your own personal tasks, not teammates' shared work.</small></div></div>
      <div className="mt2-settings-actions"><button disabled={busy} onClick={()=>void exportTasks("csv")}>↓ Export CSV</button><button disabled={busy} onClick={()=>void exportTasks("json")}>↓ Export JSON</button></div>
     </section>
     <section className="mt2-panel"><div className="mt2-panel-head"><div><p className="mt2-eyebrow">ACCOUNT SNAPSHOT</p><h2>Your workspace</h2></div></div>
      {health?<><div className="mt2-settings-stats">
       <div><strong>{health.counts.personal_tasks}</strong><span>Personal tasks</span></div>
       <div><strong>{health.counts.open_tasks}</strong><span>Open</span></div>
       <div><strong>{health.counts.workspaces}</strong><span>Team spaces</span></div>
       <div><strong>{health.counts.linked_records}</strong><span>Connected</span></div>
      </div><p className="mt2-settings-caption">Task service responding in {health.response_ms} ms.</p></>:<p className="mt2-empty">Checking account data…</p>}
     </section>
    </div>
    <section className="mt2-panel mt2-settings-import"><div className="mt2-panel-head"><div><p className="mt2-eyebrow">BRING TASKS WITH YOU</p><h2>Import from CSV</h2><small>Maximum 200 tasks and 250 KB per file. Map your columns before confirming.</small></div></div>
     <label className="mt2-settings-upload">Choose a CSV file<input type="file" accept=".csv,text/csv" onChange={e=>{const file=e.target.files?.[0];if(file)void selectCsv(file);e.target.value="";}}/></label>
     {rows.length>0&&<form onSubmit={confirmImport}>
      <h3>Match your CSV columns</h3>
      <div className="mt2-settings-mapping">{TASK_CSV_FIELDS.map(key=><label key={key}>{key.replaceAll("_"," ")}<select value={mapping[key]||""} onChange={e=>setMapping(m=>({...m,[key]:e.target.value}))}><option value="">Skip column</option>{headers.map((h,i)=><option key={h+i} value={h}>{h}</option>)}</select></label>)}</div>
      <div className="mt2-settings-preview"><strong>Preview: {rows.length} tasks</strong>{imported.slice(0,4).map((task,i)=><div key={i}>{task.title||"Missing title"} <small>{task.priority||"medium"} · {task.status||"todo"}</small></div>)}</div>
      <button className="mt2-settings-import-button" disabled={busy||titleCount!==rows.length} type="submit">{busy?"Importing…":"Import "+rows.length+" tasks"}</button>
     </form>}
    </section>
    <p className="mt2-settings-caption">Focus time, active-project limits and protected Area commitments can be configured in <Link href="/tasks/focus">Focus & Finish</Link>.</p>
   </div>
  </main>
 </div>;
}
