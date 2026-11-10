"use client";
import Link from "next/link";
import {useCallback,useEffect,useMemo,useRef,useState,type CSSProperties,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {ApplicationSwitcher} from "@/components/ApplicationSwitcher";
import {TaskV2DetailDrawer} from "./TaskV2DetailDrawer";
import type {V2Task,V2Area,V2Project} from "./model";

type Priority="low"|"medium"|"high";
type Task=V2Task;
type Area=V2Area;
type Project=V2Project;
type ApiResult<T>={ok:boolean;items?:T[];item?:T;error?:string};

const COLORS:Record<string,string>={blue:"#3777bb",green:"#229b83",purple:"#8565cd",amber:"#bb873d",red:"#d26763",slate:"#718399"};
const timeLabel=(minutes:number|null)=>minutes?minutes>=60?Math.floor(minutes/60)+"h"+(minutes%60?" "+minutes%60+"m":""):minutes+"m":"";
function dayKey(date:Date){
 const parts=new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
 const find=(name:string)=>parts.find(p=>p.type===name)?.value||"";
 return find("year")+"-"+find("month")+"-"+find("day");
}
function dueKey(value:string|null){return value?dayKey(new Date(value)):"";}
function dateTitle(value:string){return new Date(value+"T12:00:00").toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});}
function dateShort(value:string){return new Date(value+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric"});}


function Icon({name}:{name:string}){
 const paths:Record<string,string>={
  plus:"M12 5v14 M5 12h14",dashboard:"M3 3h8v8H3z M13 3h8v5h-8z M13 10h8v11h-8z M3 13h8v8H3z",
  inbox:"M4 4h16v16H4z M4 13h5l2 3h2l2-3h5",list:"M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  check:"M5 12l4 4 10-10",star:"m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z",
  flag:"M5 3v18 M5 4h13l-2 5 2 5H5",calendar:"M4 5h16v16H4z M8 2v6 M16 2v6 M4 11h16",
  arrow:"M5 12h14m-6-6 6 6-6 6",clock:"M12 3a9 9 0 1 0 .01 0 M12 7v5l4 2",
  briefcase:"M3 7h18v13H3z M8 7V4h8v3 M3 13h18",search:"M19 19l-4-4 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  sparkle:"m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z",
  close:"M5 5l14 14 M19 5L5 19",menu:"M4 6h16 M4 12h16 M4 18h16",filter:"M4 5h16l-7 8v6l-2 2v-8z",
  edit:"M4 20h4L20 8l-4-4L4 16z"
 };
 return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]||paths.check}/></svg>;
}
export function TasksV2Dashboard(){
 const router=useRouter();
 const inputRef=useRef<HTMLInputElement|null>(null);
 const [tasks,setTasks]=useState<Task[]>([]);
 const [areas,setAreas]=useState<Area[]>([]);
 const [projects,setProjects]=useState<Project[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [pendingId,setPendingId]=useState<string|null>(null);
 const [userId,setUserId]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [view,setView]=useState<View>("day");
 const [areaFilter,setAreaFilter]=useState("all");
 const [search,setSearch]=useState("");
 const [quick,setQuick]=useState("");
 const [quickArea,setQuickArea]=useState("");
 const [quickProject,setQuickProject]=useState("");
 const [quickPriority,setQuickPriority]=useState<Priority>("medium");
 const [quickDate,setQuickDate]=useState("inbox");
 const [showCompleted,setShowCompleted]=useState(true);
 const [mobileNav,setMobileNav]=useState(false);
 const [createPanel,setCreatePanel]=useState<"area"|"project"|null>(null);
 const [newName,setNewName]=useState("");
 const [newAreaForProject,setNewAreaForProject]=useState("");
 const [newColor,setNewColor]=useState("blue");
 const [selected,setSelected]=useState<Task|null>(null);
 const [today,setToday]=useState(()=>dayKey(new Date()));

 const request=useCallback(async <T,>(url:string,init:RequestInit={}):Promise<T>=>{
  const client=getSupabaseBrowserClient();
  if(!client)throw new Error("Development Supabase is not configured.");
  const {data:{session}}=await client.auth.getSession();
  if(!session?.access_token)throw new Error("Please sign in to use My Tasks.");
  const response=await fetch(url,{...init,cache:"no-store",headers:{"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json",...(init.headers||{})}});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.ok===false)throw new Error(result.error||"Couldn't complete the request.");
  return result as T;
 },[]);
 const refresh=useCallback(async()=>{
  try{
   const [areasData,projectsData]=await Promise.all([
    request<ApiResult<Area>>("/api/tasks/v2/areas"),
    request<ApiResult<Project>>("/api/tasks/v2/projects")
   ]);
   const all:Task[]=[];
   for(let offset=0;offset<10000;offset+=100){
    const page=await request<ApiResult<Task>>("/api/tasks?limit=100&offset="+offset);
    const batch=page.items||[];all.push(...batch);
    if(batch.length<100)break;
   }
   setAreas(areasData.items||[]);
   setProjects(projectsData.items||[]);
   setTasks([...new Map(all.map(item=>[item.id,item])).values()]);
   setError("");
  }catch(e){
   const message=e instanceof Error?e.message:"Unable to load dashboard.";
   if(message.includes("Complete My Tasks onboarding")){router.replace("/tasks/welcome");return;}
   setError(message);
  }finally{setLoading(false)}
 },[request,router]);
 useEffect(()=>{void refresh()},[refresh]);
 useEffect(()=>{let active=true;void getSupabaseBrowserClient()?.auth.getUser().then(({data})=>{if(active)setUserId(data.user?.id||null)});return()=>{active=false}},[]);
 useEffect(()=>{const timer=window.setInterval(()=>setToday(dayKey(new Date())),60*1000);return()=>window.clearInterval(timer)},[]);
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{
   if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){
    e.preventDefault();inputRef.current?.focus();
   }
   if(e.key==="Escape"){setSelected(null);setCreatePanel(null);setMobileNav(false)}
  };
  document.addEventListener("keydown",key);
  return()=>document.removeEventListener("keydown",key);
 },[]);
 const usableProjects=useMemo(()=>projects.filter(p=>p.status==="active"&&(!quickArea||!p.area_id||p.area_id===quickArea)),[projects,quickArea]);
 const active=tasks.filter(t=>t.status!=="done");
 const done=tasks.filter(t=>t.status==="done");
 const overdue=active.filter(t=>dueKey(t.due_at)&&dueKey(t.due_at)<today);
 const todayItems=tasks.filter(t=>t.scheduled_date===today||dueKey(t.due_at)===today||t.focus_date===today);
 const focus=active.filter(t=>t.focus_date===today&&t.focus_rank).sort((a,b)=>(a.focus_rank||9)-(b.focus_rank||9));
 const weekStart=new Date(today+"T12:00:00");weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7));
 const doneWeek=done.filter(t=>t.completed_at&&new Date(t.completed_at).getTime()>=weekStart.getTime()).length;
 const inbox=active.filter(t=>!t.scheduled_date&&!t.due_at);
 const visibleTasks=(items:Task[])=>items.filter(t=>{
  if(areaFilter==="unsorted" ? t.area_id!==null : areaFilter!=="all"&&t.area_id!==areaFilter)return false;
  if(!showCompleted&&t.status==="done")return false;
  const term=search.toLowerCase().trim();
  return !term||[t.title,t.description,areas.find(a=>a.id===t.area_id)?.name||"",projects.find(p=>p.id===t.project_id)?.name||""].some(v=>v.toLowerCase().includes(term));
 });
 const chosen=visibleTasks(view==="day"?todayItems:view==="inbox"?inbox:tasks);
 const todayAndOverdue=visibleTasks([...new Map([...todayItems,...overdue].map(t=>[t.id,t])).values()]).filter(t=>t.status!=="done");
 const dailyOpen=chosen.filter(t=>t.status!=="done").sort((a,b)=>(a.focus_rank||9)-(b.focus_rank||9)||Number(b.important)-Number(a.important)||({high:0,medium:1,low:2}[a.priority]-{high:0,medium:1,low:2}[b.priority]));
 const dailyDone=chosen.filter(t=>t.status==="done");
 const areaName=(id:string|null)=>areas.find(a=>a.id===id)?.name||"Unsorted";
 const badgeColor=(id:string|null)=>COLORS[areas.find(a=>a.id===id)?.color||"slate"]||COLORS.slate;
 
 const send=async(url:string,method:string,body:unknown)=>request<ApiResult<Task>>(url,{method,body:JSON.stringify(body)});
 const updateTask=async(task:Task,url:string,body:Record<string,unknown>)=>{
  setPendingId(task.id);
  try{
   const reply=await send(url,"PATCH",body);
   if(!reply.item)throw new Error("Task not found.");
   setTasks(prev=>prev.map(t=>t.id===task.id?reply.item as Task:t));
   setSelected(prev=>prev?.id===task.id?reply.item||null:prev);
   setNotice("Saved");setError("");
   if("status" in body)await refresh(); // Recurrences may generate another task.
  }catch(e){setError(e instanceof Error?e.message:"Unable to save task.");}
  finally{setPendingId(null)}
 };
 const toggleDone=async(task:Task)=>updateTask(task,"/api/tasks/"+task.id,{status:task.status==="done"?"todo":"done"});
 const markFocus=async(task:Task)=>{
  if(task.focus_date===today)return updateTask(task,"/api/tasks/"+task.id,{focus_date:null,focus_rank:null});
  const used=new Set(focus.map(t=>t.focus_rank));
  const next=[1,2,3].find(n=>!used.has(n));
  if(!next){setError("Your Top 3 is full. Remove one focus star first.");return;}
  await updateTask(task,"/api/tasks/"+task.id,{focus_date:today,focus_rank:next});
 };
 const capture=async(event:FormEvent)=>{
  event.preventDefault();
  const title=quick.trim();
  if(!title||busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const payload:Record<string,unknown>={title,priority:quickPriority};
   if(quickArea)payload.area_id=quickArea;
   if(quickProject)payload.project_id=quickProject;
   if(quickDate==="today")payload.scheduled_date=today;
   if(quickDate==="tomorrow"){const d=new Date(today+"T12:00:00");d.setDate(d.getDate()+1);payload.scheduled_date=dayKey(d)}
   const response=await send("/api/tasks/v2/capture","POST",payload);
   if(!response.item)throw new Error("Unable to create task.");
   setQuick("");
   setNotice("Task added. Capture another when you're ready.");
   await refresh();
   inputRef.current?.focus();
  }catch(e){setError(e instanceof Error?e.message:"Couldn't save task.");}
  finally{setBusy(false)}
 };
 const saveCollection=async(event:FormEvent)=>{
  event.preventDefault();
  if(!createPanel||!newName.trim()||busy)return;
  setBusy(true);setError("");
  try{
   if(createPanel==="area"){
    const saved=await request<ApiResult<Area>>("/api/tasks/v2/areas",{method:"POST",body:JSON.stringify({name:newName.trim(),color:newColor})});
    await refresh();
    if(saved.item)setQuickArea(saved.item.id);
   }else{
    const saved=await request<ApiResult<Project>>("/api/tasks/v2/projects",{method:"POST",body:JSON.stringify({name:newName.trim(),area_id:newAreaForProject||null})});
    await refresh();
    if(saved.item){setQuickArea(newAreaForProject);setQuickProject(saved.item.id)}
   }
   setNotice(createPanel==="area"?"Area created.":"Project created.");
   setCreatePanel(null);setNewName("");
  }catch(e){setError(e instanceof Error?e.message:"Unable to save.");}
  finally{setBusy(false)}
 };
 const openDetail=(task:Task)=>setSelected(task);
 const taskRow=(task:Task)=>{
  const d=dueKey(task.due_at);
  return <article className={"mt2-task "+(task.status==="done"?"mt2-done":"")} key={task.id}>
   <label className="mt2-check-label" title={task.status==="done"?"Reopen":"Mark completed"}>
    <input type="checkbox" aria-label={(task.status==="done"?"Reopen ":"Complete ")+task.title} checked={task.status==="done"} disabled={pendingId===task.id||(task.owner_user_id!==userId&&task.assignee_user_id!==userId)} onChange={()=>void toggleDone(task)}/>
    <span className="mt2-checkbox"><Icon name="check"/></span>
   </label>
   <button type="button" className="mt2-task-content" onClick={()=>openDetail(task)}>
    <span className="mt2-task-title">{task.title}</span>
    <span className="mt2-task-tags">
     <span className="mt2-area-tag" style={{"--area":badgeColor(task.area_id)} as CSSProperties}>{areaName(task.area_id)}</span>
     <span className={"mt2-priority mt2-priority-"+task.priority}><Icon name="flag"/>{task.priority}</span>
     {task.estimated_minutes?<span><Icon name="clock"/>{timeLabel(task.estimated_minutes)}</span>:null}
     {d?<span className={d<today&&task.status!=="done"?"mt2-late":""}><Icon name="calendar"/>{dateShort(d)}</span>:null}
     {task.status==="waiting"?<span className="mt2-waiting">Waiting</span>:null}
    </span>
   </button>
   {task.status!=="done"&&task.owner_user_id===userId&&<button type="button" className={"mt2-star "+(task.focus_date===today?"is-on":"")} title={task.focus_date===today?"Remove from Top 3":"Make a Top 3 priority"} aria-label={"Toggle Top 3 for "+task.title} disabled={pendingId===task.id} onClick={()=>void markFocus(task)}><Icon name="star"/></button>}
  </article>;
 };
 return <div className="mt2-shell">
  {mobileNav&&<button className="mt2-scrim" aria-label="Close navigation" onClick={()=>setMobileNav(false)}/>}
  <aside className={"mt2-sidebar "+(mobileNav?"mt2-sidebar-open":"")}>
   <Link href="/tasks/v2" className="mt2-brand"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/></Link>
   <div className="mt2-product">My Tasks <span>VISUAL WORKSPACE · V2</span></div>
   <ApplicationSwitcher current="tasks"/>
   <div className="mt2-sidebar-heading">MY WORKSPACE</div>
   <nav aria-label="My Tasks V2">
    <button className={view==="day"?"is-active":""} onClick={()=>{setView("day");setMobileNav(false)}}><Icon name="dashboard"/> My Day</button>
    <button className={view==="inbox"?"is-active":""} onClick={()=>{setView("inbox");setMobileNav(false)}}><Icon name="inbox"/> Inbox <span className="mt2-nav-count">{inbox.length}</span></button>
    <button className={view==="all"?"is-active":""} onClick={()=>{setView("all");setMobileNav(false)}}><Icon name="list"/> All Tasks</button>
    <Link href="/tasks/v2/board"><Icon name="briefcase"/> Visual Board <small>New</small></Link>
    <Link href="/tasks/v2/focus"><Icon name="clock"/> Focus & Finish <small>New</small></Link>
    <Link href="/tasks/board"><Icon name="briefcase"/> Classic Board</Link>
    <Link href="/tasks/calendar"><Icon name="calendar"/> Calendar <small>Classic</small></Link>
   </nav>
   <div className="mt2-sidebar-heading mt2-areas-heading">AREAS <button aria-label="Add area" title="Add area" onClick={()=>{setNewName("");setCreatePanel("area")}}><Icon name="plus"/></button></div>
   <div className="mt2-areas-nav">
    <button className={areaFilter==="all"?"selected":""} onClick={()=>setAreaFilter("all")}><span className="mt2-area-dot" style={{background:"#98a9b6"}}/>All areas <small>{active.length}</small></button>
    {areas.map(a=><button key={a.id} className={areaFilter===a.id?"selected":""} onClick={()=>setAreaFilter(a.id)}><span className="mt2-area-dot" style={{background:COLORS[a.color]||COLORS.slate}}/>{a.name}<small>{active.filter(t=>t.area_id===a.id).length}</small></button>)}
    <button className={areaFilter==="unsorted"?"selected":""} onClick={()=>setAreaFilter("unsorted")}><span className="mt2-area-dot" style={{background:"#a8b3c2"}}/>Unsorted <small>{active.filter(t=>!t.area_id).length}</small></button>
   </div>
   <div className="mt2-sidebar-bottom">
    <button type="button" onClick={()=>{setNewName("");setCreatePanel("project")}}><Icon name="plus"/> New project</button>
    <Link href="/tasks">Open classic Tasks <Icon name="arrow"/></Link>
   </div>
  </aside>
  <main className="mt2-main">
   <header className="mt2-header">
    <button className="mt2-mobile-menu" aria-label="Open navigation" onClick={()=>setMobileNav(true)}><Icon name="menu"/></button>
    <div className="mt2-breadcrumb">MY TASKS <span>/</span> {view==="day"?"My Day":view==="all"?"All Tasks":"Inbox"}</div>
    <div className="mt2-header-actions"><span className="mt2-sync"><i/> Your personal workspace</span><button onClick={()=>inputRef.current?.focus()} className="mt2-header-add"><Icon name="plus"/> New task</button></div>
   </header>
   <div className="mt2-page">
    <div className="mt2-heading"><div><p className="mt2-eyebrow">YOUR DAILY COMMAND CENTRE</p><h1>{view==="day"?"Make today count.":view==="all"?"Your work, in one place.":"Capture now. Plan later."}</h1><p className="mt2-subtitle">{dateTitle(today)} · Small steps, meaningful progress.</p></div><div className="mt2-heading-art"><Icon name="sparkle"/></div></div>
    {error&&<div role="alert" className="mt2-error">{error}<button aria-label="Dismiss error" onClick={()=>setError("")}><Icon name="close"/></button></div>}
    {notice&&<div role="status" className="mt2-notice">{notice}<button aria-label="Dismiss notification" onClick={()=>setNotice("")}><Icon name="close"/></button></div>}
    <form className="mt2-capture" onSubmit={capture}>
     <div className="mt2-capture-top"><span className="mt2-capture-icon"><Icon name="plus"/></span><input ref={inputRef} aria-label="Quick add task" value={quick} onChange={e=>setQuick(e.target.value)} placeholder="What do you need to do? Just type and press Enter…" maxLength={240}/><button type="submit" disabled={busy||!quick.trim()}>Add task <Icon name="arrow"/></button></div>
     <div className="mt2-capture-options">
      <label><span>Where</span><select aria-label="Choose task area" value={quickArea} onChange={e=>{setQuickArea(e.target.value);setQuickProject("")}}><option value="">Inbox / Unsorted</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <label><span>Project</span><select aria-label="Choose project" value={quickProject} onChange={e=>{setQuickProject(e.target.value);const p=projects.find(x=>x.id===e.target.value);if(p?.area_id)setQuickArea(p.area_id)}}><option value="">No project</option>{usableProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label><span>Plan</span><select aria-label="Schedule task" value={quickDate} onChange={e=>setQuickDate(e.target.value)}><option value="inbox">No date</option><option value="today">Today</option><option value="tomorrow">Tomorrow</option></select></label>
      <label><span>Priority</span><select aria-label="Set priority" value={quickPriority} onChange={e=>setQuickPriority(e.target.value as Priority)}><option value="medium">Normal</option><option value="high">High</option><option value="low">Low</option></select></label>
      <span className="mt2-tip">Tip: Ctrl/⌘ + K to capture</span>
     </div>
    </form>
    {loading?<div className="mt2-loading">Loading your real tasks and areas…</div>:<>
     <section className="mt2-metrics" aria-label="Task overview">
      <div className="mt2-metric"><span>OPEN TASKS</span><strong>{active.length}</strong><small>Across your areas</small></div>
      <div className="mt2-metric"><span>PLANNED TODAY</span><strong>{todayItems.filter(t=>t.status!=="done").length}</strong><small>Today's open commitments</small></div>
      <div className="mt2-metric"><span>OVERDUE</span><strong className={overdue.length?"mt2-warn":""}>{overdue.length}</strong><small>Need attention</small></div>
      <div className="mt2-metric"><span>DONE THIS WEEK</span><strong className="mt2-good">{doneWeek}</strong><small>Progress worth keeping</small></div>
     </section>
     {view==="day"&&<section className="mt2-daily-grid">
      <div className="mt2-panel mt2-focus">
       <div className="mt2-panel-head"><div><p className="mt2-eyebrow">KEEP IT SIMPLE</p><h2>Today's Top 3 <span className="mt2-focus-spark">✦</span></h2><small>Pick three outcomes worth finishing.</small></div><span className="mt2-count">{focus.length}/3</span></div>
       {focus.length?focus.map(t=><div key={t.id} className="mt2-focus-line">{taskRow(t)}</div>):<p className="mt2-empty">Star any task below to make it one of today's priorities.</p>}
       {focus.length<3&&<p className="mt2-hint">Tip: Focus is separate from urgency. You decide what matters today.</p>}
      </div>
      <div className="mt2-panel mt2-progress-panel">
       <div className="mt2-panel-head"><div><p className="mt2-eyebrow">YOUR SMALL WINS</p><h2>Today's diary</h2><small>Checked-off tasks stay visible.</small></div><span className="mt2-count">{todayItems.filter(t=>t.status==="done").length}/{todayItems.length}</span></div>
       {todayItems.length?<><div className="mt2-progress-track"><span style={{width:(100*todayItems.filter(t=>t.status==="done").length/todayItems.length)+"%"}}/></div>
       <div className="mt2-diary-items">{todayItems.slice(0,5).map(t=>taskRow(t))}</div></>:<p className="mt2-empty">A fresh page. Capture something and choose “Today” to begin.</p>}
      </div>
     </section>}
     <div className="mt2-lower-grid">
      <section className="mt2-panel mt2-task-panel">
       <div className="mt2-panel-head mt2-list-head"><div><p className="mt2-eyebrow">{view==="day"?"WHAT NEEDS YOUR ATTENTION":view==="all"?"YOUR COMPLETE TASK LIST":"UNCATEGORISED BY DATE"}</p><h2>{view==="day"?"Today & overdue":view==="all"?"All tasks":"Inbox tasks"}</h2><small>Click a task to edit its area, project and priority.</small></div><span className="mt2-count">{dailyOpen.length} open</span></div>
       <div className="mt2-task-controls"><label className="mt2-search"><Icon name="search"/><input aria-label="Search tasks" placeholder="Search tasks..." value={search} onChange={e=>setSearch(e.target.value)}/></label><label className="mt2-show-done"><input type="checkbox" checked={showCompleted} onChange={e=>setShowCompleted(e.target.checked)}/> Show completed</label></div>
       {view==="day"?todayAndOverdue.slice(0,18).map(taskRow):dailyOpen.slice(0,35).map(taskRow)}
       {view==="day"&&todayAndOverdue.length===0?<p className="mt2-empty">Your day is clear. Capture a task above.</p>:null}
       {view!=="day"&&dailyOpen.length===0?<p className="mt2-empty">No matching open tasks.</p>:null}
       {showCompleted&&view!=="day"&&dailyDone.length>0&&<><div className="mt2-completed-label">COMPLETED · {dailyDone.length}</div>{dailyDone.slice(0,12).map(taskRow)}</>}
      </section>
      <div className="mt2-right-stack">
       <section className="mt2-panel mt2-areas-panel"><div className="mt2-panel-head"><div><p className="mt2-eyebrow">WORK & LIFE</p><h2>Areas at a glance</h2><small>Progress across your responsibilities.</small></div><button className="mt2-small-add" onClick={()=>{setCreatePanel("area");setNewName("")}}><Icon name="plus"/></button></div>
        {areas.length?areas.map(a=>{
         const inArea=tasks.filter(t=>t.area_id===a.id);const completed=inArea.filter(t=>t.status==="done").length;
         return <button className="mt2-area-progress" key={a.id} onClick={()=>{setAreaFilter(a.id);setView("all")}}>
          <span className="mt2-area-progress-top"><b>{a.name}</b><small>{completed}/{inArea.length} completed</small></span>
          <span className="mt2-progress-track"><span style={{background:COLORS[a.color]||COLORS.slate,width:(inArea.length?100*completed/inArea.length:0)+"%"}}/></span>
         </button>
        }):<p className="mt2-empty">Create your first Area to separate work, personal and other responsibilities.</p>}
        <button className="mt2-text-action" onClick={()=>{setNewName("");setCreatePanel("project")}}><Icon name="plus"/> Create a project</button>
       </section>
       <section className="mt2-panel mt2-upcoming"><div className="mt2-panel-head"><div><p className="mt2-eyebrow">STAY AHEAD</p><h2>Coming up next</h2></div></div>
        {active.filter(t=>(t.scheduled_date&&t.scheduled_date>today)||(dueKey(t.due_at)>today)).sort((a,b)=>(a.scheduled_date||dueKey(a.due_at)).localeCompare(b.scheduled_date||dueKey(b.due_at))).slice(0,5).map(t=><button className="mt2-upcoming-item" key={t.id} onClick={()=>openDetail(t)}><span className="mt2-upcoming-dot"/><span>{t.title}</span><small>{dateShort(t.scheduled_date||dueKey(t.due_at))}</small></button>)}
        {!active.some(t=>(t.scheduled_date&&t.scheduled_date>today)||(dueKey(t.due_at)>today))&&<p className="mt2-empty">No upcoming commitments yet.</p>}
       </section>
      </div>
     </div>
    </>}
   </div>
  </main>
  {createPanel&&<div className="mt2-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setCreatePanel(null)}}><form className="mt2-modal" onSubmit={saveCollection} aria-label={createPanel==="area"?"Create area":"Create project"}>
   <div className="mt2-modal-head"><h2>{createPanel==="area"?"New area":"New project"}</h2><button type="button" aria-label="Close" onClick={()=>setCreatePanel(null)}><Icon name="close"/></button></div>
   <p>{createPanel==="area"?"An area is a part of your work or life, such as Sales or Personal.":"A project groups tasks around a result you want to complete."}</p>
   <label>Name<input autoFocus required maxLength={createPanel==="area"?80:160} value={newName} onChange={e=>setNewName(e.target.value)} placeholder={createPanel==="area"?"Sales & Outreach":"Winter STEM workshop"}/></label>
   {createPanel==="area"?<label>Colour<select value={newColor} onChange={e=>setNewColor(e.target.value)}>{Object.keys(COLORS).map(c=><option value={c} key={c}>{c}</option>)}</select></label>:<label>Area (optional)<select value={newAreaForProject} onChange={e=>setNewAreaForProject(e.target.value)}><option value="">No area</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
   <div className="mt2-modal-actions"><button type="button" onClick={()=>setCreatePanel(null)}>Cancel</button><button type="submit" disabled={busy||!newName.trim()}>Create {createPanel}</button></div>
  </form></div>}
  <TaskV2DetailDrawer task={selected} areas={areas} projects={projects}
   userId={userId} request={request} onClose={()=>setSelected(null)} onChanged={refresh}/>
 </div>;
}
