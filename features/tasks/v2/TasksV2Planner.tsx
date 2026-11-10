"use client";
import Link from "next/link";
import {useCallback,useEffect,useMemo,useState,type DragEvent,type FormEvent} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {ApplicationSwitcher} from "@/components/ApplicationSwitcher";
import {TaskV2DetailDrawer} from "./TaskV2DetailDrawer";
import type {V2Task,V2Area,V2Project,V2Response,V2Request} from "./model";
import {v2Colors} from "./model";

type View="week"|"today"|"upcoming"|"someday"|"matrix";
type FocusSettings={active_project_limit:number;daily_focus_minutes:number;switch_prompt_enabled:boolean};
type FocusResponse={ok:boolean;focus:{settings:FocusSettings}};
const pad=(n:number)=>String(n).padStart(2,"0");
function keyOf(date:Date){return date.getFullYear()+"-"+pad(date.getMonth()+1)+"-"+pad(date.getDate());}
const fromKey=(value:string)=>new Date(value+"T12:00:00");
function plusDays(value:string,days:number){const d=fromKey(value);d.setDate(d.getDate()+days);return keyOf(d);}
const weekday=(date:string)=>fromKey(date).toLocaleDateString(undefined,{weekday:"short"});
const dateLabel=(date:string)=>fromKey(date).toLocaleDateString(undefined,{month:"short",day:"numeric"});
const startMonday=(value:string)=>{const d=fromKey(value);d.setDate(d.getDate()-((d.getDay()+6)%7));return keyOf(d);};
const dateAt=(iso:string|null)=>iso?keyOf(new Date(iso)):"";
const matrixNames=["Do first","Schedule","Delegate or simplify","Do later"] as const;
const matrixLabels=["Urgent + Important","Important, not urgent","Urgent, less important","Not urgent or important"];
const quadrant=(t:V2Task)=>t.important?(t.urgent?0:1):(t.urgent?2:3);
export function TasksV2Planner(){
 const [tasks,setTasks]=useState<V2Task[]>([]);
 const [areas,setAreas]=useState<V2Area[]>([]);
 const [projects,setProjects]=useState<V2Project[]>([]);
 const [settings,setSettings]=useState<FocusSettings>({active_project_limit:2,daily_focus_minutes:180,switch_prompt_enabled:true});
 const [userId,setUserId]=useState<string|null>(null);
 const [view,setView]=useState<View>("week");
 const [anchor,setAnchor]=useState(()=>keyOf(new Date()));
 const [today,setToday]=useState(()=>keyOf(new Date()));
 const [selected,setSelected]=useState<V2Task|null>(null);
 const [selectedIds,setSelectedIds]=useState<string[]>([]);
 const [search,setSearch]=useState("");
 const [filterArea,setFilterArea]=useState("all");
 const [quick,setQuick]=useState("");
 const [captureDate,setCaptureDate]=useState("");
 const [dragId,setDragId]=useState<string|null>(null);
 const [hoverDate,setHoverDate]=useState<string|null>(null);
 const [recoveryDate,setRecoveryDate]=useState(()=>keyOf(new Date()));
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [mobileNav,setMobileNav]=useState(false);
 const [capacity,setCapacity]=useState(180);
 const request:V2Request=useCallback(async <T,>(url:string,init:RequestInit={}):Promise<T>=>{
  const client=getSupabaseBrowserClient();
  if(!client)throw new Error("Supabase connection unavailable.");
  const {data:{session}}=await client.auth.getSession();
  if(!session?.access_token)throw new Error("Please sign in first.");
  const response=await fetch(url,{...init,cache:"no-store",headers:{
   Authorization:"Bearer "+session.access_token,"Content-Type":"application/json",...(init.headers||{})
  }});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.ok===false)throw new Error(result.error||"Unable to complete request.");
  return result as T;
 },[]);
 const refresh=useCallback(async()=>{
  try{
   const [areaResult,projectResult,focusResult]=await Promise.all([
    request<V2Response<V2Area>>("/api/tasks/v2/areas"),
    request<V2Response<V2Project>>("/api/tasks/v2/projects"),
    request<FocusResponse>("/api/tasks/v2/focus")
   ]);
   const all:V2Task[]=[];
   for(let offset=0;offset<20000;offset+=250){
    const result=await request<V2Response<V2Task>>("/api/tasks/v2/board?limit=250&offset="+offset);
    const batch=result.items||[];
    all.push(...batch);
    if(batch.length<250)break;
   }
   setAreas(areaResult.items||[]);setProjects(projectResult.items||[]);
   setSettings(focusResult.focus.settings);setCapacity(focusResult.focus.settings.daily_focus_minutes);
   setTasks([...new Map(all.map(t=>[t.id,t])).values()]);
   setSelectedIds(ids=>ids.filter(id=>all.some(t=>t.id===id&&t.status!=="done")));
   setError("");
  }catch(e){setError(e instanceof Error?e.message:"Unable to load weekly planner.");}
  finally{setLoading(false)}
 },[request]);
 useEffect(()=>{void refresh()},[refresh]);
 useEffect(()=>{
  let mounted=true;
  void getSupabaseBrowserClient()?.auth.getUser().then(({data})=>{if(mounted)setUserId(data.user?.id||null)});
  return()=>{mounted=false};
 },[]);
 useEffect(()=>{
  const id=window.setInterval(()=>setToday(keyOf(new Date())),60000);
  return()=>window.clearInterval(id);
 },[]);
 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape"){setSelected(null);setMobileNav(false)}};
  document.addEventListener("keydown",onKey);
  return()=>document.removeEventListener("keydown",onKey);
 },[]);
 const weekStart=startMonday(anchor);
 const days=useMemo(()=>Array.from({length:7},(_,i)=>plusDays(weekStart,i)),[weekStart]);
 const available=tasks.filter(t=>t.status!=="done");
 const owned=available.filter(t=>t.owner_user_id===userId);
 const visible=useMemo(()=>{
  const q=search.trim().toLowerCase();
  return available.filter(t=>(filterArea==="all"||t.area_id===filterArea||(filterArea==="none"&&!t.area_id))&&
   (!q||[t.title,t.description,areas.find(a=>a.id===t.area_id)?.name||""].some(v=>v.toLowerCase().includes(q))));
 },[available,filterArea,search,areas]);
 const dated=(d:string)=>visible.filter(t=>!t.someday&&t.scheduled_date===d).sort((a,b)=>Number(b.important)-Number(a.important)||a.board_rank-b.board_rank);
 const backlog=visible.filter(t=>!t.someday&&!t.scheduled_date);
 const someday=visible.filter(t=>t.someday);
 const upcoming=visible.filter(t=>(!t.someday&&t.scheduled_date&&t.scheduled_date>today)||(dateAt(t.due_at)>today)).sort((a,b)=>(a.scheduled_date||dateAt(a.due_at)).localeCompare(b.scheduled_date||dateAt(b.due_at)));
 const overdue=visible.filter(t=>(!t.someday&&t.scheduled_date&&t.scheduled_date<today)||(dateAt(t.due_at)&&dateAt(t.due_at)<today));
 const dueOverdue=overdue.filter(t=>dateAt(t.due_at)&&dateAt(t.due_at)<today);
 const planOverdue=overdue.filter(t=>t.scheduled_date&&t.scheduled_date<today);
 const areaName=(t:V2Task)=>areas.find(a=>a.id===t.area_id)?.name||"Unsorted";
 const dayMinutes=(d:string)=>dated(d).reduce((sum,t)=>sum+(t.estimated_minutes||0),0);
 const allowedToMove=(t:V2Task)=>t.owner_user_id===userId;
 const checked=(t:V2Task)=>selectedIds.includes(t.id);
 async function move(ids:string[],action:"plan"|"unschedule"|"someday",date?:string){
  if(!ids.length||busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   await request<V2Response<V2Task>>("/api/tasks/v2/planner",{
    method:"POST",body:JSON.stringify({ids,action,...(action==="plan"?{date}: {})})
   });
   setSelectedIds([]);
   await refresh();
   setNotice(action==="plan"?"Scheduled "+ids.length+" task(s).":action==="someday"?"Moved to Someday.":"Moved to unscheduled tasks.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to update planned dates.");}
  finally{setBusy(false);setDragId(null);setHoverDate(null)}
 }
 function beginDrag(e:DragEvent,id:string){
  const task=tasks.find(t=>t.id===id);
  if(!task||!allowedToMove(task)||busy){e.preventDefault();return;}
  setDragId(id);e.dataTransfer.setData("text/plain",id);e.dataTransfer.effectAllowed="move";
 }
 function onDrop(e:DragEvent,action:"plan"|"unschedule"|"someday",date?:string){
  e.preventDefault();
  const id=e.dataTransfer.getData("text/plain")||dragId;
  const task=tasks.find(t=>t.id===id);
  if(!task||!allowedToMove(task))return;
  void move(selectedIds.includes(id)?selectedIds:[id],action,date);
 }
 async function quickAdd(e:FormEvent){
  e.preventDefault();if(!quick.trim()||busy)return;
  setBusy(true);setError("");
  try{
   await request<V2Response<V2Task>>("/api/tasks/v2/capture",{
    method:"POST",body:JSON.stringify({title:quick.trim(),...(captureDate?{scheduled_date:captureDate}:{})})
   });
   setQuick("");setNotice("Task captured.");await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Unable to add task.");}
  finally{setBusy(false)}
 }
 async function setMatrix(t:V2Task,index:number){
  if(!allowedToMove(t)||busy)return;
  setBusy(true);setError("");
  try{
   await request<V2Response<V2Task>>("/api/tasks/v2/items/"+t.id+"/matrix",{
    method:"PATCH",body:JSON.stringify({important:index===0||index===1,urgent:index===0||index===2})
   });
   await refresh();setNotice("Importance and urgency saved.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to update priority quadrant.");}
  finally{setBusy(false)}
 }
 async function saveCapacity(){
  if(busy)return;setBusy(true);setError("");
  try{
   await request<{ok:boolean}>("/api/tasks/v2/focus/settings",{
    method:"PUT",body:JSON.stringify({...settings,daily_focus_minutes:capacity})
   });
   setSettings(v=>({...v,daily_focus_minutes:capacity}));setNotice("Workload capacity saved.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to save capacity.");}
  finally{setBusy(false)}
 }
 async function createReview(){
  if(busy)return;
  if(tasks.some(t=>t.status!=="done"&&t.recurrence==="weekly"&&t.title==="Weekly review — wins, unfinished work, upcoming priorities")){
   setNotice("Your recurring weekly review already exists. Open it to manage the schedule.");return;
  }setBusy(true);setError("");
  try{
   await request<V2Response<V2Task>>("/api/tasks",{
    method:"POST",body:JSON.stringify({
     title:"Weekly review — wins, unfinished work, upcoming priorities",
     description:"1. Check completed tasks. 2. Review overdue work without guilt. 3. Park or reschedule unfinished tasks. 4. Choose protected Areas for next week. 5. Set the next Top 3.",
     scheduled_date:today,recurrence:"weekly",priority:"medium"
    })
   });
   setNotice("Weekly recurring review added to My Tasks.");await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Unable to create review.");}
  finally{setBusy(false)}
 }
 function renderTask(t:V2Task){
  return <article className={"mt2-plan-task "+(checked(t)?"is-selected":"")} key={t.id}
   draggable={allowedToMove(t)&&!busy} onDragStart={e=>beginDrag(e,t.id)} onDragEnd={()=>{setDragId(null);setHoverDate(null)}}>
   <label className="mt2-plan-check" title="Select for bulk planning"><input type="checkbox" checked={checked(t)} disabled={!allowedToMove(t)||busy}
    onChange={e=>setSelectedIds(v=>e.target.checked?[...v,t.id]:v.filter(id=>id!==t.id))}/></label>
   <button className="mt2-plan-task-main" type="button" onClick={()=>setSelected(t)}>
    <strong>{t.title}</strong>
    <span><i style={{background:v2Colors[areas.find(a=>a.id===t.area_id)?.color||"slate"]}}/>{areaName(t)}
     {t.priority==="high"&&<em>High</em>}{t.estimated_minutes&&<em>{t.estimated_minutes}m</em>}
     {t.reschedule_count>1&&<em title="Previously rescheduled">↻ {t.reschedule_count}</em>}
     {t.due_at&&<em className={dateAt(t.due_at)<today?"mt2-hard-late":""}>Due {dateLabel(dateAt(t.due_at))}</em>}
    </span>
   </button>
  </article>;
 }
 const routeViews:[View,string][]=[["week","My Week"],["today","Today"],["upcoming","Upcoming"],["someday","Someday"],["matrix","Priority Matrix"]];
 const selectedOwnerIds=selectedIds.filter(id=>owned.some(t=>t.id===id));
 const recoveryOwned=planOverdue.filter(allowedToMove);
 const dateClock=useMemo(()=>days.map(date=>({date,minutes:dayMinutes(date)})),[days,visible]);
 return <div className="mt2-shell mt2-planner-shell">
  {mobileNav&&<button className="mt2-scrim" aria-label="Close navigation" onClick={()=>setMobileNav(false)}/>}
  <aside className={"mt2-sidebar "+(mobileNav?"mt2-sidebar-open":"")}>
   <Link href="/tasks/v2" className="mt2-brand"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/></Link>
   <div className="mt2-product">My Tasks <span>PLANNING · V2</span></div>
   <ApplicationSwitcher current="tasks"/>
   <div className="mt2-sidebar-heading">MY WORKSPACE</div>
   <nav aria-label="My Tasks V2">
    <Link href="/tasks/v2"><span className="mt2-nav-emoji">✦</span> My Day</Link>
    <Link href="/tasks/v2/board"><span className="mt2-nav-emoji">▥</span> Visual Board</Link>
    <Link href="/tasks/v2/focus"><span className="mt2-nav-emoji">◷</span> Focus & Finish</Link>
    <Link href="/tasks/v2/connected"><span className="mt2-nav-emoji">◇</span> Connected Work</Link>
    <Link href="/tasks/v2/planner" className="is-active" aria-current="page"><span className="mt2-nav-emoji">▦</span> Weekly Planner</Link>
    <Link href="/tasks"><span className="mt2-nav-emoji">▤</span> Classic Tasks</Link>
   </nav>
   <div className="mt2-sidebar-bottom"><Link href="/tasks/v2">← Return to My Day</Link></div>
  </aside>
  <main className="mt2-main">
   <header className="mt2-header">
    <button className="mt2-mobile-menu" type="button" aria-label="Open navigation" onClick={()=>setMobileNav(true)}>☰</button>
    <div className="mt2-breadcrumb">MY TASKS <span>/</span> Weekly Planner</div>
    <div className="mt2-header-actions"><span className="mt2-sync"><i/> Personal planning</span></div>
   </header>
   <div className="mt2-page mt2-planner-page">
    <div className="mt2-heading"><div><p className="mt2-eyebrow">PLAN LESS · FINISH MORE</p><h1>Give your week some shape.</h1><p className="mt2-subtitle">Drag tasks to a day, keep future ideas in Someday, and protect realistic focus time.</p></div></div>
    {error&&<div role="alert" className="mt2-error">{error}<button onClick={()=>setError("")} aria-label="Dismiss">✕</button></div>}
    {notice&&<div role="status" className="mt2-notice">{notice}<button onClick={()=>setNotice("")} aria-label="Dismiss">✕</button></div>}
    <form className="mt2-board-capture" onSubmit={quickAdd}><span>＋</span><input aria-label="Quick capture task" value={quick} onChange={e=>setQuick(e.target.value)} maxLength={240} placeholder="Add an idea or action in one line…"/><select aria-label="Quick capture planned date" value={captureDate} onChange={e=>setCaptureDate(e.target.value)}><option value="">No date</option><option value={today}>Today</option><option value={plusDays(today,1)}>Tomorrow</option></select><button disabled={busy||!quick.trim()} type="submit">Add</button></form>
    <div className="mt2-plan-toolbar"><div className="mt2-plan-tabs">{routeViews.map(([id,label])=><button type="button" key={id} className={view===id?"active":""} aria-pressed={view===id} onClick={()=>setView(id)}>{label}</button>)}</div>
     <div className="mt2-plan-filter"><input aria-label="Search planned tasks" placeholder="Search tasks…" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Filter area" value={filterArea} onChange={e=>setFilterArea(e.target.value)}><option value="all">All areas</option><option value="none">Unsorted</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
    </div>
    {loading?<div className="mt2-loading">Loading your plan and commitments…</div>:<>
     <section className="mt2-plan-insight">
      <div><b>{overdue.length}</b><span>Needs review</span></div><div><b>{owned.filter(t=>t.someday).length}</b><span>Someday ideas</span></div>
      <div><b>{tasks.filter(t=>t.status==="done").length}</b><span>Finished tasks</span></div>
      <label>Daily focus capacity<select value={capacity} onChange={e=>setCapacity(Number(e.target.value))}>{[30,60,90,120,150,180,240,300,360,480,600].map(n=><option value={n} key={n}>{n} minutes</option>)}</select></label>
      <button disabled={busy||capacity===settings.daily_focus_minutes} onClick={()=>void saveCapacity()}>Save capacity</button>
     </section>
     {selectedOwnerIds.length>0&&<div className="mt2-bulk-bar"><strong>{selectedOwnerIds.length} selected</strong><input type="date" value={recoveryDate} onChange={e=>setRecoveryDate(e.target.value)}/><button disabled={busy} onClick={()=>void move(selectedOwnerIds,"plan",recoveryDate)}>Plan together</button><button disabled={busy} onClick={()=>void move(selectedOwnerIds,"someday")}>Someday</button><button disabled={busy} onClick={()=>void move(selectedOwnerIds,"unschedule")}>Unplan</button><button onClick={()=>setSelectedIds([])}>Clear</button></div>}
     {view==="week"&&<>
      <div className="mt2-week-toolbar"><div><button aria-label="Previous week" onClick={()=>setAnchor(plusDays(weekStart,-7))}>←</button><strong>{dateLabel(weekStart)} – {dateLabel(plusDays(weekStart,6))}</strong><button aria-label="Next week" onClick={()=>setAnchor(plusDays(weekStart,7))}>→</button><button onClick={()=>setAnchor(today)}>This week</button></div><small>Drag cards onto a day, or select several and use Plan together.</small></div>
      <div className="mt2-planner-days">
       {dateClock.map(({date,minutes})=><section key={date} className={"mt2-day-column "+(date===today?"is-today ":"")+(hoverDate===date?"is-drop":"")}
        onDragOver={e=>{if(dragId){e.preventDefault();setHoverDate(date)}}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setHoverDate(null)}} onDrop={e=>onDrop(e,"plan",date)}>
        <div className="mt2-day-head"><small>{weekday(date)}</small><strong>{date.slice(-2)}</strong><span>{dated(date).length} tasks</span></div>
        <div className="mt2-day-capacity"><div className="mt2-progress-track"><span style={{width:Math.min(100,100*minutes/Math.max(1,capacity))+"%",background:minutes>capacity?"#c98554":"#3e9fb6"}}/></div><small className={minutes>capacity?"mt2-overload":""}>{minutes} / {capacity}m</small></div>
        <div className="mt2-day-cards">{dated(date).map(renderTask)}{!dated(date).length&&<p className="mt2-empty">Drop a task here</p>}</div>
        <button className="mt2-day-add" onClick={()=>{setCaptureDate(date);document.querySelector<HTMLInputElement>(".mt2-board-capture input")?.focus()}}>＋ Add for {weekday(date)}</button>
       </section>)}
      </div>
      <div className="mt2-planner-lower">
       <section className="mt2-panel mt2-plan-inbox" onDragOver={e=>{if(dragId)e.preventDefault()}} onDrop={e=>onDrop(e,"unschedule")}><div className="mt2-panel-head"><div><p className="mt2-eyebrow">UNSCHEDULED WORK</p><h2>Inbox & backlog</h2><small>Not every task needs a deadline.</small></div><span className="mt2-count">{backlog.length}</span></div>{backlog.slice(0,40).map(renderTask)}{!backlog.length&&<p className="mt2-empty">Nothing waiting in your Inbox.</p>}</section>
       <section className="mt2-panel mt2-plan-inbox" onDragOver={e=>{if(dragId)e.preventDefault()}} onDrop={e=>onDrop(e,"someday")}><div className="mt2-panel-head"><div><p className="mt2-eyebrow">CAPTURE NOW, COMMIT LATER</p><h2>Someday / Maybe</h2><small>Park ideas without losing them.</small></div><span className="mt2-count">{someday.length}</span></div>{someday.slice(0,35).map(renderTask)}{!someday.length&&<p className="mt2-empty">Keep future possibilities here.</p>}</section>
      </div>
     </>}
     {view==="today"&&<section className="mt2-panel mt2-plan-list"><div className="mt2-panel-head"><div><p className="mt2-eyebrow">ONE MANAGEABLE DAY</p><h2>Today · {dateLabel(today)}</h2><small>Planned work and hard deadlines are shown separately.</small></div><span className="mt2-count">{dated(today).length} planned</span></div>{dated(today).map(renderTask)}{visible.filter(t=>dateAt(t.due_at)===today&&t.scheduled_date!==today).map(renderTask)}{!dated(today).length&&!visible.some(t=>dateAt(t.due_at)===today)&&<p className="mt2-empty">A clear day. Choose the one thing that matters.</p>}</section>}
     {view==="upcoming"&&<section className="mt2-panel mt2-plan-list"><div className="mt2-panel-head"><div><p className="mt2-eyebrow">LOOK AHEAD</p><h2>Upcoming commitments</h2><small>Upcoming planned days and hard deadlines.</small></div><span className="mt2-count">{upcoming.length}</span></div>{upcoming.map(renderTask)}{!upcoming.length&&<p className="mt2-empty">No upcoming work scheduled.</p>}</section>}
     {view==="someday"&&<section className="mt2-panel mt2-plan-list" onDragOver={e=>{if(dragId)e.preventDefault()}} onDrop={e=>onDrop(e,"someday")}><div className="mt2-panel-head"><div><p className="mt2-eyebrow">NO PRESSURE TO START</p><h2>Someday / Maybe</h2><small>These are possibilities, not overdue commitments.</small></div><span className="mt2-count">{someday.length}</span></div>{someday.map(renderTask)}{!someday.length&&<p className="mt2-empty">No Someday ideas yet.</p>}</section>}
     {view==="matrix"&&<section className="mt2-matrix-wrap"><div className="mt2-panel-head"><div><p className="mt2-eyebrow">OPTIONAL PRIORITISATION TOOL</p><h2>Importance × urgency</h2><small>Choose what matters. A near deadline does not automatically make a task important.</small></div></div><div className="mt2-matrix-grid">
      {matrixNames.map((name,index)=><div key={name} className={"mt2-matrix-quadrant mt2-matrix-q"+index} onDragOver={e=>{if(dragId)e.preventDefault()}} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData("text/plain")||dragId;const t=tasks.find(x=>x.id===id);if(t)void setMatrix(t,index)}}><header><strong>{name}</strong><small>{matrixLabels[index]}</small></header><div>{visible.filter(t=>quadrant(t)===index).map(t=><div key={t.id} className="mt2-matrix-task" draggable={allowedToMove(t)} onDragStart={e=>beginDrag(e,t.id)}><button type="button" onClick={()=>setSelected(t)}>{t.title}</button>{allowedToMove(t)&&<select aria-label={"Change priority quadrant for "+t.title} value={index} disabled={busy} onChange={e=>void setMatrix(t,Number(e.target.value))}>{matrixNames.map((label,i)=><option key={label} value={i}>{label}</option>)}</select>}</div>)}{!visible.some(t=>quadrant(t)===index)&&<p className="mt2-empty">Nothing here yet.</p>}</div></div>)}
     </div></section>}
     <section className="mt2-panel mt2-overdue-recovery"><div className="mt2-panel-head"><div><p className="mt2-eyebrow">RESET WITHOUT THE BACKLOG GUILT</p><h2>Overdue recovery</h2><small>Move a planned day, not a real deadline. You decide whether a deadline needs separate follow-up.</small></div><span className="mt2-count">{overdue.length}</span></div>
      {overdue.length>0?<><p className="mt2-overdue-help">{planOverdue.length} tasks have past planned dates. {dueOverdue.length} have hard deadlines in the past. Hard deadlines remain visible even if you reschedule planned work.</p><div className="mt2-recovery-list">{overdue.slice(0,15).map(renderTask)}</div>
       <div className="mt2-recovery-actions"><input aria-label="Recovery date" type="date" value={recoveryDate} onChange={e=>setRecoveryDate(e.target.value)}/><button disabled={busy||!recoveryOwned.length} onClick={()=>void move(recoveryOwned.slice(0,50).map(t=>t.id),"plan",recoveryDate)}>Replan old planned tasks ({Math.min(recoveryOwned.length,50)})</button><button className="mt2-recovery-secondary" disabled={busy||!recoveryOwned.length} onClick={()=>void move(recoveryOwned.slice(0,50).map(t=>t.id),"someday")}>Park planned tasks</button></div>
       <small>Batch actions apply only to tasks you own and are capped at 50 at a time.</small></>:<p className="mt2-empty">Nothing needs recovery right now.</p>}
     </section>
     <section className="mt2-review-strip"><div><strong>Weekly Review</strong><p>Keep your review small: wins, unfinished work, what matters next week.</p></div><button type="button" disabled={busy||tasks.some(t=>t.status!=="done"&&t.recurrence==="weekly"&&t.title==="Weekly review — wins, unfinished work, upcoming priorities")} onClick={()=>void createReview()}>{tasks.some(t=>t.status!=="done"&&t.recurrence==="weekly"&&t.title==="Weekly review — wins, unfinished work, upcoming priorities")?"✓ Weekly review scheduled":"＋ Create recurring weekly review"}</button></section>
    </>}
   </div>
  </main>
  <TaskV2DetailDrawer task={selected} areas={areas} projects={projects} userId={userId} request={request} onClose={()=>setSelected(null)} onChanged={refresh}/>
 </div>;
}
