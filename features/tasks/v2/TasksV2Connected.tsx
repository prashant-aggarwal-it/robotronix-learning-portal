"use client";
import Link from "next/link";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {ApplicationSwitcher} from "@/components/ApplicationSwitcher";
import {TasksNotifications} from "./TasksNotifications";
import {TasksPrimaryNav} from "./TasksPrimaryNav";
import {getCurrentProfile} from "@/lib/repository";
import {TeamSpaces} from "@/features/tasks/TaskCollaboration";
import {TaskV2DetailDrawer} from "./TaskV2DetailDrawer";
import type {V2Task,V2ModuleLink,V2Area,V2Project,V2Request,V2Response} from "./model";
import {v2StatusNames} from "./model";

type View="overview"|"teams"|"assigned"|"delegated"|"linked";
type Workspace={id:string;name:string;role:"owner"|"admin"|"member"};
const moduleLabels:Record<V2ModuleLink["module"],string>={connect:"Connect CRM",learning:"Learning Portal"};
const resourceLabels:Record<V2ModuleLink["resource"],string>={
 crm_task:"CRM follow-up",crm_person:"CRM contact",crm_opportunity:"CRM opportunity",schedule_event:"Scheduled class"
};
export function TasksV2Connected(){
 const [tasks,setTasks]=useState<V2Task[]>([]);
 const [areas,setAreas]=useState<V2Area[]>([]);
 const [projects,setProjects]=useState<V2Project[]>([]);
 const [links,setLinks]=useState<V2ModuleLink[]>([]);
 const [workspaces,setWorkspaces]=useState<Workspace[]>([]);
 const [userId,setUserId]=useState<string|null>(null);
 const [learningRoute,setLearningRoute]=useState("/");
 const [selected,setSelected]=useState<V2Task|null>(null);
 const openedDeepLink=useRef(false);
 const [view,setView]=useState<View>("overview");
 useEffect(()=>{const requested=new URLSearchParams(window.location.search).get("view");if(["teams","assigned","delegated","linked"].includes(requested||""))setView(requested as View)},[]);
 const [search,setSearch]=useState("");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [mobileNav,setMobileNav]=useState(false);
 const [statusBusy,setStatusBusy]=useState<string|null>(null);
 const request:V2Request=useCallback(async <T,>(url:string,init:RequestInit={}):Promise<T>=>{
  const client=getSupabaseBrowserClient();
  if(!client)throw new Error("Supabase is unavailable.");
  const {data:{session}}=await client.auth.getSession();
  if(!session?.access_token)throw new Error("Please sign in to view connected work.");
  const response=await fetch(url,{...init,cache:"no-store",headers:{
   Authorization:"Bearer "+session.access_token,"Content-Type":"application/json",...(init.headers||{})
  }});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.ok===false)throw new Error(result.error||"Unable to complete request.");
  return result as T;
 },[]);
 const refresh=useCallback(async()=>{
  try{
   const [ar,pr,ml,wr]=await Promise.all([
    request<V2Response<V2Area>>("/api/tasks/v2/areas"),
    request<V2Response<V2Project>>("/api/tasks/v2/projects"),
    request<V2Response<V2ModuleLink>>("/api/tasks/module-links"),
    request<V2Response<Workspace>>("/api/tasks/collaboration?scope=workspaces")
   ]);
   const items:V2Task[]=[];
   for(let offset=0;offset<20000;offset+=250){
    const page=await request<V2Response<V2Task>>("/api/tasks/v2/board?limit=250&offset="+offset);
    const batch=page.items||[];items.push(...batch);if(batch.length<250)break;
   }
   const distinct=[...new Map(items.map(t=>[t.id,t])).values()];
   setTasks(distinct);setAreas(ar.items||[]);setProjects(pr.items||[]);
   setLinks(ml.items||[]);setWorkspaces(wr.items||[]);
   setSelected(t=>t?distinct.find(item=>item.id===t.id)||null:null);
   setError("");
  }catch(e){setError(e instanceof Error?e.message:"Unable to load connected work.");}
  finally{setLoading(false)}
 },[request]);
 useEffect(()=>{void refresh()},[refresh]);
 useEffect(()=>{
  let mounted=true;
  void Promise.allSettled([
   getSupabaseBrowserClient()?.auth.getUser(),
   getCurrentProfile()
  ]).then(([authResult,profileResult])=>{
   if(!mounted)return;
   if(authResult.status==="fulfilled")setUserId(authResult.value?.data.user?.id||null);
   if(profileResult.status==="fulfilled"){
    const role=profileResult.value?.role;
    setLearningRoute(role==="admin"?"/admin/schedule":role==="trainer"?"/trainer/schedule":"/");
   }
  });
  return()=>{mounted=false};
 },[]);
 useEffect(()=>{
  if(openedDeepLink.current)return;
  const query=new URLSearchParams(window.location.search);
  const id=query.get("task");
  if(!id){openedDeepLink.current=true;return;}
  const match=tasks.find(t=>t.id===id);
  if(match){setSelected(match);openedDeepLink.current=true;}
 },[tasks]);
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{if(e.key==="Escape"){setSelected(null);setMobileNav(false);}};
  document.addEventListener("keydown",key);return()=>document.removeEventListener("keydown",key);
 },[]);
 const linkedIds=useMemo(()=>new Set(links.map(l=>l.task_id)),[links]);
 const shared=tasks.filter(t=>t.workspace_id!==null);
 const assigned=tasks.filter(t=>t.owner_user_id!==userId&&t.assignee_user_id===userId);
 const delegated=tasks.filter(t=>t.owner_user_id===userId&&t.assignee_user_id!==null&&t.assignee_user_id!==userId);
 const myShared=tasks.filter(t=>t.workspace_id&&t.owner_user_id===userId);
 const linked=tasks.filter(t=>linkedIds.has(t.id));
 const availableLinks=links.filter(l=>tasks.some(t=>t.id===l.task_id));
 const areaName=(t:V2Task)=>areas.find(a=>a.id===t.area_id)?.name||"Unsorted";
 const workspaceName=(t:V2Task)=>workspaces.find(w=>w.id===t.workspace_id)?.name||"Shared workspace";
 const visible=(list:V2Task[])=>{
  const q=search.trim().toLowerCase();
  return list.filter(t=>!q||[t.title,t.description,areaName(t),workspaceName(t)].some(v=>v.toLowerCase().includes(q)));
 };
 async function updateAssignedStatus(task:V2Task,status:"todo"|"in_progress"|"done"){
  if(!userId||task.assignee_user_id!==userId||statusBusy)return;
  setStatusBusy(task.id);setError("");
  try{
   await request<V2Response<V2Task>>("/api/tasks/"+task.id,{method:"PATCH",body:JSON.stringify({status})});
   setNotice("Shared task status updated.");await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Unable to update assigned status.");}
  finally{setStatusBusy(null)}
 }
 function taskCard(t:V2Task){
  const owned=t.owner_user_id===userId;
  const canStatus=t.assignee_user_id===userId&&!owned;
  return <article className="mt2-connected-task" key={t.id}>
   <div className="mt2-connected-task-top">
    <span className="mt2-source-chip neutral">{t.workspace_id?workspaceName(t):"Personal linked work"}</span>
    <span className={"mt2-cstatus "+t.status}>{v2StatusNames[t.status]}</span>
   </div>
   <button type="button" className="mt2-connected-title" onClick={()=>setSelected(t)}>{t.title}</button>
   <p>{areaName(t)} · {t.priority} priority{t.due_at?" · Due "+new Date(t.due_at).toLocaleDateString():""}</p>
   <div className="mt2-connected-card-actions">
    <button onClick={()=>setSelected(t)}>People & details</button>
    {canStatus&&<select aria-label={"Change status of "+t.title} disabled={statusBusy===t.id}
     value={t.status}
     onChange={e=>void updateAssignedStatus(t,e.target.value as "todo"|"in_progress"|"done")}>
     <option value="todo">To Do</option><option value="in_progress">In Progress</option><option value="done">Done</option>{t.status==="waiting"&&<option value="waiting" disabled>Waiting</option>}
    </select>}
   </div>
  </article>;
 }
 const tabs:[View,string][]=[["overview","Overview"],["teams","Team Spaces"],["assigned","Assigned to me"],["delegated","Delegated"],["linked","Connected modules"]];
 return <div className="mt2-shell mt2-connected-shell">
  {mobileNav&&<button className="mt2-scrim" onClick={()=>setMobileNav(false)} aria-label="Close navigation"/>}
  <aside className={"mt2-sidebar "+(mobileNav?"mt2-sidebar-open":"")}>
   <Link href="/tasks" className="mt2-brand"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/></Link>
   <div className="mt2-product">My Tasks <span>CONNECTED WORK</span></div>
   <ApplicationSwitcher current="tasks"/>
   <div className="mt2-sidebar-heading">TASKS</div>
   <TasksPrimaryNav section="connected"/>
   <div className="mt2-sidebar-bottom"><Link href="/tasks">← Return to My Day</Link></div>
  </aside>
  <main className="mt2-main">
   <header className="mt2-header">
    <button type="button" className="mt2-mobile-menu" onClick={()=>setMobileNav(true)} aria-label="Open navigation">☰</button>
    <div className="mt2-breadcrumb">MY TASKS <span>/</span> Connected Work</div>
    <div className="mt2-header-actions"><TasksNotifications/><span className="mt2-sync"><i/> Your accessible tasks only</span></div>
   </header>
   <div className="mt2-page mt2-connected-page">
    <div className="mt2-heading"><div><p className="mt2-eyebrow">WORK TOGETHER · STAY IN CONTEXT</p><h1>Connected work, made simple.</h1><p className="mt2-subtitle">A clear view of shared tasks, delegated work, CRM follow-ups and Learning Portal links.</p></div></div>
    {error&&<div role="alert" className="mt2-error">{error}<button onClick={()=>setError("")} aria-label="Dismiss">✕</button></div>}
    {notice&&<div role="status" className="mt2-notice">{notice}<button onClick={()=>setNotice("")} aria-label="Dismiss">✕</button></div>}
    {loading?<div className="mt2-loading">Loading workspaces, linked tasks and access…</div>:<>
     <section className="mt2-connected-metrics" aria-label="Connected work totals">
      <button onClick={()=>setView("teams")}><strong>{workspaces.length}</strong><span>Team spaces</span></button>
      <button onClick={()=>setView("assigned")}><strong>{assigned.filter(t=>t.status!=="done").length}</strong><span>Assigned to me</span></button>
      <button onClick={()=>setView("delegated")}><strong>{delegated.filter(t=>t.status!=="done").length}</strong><span>Delegated by me</span></button>
      <button onClick={()=>setView("linked")}><strong>{availableLinks.length}</strong><span>Source links</span></button>
     </section>
     <div className="mt2-connected-toolbar"><nav aria-label="Connected work views">{tabs.map(([key,label])=><button type="button" key={key} className={view===key?"active":""} aria-pressed={view===key} onClick={()=>setView(key)}>{label}</button>)}</nav>
      {view!=="teams"&&<input aria-label="Search connected tasks" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a connected task…"/>}
     </div>
     {view==="overview"&&<section className="mt2-panel mt2-workspace-preview">
       <div><p className="mt2-eyebrow">YOUR PEOPLE</p><h2>Team Spaces</h2><p>{workspaces.length?`${workspaces.length} workspace${workspaces.length===1?"":"s"} · Invite, assign and discuss without leaving Tasks.`:"Create a workspace when you need to collaborate. Personal work stays private."}</p></div>
       <div className="mt2-workspace-preview-actions">{workspaces.slice(0,3).map(w=><span className="mt2-workspace-pill" key={w.id}>{w.name}</span>)}<button type="button" onClick={()=>setView("teams")}>Manage team spaces →</button></div>
      </section>}
      {view==="teams"&&<section className="mt2-connected-team">
      <div className="mt2-connected-section-title"><div><p className="mt2-eyebrow">INVITE · ASSIGN · DISCUSS</p><h2>Team Spaces</h2></div><span>Invite teammates, manage access and keep work moving</span></div>
      <TeamSpaces request={request} tasks={tasks} userId={userId} onUpdated={refresh} onOpenTask={t=>{const found=tasks.find(x=>x.id===t.id);if(found)setSelected(found)}}/>
     </section>}
     {view==="overview"&&<>
      {(assigned.some(t=>t.status!=="done")||delegated.some(t=>t.status!=="done"))?<div className="mt2-connected-panes">
       <section className="mt2-panel"><div className="mt2-panel-head"><div><p className="mt2-eyebrow">MY NEXT ACTIONS</p><h2>Assigned to me</h2></div><button className="mt2-connected-see" onClick={()=>setView("assigned")}>View all</button></div>
        <div className="mt2-connected-task-grid">{visible(assigned).filter(t=>t.status!=="done").slice(0,5).map(taskCard)}{!assigned.some(t=>t.status!=="done")&&<p className="mt2-empty">No tasks assigned to you right now.</p>}</div>
       </section>
       <section className="mt2-panel"><div className="mt2-panel-head"><div><p className="mt2-eyebrow">FOLLOW UP, DON'T CHASE</p><h2>Delegated by me</h2></div><button className="mt2-connected-see" onClick={()=>setView("delegated")}>View all</button></div>
        <div className="mt2-connected-task-grid">{visible(delegated).filter(t=>t.status!=="done").slice(0,5).map(taskCard)}{!delegated.some(t=>t.status!=="done")&&<p className="mt2-empty">Nothing waiting on your team.</p>}</div>
       </section>
      </div>:<section className="mt2-panel mt2-handoff-empty">
       <div className="mt2-handoff-icon" aria-hidden="true">⇄</div>
       <div><p className="mt2-eyebrow">COLLABORATE WHEN YOU NEED TO</p><h2>No active handoffs</h2><p>Tasks you assign or receive will appear here. Your personal tasks stay separate.</p></div>
       <button type="button" onClick={()=>setView("teams")}>Manage team spaces →</button>
      </section>}
      <section className="mt2-panel mt2-connected-linked-overview"><div className="mt2-panel-head"><div><p className="mt2-eyebrow">WORK ACROSS APPLICATIONS</p><h2>Connected modules</h2></div><button className="mt2-connected-see" onClick={()=>setView("linked")}>Explore linked tasks</button></div>
       <p>Keep follow-ups connected to their source. Linking work never changes its original permissions.</p>
       <div className="mt2-connected-source-tiles"><Link href="/connect"><span className="mt2-source-chip connect">Connect CRM</span><strong>Open CRM workspace</strong><small>Contacts, opportunities and follow-ups ↗</small></Link><Link href={learningRoute}><span className="mt2-source-chip learning">Learning Portal</span><strong>Open Learning Portal</strong><small>Classes and scheduling ↗</small></Link></div>
      </section>
     </>}
     {(view==="assigned"||view==="delegated")&&<section className="mt2-panel"><div className="mt2-panel-head"><div><p className="mt2-eyebrow">{view==="assigned"?"RESPONSIBILITIES GIVEN TO YOU":"FOLLOW-UP & HANDOFFS"}</p><h2>{view==="assigned"?"Assigned to me":"Delegated by me"}</h2></div><span className="mt2-count">{(view==="assigned"?assigned:delegated).length}</span></div>
      <div className="mt2-connected-task-grid two">{visible(view==="assigned"?assigned:delegated).map(taskCard)}</div>{!(view==="assigned"?assigned:delegated).length&&<p className="mt2-empty">Nothing in this view right now.</p>}</section>}
     {view==="linked"&&<section className="mt2-panel"><div className="mt2-panel-head"><div><p className="mt2-eyebrow">ONE TASK, ONE SOURCE OF TRUTH</p><h2>Connected source records</h2><small>Your connected records, with their original access permissions.</small></div><span className="mt2-count">{availableLinks.length}</span></div>
      <div className="mt2-module-list">
       {availableLinks.filter(l=>!search||[l.title,l.module,l.resource].some(x=>x.toLowerCase().includes(search.toLowerCase()))).map(l=><article key={l.module+"-"+l.resource_id} className="mt2-module-item">
        <span className={"mt2-source-chip "+l.module}>{moduleLabels[l.module]}</span>
        <div><button onClick={()=>{const t=linked.find(t=>t.id===l.task_id);if(t)setSelected(t)}}>{l.title}</button><small>{resourceLabels[l.resource]} · {v2StatusNames[l.status as V2Task["status"]]||l.status.replaceAll("_"," ")}</small></div>
        <Link href={l.module==="connect"?"/connect":learningRoute}>Open module ↗</Link>
       </article>)}
       {!availableLinks.length&&<p className="mt2-empty">No CRM or Learning Portal links for this account yet. Linked tasks appear automatically when generated by the source modules.</p>}
      </div>
     </section>}
     {myShared.length>0&&view==="overview"&&<p className="mt2-connected-note">{myShared.length} shared task(s) were created by your account. Open Team Spaces to manage access, assignments and updates.</p>}
    </>}
   </div>
  </main>
  <TaskV2DetailDrawer task={selected} userId={userId} areas={areas} projects={projects} request={request} onClose={()=>setSelected(null)} onChanged={refresh}/>
 </div>;
}
