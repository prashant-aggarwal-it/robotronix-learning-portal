"use client";
import {useMemo} from "react";
import {ConnectEnquiryVisualizations} from "./ConnectEnquiryVisualizations";
import type {ConnectInquiry,ConnectOverview,ConnectOpportunity,ConnectTask} from "@/features/connect/api/client";
import type {Section} from "@/features/connect/model";

type Props={
 overview:ConnectOverview;inquiries:ConnectInquiry[];opportunities:ConnectOpportunity[];
 tasks:ConnectTask[];advanced:boolean;onNavigate:(section:Section)=>void;
 onSelectSource?:(source:string)=>void;
};
const colors=["#1589d0","#16a6a0","#f3a74b","#607de7","#e47d9e","#8a9cae"];
function nameSource(value:string){return value.trim().replace(/[_-]+/g," ").replace(/\b\w/g,x=>x.toUpperCase())||"Unknown";}
export function ConnectOverviewWidgets({overview,inquiries,opportunities,tasks,advanced,onNavigate,onSelectSource}:Props){
 const stageData=useMemo(()=>{
  const byStage=new Map<string,number>();
  for(const item of opportunities){const label=item.stage_name||"Unassigned";byStage.set(label,(byStage.get(label)||0)+1);}
  return [...byStage].sort((a,b)=>b[1]-a[1]).slice(0,6);
 },[opportunities]);
 const today=new Date().toDateString();
 const todayTasks=tasks.filter(t=>t.due_at&&new Date(t.due_at).toDateString()===today&&t.status!=="completed").length;
 const metrics=[
  {label:"New enquiries today",value:overview.newEnquiries,detail:"Captured today",icon:"✉",target:"enquiries" as Section},
  {label:"Open opportunities",value:overview.openOpportunities,detail:"Admissions in progress",icon:"▥",target:(advanced?"pipeline":"enquiries") as Section},
  {label:"Overdue follow-ups",value:overview.overdueTasks,detail:"Need your attention",icon:"◷",target:"followups" as Section,warning:true},
  {label:"Admissions won",value:overview.wonOpportunities,detail:"Completed conversions",icon:"✓",target:(advanced?"pipeline":"enquiries") as Section}
 ];
 return <div className="cx-insights">
  <div className="cx-insights-intro"><span className="cx-kicker">AT A GLANCE · WORKSPACE DATA</span></div>
  <div className="cx-insight-metrics">
   {metrics.map((m,i)=><button key={m.label} className={"cx-insight-metric "+(m.warning&&m.value>0?"cx-insight-urgent":"")} type="button" onClick={()=>onNavigate(m.target)}>
    <span className="cx-insight-metric-top"><span className={"cx-insight-icon cx-insight-color-"+i} aria-hidden="true">{m.icon}</span><span className="cx-insight-open" aria-hidden="true">↗</span></span>
    <span className="cx-insight-number">{m.value.toLocaleString()}</span><span className="cx-insight-label">{m.label}</span><small>{m.detail}</small>
   </button>)}
  </div>
  <section className="cx-insight-panel cx-overview-recent" aria-label="Recent enquiries">
   <div className="cx-insight-panel-heading"><div><h3>Recent enquiries</h3><p>Latest customer enquiries · {inquiries.length} loaded</p></div><button type="button" onClick={()=>onNavigate("enquiries")}>View all ↗</button></div>
   {inquiries.length===0?<p className="cx-insight-empty">No enquiries yet. Add your first enquiry to begin tracking prospects.</p>:
    <div className="cx-record-list">{inquiries.slice(0,5).map(i=><button type="button" className="cx-record" key={i.id} onClick={()=>onNavigate("enquiries")}>
     <span className="cx-avatar" aria-hidden="true">{(i.contact_name||"Lead").trim().split(/\\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()).join("")||"?"}</span>
     <span className="cx-record-main"><strong>{i.contact_name||"New enquiry"}</strong><small>{i.summary||nameSource(i.source)}</small></span>
     <span className="cx-record-end"><span className="cx-pill">{i.stage_name||nameSource(i.source)}</span><small>{new Date(i.received_at).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</small></span>
    </button>)}</div>}
  </section>
  <div className="cx-insight-panels">
   <ConnectEnquiryVisualizations inquiries={inquiries} onSelectSource={onSelectSource}/>
   <section className="cx-insight-panel"><div className="cx-insight-panel-heading"><div><h3>Action required</h3><p>Follow-ups and scheduled activities</p></div><button type="button" onClick={()=>onNavigate("followups")}>View tasks ↗</button></div>
    <button type="button" className="cx-priority-row" onClick={()=>onNavigate("followups")}><span className="cx-priority-symbol cx-insight-color-2">◷</span><span><strong>{overview.overdueTasks} overdue</strong><small>Follow-ups needing action</small></span><span aria-hidden="true">›</span></button>
    <button type="button" className="cx-priority-row" onClick={()=>onNavigate("followups")}><span className="cx-priority-symbol cx-insight-color-0">☑</span><span><strong>{todayTasks} due today</strong><small>From the latest {tasks.length} loaded tasks</small></span><span aria-hidden="true">›</span></button>
    <button type="button" className="cx-priority-row" onClick={()=>onNavigate(advanced?"calendar":"followups")}><span className="cx-priority-symbol cx-insight-color-1">▦</span><span><strong>{overview.scheduledAppointments} upcoming appointments</strong><small>Demo and counselling schedule</small></span><span aria-hidden="true">›</span></button>
   </section>
  </div>
  {advanced&&<section className="cx-insight-panel cx-stages-panel"><div className="cx-insight-panel-heading"><div><h3>Admissions pipeline</h3><p>{opportunities.length} loaded opportunities · stage summary</p></div><button type="button" onClick={()=>onNavigate("pipeline")}>Open pipeline ↗</button></div>
   {stageData.length===0?<p className="cx-pipeline-compact-empty">No opportunities yet. Open your pipeline to set up stages or add your first admission.</p>:<div className="cx-stage-grid">{stageData.map(([stage,count],i)=><div className="cx-stage-tile" key={stage}><span className="cx-stage-dot" style={{background:colors[i]}}/><span>{stage}</span><strong>{count}</strong></div>)}</div>}
  </section>}
 </div>;
}
