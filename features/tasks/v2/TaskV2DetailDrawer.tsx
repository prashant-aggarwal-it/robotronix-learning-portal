"use client";
import Link from "next/link";
import {useCallback,useEffect,useMemo,useState,type FormEvent} from "react";
import type {V2Task,V2Area,V2Project,V2Status,V2Priority,V2Response,V2Request} from "./model";
import {v2StatusNames} from "./model";

type Subtask={id:string;title:string;done:boolean;sort_order:number};
type Props={
 task:V2Task|null;areas:V2Area[];projects:V2Project[];
 userId:string|null;request:V2Request;
 onClose:()=>void;onChanged:()=>Promise<void>;
};
const dateTimeLocal=(iso:string|null)=>{
 if(!iso)return "";
 const d=new Date(iso);
 if(Number.isNaN(d.getTime()))return "";
 const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
 return local.toISOString().slice(0,16);
};
export function TaskV2DetailDrawer({task,areas,projects,userId,request,onClose,onChanged}:Props){
 const [title,setTitle]=useState("");
 const [description,setDescription]=useState("");
 const [status,setStatus]=useState<V2Status>("todo");
 const [priority,setPriority]=useState<V2Priority>("medium");
 const [areaId,setAreaId]=useState("");
 const [projectId,setProjectId]=useState("");
 const [planned,setPlanned]=useState("");
 const [due,setDue]=useState("");
 const [important,setImportant]=useState(false);
 const [estimate,setEstimate]=useState("");
 const [doneDefinition,setDoneDefinition]=useState("");
 const [resumeNote,setResumeNote]=useState("");
 const [waitingFor,setWaitingFor]=useState("");
 const [followup,setFollowup]=useState("");
 const [subtasks,setSubtasks]=useState<Subtask[]>([]);
 const [newStep,setNewStep]=useState("");
 const [working,setWorking]=useState(false);
 const [loadingSteps,setLoadingSteps]=useState(false);
 const [error,setError]=useState("");
 const canEdit=Boolean(task&&userId===task.owner_user_id);
 const accessibleProjects=useMemo(()=>projects.filter(p=>!areaId||!p.area_id||p.area_id===areaId),[projects,areaId]);
 useEffect(()=>{
  if(!task)return;
  setTitle(task.title);setDescription(task.description||"");
  setStatus(task.status);setPriority(task.priority);
  setAreaId(task.area_id||"");setProjectId(task.project_id||"");
  setPlanned(task.scheduled_date||"");setDue(dateTimeLocal(task.due_at));
  setImportant(Boolean(task.important));setEstimate(task.estimated_minutes==null?"":String(task.estimated_minutes));
  setDoneDefinition(task.done_definition||"");setResumeNote(task.resume_note||"");
  setWaitingFor(task.waiting_for||"");setFollowup(task.followup_date||"");
  setSubtasks([]);setNewStep("");setError("");
 },[task?.id]);
 const loadSteps=useCallback(async()=>{
  if(!task)return;
  setLoadingSteps(true);
  try{
   const response=await request<V2Response<Subtask>>("/api/tasks/"+task.id+"/subtasks");
   setSubtasks(response.items||[]);
  }catch(e){setError(e instanceof Error?e.message:"Couldn't load checklist.");}
  finally{setLoadingSteps(false)}
 },[task?.id,request]);
 useEffect(()=>{void loadSteps()},[loadSteps]);
 useEffect(()=>{
  if(!task)return;
  const key=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose()};
  document.addEventListener("keydown",key);
  return()=>document.removeEventListener("keydown",key);
 },[task?.id,onClose]);
 if(!task)return null;
 const total=subtasks.length;
 const completed=subtasks.filter(s=>s.done).length;
 const progress=total?Math.round(100*completed/total):0;
 async function save(e:FormEvent){
  e.preventDefault();
  if(!task||!canEdit||working)return;
  if(!title.trim()){setError("A task needs a title.");return;}
  const minutes=estimate?Number(estimate):null;
  if(minutes!==null&&(!Number.isInteger(minutes)||minutes<1||minutes>1440)){setError("Estimate must be between 1 and 1,440 minutes.");return;}
  setWorking(true);setError("");
  try{
   const payload={
    title:title.trim(),description,priority,status,
    area_id:areaId||null,project_id:projectId||null,
    scheduled_date:planned||null,due_at:due?new Date(due).toISOString():null,
    important,estimated_minutes:minutes,done_definition:doneDefinition,
    resume_note:resumeNote,waiting_for:waitingFor,followup_date:followup||null
   };
   await request<V2Response<V2Task>>("/api/tasks/v2/items/"+task.id+"/detail",{
    method:"PATCH",body:JSON.stringify(payload)
   });
   await onChanged();
   onClose();
  }catch(e){setError(e instanceof Error?e.message:"Unable to save task details.");}
  finally{setWorking(false)}
 }
 async function updateStep(step:Subtask,done:boolean){
  if(!task||!canEdit||working)return;
  setWorking(true);setError("");
  try{
   await request<V2Response<Subtask>>("/api/tasks/"+task.id+"/subtasks",{
    method:"POST",body:JSON.stringify({id:step.id,title:step.title,done})
   });
   await loadSteps();await onChanged();
  }catch(e){setError(e instanceof Error?e.message:"Unable to update checklist.");}
  finally{setWorking(false)}
 }
 async function addStep(e:FormEvent){
  e.preventDefault();
  if(!task||!canEdit||!newStep.trim()||working)return;
  setWorking(true);setError("");
  try{
   await request<V2Response<Subtask>>("/api/tasks/"+task.id+"/subtasks",{
    method:"POST",body:JSON.stringify({title:newStep.trim(),done:false})
   });
   setNewStep("");await loadSteps();await onChanged();
  }catch(e){setError(e instanceof Error?e.message:"Unable to add checklist item.");}
  finally{setWorking(false)}
 }
 async function deleteStep(id:string){
  if(!task||!canEdit||working)return;
  setWorking(true);setError("");
  try{
   await request<V2Response<unknown>>("/api/tasks/"+task.id+"/subtasks?id="+encodeURIComponent(id),{method:"DELETE"});
   await loadSteps();await onChanged();
  }catch(e){setError(e instanceof Error?e.message:"Unable to remove checklist item.");}
  finally{setWorking(false)}
 }
 return <div className="mt2-drawer-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <aside className="mt2-drawer" role="dialog" aria-modal="true" aria-labelledby="mt2-task-detail-heading">
   <div className="mt2-drawer-top">
    <div><span className="mt2-eyebrow">TASK DETAILS</span><h2 id="mt2-task-detail-heading">Make progress, one step at a time.</h2></div>
    <button type="button" aria-label="Close task details" onClick={onClose}>✕</button>
   </div>
   {!canEdit&&<div className="mt2-drawer-info">This task is shared with you. Open Classic Tasks to manage actions permitted by your workspace.</div>}
   {error&&<div className="mt2-error" role="alert">{error}</div>}
   <form id="mt2-detail-form" className="mt2-detail-form" onSubmit={save}>
    <fieldset disabled={!canEdit||working}>
     <label className="mt2-form-field mt2-title-field">Task title<input aria-label="Task title" maxLength={240} required value={title} onChange={e=>setTitle(e.target.value)}/></label>
     <div className="mt2-detail-grid">
      <label className="mt2-form-field">Status<select value={status} onChange={e=>setStatus(e.target.value as V2Status)}>{(Object.entries(v2StatusNames) as [V2Status,string][]).map(([k,label])=><option key={k} value={k}>{label}</option>)}</select></label>
      <label className="mt2-form-field">Priority<select value={priority} onChange={e=>setPriority(e.target.value as V2Priority)}><option value="high">High</option><option value="medium">Normal</option><option value="low">Low</option></select></label>
      <label className="mt2-form-field">Area<select value={areaId} onChange={e=>{setAreaId(e.target.value);setProjectId("")}}><option value="">Unsorted</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <label className="mt2-form-field">Project<select value={projectId} onChange={e=>{const id=e.target.value;setProjectId(id);const p=projects.find(x=>x.id===id);if(p?.area_id)setAreaId(p.area_id)}}><option value="">No project</option>{accessibleProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="mt2-form-field">Work on<input type="date" value={planned} onChange={e=>setPlanned(e.target.value)}/></label>
      <label className="mt2-form-field">Due date & time<input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></label>
      <label className="mt2-form-field">Estimated minutes<input type="number" min={1} max={1440} placeholder="Optional" value={estimate} onChange={e=>setEstimate(e.target.value)}/></label>
      <label className="mt2-drawer-important"><input type="checkbox" checked={important} onChange={e=>setImportant(e.target.checked)}/> Important work</label>
     </div>
     <label className="mt2-form-field">Notes<textarea rows={3} maxLength={12000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Relevant information, links, or context..."/></label>
     <label className="mt2-form-field">Definition of done<textarea rows={2} maxLength={2000} value={doneDefinition} onChange={e=>setDoneDefinition(e.target.value)} placeholder="What does finished look like?"/></label>
     <label className="mt2-form-field">Park & resume note<textarea rows={2} maxLength={4000} value={resumeNote} onChange={e=>setResumeNote(e.target.value)} placeholder="Where did I stop? What is the next action?"/></label>
     {status==="waiting"&&<div className="mt2-detail-grid">
      <label className="mt2-form-field">Waiting for<input maxLength={500} value={waitingFor} onChange={e=>setWaitingFor(e.target.value)} placeholder="Response or approval"/></label>
      <label className="mt2-form-field">Follow up on<input type="date" value={followup} onChange={e=>setFollowup(e.target.value)}/></label>
     </div>}
    </fieldset>
   </form>
   <section className="mt2-drawer-checklist" aria-labelledby="mt2-checklist-title">
    <div className="mt2-drawer-section-head"><h3 id="mt2-checklist-title">Checklist</h3><span>{completed}/{total} completed</span></div>
    <div className="mt2-progress-track"><span style={{width:progress+"%"}}/></div>
    {loadingSteps?<p className="mt2-empty">Loading checklist…</p>:subtasks.length?subtasks.map(s=><div className="mt2-step" key={s.id}>
     <label><input type="checkbox" checked={s.done} disabled={working||!canEdit} onChange={e=>void updateStep(s,e.target.checked)}/><span className={s.done?"mt2-step-done":""}>{s.title}</span></label>
     {canEdit&&<button type="button" aria-label={"Remove "+s.title} disabled={working} onClick={()=>void deleteStep(s.id)}>✕</button>}
    </div>):<p className="mt2-empty">No subtasks yet. Add your first small step.</p>}
    {canEdit&&<form className="mt2-new-step" onSubmit={addStep}><input maxLength={240} aria-label="New subtask" value={newStep} onChange={e=>setNewStep(e.target.value)} placeholder="Add a step..."/><button disabled={working||!newStep.trim()} type="submit">Add</button></form>}
   </section>
   <div className="mt2-drawer-footer">
    <Link href={"/tasks/all?task="+task.id}>Open Classic Tasks ↗</Link>
    {canEdit&&task.status!=="done"&&<Link href={"/tasks/v2/focus?task="+task.id}>▶ Focus on this task</Link>}
    <button type="button" onClick={onClose} className="mt2-drawer-cancel">Close</button>
    {canEdit&&<button type="submit" form="mt2-detail-form" disabled={working} className="mt2-drawer-save">{working?"Saving…":"Save changes"}</button>}
   </div>
  </aside>
 </div>;
}
