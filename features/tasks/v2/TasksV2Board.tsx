"use client";
import Link from "next/link";
import {useCallback,useEffect,useMemo,useRef,useState,type DragEvent,type FormEvent} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {ApplicationSwitcher} from "@/components/ApplicationSwitcher";
import {TasksNotifications} from "./TasksNotifications";
import {TasksPrimaryNav} from "./TasksPrimaryNav";
import {TaskV2DetailDrawer} from "./TaskV2DetailDrawer";
import type {V2Task,V2Area,V2Project,V2Priority,V2Status,V2Response,V2Request,V2ModuleLink} from "./model";
import {v2Colors,v2Statuses,v2StatusNames} from "./model";

type Grouping="status"|"area"|"project"|"person";
type Column={id:string;title:string;subtitle:string;color:string};
const asDate=(value:string|null)=>value?new Date(value.includes("T")?value:value+"T12:00:00").toLocaleDateString(undefined,{day:"numeric",month:"short"}):"";
const sortCards=(a:V2Task,b:V2Task)=>a.board_rank-b.board_rank||a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id);
export function TasksV2Board(){
 const [tasks,setTasks]=useState<V2Task[]>([]);
 const [areas,setAreas]=useState<V2Area[]>([]);
 const [projects,setProjects]=useState<V2Project[]>([]);
 const [moduleLinks,setModuleLinks]=useState<V2ModuleLink[]>([]);
 const [userId,setUserId]=useState<string|null>(null);
 const [group,setGroup]=useState<Grouping>("status");
 const [search,setSearch]=useState("");
 const [priority,setPriority]=useState<"all"|V2Priority>("all");
 const [showDone,setShowDone]=useState(false);
 const [loading,setLoading]=useState(true);
 const [working,setWorking]=useState(false);
 const [dragId,setDragId]=useState<string|null>(null);
 const [overColumn,setOverColumn]=useState<string|null>(null);
 const [selected,setSelected]=useState<V2Task|null>(null);
 const [quick,setQuick]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [mobileNav,setMobileNav]=useState(false);
 const quickRef=useRef<HTMLInputElement>(null);
 const request:V2Request=useCallback(async <T,>(url:string,init:RequestInit={}):Promise<T>=>{
  const client=getSupabaseBrowserClient();
  if(!client)throw new Error("Supabase is not configured.");
  const {data:{session}}=await client.auth.getSession();
  if(!session?.access_token)throw new Error("Sign in to access My Tasks.");
  const response=await fetch(url,{...init,cache:"no-store",headers:{
   "Authorization":"Bearer "+session.access_token,"Content-Type":"application/json",...(init.headers||{})
  }});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok||payload.ok===false)throw new Error(payload.error||"Unable to complete operation.");
  return payload as T;
 },[]);
 const refresh=useCallback(async()=>{
  try{
   const [a,p,connected]=await Promise.all([
    request<V2Response<V2Area>>("/api/tasks/v2/areas"),
    request<V2Response<V2Project>>("/api/tasks/v2/projects"),
    request<V2Response<V2ModuleLink>>("/api/tasks/module-links")
   ]);
   const all:V2Task[]=[];
   for(let offset=0;offset<20000;offset+=250){
    const page=await request<V2Response<V2Task>>("/api/tasks/v2/board?limit=250&offset="+offset);
    const part=page.items||[];
    all.push(...part);
    if(part.length<250)break;
   }
   setTasks([...new Map(all.map(t=>[t.id,t])).values()]);
   setAreas(a.items||[]);setProjects(p.items||[]);setModuleLinks(connected.items||[]);
   setError("");
  }catch(e){setError(e instanceof Error?e.message:"Unable to load task board.");}
  finally{setLoading(false)}
 },[request]);
 useEffect(()=>{void refresh()},[refresh]);
 useEffect(()=>{
  let active=true;void getSupabaseBrowserClient()?.auth.getUser().then(({data})=>{
   if(active)setUserId(data.user?.id||null);
  });
  return()=>{active=false};
 },[]);
 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{
   if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();quickRef.current?.focus();}
   if(e.key==="Escape"){setSelected(null);setMobileNav(false);}
  };
  document.addEventListener("keydown",onKey);return()=>document.removeEventListener("keydown",onKey);
 },[]);
 const areaById=useMemo(()=>new Map(areas.map(a=>[a.id,a])),[areas]);
 const projectById=useMemo(()=>new Map(projects.map(p=>[p.id,p])),[projects]);
 const sourceByTask=useMemo(()=>new Map(moduleLinks.map(l=>[l.task_id,l.module])),[moduleLinks]);
 const columns=useMemo<Column[]>(()=>{
  if(group==="status")return v2Statuses.map((s,i)=>({id:s,title:v2StatusNames[s],subtitle:["Ready to begin","Your active work","Pending a response","Finished work"][i],color:["#6884ab","#3c91d3","#d49b47","#38a183"][i]}));
  if(group==="area")return [
   {id:"none",title:"Unsorted",subtitle:"No area yet",color:"#9cabbc"},
   ...areas.map(a=>({id:a.id,title:a.name,subtitle:"Area",color:v2Colors[a.color]||v2Colors.slate}))
  ];
  if(group==="project")return [
   {id:"none",title:"No project",subtitle:"Independent tasks",color:"#96a8b7"},
   ...projects.map(p=>({id:p.id,title:p.name,subtitle:p.status==="active"?"Project":p.status,color:v2Colors[areaById.get(p.area_id||"")?.color||"slate"]||v2Colors.slate}))
  ];
  return [
   {id:"me",title:"My tasks",subtitle:"Owned or assigned to me",color:"#3382bd"},
   {id:"other",title:"Delegated",subtitle:"Assigned to other people",color:"#b98351"},
   {id:"shared",title:"Shared with me",subtitle:"Other workspace tasks",color:"#9caec0"}
  ];
 },[group,areas,projects,areaById]);
 const columnKey=useCallback((task:V2Task):string=>{
  if(group==="status")return task.status;
  if(group==="area")return task.area_id&&areaById.has(task.area_id)?task.area_id:"none";
  if(group==="project")return task.project_id&&projectById.has(task.project_id)?task.project_id:"none";
  if(task.assignee_user_id===userId||(task.owner_user_id===userId&&!task.assignee_user_id))return "me";
  if(task.owner_user_id===userId&&task.assignee_user_id&&task.assignee_user_id!==userId)return "other";
  return "shared";
 },[group,areaById,projectById,userId]);
 const filtered=useMemo(()=>{
  const q=search.trim().toLowerCase();
  return tasks.filter(t=>{
   if(!showDone&&t.status==="done")return false;
   if(priority!=="all"&&t.priority!==priority)return false;
   if(!q)return true;
   return [t.title,t.description,areaById.get(t.area_id||"")?.name||"",projectById.get(t.project_id||"")?.name||""]
    .some(x=>x.toLowerCase().includes(q));
  });
 },[tasks,search,priority,showDone,areaById,projectById]);
 const visibleByColumn=useMemo(()=>{
  const result=new Map<string,V2Task[]>();
  for(const col of columns)result.set(col.id,[]);
  for(const t of filtered)result.get(columnKey(t))?.push(t);
  for(const list of result.values())list.sort(sortCards);
  return result;
 },[filtered,columns,columnKey]);
 const allCardsIn=(colId:string,exclude?:string)=>tasks.filter(t=>columnKey(t)===colId&&t.id!==exclude).sort(sortCards);
 const move=async(task:V2Task,colId:string,targetIndex:number)=>{
  if(working)return;
  if(group==="person"){setError("Assignment changes are managed in Connected Work.");return;}
  if(task.owner_user_id!==userId){setError("Only the task owner can reorder or move this card here.");return;}
  const dest=columns.find(c=>c.id===colId);
  if(!dest)return;
  const status:V2Status=group==="status"?dest.id as V2Status:task.status;
  setWorking(true);setError("");setNotice("");
  try{
   await request<V2Response<V2Task>>("/api/tasks/v2/items/"+task.id+"/move",{
    method:"POST",body:JSON.stringify({
     status,group_by:group,group_id:group==="status"?null:colId==="none"?null:colId,
     position:Math.max(0,targetIndex)
    })
   });
   await refresh();setNotice("Card moved successfully.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to move card. No changes were applied.");}
  finally{setWorking(false);setOverColumn(null);setDragId(null)}
 };
 const onDrop=(e:DragEvent,colId:string,beforeTask?:string)=>{
  e.preventDefault();e.stopPropagation();
  const id=e.dataTransfer.getData("text/plain")||dragId;
  const task=tasks.find(t=>t.id===id);
  if(!task||beforeTask===id){setOverColumn(null);return;}
  const lane=allCardsIn(colId,task.id);
  const position=beforeTask?Math.max(0,lane.findIndex(t=>t.id===beforeTask)):lane.length;
  void move(task,colId,position);
 };
 const arrowMove=(task:V2Task,colId:string,by:number)=>{
  const lane=allCardsIn(colId,task.id);
  const current=allCardsIn(colId).findIndex(t=>t.id===task.id);
  if(current<0)return;
  void move(task,colId,Math.max(0,Math.min(lane.length,current+by)));
 };
 const capture=async(e:FormEvent)=>{
  e.preventDefault();if(!quick.trim()||working)return;
  setWorking(true);setError("");
  try{
   const added=await request<V2Response<V2Task>>("/api/tasks/v2/capture",{
    method:"POST",body:JSON.stringify({title:quick.trim()})
   });
   if(!added.item)throw new Error("Unable to create task.");
   setQuick("");await refresh();setNotice("Task captured in your Inbox.");
   quickRef.current?.focus();
  }catch(e){setError(e instanceof Error?e.message:"Unable to capture task.");}
  finally{setWorking(false)}
 };
 const areaName=(t:V2Task)=>areaById.get(t.area_id||"")?.name||"Unsorted";
 const openDetails=(task:V2Task)=>setSelected(task);
 const totalOpen=tasks.filter(t=>t.status!=="done").length;
 const totalDone=tasks.filter(t=>t.status==="done").length;
 const groupOptions:[Grouping,string][]=[["status","Status"],["area","Area"],["project","Project"],["person","Person"]];
 return <div className="mt2-shell mt2-board-shell">
  {mobileNav&&<button className="mt2-scrim" aria-label="Close navigation" onClick={()=>setMobileNav(false)}/>}
  <aside className={"mt2-sidebar "+(mobileNav?"mt2-sidebar-open":"")}>
   <Link href="/tasks" className="mt2-brand"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/></Link>
   <div className="mt2-product">My Tasks <span>VISUAL WORKSPACE</span></div>
   <ApplicationSwitcher current="tasks"/>
   <div className="mt2-sidebar-heading">MY WORKSPACE</div>
   <TasksPrimaryNav section="board"/>
   <div className="mt2-sidebar-heading mt2-areas-heading">WORKFLOW</div>
   <p className="mt2-sidebar-help">Group and filter the board above the columns. Drag a card or use its move selector to change status.</p>
   <div className="mt2-sidebar-bottom"><Link href="/tasks">← Back to My Day</Link></div>
  </aside>
  <main className="mt2-main">
   <header className="mt2-header">
    <button type="button" className="mt2-mobile-menu" aria-label="Open navigation" onClick={()=>setMobileNav(true)}>☰</button>
    <div className="mt2-breadcrumb">MY TASKS <span>/</span> Visual Board</div>
    <div className="mt2-header-actions"><TasksNotifications/><span className="mt2-sync"><i/> Live task workspace</span><button className="mt2-header-add" onClick={()=>quickRef.current?.focus()}>+ New task</button></div>
   </header>
   <div className="mt2-page mt2-board-page">
    <div className="mt2-heading"><div><p className="mt2-eyebrow">VISUAL WORKFLOW</p><h1>Task board</h1><p className="mt2-subtitle">See what is next, underway and waiting for a response.</p></div><div className="mt2-board-summary"><strong>{totalOpen}</strong><span>Open</span><strong>{totalDone}</strong><span>Done</span></div></div>
    {error&&<div className="mt2-error" role="alert">{error}<button aria-label="Dismiss" onClick={()=>setError("")}>✕</button></div>}
    {notice&&<div className="mt2-notice" role="status">{notice}<button aria-label="Dismiss" onClick={()=>setNotice("")}>✕</button></div>}
    <form className="mt2-board-capture" onSubmit={capture}><span>＋</span><input ref={quickRef} value={quick} onChange={e=>setQuick(e.target.value)} maxLength={240} aria-label="Quick capture task" placeholder="Quick capture — type something and press Enter…"/><button disabled={working||!quick.trim()} type="submit">Add task</button></form>
    <div className="mt2-board-tools">
     <div className="mt2-board-group"><span>Group by</span>{groupOptions.map(([id,label])=><button key={id} aria-pressed={group===id} className={group===id?"active":""} onClick={()=>{setGroup(id);setOverColumn(null)}}>{label}</button>)}</div>
     <div className="mt2-board-filters"><input aria-label="Search board" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search cards..."/><select aria-label="Filter priority" value={priority} onChange={e=>setPriority(e.target.value as "all"|V2Priority)}><option value="all">All priorities</option><option value="high">High priority</option><option value="medium">Normal</option><option value="low">Low</option></select><label><input type="checkbox" checked={showDone} onChange={e=>setShowDone(e.target.checked)}/> Show done</label></div>
    </div>
    {loading?<div className="mt2-loading">Loading your board and checklist progress…</div>:<div className="mt2-board-columns" aria-label={"Board grouped by "+group}>
     {columns.filter(c=>group!=="status"||showDone||c.id!=="done").map(col=>{
      const cards=visibleByColumn.get(col.id)||[];
      return <section className={"mt2-board-column "+(overColumn===col.id?"mt2-column-over":"")} key={col.id}
       aria-label={col.title} onDragOver={e=>{if(group!=="person"&&dragId){e.preventDefault();setOverColumn(col.id)}}}
       onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setOverColumn(null)}}
       onDrop={e=>onDrop(e,col.id)}>
       <div className="mt2-board-column-head"><span className="mt2-board-marker" style={{background:col.color}}/><div><h2>{col.title}</h2><small>{col.subtitle}</small></div><span className="mt2-board-counter">{cards.length}</span></div>
       <div className="mt2-board-card-list">
        {cards.map(task=>{
         const movable=group!=="person"&&task.owner_user_id===userId&&!working;
         const rank=allCardsIn(col.id).findIndex(t=>t.id===task.id);
         const completed=task.subtask_done||0,total=task.subtask_total||0;
         return <article key={task.id} className={"mt2-board-card "+(dragId===task.id?"mt2-card-dragging":"")+" mt2-board-priority-"+task.priority}
          draggable={movable}
          onDragStart={e=>{if(!movable){e.preventDefault();return;}setDragId(task.id);e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",task.id)}}
          onDragEnd={()=>{setDragId(null);setOverColumn(null)}}
          onDragOver={e=>{if(dragId&&group!=="person")e.preventDefault()}}
          onDrop={e=>onDrop(e,col.id,task.id)}
         >
          <div className="mt2-card-top">
           <span className="mt2-card-area" style={{color:v2Colors[areaById.get(task.area_id||"")?.color||"slate"]||v2Colors.slate}}>{areaName(task)}</span>
           <span className={"mt2-card-flag "+task.priority}>⚑ {task.priority}</span>
          </div>
          <button className="mt2-card-title" onClick={()=>openDetails(task)}>{task.title}</button>
          {task.done_definition&&<p className="mt2-card-outcome">✓ {task.done_definition}</p>}
          {total>0&&<div className="mt2-card-steps"><div className="mt2-progress-track"><span style={{width:(100*completed/total)+"%"}}/></div><small>{completed}/{total} steps</small></div>}
          <div className="mt2-card-tags">
           {task.workspace_id&&<span className="mt2-shared-chip">◇ Shared{task.assignee_user_id===userId?" · Assigned to you":""}</span>}
           {sourceByTask.get(task.id)&&<span className="mt2-source-mini">↗ {sourceByTask.get(task.id)==="connect"?"Connect CRM":"Learning Portal"}</span>}
           {task.important&&<span className="mt2-card-important">★ Important</span>}
           {task.scheduled_date&&<span>◷ {asDate(task.scheduled_date)}</span>}
           {task.due_at&&<span className={new Date(task.due_at)<new Date()&&task.status!=="done"?"late":""}>◉ {asDate(task.due_at)}</span>}
           {task.estimated_minutes&&<span>⏱ {task.estimated_minutes}m</span>}
           {task.status==="waiting"&&<span>⏳ Waiting</span>}
          </div>
          <div className="mt2-card-actions">
           <button type="button" onClick={()=>openDetails(task)}>Details</button>
           {task.owner_user_id===userId&&task.status!=="done"&&<Link className="mt2-card-focus-link" href={"/tasks/focus?task="+task.id}>▶ Focus</Link>}
           {movable&&<>
            <button type="button" title="Move earlier" aria-label={"Move "+task.title+" earlier"} disabled={rank<=0||working} onClick={()=>arrowMove(task,col.id,-1)}>↑</button>
            <button type="button" title="Move later" aria-label={"Move "+task.title+" later"} disabled={rank>=allCardsIn(col.id).length-1||working} onClick={()=>arrowMove(task,col.id,1)}>↓</button>
            <select aria-label={"Move "+task.title+" to a different column"} value={col.id} disabled={working} onChange={e=>void move(task,e.target.value,allCardsIn(e.target.value,task.id).length)}>
             {columns.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
           </>}
          </div>
         </article>;
        })}
        {!cards.length&&<div className="mt2-column-empty">No cards here. {group==="person"?"": "Drop a card to get started."}</div>}
        {group!=="person"&&<button className="mt2-column-drop-target" disabled={working} onClick={()=>quickRef.current?.focus()} type="button">＋ Capture a task</button>}
       </div>
      </section>;
     })}
    </div>}
    <p className="mt2-board-footnote">{group==="person"?"Assignments are shown here but managed in Connected Work.":"Drag cards between columns, or use each card’s move selector and ↑/↓ buttons. Status moves preserve linked workflows and completion history."}</p>
   </div>
  </main>
  <TaskV2DetailDrawer task={selected} areas={areas} projects={projects} userId={userId} request={request}
   onClose={()=>setSelected(null)} onChanged={refresh}/>
 </div>;
}
