"use client";
import {FormEvent,useCallback,useEffect,useRef,useState} from "react";
import {connectFetch} from "@/features/connect/api/client";
export type Policy={assignmentEnabled:boolean;initialFollowupEnabled:boolean;followupDelayHours:number;remindersEnabled:boolean;reminderAdvanceMinutes:number};
const defaults:Policy={assignmentEnabled:true,initialFollowupEnabled:true,followupDelayHours:24,remindersEnabled:true,reminderAdvanceMinutes:30};
export function ConnectAutomationSettings({tenantId,canManage}:{tenantId:string;canManage:boolean}){
 const[policy,setPolicy]=useState<Policy>(defaults);
 const[loading,setLoading]=useState(true);
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState("");
 const[notice,setNotice]=useState("");
 const requestId=useRef(0);
 const load=useCallback(async()=>{
  const id=++requestId.current;
  setLoading(true);setError("");
  try{
   const r=await connectFetch<{settings:Policy}>("/api/connect/workspaces/"+tenantId+"/automation");
   if(requestId.current===id)setPolicy(r.settings);
  }catch(e){if(requestId.current===id)setError(e instanceof Error?e.message:"Could not load automation settings.");}
  finally{if(requestId.current===id)setLoading(false);}
 },[tenantId]);
 useEffect(()=>{setPolicy(defaults);setNotice("");setBusy(false);void load();return ()=>{requestId.current++;};},[load]);
 async function save(e:FormEvent){
  e.preventDefault();if(busy)return;const generation=++requestId.current;setBusy(true);setError("");setNotice("");
  try{
   const r=await connectFetch<{settings:Policy}>("/api/connect/workspaces/"+tenantId+"/automation",{
    method:"PATCH",body:JSON.stringify(policy)
   });
   if(requestId.current===generation){setPolicy(r.settings);setNotice("Automation settings saved.");}
  }catch(e){if(requestId.current===generation)setError(e instanceof Error?e.message:"Unable to save automation settings.");}
  finally{if(requestId.current===generation)setBusy(false);}
 }
 return <section className="cx-panel cx-integration-panel">
  <div className="cx-panel-header"><div><h2>Automation rules</h2><p>Assign new admissions, create follow-ups and remind your team. Messages are not sent to families automatically.</p></div></div>
  <form className="cx-form cx-automation-form" onSubmit={save}>
   {loading?<p className="cx-muted">Loading automation rules…</p>:<>
    {error&&<div className="cx-alert" role="alert">{error}</div>}
    {notice&&<div className="cx-success" role="status">{notice}</div>}
    <label className="cx-policy-check"><input type="checkbox" checked={policy.assignmentEnabled} disabled={!canManage}
      onChange={e=>setPolicy(p=>({...p,assignmentEnabled:e.target.checked}))}/><span><strong>Automatically assign incoming admissions</strong><small>Prefer an active counsellor with fewer open opportunities. Keep a manually selected owner when specified.</small></span></label>
    <label className="cx-policy-check"><input type="checkbox" checked={policy.initialFollowupEnabled} disabled={!canManage}
      onChange={e=>setPolicy(p=>({...p,initialFollowupEnabled:e.target.checked}))}/><span><strong>Prepare the first follow-up automatically</strong><small>Create one follow-up for every new admission, including website and messaging enquiries.</small></span></label>
    <label>First follow-up after (hours)<input type="number" min={1} max={168} disabled={!canManage||!policy.initialFollowupEnabled}
     value={policy.followupDelayHours} onChange={e=>setPolicy(p=>({...p,followupDelayHours:Number(e.target.value)}))}/></label>
    <label className="cx-policy-check"><input type="checkbox" checked={policy.remindersEnabled} disabled={!canManage}
      onChange={e=>setPolicy(p=>({...p,remindersEnabled:e.target.checked}))}/><span><strong>Enable in-app task reminders</strong><small>Requires the secure reminder scheduler to run. No SMS, email or WhatsApp is sent.</small></span></label>
    <label>Remind before due time (minutes)<input type="number" min={5} max={1440} disabled={!canManage||!policy.remindersEnabled}
     value={policy.reminderAdvanceMinutes} onChange={e=>setPolicy(p=>({...p,reminderAdvanceMinutes:Number(e.target.value)}))}/></label>
    {canManage&&<button className="cx-primary" disabled={busy}>{busy?"Saving…":"Save automation rules"}</button>}
   </>}
  </form>
 </section>;
}
