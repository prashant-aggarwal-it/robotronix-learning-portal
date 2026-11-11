"use client";
import {ConnectEnquiryVisualizations} from "./ConnectEnquiryVisualizations";
import type {ReactNode} from "react";
import {stageTone,toneColor} from "../connect-palette";
import type {ConnectAppointment,ConnectPerson,ConnectPipeline,ConnectInquiry,ConnectOverview,ConnectOpportunity,ConnectTask} from "@/features/connect/api/client";
import type {Section} from "@/features/connect/model";

type Props={
 overview:ConnectOverview;inquiries:ConnectInquiry[];opportunities:ConnectOpportunity[];
 appointments:ConnectAppointment[];people:ConnectPerson[];pipelines:ConnectPipeline[];
 tasks:ConnectTask[];advanced:boolean;onNavigate:(section:Section)=>void;
 onSelectSource?:(source:string)=>void;
 onOpenEnquiry:(enquiry:ConnectInquiry)=>void;
 onViewAllEnquiries:()=>void;
 attentionWidget?:ReactNode;
};
function nameSource(value:string){return value.trim().replace(/[_-]+/g," ").replace(/\b\w/g,x=>x.toUpperCase())||"Unknown";}
export function ConnectOverviewWidgets({overview,inquiries,opportunities,appointments,people,pipelines,tasks,advanced,onNavigate,onSelectSource,onOpenEnquiry,onViewAllEnquiries,attentionWidget}:Props){
 const recent=[...inquiries].sort((a,b)=>Date.parse(b.received_at)-Date.parse(a.received_at)).slice(0,3);
 const indiaDay=(value:string)=>new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value));
 const today=indiaDay(new Date().toISOString());
 const todayTasks=tasks.filter(t=>t.due_at&&indiaDay(t.due_at)===today&&!["completed","done","cancelled"].includes(t.status)).length;
 const now=Date.now();
 const upcoming=appointments.filter(a=>a.status==="scheduled"&&Number.isFinite(Date.parse(a.starts_at))&&Date.parse(a.starts_at)>=now)
  .sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)).slice(0,3);
 const peopleById=new Map(people.map(p=>[p.id,p.full_name]));
 const stageRows=pipelines.flatMap(p=>p.stages.map(stage=>({...stage,pipeline:p.name,count:opportunities.filter(o=>o.stage_id===stage.id).length})))
  .sort((a,b)=>a.order-b.order);
 const appointmentDate=(value:string)=>new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit"}).format(new Date(value));
 const appointmentMonth=(value:string)=>new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",month:"short"}).format(new Date(value));
 const appointmentTime=(value:string)=>new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",hour:"numeric",minute:"2-digit"}).format(new Date(value));
 const upcomingName=(item:ConnectAppointment)=>peopleById.get(item.person_id||"")||"Customer not linked";
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
  <div className="cx-insight-panels cx-overview-dashboard-grid">
    <div className="cx-overview-hero-chart"><ConnectEnquiryVisualizations inquiries={inquiries} onSelectSource={onSelectSource}/></div>
    <div className="cx-overview-duo cx-overview-operations">
      <section className="cx-insight-panel cx-overview-actions-panel"><div className="cx-insight-panel-heading"><div><h3>Action required</h3><p>Follow-ups and scheduled activities</p></div><button type="button" onClick={()=>onNavigate("followups")}>View tasks ↗</button></div>
     <button type="button" className="cx-priority-row" onClick={()=>onNavigate("followups")}><span className="cx-priority-symbol cx-insight-color-2">◷</span><span><strong>{overview.overdueTasks} overdue</strong><small>Follow-ups needing action</small></span><span aria-hidden="true">›</span></button>
     <button type="button" className="cx-priority-row" onClick={()=>onNavigate("followups")}><span className="cx-priority-symbol cx-insight-color-0">☑</span><span><strong>{todayTasks} due today</strong><small>From {tasks.length} loaded tasks</small></span><span aria-hidden="true">›</span></button>
     <button type="button" className="cx-priority-row" onClick={()=>onNavigate("calendar")}><span className="cx-priority-symbol cx-insight-color-1">▦</span><span><strong>{overview.scheduledAppointments} upcoming appointments</strong><small>Demo and counselling schedule</small></span><span aria-hidden="true">›</span></button>
    </section>
      <section className="cx-insight-panel cx-overview-schedule" aria-label="Upcoming appointment schedule">
     <div className="cx-insight-panel-heading"><div><h3>Next appointments</h3><p>Next three scheduled sessions · IST</p></div><button type="button" onClick={()=>onNavigate("calendar")}>Calendar ↗</button></div>
     {upcoming.length===0?<div className="cx-overview-widget-empty"><span aria-hidden="true">▦</span><p>No upcoming appointments. Schedule a demo or consultation from Calendar.</p><button type="button" onClick={()=>onNavigate("calendar")}>Open calendar ↗</button></div>:
      <div className="cx-overview-appointments">{upcoming.map(a=><button key={a.id} type="button" className="cx-overview-appointment" onClick={()=>onNavigate("calendar")} aria-label={"Open Calendar for "+a.title}>
       <span className="cx-overview-appointment-date"><strong>{appointmentDate(a.starts_at)}</strong><small>{appointmentMonth(a.starts_at)}</small></span>
       <span className="cx-overview-appointment-info"><strong>{a.title}</strong><small>{appointmentTime(a.starts_at)} · {upcomingName(a)} · {nameSource(a.kind)}</small></span><span className="cx-overview-row-arrow" aria-hidden="true">›</span>
      </button>)}</div>}
    </section>
    </div>
    {advanced&&<div className="cx-overview-wide-pipeline"><section className="cx-insight-panel cx-overview-pipeline" aria-label="Admissions pipeline snapshot">
     <div className="cx-insight-panel-heading"><div><h3>Pipeline snapshot</h3><p>Current admissions by stage</p></div><button type="button" onClick={()=>onNavigate("pipeline")}>View pipeline ↗</button></div>
     {stageRows.length>0&&<div className="cx-overview-stage-summary"><span><strong>{stageRows.reduce((sum,stage)=>sum+stage.count,0)}</strong> opportunities in current stages</span><span>{stageRows.filter(stage=>stage.count>0).length} active stages</span></div>}
     {stageRows.length===0?<div className="cx-overview-widget-empty"><p>No admissions in the loaded pipelines.</p><button type="button" onClick={()=>onNavigate("pipeline")}>View admissions ↗</button></div>:
      <div className="cx-overview-stage-list">{stageRows.map(stage=><button type="button" key={stage.id} onClick={()=>onNavigate("pipeline")} title={stage.pipeline+" · "+stage.name}>
       <span className="cx-overview-stage-dot" style={{background:toneColor(stageTone(stage.name,stage.outcome))}} aria-hidden="true"/>
       <span className="cx-overview-stage-label">{stage.name}</span><strong>{stage.count}</strong><small>{stageRows.reduce((sum,row)=>sum+row.count,0)?Math.round(stage.count/stageRows.reduce((sum,row)=>sum+row.count,0)*100):0}%</small>
      </button>)}</div>}
    </section></div>}
    <div className={"cx-overview-duo cx-overview-people"+(!attentionWidget?" cx-overview-solo":"")}>
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
      {attentionWidget}
    </div>
  </div>
 </div>;
}
