"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {TaskCollaborationDetail} from "@/features/tasks/TaskCollaboration";
import {getCurrentProfile} from "@/lib/repository";
import type {V2ModuleLink,V2Request,V2Response,V2Task} from "./model";

type Props={task:V2Task;userId:string|null;request:V2Request;onChanged:()=>Promise<void>};
const modules:Record<V2ModuleLink["module"],string>={connect:"Connect CRM",learning:"Learning Portal"};
const resourceNames:Record<V2ModuleLink["resource"],string>={
 crm_task:"CRM follow-up",crm_person:"CRM contact",crm_opportunity:"CRM opportunity",schedule_event:"Scheduled class"
};
export function TaskV2CollaborationPanel({task,userId,request,onChanged}:Props){
 const [links,setLinks]=useState<V2ModuleLink[]>([]);
 const [loading,setLoading]=useState(true);
 const [status,setStatus]=useState(task.status);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const [learningRoute,setLearningRoute]=useState("/admin/schedule");
 useEffect(()=>{
  setStatus(task.status);
  let alive=true;
  setLoading(true);setLinks([]);setError("");
  void Promise.all([
   task.owner_user_id===userId
    ?request<V2Response<V2ModuleLink>>("/api/tasks/module-links")
    :Promise.resolve({items:[] as V2ModuleLink[]}),
   getCurrentProfile().catch(()=>null)
  ]).then(([result,profile])=>{
   if(!alive)return;
   setLinks((result.items||[]).filter(l=>l.task_id===task.id));
   if(profile?.role==="trainer")setLearningRoute("/trainer/schedule");
   else if(profile?.role==="admin")setLearningRoute("/admin/schedule");
   else setLearningRoute("/");
  }).catch(e=>{if(alive)setError(e instanceof Error?e.message:"Couldn't load connected records.");})
   .finally(()=>{if(alive)setLoading(false)});
  return()=>{alive=false};
 },[task.id,task.owner_user_id,userId,request]);
 async function changeStatus(next:"todo"|"in_progress"|"done"){
  if(saving||userId!==task.assignee_user_id||userId===task.owner_user_id)return;
  setSaving(true);setError("");setMessage("");
  try{
   await request<V2Response<V2Task>>("/api/tasks/"+task.id,{method:"PATCH",body:JSON.stringify({status:next})});
   setStatus(next);setMessage("Your task status has been updated.");await onChanged();
  }catch(e){setError(e instanceof Error?e.message:"Unable to change your assigned task status.");}
  finally{setSaving(false)}
 }
 return <div className="mt2-collaboration">
  {loading?<div className="mt2-loading">Checking connected records and access…</div>:<>
   {error&&<div role="alert" className="mt2-error">{error}</div>}
   {message&&<div role="status" className="mt2-notice">{message}</div>}
   {userId&&task.assignee_user_id===userId&&task.owner_user_id!==userId&&<div className="mt2-assigned-status"><div><strong>Your assignment</strong><small>Update progress without changing another person’s task details.</small></div><select aria-label="Update assigned task status" value={status} disabled={saving} onChange={e=>void changeStatus(e.target.value as "todo"|"in_progress"|"done")}><option value="todo">To Do</option><option value="in_progress">In Progress</option><option value="done">Done</option>{status==="waiting"&&<option value="waiting" disabled>Waiting</option>}</select></div>}
   {links.length>0&&<section className="mt2-linked-context" aria-label="Connected source records">
    <h3>Connected source records</h3>
    <p>This task was linked from another Robotronix module. Its original workflow remains authoritative; sharing controls are disabled here.</p>
    {links.map(link=><div className="mt2-linked-record" key={link.module+"-"+link.resource_id}>
     <span className={"mt2-source-chip "+link.module}>{modules[link.module]}</span>
     <div><strong>{resourceNames[link.resource]}</strong><small>{link.title} · {link.status.replaceAll("_"," ")}</small></div>
     <Link href={link.module==="connect"?"/connect":learningRoute}>Open module ↗</Link>
    </div>)}
   </section>}
   <TaskCollaborationDetail key={task.id} task={task} request={request} userId={userId} onChanged={onChanged} sharingDisabled={links.length>0||Boolean(error)}/>
  </>}
 </div>;
}
