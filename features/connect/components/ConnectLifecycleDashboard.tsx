"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {connectFetch} from "@/features/connect/api/client";
import type {ConnectPerson} from "@/features/connect/api/client";

type Lifecycle={
 enrollment_id:string;opportunity_id:string;learner_person_id:string;course_title:string;
 enrollment_status:string;sessions_completed:number;planned_sessions:number|null;progress_percent:number|null;
 attendance_count:number;last_class_date:string|null;package_name:string|null;billing_model:string|null;
 paid_session_balance:number|null;package_end_date:string|null;renewal_reason:string|null;
 renewal_status:"open"|"contacted"|"dismissed"|null;renewal_active:boolean|null;
 payment_attention:boolean|null;refreshed_at:string;
};
const reasonLabel:Record<string,string>={course_completed:"Course completed",learning_paused:"Learning paused",package_sessions_low:"Package sessions running low",package_ending:"Package ending soon",course_ending:"Course ending soon"};

export function ConnectLifecycleDashboard({tenantId,canWrite,refreshKey,people}:{tenantId:string;canWrite:boolean;refreshKey:number;people:ConnectPerson[]}){
 const [items,setItems]=useState<Lifecycle[]>([]);
 const [connected,setConnected]=useState(false);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [filter,setFilter]=useState<"all"|"renewals"|"attention">("all");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{const response=await connectFetch<{items:Lifecycle[];connected:boolean}>(`/api/connect/workspaces/${encodeURIComponent(tenantId)}/lifecycle`);
   setItems(response.items||[]);setConnected(response.connected);
  }catch(e){setError(e instanceof Error?e.message:"Unable to load learner lifecycle.");}
  finally{setLoading(false);}
 },[tenantId]);
 useEffect(()=>{void load();},[load,refreshKey]);
 const active=items.filter(x=>x.enrollment_status==="active").length;
 const renewals=items.filter(x=>x.renewal_active&&x.renewal_status==="open").length;
 const paymentAttention=items.filter(x=>x.payment_attention===true).length;
 const displayed=useMemo(()=>items.filter(x=>filter==="all"||(filter==="renewals"?x.renewal_active&&x.renewal_status!=="dismissed":x.payment_attention===true)),[items,filter]);
 async function mark(enrollmentId:string,status:string){
  setBusy(enrollmentId);setError("");
  try{await connectFetch(`/api/connect/workspaces/${encodeURIComponent(tenantId)}/lifecycle`,{
   method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({enrollmentId,status})
  });await load();}
  catch(e){setError(e instanceof Error?e.message:"Unable to update renewal.");}
  finally{setBusy(null);}
 }
 return <div className="cx-pipeline-stack">
  <section className="cx-panel cx-panel-full">
   <div className="cx-panel-header"><div><h2>Learner lifecycle & renewals</h2><p>Portal-owned learning and billing indicators, refreshed periodically. Connect manages the follow-up conversation.</p></div>
    <button type="button" className="cx-secondary" onClick={()=>void load()} disabled={loading}>Refresh</button></div>
   {!connected&&!loading?<div className="cx-empty">Connect your Learning Portal to see confirmed enrolments here.</div>:<>
    <div className="cx-summary-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:18}}>
     <button className="cx-secondary" type="button" onClick={()=>setFilter("all")} aria-pressed={filter==="all"}><strong>{items.length}</strong> Linked learners · {active} active</button>
     <button className="cx-secondary" type="button" onClick={()=>setFilter("renewals")} aria-pressed={filter==="renewals"}><strong>{renewals}</strong> Open renewal signals</button>
     {items.some(x=>x.payment_attention!==null)&&<button className="cx-secondary" type="button" onClick={()=>setFilter("attention")} aria-pressed={filter==="attention"}><strong>{paymentAttention}</strong> Payment attention</button>}
    </div>
    {error&&<p role="alert" style={{color:"#b42318"}}>{error}</p>}
    {loading?<p>Loading lifecycle summaries…</p>:displayed.length===0?<p className="cx-empty">{filter==="all"?"No confirmed Portal enrolments have been linked yet.":"No learners match this filter."}</p>:
     <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:14}}>
      {displayed.map(item=><article key={item.enrollment_id} className="cx-panel" style={{padding:18,margin:0}}>
       <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"start"}}><div><strong>{people.find(person=>person.id===item.learner_person_id)?.full_name||"Linked learner"}</strong><p>{item.course_title}</p></div><span>{item.enrollment_status.replaceAll("_"," ")}</span></div>
       <p style={{margin:"8px 0"}}>Sessions completed: {item.sessions_completed}{item.planned_sessions!==null?` / ${item.planned_sessions}`:""} · Attendance recorded: {item.attendance_count}</p>
       {item.progress_percent!==null&&<p>Learning progress: {Math.round(item.progress_percent)}%</p>}
       {item.package_name&&<p>Package: {item.package_name}{item.billing_model?` · ${item.billing_model.replaceAll("_"," ")}`:""}</p>}
       {item.paid_session_balance!==null&&<p>Paid session balance: {item.paid_session_balance}</p>}
       {item.package_end_date&&<p>Package end: {item.package_end_date}</p>}
       {item.payment_attention===true&&<p style={{color:"#a35c13"}}>Payment follow-up needed — check the Portal finance ledger.</p>}
       {item.renewal_reason&&item.renewal_active&&<div style={{padding:"10px 0",borderTop:"1px solid #dce8ef"}}>
        <strong>{reasonLabel[item.renewal_reason]||item.renewal_reason.replaceAll("_"," ")}</strong>
        <p>Status: {item.renewal_status||"open"}. Follow up in Connect; record actual package changes in Portal.</p>
        {canWrite&&<div style={{display:"flex",flexWrap:"wrap",gap:8}}>
         {item.renewal_status!=="contacted"&&<button type="button" className="cx-secondary" disabled={busy!==null} onClick={()=>void mark(item.enrollment_id,"contacted")}>Mark contacted</button>}
         {item.renewal_status!=="dismissed"&&<button type="button" className="cx-secondary" disabled={busy!==null} onClick={()=>void mark(item.enrollment_id,"dismissed")}>Dismiss</button>}
         {item.renewal_status!=="open"&&<button type="button" className="cx-secondary" disabled={busy!==null} onClick={()=>void mark(item.enrollment_id,"open")}>Reopen</button>}
        </div>}
       </div>}
      </article>)}
     </div>}
   </>}
  </section>
 </div>;
}
