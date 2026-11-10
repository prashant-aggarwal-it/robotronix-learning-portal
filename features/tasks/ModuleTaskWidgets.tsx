"use client";
import Link from "next/link";
import {useCallback,useEffect,useState} from "react";
import {connectFetch} from "@/features/connect/api/client";
import "./module-task-widgets.css";

type Module="connect"|"learning";
type Resource="crm_task"|"crm_person"|"crm_opportunity"|"schedule_event";
type Linked={task_id:string;resource_id:string;resource:Resource;title:string;status:string;due_at:string|null};

export function ModuleTaskLinkButton({module,resource,resourceId,tenantId,label="Add to My Tasks"}:{module:Module;resource:Resource;resourceId:string;tenantId?:string;label?:string}){
 const [busy,setBusy]=useState(false),[linked,setLinked]=useState(false),[error,setError]=useState("");
 const add=async()=>{setBusy(true);setError("");try{
  await connectFetch("/api/tasks/module-links",{method:"POST",body:JSON.stringify({module,resource,resource_id:resourceId,tenant_id:tenantId||null})});setLinked(true);
 }catch(e){setError(e instanceof Error?e.message:"Could not add task.")}finally{setBusy(false)}};
 return <span className="tw-module-link-control"><button type="button" className="tw-module-link-button" onClick={()=>void add()} disabled={busy||linked} title="Copy this record into your private My Tasks workspace without changing its visibility">{busy?"Adding…":linked?"✓ Added to My Tasks":`✦ ${label}`}</button>{linked&&<Link href="/tasks/all">Open ↗</Link>}{error&&<small role="alert">{error}</small>}</span>;
}

export function ModuleTasksWidget({module,tenantId}:{module:Module;tenantId?:string}){
 const [items,setItems]=useState<Linked[]>([]),[error,setError]=useState("");
 const refresh=useCallback(async()=>{try{const params=new URLSearchParams({module});if(tenantId)params.set("tenant_id",tenantId);
  const data=await connectFetch<{items:Linked[]}>("/api/tasks/module-links?"+params);setItems(data.items||[]);setError("");
 }catch(e){setError(e instanceof Error?e.message:"Tasks unavailable.")}},[module,tenantId]);
 useEffect(()=>{void refresh()},[refresh]);
 const active=items.filter(t=>t.status!=="done");const overdue=active.filter(t=>t.due_at&&new Date(t.due_at).getTime()<Date.now());
 return <section className="tw-module-widget" aria-label="Linked My Tasks"><div className="tw-module-widget-heading"><span>✦</span><div><strong>My Tasks · {module==="connect"?"Connect CRM":"Learning"}</strong><small>Your private actions linked to this module</small></div><button onClick={()=>void refresh()} title="Refresh linked tasks">↻</button></div>
  <div className="tw-module-widget-stats"><span><b>{active.length}</b> Open</span><span><b>{overdue.length}</b> Overdue</span><span><b>{items.length}</b> Linked</span></div>
  {items.slice(0,3).map(t=><Link key={t.task_id} href={`/tasks/all?task=${t.task_id}`} className="tw-module-widget-row"><span>{t.status==="done"?"✓":"○"}</span><b>{t.title}</b><small>↗</small></Link>)}
  {items.length===0&&<p>No linked tasks yet. Add an item below to keep it on your personal radar.</p>}
  {error&&<small role="alert">{error}</small>}
  <Link className="tw-module-widget-all" href="/tasks/all">Open My Tasks →</Link>
 </section>;
}
