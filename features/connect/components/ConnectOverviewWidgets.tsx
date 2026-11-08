"use client";
import {ConnectEnquiryVisualizations} from "./ConnectEnquiryVisualizations";
import {stageTone} from "../connect-palette";
import type {ConnectInquiry,ConnectOverview,ConnectOpportunity,ConnectTask} from "@/features/connect/api/client";
import type {Section} from "@/features/connect/model";

type Props={
 overview:ConnectOverview;inquiries:ConnectInquiry[];opportunities:ConnectOpportunity[];
 tasks:ConnectTask[];advanced:boolean;onNavigate:(section:Section)=>void;
 onSelectSource?:(source:string)=>void;
 onOpenEnquiry:(enquiry:ConnectInquiry)=>void;
 onViewAllEnquiries:()=>void;
};
function nameSource(value:string){return value.trim().replace(/[_-]+/g," ").replace(/\b\w/g,x=>x.toUpperCase())||"Unknown";}
export function ConnectOverviewWidgets({overview,inquiries,tasks,advanced,onNavigate,onSelectSource,onOpenEnquiry,onViewAllEnquiries}:Props){
 const recent=[...inquiries].sort((a,b)=>Date.parse(b.received_at)-Date.parse(a.received_at)).slice(0,3);
 const indiaDay=(value:string)=>new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value));
 const today=indiaDay(new Date().toISOString());
 const todayTasks=tasks.filter(t=>t.due_at&&indiaDay(t.due_at)===today&&!["completed","done","cancelled"].includes(t.status)).length;
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
  <div className="cx-insight-panels">
   <ConnectEnquiryVisualizations inquiries={inquiries} onSelectSource={onSelectSource}/>
   <section className="cx-insight-panel"><div className="cx-insight-panel-heading"><div><h3>Action required</h3><p>Follow-ups and scheduled activities</p></div><button type="button" onClick={()=>onNavigate("followups")}>View tasks ↗</button></div>
    <button type="button" className="cx-priority-row" onClick={()=>onNavigate("followups")}><span className="cx-priority-symbol cx-insight-color-2">◷</span><span><strong>{overview.overdueTasks} overdue</strong><small>Follow-ups needing action</small></span><span aria-hidden="true">›</span></button>
    <button type="button" className="cx-priority-row" onClick={()=>onNavigate("followups")}><span className="cx-priority-symbol cx-insight-color-0">☑</span><span><strong>{todayTasks} due today</strong><small>From the latest {tasks.length} loaded tasks</small></span><span aria-hidden="true">›</span></button>
    <button type="button" className="cx-priority-row" onClick={()=>onNavigate(advanced?"calendar":"followups")}><span className="cx-priority-symbol cx-insight-color-1">▦</span><span><strong>{overview.scheduledAppointments} upcoming appointments</strong><small>Demo and counselling schedule</small></span><span aria-hidden="true">›</span></button>
   </section>
  </div>
  <section className="cx-insight-panel cx-overview-recent" aria-label="Recent enquiries">
   <div className="cx-insight-panel-heading"><div><h3>Latest enquiries</h3><p>The three most recent customer enquiries</p></div><button type="button" onClick={onViewAllEnquiries}>View all ↗</button></div>
   {recent.length===0?<p className="cx-insight-empty">No enquiries recorded yet. Create an enquiry to get started.</p>:
    <div className="cx-record-list">{recent.map(i=><button type="button" className="cx-record" key={i.id}
     aria-label={"Open enquiry for "+(i.contact_name||"new enquiry")}
     onClick={()=>onOpenEnquiry(i)}>
      <span className="cx-avatar" aria-hidden="true">{(i.contact_name||"Lead").trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()).join("")||"?"}</span>
      <span className="cx-record-main"><strong>{i.contact_name||"New enquiry"}</strong><small>{i.summary||nameSource(i.source)}</small></span>
      <span className="cx-record-end"><span className="cx-pill" data-tone={stageTone(i.stage_name,i.outcome)}>{i.stage_name||"New"}</span><small>{nameSource(i.source)} · {new Date(i.received_at).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</small></span>
    </button>)}</div>}
  </section>
 </div>;
}
