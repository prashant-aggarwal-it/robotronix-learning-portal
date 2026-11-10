"use client";
import Link from "next/link";
import {useCallback,useEffect,useMemo,useState,type FormEvent} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {ApplicationSwitcher} from "@/components/ApplicationSwitcher";
import {TasksNotifications} from "./TasksNotifications";
import {TasksPrimaryNav} from "./TasksPrimaryNav";
import type {V2Task,V2Area,V2Project,V2Response,V2Request} from "./model";

type FocusMode="timebox"|"pomodoro"|"stopwatch"|"five_minutes";
type FocusState="running"|"paused"|"ended";
type Session={id:string;task_id:string;mode:FocusMode;state:FocusState;planned_minutes:number;elapsed_seconds:number;resumed_at:string;started_at:string;ended_at:string|null;outcome:"completed"|"parked"|"stopped"|null;extension_count:number};
type Idea={id:string;source_task_id:string|null;title:string;state:string;created_at:string};
type Settings={active_project_limit:number;daily_focus_minutes:number;switch_prompt_enabled:boolean};
type Commitment={area_id:string;target_sessions:number;completed_sessions:number};
type FocusResponse={active:Session|null;settings:Settings;ideas:Idea[];history:Session[];commitments:Commitment[]};
type FocusApi={ok:boolean;focus:FocusResponse};
type SessionApi={ok:boolean;session:Session};
type IdeaApi={ok:boolean;item:Idea};
type SettingsApi={ok:boolean;settings:Settings};
const modeLabels:Record<FocusMode,string>={timebox:"Timebox",pomodoro:"Pomodoro",stopwatch:"Stopwatch",five_minutes:"Start for 5"};
const modeMinutes:Record<FocusMode,number>={timebox:45,pomodoro:25,stopwatch:45,five_minutes:5};
const prettySeconds=(seconds:number)=>{const minutes=Math.floor(seconds/60);return String(Math.floor(minutes/60)).padStart(2,"0")+":"+String(minutes%60).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0")};
const timeSpent=(s:Session,now:number)=>{
 const started=Date.parse(s.resumed_at);
 return s.elapsed_seconds+(s.state==="running"&&Number.isFinite(started)?Math.max(0,Math.floor((now-started)/1000)):0);
};
const defaultSettings:Settings={active_project_limit:2,daily_focus_minutes:180,switch_prompt_enabled:true};
export function TasksV2Focus(){
 const [tasks,setTasks]=useState<V2Task[]>([]);
 const [userId,setUserId]=useState<string|null>(null);
 const [areas,setAreas]=useState<V2Area[]>([]);
 const [projects,setProjects]=useState<V2Project[]>([]);
 const [data,setData]=useState<FocusResponse>({active:null,settings:defaultSettings,ideas:[],history:[],commitments:[]});
 const [now,setNow]=useState(()=>Date.now());
 const [breakUntil,setBreakUntil]=useState<number|null>(null);
 useEffect(()=>{const query=new URLSearchParams(window.location.search);const id=query.get("task");if(id&&/^[0-9a-f-]{36}$/i.test(id))setChosenTask(id);},[]);
 const [chosenTask,setChosenTask]=useState("");
 const [mode,setMode]=useState<FocusMode>("timebox");
 const [minutes,setMinutes]=useState(45);
 const [resumeNote,setResumeNote]=useState("");
 const [ideaText,setIdeaText]=useState("");
 const [newCommitmentArea,setNewCommitmentArea]=useState("");
 const [newCommitmentTarget,setNewCommitmentTarget]=useState(3);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [limit,setLimit]=useState(2);
 const [capacity,setCapacity]=useState(180);
 const [promptEnabled,setPromptEnabled]=useState(true);
 const [mobileNav,setMobileNav]=useState(false);
 const request:V2Request=useCallback(async <T,>(url:string,init:RequestInit={}):Promise<T>=>{
  const client=getSupabaseBrowserClient();if(!client)throw new Error("Development Supabase not configured.");
  const {data:{session}}=await client.auth.getSession();
  if(!session?.access_token)throw new Error("Please sign in to continue.");
  const response=await fetch(url,{...init,cache:"no-store",headers:{"Authorization":"Bearer "+session.access_token,
   "Content-Type":"application/json",...(init.headers||{})}});
  const json=await response.json().catch(()=>({}));
  if(!response.ok||json.ok===false)throw new Error(json.error||"The request failed.");
  return json as T;
 },[]);
 const refresh=useCallback(async()=>{
  try{
   const [focus,areaData,projectData]=await Promise.all([
    request<FocusApi>("/api/tasks/v2/focus"),
    request<V2Response<V2Area>>("/api/tasks/v2/areas"),
    request<V2Response<V2Project>>("/api/tasks/v2/projects")
   ]);
   const all:V2Task[]=[];
   for(let offset=0;offset<20000;offset+=250){
    const next=await request<V2Response<V2Task>>("/api/tasks/v2/board?limit=250&offset="+offset);
    const page=next.items||[];all.push(...page);if(page.length<250)break;
   }
   setData({...focus.focus,commitments:focus.focus.commitments||[]});setAreas(areaData.items||[]);setProjects(projectData.items||[]);
   setTasks([...new Map(all.map(t=>[t.id,t])).values()]);
   setLimit(focus.focus.settings.active_project_limit);setCapacity(focus.focus.settings.daily_focus_minutes);
   setPromptEnabled(focus.focus.settings.switch_prompt_enabled);
   setError("");
  }catch(e){setError(e instanceof Error?e.message:"Unable to load focus workspace.");}
  finally{setLoading(false)}
 },[request]);
 useEffect(()=>{void refresh()},[refresh]);
 useEffect(()=>{let mounted=true;void getSupabaseBrowserClient()?.auth.getUser().then(({data})=>{if(mounted)setUserId(data.user?.id||null)});return()=>{mounted=false}},[]);
 useEffect(()=>{const id=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(id)},[]);
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{if(e.key==="Escape")setMobileNav(false)};
  document.addEventListener("keydown",key);return()=>document.removeEventListener("keydown",key);
 },[]);
 useEffect(()=>{
  if(data.active){const current=tasks.find(t=>t.id===data.active?.task_id);setResumeNote(current?.resume_note||"");}
 },[data.active?.id,tasks]);
 const taskById=useMemo(()=>new Map(tasks.map(t=>[t.id,t])),[tasks]);
 const active=data.active;
 const elapsed=active?timeSpent(active,now):0;
 const target=active?active.planned_minutes*60:0;
 const isTimeUp=Boolean(active&&active.state==="running"&&active.mode!=="stopwatch"&&elapsed>=target);
 const isPaused=active?.state==="paused";
 const breakRemaining=breakUntil===null?0:Math.max(0,Math.ceil((breakUntil-now)/1000));
 const openTasks=tasks.filter(t=>t.status!=="done"&&t.owner_user_id===userId);
 const activeProjects=projects.filter(p=>p.status==="active");
 const nextProtected=useMemo(()=>{
  const candidateAreas=[...data.commitments].filter(c=>c.completed_sessions<c.target_sessions)
   .sort((a,b)=>a.completed_sessions/a.target_sessions-b.completed_sessions/b.target_sessions);
  const priorities:Record<string,number>={high:0,medium:1,low:2};
  for(const c of candidateAreas){
   const option=tasks.filter(t=>t.owner_user_id===userId&&t.status!=="done"&&t.id!==active?.task_id&&t.area_id===c.area_id)
    .sort((a,b)=>priorities[a.priority]-priorities[b.priority]||Number(b.important)-Number(a.important))[0];
   if(option)return option;
  }
  return null;
 },[data.commitments,tasks,userId,active?.task_id]);
 const usedThisWeek=useMemo(()=>{
  const since=new Date();since.setDate(since.getDate()-6);since.setHours(0,0,0,0);
  return data.history.filter(s=>Date.parse(s.started_at)>=since.getTime()).reduce((sum,s)=>sum+s.elapsed_seconds,0);
 },[data.history]);
 const areaUsage=useMemo(()=>{
  const buckets=new Map<string,number>();
  for(const s of data.history){
   const t=taskById.get(s.task_id);const label=areas.find(a=>a.id===t?.area_id)?.name||"Unsorted";
   buckets.set(label,(buckets.get(label)||0)+s.elapsed_seconds);
  }
  if(active){
   const t=taskById.get(active.task_id);const label=areas.find(a=>a.id===t?.area_id)?.name||"Unsorted";
   buckets.set(label,(buckets.get(label)||0)+elapsed);
  }
  return [...buckets.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);
 },[data.history,active?.id,elapsed,taskById,areas]);
 const taskLabel=(id:string)=>taskById.get(id)?.title||"Previously recorded task";
 async function action(name:"start"|"pause"|"resume"|"extend"|"finish",payload:Record<string,unknown>){
  if(busy)return false;setBusy(true);setError("");setNotice("");
  try{
   await request<SessionApi>("/api/tasks/v2/focus",{method:"POST",body:JSON.stringify({action:name,...payload})});
   if(name==="finish"){setResumeNote("");setBreakUntil(null);setNotice("Session closed. Your next priority is ready when you are.");}
   if(name==="extend")setNotice("Extra time added. The next decision point remains visible.");
   await refresh();
   return true;
  }catch(e){setError(e instanceof Error?e.message:"Unable to update focus session.");return false;}
  finally{setBusy(false)}
 }
 async function startBreak(){
  if(!active||active.state!=="running"||busy)return;
  const paused=await action("pause",{session_id:active.id});
  if(paused)setBreakUntil(Date.now()+5*60*1000);
 }
 async function idea(e:FormEvent){
  e.preventDefault();if(!ideaText.trim()||busy)return;
  setBusy(true);setError("");
  try{
   await request<IdeaApi>("/api/tasks/v2/ideas",{method:"POST",body:JSON.stringify({
    action:"capture",title:ideaText.trim(),source_task_id:active?.task_id||null
   })});
   setIdeaText("");setNotice("Idea parked. Stay with the work you chose.");await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Couldn't park idea.");}
  finally{setBusy(false)}
 }
 async function ideaAction(id:string,name:"convert"|"dismiss"){
  if(busy)return;setBusy(true);setError("");
  try{
   await request<IdeaApi>("/api/tasks/v2/ideas",{method:"POST",body:JSON.stringify({action:name,idea_id:id})});
   setNotice(name==="convert"?"Idea moved to your Inbox.":"Idea dismissed.");await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Unable to update idea.");}
  finally{setBusy(false)}
 }
 async function saveSettings(e:FormEvent){
  e.preventDefault();if(busy)return;setBusy(true);setError("");
  try{
   await request<SettingsApi>("/api/tasks/v2/focus/settings",{method:"PUT",body:JSON.stringify({
    active_project_limit:limit,daily_focus_minutes:capacity,switch_prompt_enabled:promptEnabled
   })});
   setNotice("Focus preferences saved.");await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Unable to save preferences.");}
  finally{setBusy(false)}
 }
 async function saveCommitment(areaId:string,target:number){
  if(!areaId||busy)return;setBusy(true);setError("");
  try{
   await request<{ok:boolean}>("/api/tasks/v2/focus/commitments",{
    method:"PUT",body:JSON.stringify({area_id:areaId,target_sessions:target})
   });
   setNewCommitmentArea("");setNotice(target?"Weekly commitment saved.":"Weekly commitment cleared.");await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Unable to update weekly commitment.");}
  finally{setBusy(false)}
 }
 function chooseMode(value:FocusMode){setMode(value);setMinutes(modeMinutes[value]);}
 const currentDate=new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const datePart=(key:string)=>currentDate.find(part=>part.type===key)?.value||"";
 const todayKey=datePart("year")+"-"+datePart("month")+"-"+datePart("day");
 const plannedMinutes=tasks.filter(t=>t.status!=="done"&&t.scheduled_date===todayKey).reduce((n,t)=>n+(t.estimated_minutes||0),0);
 return <div className="mt2-shell">
  {mobileNav&&<button className="mt2-scrim" aria-label="Close navigation" onClick={()=>setMobileNav(false)}/>}
  <aside className={"mt2-sidebar "+(mobileNav?"mt2-sidebar-open":"")}>
   <Link href="/tasks" className="mt2-brand"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/></Link>
   <div className="mt2-product">My Tasks <span>FOCUS & FINISH</span></div>
   <ApplicationSwitcher current="tasks"/>
   <div className="mt2-sidebar-heading">MY WORKSPACE</div>
   <TasksPrimaryNav section="focus"/>
   <div className="mt2-sidebar-bottom"><Link href="/tasks">← Return to My Day</Link></div>
  </aside>
  <main className="mt2-main">
   <header className="mt2-header">
    <button className="mt2-mobile-menu" type="button" aria-label="Open navigation" onClick={()=>setMobileNav(true)}>☰</button>
    <div className="mt2-breadcrumb">MY TASKS <span>/</span> Focus & Finish</div>
    <div className="mt2-header-actions"><TasksNotifications/><span className="mt2-sync"><i/> Your personal focus workspace</span></div>
   </header>
   <div className="mt2-page mt2-focus-page">
    <div className="mt2-heading"><div><p className="mt2-eyebrow">DO THE RIGHT WORK · KNOW WHEN TO STOP</p><h1>Focus. Finish. Switch.</h1><p className="mt2-subtitle">One task at a time. Park new ideas. Protect time for other priorities.</p></div></div>
    {error&&<div className="mt2-error" role="alert">{error}<button onClick={()=>setError("")} aria-label="Dismiss">✕</button></div>}
    {notice&&<div className="mt2-notice" role="status">{notice}<button onClick={()=>setNotice("")} aria-label="Dismiss">✕</button></div>}
    {loading?<div className="mt2-loading">Loading your focus workspace…</div>:<>
     <div className="mt2-focus-grid">
      <div className="mt2-focus-primary">
      <section className="mt2-panel mt2-focus-session">
       <p className="mt2-eyebrow">{active?"YOUR CURRENT FOCUS":"START WITH ONE CLEAR OUTCOME"}</p>
       {active?<div className="mt2-focus-current">
        <h2>{taskLabel(active.task_id)}</h2>
        <p>{taskById.get(active.task_id)?.done_definition||"Define a clear stopping point in this task’s details."}</p>
        <div className={"mt2-focus-clock "+(isTimeUp?"mt2-focus-ended":"")}>
         <strong role="timer" aria-live="off">{active.mode==="stopwatch"?prettySeconds(elapsed):prettySeconds(Math.max(0,target-elapsed))}</strong>
         <span>{isPaused?"Paused":isTimeUp?"Timebox reached":modeLabels[active.mode]+" · "+active.planned_minutes+" min planned"}</span>
        </div>
        <div className="mt2-progress-track"><span style={{width:Math.min(100,100*elapsed/Math.max(1,target))+"%"}}/></div>
        {isTimeUp&&active.mode==="pomodoro"&&<button type="button" className="mt2-break-offer" disabled={busy||breakRemaining>0} onClick={()=>void startBreak()}>Take an optional 5-minute break</button>}
        {breakRemaining>0&&<div className="mt2-break"><span>Short break <strong>{prettySeconds(breakRemaining)}</strong></span><button onClick={()=>setBreakUntil(null)} type="button">End break</button></div>}
        {breakUntil!==null&&breakRemaining===0&&isPaused&&<div className="mt2-break" role="status">Break complete. Resume focus when ready.<button type="button" onClick={()=>setBreakUntil(null)}>Dismiss</button></div>}
        {isTimeUp&&promptEnabled&&<div className="mt2-switch-prompt" role="status">
         <strong>Time to decide — not to rush.</strong>
         <p>Your timebox has ended. Save your stopping point and switch to another priority, or consciously extend once.</p>
         {nextProtected&&<p><strong>Next protected priority:</strong> {nextProtected.title} · {areas.find(a=>a.id===nextProtected.area_id)?.name||"Area"}</p>}
        </div>}
        <div className="mt2-focus-controls">
         {isPaused?<button disabled={busy} onClick={()=>void action("resume",{session_id:active.id})}>▶ Resume</button>:<button disabled={busy} onClick={()=>void action("pause",{session_id:active.id})}>Ⅱ Pause</button>}
         <button disabled={busy||active.planned_minutes>=240} className="mt2-secondary-button" onClick={()=>void action("extend",{session_id:active.id,minutes:15})}>+15 minutes</button>
        </div>
        <label className="mt2-focus-note">Where will you resume?<textarea rows={3} maxLength={4000} value={resumeNote} onChange={e=>setResumeNote(e.target.value)} placeholder="I finished X. Next: do Y. This can wait until tomorrow."/></label>
        <div className="mt2-finish-actions">
         <button disabled={busy||!resumeNote.trim()} onClick={()=>void action("finish",{session_id:active.id,outcome:"parked",resume_note:resumeNote})}>⤷ Park & switch</button>
         <button disabled={busy} onClick={()=>void action("finish",{session_id:active.id,outcome:"completed"})}>✓ Mark task done</button>
         <button disabled={busy} className="mt2-secondary-button" onClick={()=>void action("finish",{session_id:active.id,outcome:"stopped"})}>End session</button>
        </div>
       </div>:<div className="mt2-focus-start">
        <label className="mt2-focus-label">Choose one task<select value={chosenTask} onChange={e=>setChosenTask(e.target.value)}><option value="">Select an open task…</option>{openTasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
        <p className="mt2-focus-explain">Know what Done means before you begin. You can add that in the task details.</p>
        <div className="mt2-focus-mode-buttons">{(Object.keys(modeLabels) as FocusMode[]).map(m=><button key={m} aria-pressed={mode===m} className={mode===m?"active":""} onClick={()=>chooseMode(m)}>{modeLabels[m]}</button>)}</div>
        <div className="mt2-focus-setup"><label>Planned minutes<input type="number" min={5} max={240} value={minutes} disabled={mode==="five_minutes"} onChange={e=>setMinutes(Number(e.target.value))}/></label><button disabled={!chosenTask||busy||!Number.isInteger(minutes)||minutes<5||minutes>240} onClick={()=>void action("start",{task_id:chosenTask,mode,minutes})}>▶ Start Focus</button></div>
        <p className="mt2-focus-explain">Pomodoro: 25 minutes. Timebox: choose a limit. Stopwatch: count up. Five-minute start: make beginning easier. Sessions never block access to your work.</p>
       </div>}
      </section>
     <div className="mt2-focus-bottom">
      <section className="mt2-panel"><div className="mt2-panel-head"><div><p className="mt2-eyebrow">MAKE CONSISTENCY EASIER</p><h2>My focus preferences</h2></div></div>
       <form className="mt2-focus-settings" onSubmit={saveSettings}>
        <label>Maximum active projects<select value={limit} onChange={e=>setLimit(Number(e.target.value))}>{Array.from({length:10},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label>
        <label>Example daily focus capacity<select value={capacity} onChange={e=>setCapacity(Number(e.target.value))}>{[30,60,90,120,150,180,240,300,360,480,600].map(n=><option value={n} key={n}>{n} minutes</option>)}</select></label>
        <label className="mt2-prompt-option"><input type="checkbox" checked={promptEnabled} onChange={e=>setPromptEnabled(e.target.checked)}/> Show Stop & Switch prompt</label>
        <button type="submit" disabled={busy}>Save preferences</button>
       </form><p className="mt2-focus-explain">Limits are recommendations, not restrictions. Missed days do not create penalties or streak resets.</p>
      </section>
      <section className="mt2-panel"><div className="mt2-panel-head"><div><p className="mt2-eyebrow">LOOK BACK WITHOUT JUDGEMENT</p><h2>Recently finished sessions</h2></div></div>
       {data.history.length?<div className="mt2-focus-history">{data.history.slice(0,8).map(s=><div key={s.id}><span><b>{taskLabel(s.task_id)}</b><small>{s.outcome||"Ended"} · {new Date(s.started_at).toLocaleDateString()}</small></span><strong>{Math.round(s.elapsed_seconds/60)}m</strong></div>)}</div>:<p className="mt2-empty">Your completed focus sessions will appear here.</p>}
      </section>
     </div>
      </div>
      <div className="mt2-focus-aside">
       <section className="mt2-panel mt2-idea-panel">
        <div className="mt2-panel-head"><div><p className="mt2-eyebrow">DISTRACTION PARKING LOT</p><h2>Capture, don’t switch.</h2><small>A new idea is not a new commitment.</small></div><span className="mt2-count">{data.ideas.length}</span></div>
        <form onSubmit={idea} className="mt2-idea-entry"><input value={ideaText} maxLength={300} onChange={e=>setIdeaText(e.target.value)} placeholder="An idea just popped up…"/><button disabled={!ideaText.trim()||busy} type="submit">Park idea</button></form>
        <div className="mt2-idea-list">{data.ideas.length?data.ideas.slice(0,20).map(i=><div className="mt2-idea-row" key={i.id}><span>{i.title}</span><button disabled={busy} title="Turn into an Inbox task" onClick={()=>void ideaAction(i.id,"convert")}>→ Task</button><button disabled={busy} title="Dismiss idea" aria-label={"Dismiss "+i.title} onClick={()=>void ideaAction(i.id,"dismiss")}>✕</button></div>):<p className="mt2-empty">Ideas can wait here. You don’t have to act on them immediately.</p>}</div>
       </section>
       <section className="mt2-panel">
        <div className="mt2-panel-head"><div><p className="mt2-eyebrow">FOCUS BALANCE</p><h2>Protect other responsibilities.</h2></div></div>
        <div className="mt2-focus-facts">
         <div><strong>{activeProjects.length}<span> / {data.settings.active_project_limit}</span></strong><small>Active projects · suggested limit</small></div>
         <div><strong>{Math.floor(usedThisWeek/3600)}h {Math.round(usedThisWeek%3600/60)}m</strong><small>Recorded focus time · last 7 days</small></div>
        </div>
        {activeProjects.length>data.settings.active_project_limit&&<p className="mt2-balance-note">You have more active projects than your preferred limit. Finish or pause one before starting another big commitment.</p>}
        {areaUsage.length?<div className="mt2-area-balance">{areaUsage.map(([name,seconds])=><div key={name}><span>{name}</span><strong>{Math.floor(seconds/60)}m</strong><div className="mt2-progress-track"><span style={{width:Math.min(100,100*seconds/Math.max(...areaUsage.map(v=>v[1]),1))+"%"}}/></div></div>)}</div>:<p className="mt2-empty">Your time across Areas will appear as you complete sessions.</p>}
        <div className="mt2-weekly-commitments">
         <h3>Protected weekly commitments</h3>
         <p className="mt2-focus-explain">Choose important Areas such as Sales & Outreach and set a realistic number of sessions over a rolling seven days.</p>
         {data.commitments.map(c=><div className="mt2-commitment-row" key={c.area_id}>
          <div><b>{areas.find(a=>a.id===c.area_id)?.name||"Area"}</b><small>{c.completed_sessions} of {c.target_sessions} sessions</small></div>
          <div className="mt2-progress-track"><span style={{width:Math.min(100,100*c.completed_sessions/c.target_sessions)+"%"}}/></div>
          <button disabled={busy} onClick={()=>void saveCommitment(c.area_id,0)} aria-label={"Clear commitment for "+(areas.find(a=>a.id===c.area_id)?.name||"Area")}>Remove</button>
         </div>)}
         <div className="mt2-commitment-add">
          <select aria-label="Choose area to protect" value={newCommitmentArea} onChange={e=>setNewCommitmentArea(e.target.value)}>
           <option value="">Choose an Area…</option>
           {areas.filter(a=>!data.commitments.some(c=>c.area_id===a.id)).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select aria-label="Weekly focus session target" value={newCommitmentTarget} onChange={e=>setNewCommitmentTarget(Number(e.target.value))}>
           {Array.from({length:14},(_,i)=><option key={i} value={i+1}>{i+1} sessions</option>)}
          </select>
          <button disabled={!newCommitmentArea||busy} onClick={()=>void saveCommitment(newCommitmentArea,newCommitmentTarget)}>Protect</button>
         </div>
        </div>
        <p className="mt2-focus-explain">This reflects focus sessions you record in the app, not automatic device or app usage tracking. A skipped day simply means you can resume next time.</p>
       </section>
      </div>
     </div>
     {plannedMinutes>data.settings.daily_focus_minutes&&<p className="mt2-balance-note">Your planned tasks exceed the focus capacity you selected. Moving some work is an option, not a requirement.</p>}
    </>}
   </div>
  </main>
 </div>;
}
