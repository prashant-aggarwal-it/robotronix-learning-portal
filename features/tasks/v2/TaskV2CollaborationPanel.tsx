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
 const [error,setError]=useState("");
 const [learningRoute,setLearningRoute]=useState("/admin/schedule");
 useEffect(()=>{
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
 return <div className="mt2-collaboration">
  {loading?<div className="mt2-loading">Checking connected records and access…</div>:<>
   {error&&<div role="alert" className="mt2-error">{error}</div>}
   {links.length>0&&<section className="mt2-linked-context" aria-label="Connected source records">
    <h3>Connected source records</h3>
    <p>This task was linked from another Robotronix module. Its original workflow remains authoritative; sharing controls are disabled here.</p>
    {links.map(link=><div className="mt2-linked-record" key={link.module+"-"+link.resource_id}>
     <span className={"mt2-source-chip "+link.module}>{modules[link.module]}</span>
     <div><strong>{resourceNames[link.resource]}</strong><small>{link.title} · {link.status.replaceAll("_"," ")}</small></div>
     <Link href={link.module==="connect"?"/connect":learningRoute}>Open module ↗</Link>
    </div>)}
   </section>}
   <TaskCollaborationDetail key={task.id} task={task} request={request} userId={userId} onChanged={onChanged} sharingDisabled={links.length>0}/>
  </>}
 </div>;
}
