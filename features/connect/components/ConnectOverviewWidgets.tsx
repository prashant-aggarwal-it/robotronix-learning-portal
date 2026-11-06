"use client";
import {useMemo} from "react";
import type {ConnectInquiry,ConnectOverview,ConnectOpportunity,ConnectTask} from "@/features/connect/api/client";
import type {Section} from "@/features/connect/model";

type Props={
 overview:ConnectOverview;inquiries:ConnectInquiry[];opportunities:ConnectOpportunity[];
 tasks:ConnectTask[];advanced:boolean;onNavigate:(section:Section)=>void;
};
const colors=["#1589d0","#16a6a0","#f3a74b","#607de7","#e47d9e","#8a9cae"];
function nameSource(value:string){return value.trim().replace(/[_-]+/g," ").replace(/\b\w/g,x=>x.toUpperCase())||"Unknown";}
export function ConnectOverviewWidgets({overview,inquiries,opportunities,tasks,advanced,onNavigate}:Props){
 const sourceData=useMemo(()=>{
  const bySource=new Map<string,number>();
  for(const item of inquiries){const source=nameSource(item.source||"Unknown");bySource.set(source,(bySource.get(source)||0)+1);}
  return [...bySource].sort((a,b)=>b[1]-a[1]).slice(0,6);
 },[inquiries]);
 const stageData=useMemo(()=>{
  const byStage=new Map<string,number>();
  for(const item of opportunities){const label=item.stage_name||"Unassigned";byStage.set(label,(byStage.get(label)||0)+1);}
  return [...byStage].sort((a,b)=>b[1]-a[1]).slice(0,6);
 },[opportunities]);
 const totalSources=sourceData.reduce((n,entry)=>n+entry[1],0);
 const today=new Date().toDateString();
 const todayTasks=tasks.filter(t=>t.due_at&&new Date(t.due_at).toDateString()===today&&t.status!=="completed").length;
 const metrics=[
  {label:"New enquiries today",value:overview.newEnquiries,detail:"Captured today",icon:"✉",target:"enquiries" as Section},
  {label:"Active admissions",value:overview.openOpportunities,detail:"Open opportunities",icon:"▥",target:(advanced?"pipeline":"enquiries") as Section},
  {label:"Overdue follow-ups",value:overview.overdueTasks,detail:"Need your attention",icon:"◷",target:"followups" as Section,warning:true},
  {label:"Admissions won",value:overview.wonOpportunities,detail:"Completed conversions",icon:"✓",target:(advanced?"pipeline":"enquiries") as Section}
 ];
 return <div className="cx-insights">
  <div className="cx-insights-intro"><div><span className="cx-kicker">AT A GLANCE</span><h2>Your business, clearly in view</h2><p>Real enquiries, admissions and next actions from this workspace.</p></div><span className="cx-live-pill"><span/> Workspace data</span></div>
  <div className="cx-insight-metrics">
   {metrics.map((m,i)=><button key={m.label} className={"cx-insight-metric "+(m.warning&&m.value>0?"cx-insight-urgent":"")} type="button" onClick={()=>onNavigate(m.target)}>
    <span className="cx-insight-metric-top"><span className={"cx-insight-icon cx-insight-color-"+i} aria-hidden="true">{m.icon}</span><span className="cx-insight-open" aria-hidden="true">↗</span></span>
    <span className="cx-insight-number">{m.value.toLocaleString()}</span><span className="cx-insight-label">{m.label}</span><small>{m.detail}</small>
   </button>)}
  </div>
  <div className="cx-insight-panels">
   <section className="cx-insight-panel"><div className="cx-insight-panel-heading"><div><h3>Where enquiries come from</h3><p>Breakdown of the latest {inquiries.length} loaded enquiries</p></div><button type="button" onClick={()=>onNavigate("enquiries")}>Explore ↗</button></div>
    {totalSources===0?<p className="cx-insight-empty">No enquiries captured yet. Source insights will appear here as enquiries arrive.</p>:<>
     <div className="cx-source-bar" aria-label="Enquiry source distribution">{sourceData.map(([source,count],i)=><span key={source} title={source+": "+count} style={{width:(count/totalSources*100)+"%",background:colors[i]}}/>)}</div>
     <div className="cx-source-rows">{sourceData.map(([source,count],i)=><div className="cx-source-row" key={source}><span className="cx-source-name"><i style={{background:colors[i]}}/>{source}</span><div className="cx-source-track"><span style={{width:(count/totalSources*100)+"%",background:colors[i]}}/></div><strong>{count}</strong><small>{Math.round(count/totalSources*100)}%</small></div>)}</div>
    </>}
   </section>
   <section className="cx-insight-panel"><div className="cx-insight-panel-heading"><div><h3>Today's priorities</h3><p>Stay ahead of your next actions</p></div><button type="button" onClick={()=>onNavigate("followups")}>View tasks ↗</button></div>
    <button type="button" className="cx-priority-row" onClick={()=>onNavigate("followups")}><span className="cx-priority-symbol cx-insight-color-2">◷</span><span><strong>{overview.overdueTasks} overdue</strong><small>Follow-ups needing action</small></span><span aria-hidden="true">›</span></button>
    <button type="button" className="cx-priority-row" onClick={()=>onNavigate("followups")}><span className="cx-priority-symbol cx-insight-color-0">☑</span><span><strong>{todayTasks} due today</strong><small>From the latest {tasks.length} loaded tasks</small></span><span aria-hidden="true">›</span></button>
    <button type="button" className="cx-priority-row" onClick={()=>onNavigate(advanced?"calendar":"followups")}><span className="cx-priority-symbol cx-insight-color-1">▦</span><span><strong>{overview.scheduledAppointments} upcoming appointments</strong><small>Demo and counselling schedule</small></span><span aria-hidden="true">›</span></button>
   </section>
  </div>
  {advanced&&<section className="cx-insight-panel cx-stages-panel"><div className="cx-insight-panel-heading"><div><h3>Admissions pipeline snapshot</h3><p>Current stages across the latest {opportunities.length} loaded opportunities</p></div><button type="button" onClick={()=>onNavigate("pipeline")}>Open pipeline ↗</button></div>
   {stageData.length===0?<p className="cx-insight-empty">Your pipeline stages will appear here when opportunities are added.</p>:<div className="cx-stage-grid">{stageData.map(([stage,count],i)=><div className="cx-stage-tile" key={stage}><span className="cx-stage-dot" style={{background:colors[i]}}/><span>{stage}</span><strong>{count}</strong></div>)}</div>}
  </section>}
 </div>;
}
