"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import {createPortal} from "react-dom";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";

type Area={id:string;name:string};
type Project={id:string;name:string;area_id:string|null;status:string};

export function TasksQuickAdd(){
 const [open,setOpen]=useState(false);
 const [title,setTitle]=useState("");
 const [areas,setAreas]=useState<Area[]>([]);
 const [projects,setProjects]=useState<Project[]>([]);
 const [area,setArea]=useState("");
 const [project,setProject]=useState("");
 const [priority,setPriority]=useState("medium");
 const [date,setDate]=useState("");
 const [busy,setBusy]=useState(false);
 const busyRef=useRef(false);
 const [error,setError]=useState("");
 const input=useRef<HTMLInputElement>(null);
 const request=useCallback(async(path:string,init:RequestInit={})=>{
  const client=getSupabaseBrowserClient();
  if(!client)throw new Error("Development Supabase is not configured.");
  const {data:{session}}=await client.auth.getSession();
  if(!session?.access_token)throw new Error("Please sign in to add tasks.");
  const response=await fetch(path,{...init,cache:"no-store",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json",...init.headers}});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.ok===false)throw new Error(result.error||"Unable to complete the request.");
  return result;
 },[]);
 const show=useCallback((plannedDate="")=>{setDate(plannedDate);setError("");setOpen(true)},[]);
 useEffect(()=>{
  const handler=(event:Event)=>show((event as CustomEvent<{date?:string}>).detail?.date||"");
  const key=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();show()} };
  window.addEventListener("tasks:quick-add",handler);
  window.addEventListener("keydown",key);
  return()=>{window.removeEventListener("tasks:quick-add",handler);window.removeEventListener("keydown",key)};
 },[show]);
 useEffect(()=>{
  if(!open)return;
  const previous=document.activeElement as HTMLElement|null;
  const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape"&&!busyRef.current){event.stopPropagation();setOpen(false)}if(event.key==="Tab"){
   const nodes=Array.from(document.querySelectorAll<HTMLElement>(".mt2-quick-modal button:not(:disabled),.mt2-quick-modal input:not(:disabled),.mt2-quick-modal select:not(:disabled)"));
   if(!nodes.length)return;
   const first=nodes[0],last=nodes[nodes.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  }};
  document.addEventListener("keydown",onKey,true);
  input.current?.focus();
  Promise.all([request("/api/tasks/v2/areas"),request("/api/tasks/v2/projects")]).then(([a,p])=>{setAreas(a.items||[]);setProjects(p.items||[])}).catch(e=>setError(e instanceof Error?e.message:"Unable to load task options."));
  return()=>{document.removeEventListener("keydown",onKey,true);previous?.focus()};
 },[open,request]);
 const save=async(event:FormEvent)=>{
  event.preventDefault();if(!title.trim()||busy)return;
  busyRef.current=true;setBusy(true);setError("");
  try{
   const payload:Record<string,unknown>={title:title.trim(),priority};
   if(area)payload.area_id=area;
   if(project)payload.project_id=project;
   if(date)payload.scheduled_date=date;
   const result=await request("/api/tasks/v2/capture",{method:"POST",body:JSON.stringify(payload)});
   if(!result.item)throw new Error("Task was not created.");
   setTitle("");setArea("");setProject("");setPriority("medium");setDate("");setOpen(false);
   window.dispatchEvent(new Event("tasks:changed"));
  }catch(e){setError(e instanceof Error?e.message:"Unable to save task.")}
  finally{busyRef.current=false;setBusy(false)}
 };
 return <>
  <button type="button" className="mt2-nav-capture" onClick={()=>show()}><span className="mt2-nav-emoji" aria-hidden="true">＋</span> Add Task</button>
  {open&&createPortal(<div className="mt2-quick-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)setOpen(false)}}>
   <form className="mt2-quick-modal" role="dialog" aria-modal="true" aria-labelledby="mt2-quick-title" onSubmit={save}>
    <div className="mt2-quick-head"><div><span>QUICK CAPTURE</span><h2 id="mt2-quick-title">Add Task</h2></div><button type="button" aria-label="Close Add Task" disabled={busy} onClick={()=>setOpen(false)}>✕</button></div>
    <label>Task title<input ref={input} required maxLength={240} value={title} onChange={e=>setTitle(e.target.value)} placeholder="What needs to get done?"/></label>
    <div className="mt2-quick-fields"><label>Area<select value={area} onChange={e=>{setArea(e.target.value);setProject("")}}><option value="">Inbox / Unsorted</option>{areas.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label>
     <label>Project<select value={project} onChange={e=>{setProject(e.target.value);const p=projects.find(p=>p.id===e.target.value);if(p?.area_id)setArea(p.area_id)}}><option value="">No project</option>{projects.filter(p=>p.status==="active"&&(!area||!p.area_id||p.area_id===area)).map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
     <label>Priority<select value={priority} onChange={e=>setPriority(e.target.value)}><option value="low">Low</option><option value="medium">Normal</option><option value="high">High</option></select></label>
     <label>Plan for (optional)<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label></div>
    {error&&<p className="mt2-quick-error" role="alert">{error}</p>}
    <div className="mt2-quick-actions"><button type="button" disabled={busy} onClick={()=>setOpen(false)}>Cancel</button><button type="submit" disabled={busy||!title.trim()}>{busy?"Adding…":"Add Task"}</button></div>
   </form>
  </div>,document.body)}
 </>;
}
