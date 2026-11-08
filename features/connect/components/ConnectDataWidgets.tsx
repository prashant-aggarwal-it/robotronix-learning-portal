"use client";
import {useMemo,useState} from "react";
import type {ConnectPipeline,ConnectOpportunity,ConnectTask} from "@/features/connect/api/client";
import {channelColor,stageTone,toneColor} from "../connect-palette";

const label=(s:string)=>s.replace(/[_-]+/g," ").replace(/\b\w/g,c=>c.toUpperCase());
export function PipelineVisual({pipelines,opportunities,onOpen}:{pipelines:ConnectPipeline[];opportunities:ConnectOpportunity[];onOpen?:(id:string)=>void}){
 const [pipelineId,setPipelineId]=useState("all");
 const relevant=opportunities.filter(o=>pipelineId==="all"||o.pipeline_id===pipelineId);
 const open=relevant.filter(o=>o.outcome==="open").length,won=relevant.filter(o=>o.outcome==="won").length,lost=relevant.filter(o=>o.outcome==="lost").length;
 const stages=pipelines.filter(p=>pipelineId==="all"||p.id===pipelineId).flatMap(p=>p.stages.slice().sort((a,b)=>a.order-b.order).map(stage=>({...stage,pipeline:p.name,count:relevant.filter(o=>o.stage_id===stage.id).length})));
 const max=Math.max(1,...stages.map(s=>s.count));
 return <section className="cx-widget cx-pipeline-visual" aria-label="Admissions stage visualization">
  <header className="cx-widget-head"><div><h3>Admissions at a glance</h3><p>Current opportunities by stage · Not a historical conversion funnel</p></div>
   {pipelines.length>1&&<select aria-label="Select pipeline to visualize" value={pipelineId} onChange={e=>setPipelineId(e.target.value)}><option value="all">All pipelines</option>{pipelines.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>}
  </header>
  <div className="cx-widget-kpis"><span><strong>{relevant.length}</strong>Total opportunities</span><span><strong>{open}</strong>Open</span><span><strong>{won}</strong>Won</span><span><strong>{lost}</strong>Lost</span></div>
  {stages.length===0?<p className="cx-widget-empty">Create an admissions pipeline to visualize its stages.</p>:<div className="cx-widget-stages">
   {stages.map(stage=><button type="button" key={stage.id} className="cx-widget-stage" onClick={()=>{const opportunity=relevant.find(o=>o.stage_id===stage.id);if(opportunity&&onOpen)onOpen(opportunity.id);}} disabled={!stage.count||!onOpen} title={stage.pipeline+" · "+stage.name+": "+stage.count+" current opportunities"}>
    <span className="cx-widget-stage-top"><span>{stage.name}</span><strong>{stage.count}</strong></span>
    <span className="cx-widget-track"><span style={{width:stage.count/max*100+"%",background:toneColor(stageTone(stage.name,stage.outcome))}}/></span>
    {pipelineId==="all"&&pipelines.length>1&&<small>{stage.pipeline}</small>}
   </button>)}
  </div>}
 </section>;
}

type ReportGraphic={summary:{inquiries:number;opportunities:number;won:number;conversionRate:number|null};sources:Array<{source:string;inquiries:number;opportunities:number;won:number;conversionRate:number|null;revenue:number|null;spend:number|null}>;stageJourney:Array<{stageId:string;pipeline:string;stage:string;reached:number;cohort:number;reachPercent:number|null}>};
export function ReportVisuals({report}:{report:ReportGraphic}){
 const [metric,setMetric]=useState<"inquiries"|"opportunities"|"won">("inquiries");
 const entries=report.sources.slice().sort((a,b)=>b[metric]-a[metric]).slice(0,8);
 const max=Math.max(1,...entries.map(s=>s[metric]));
 const stages=report.stageJourney.slice().sort((a,b)=>b.cohort-a.cohort).slice(0,8);
 return <div className="cx-widget-double" aria-label="Visual reporting">
  <section className="cx-widget"><header className="cx-widget-head"><div><h3>Channel performance</h3><p>Comparison for the selected reporting period</p></div>
   <select value={metric} onChange={e=>setMetric(e.target.value==="won"?"won":e.target.value==="opportunities"?"opportunities":"inquiries")} aria-label="Channel performance metric"><option value="inquiries">Enquiries</option><option value="opportunities">Admissions</option><option value="won">Won</option></select>
  </header>
  {entries.length===0?<p className="cx-widget-empty">No channel activity recorded for this period.</p>:<div className="cx-widget-bars">{entries.map(s=><div key={s.source} className="cx-widget-bar-row">
   <span title={s.source}>{label(s.source)}</span><span className="cx-widget-track"><span style={{width:s[metric]/max*100+"%",background:channelColor(s.source)}}/></span><strong>{s[metric]}</strong>
  </div>)}</div>}
  <p className="cx-widget-caption">Changing the metric compares recorded counts, not predicted results.</p>
  </section>
  <section className="cx-widget"><header className="cx-widget-head"><div><h3>Admissions stage reach</h3><p>Recorded stage history for the selected creation cohort</p></div></header>
   {stages.length===0?<p className="cx-widget-empty">No stage history yet. Create admissions and move them through the pipeline to populate this chart.</p>:
    <div className="cx-widget-bars">{stages.map(s=><div key={s.stageId} className="cx-widget-bar-row">
     <span title={s.pipeline+" · "+s.stage}>{s.stage}</span><span className="cx-widget-track"><span style={{width:Math.min(100,Math.max(0,s.reachPercent||0))+"%",background:toneColor(stageTone(s.stage))}}/></span>
     <strong>{s.reached}/{s.cohort}</strong>
    </div>)}</div>}
   <p className="cx-widget-caption">Reached stages, not stage-to-stage conversion. Cohorts and pipeline filters apply.</p>
  </section>
 </div>;
}

function istDate(input:Date){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(input);}
function isoDay(input:Date){const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(input);const p=(key:string)=>parts.find(x=>x.type===key)?.value||"";return p("year")+"-"+p("month")+"-"+p("day");}
const isDone=(t:ConnectTask)=>t.status==="done"||t.status==="completed";
export function FollowupWeekWidget({tasks,onSelectDay,selectedDay}:{tasks:ConnectTask[];onSelectDay:(day:string|null)=>void;selectedDay:string|null}){
 const today=isoDay(new Date());
 const days=useMemo(()=>{
  const todayUtc=Date.parse(today+"T00:00:00Z");
  return Array.from({length:7},(_,i)=>{
   const date=new Date(todayUtc+i*86400000),key=date.toISOString().slice(0,10);
   const subset=tasks.filter(t=>t.due_at&&Number.isFinite(Date.parse(t.due_at))&&isoDay(new Date(t.due_at))===key);
   return {key,label:date.toLocaleDateString("en-IN",{weekday:"short",day:"numeric",timeZone:"UTC"}),open:subset.filter(t=>!isDone(t)).length,completed:subset.filter(isDone).length};
  });
 },[tasks,today]);
 const max=Math.max(1,...days.map(d=>d.open+d.completed));
 const complete=tasks.filter(isDone).length,total=tasks.length;
 return <section className="cx-widget cx-widget-workload" aria-label="Seven day follow-up workload">
  <header className="cx-widget-head"><div><h3>7-day workload</h3><p>Tasks due from today · India time (IST)</p></div><span className="cx-widget-tag">{complete}/{total} completed in loaded tasks</span></header>
  <div className="cx-widget-week">{days.map(d=><button type="button" key={d.key} aria-pressed={selectedDay===d.key} className={"cx-widget-week-day "+(selectedDay===d.key?"is-selected":"")} onClick={()=>onSelectDay(selectedDay===d.key?null:d.key)} title={d.label+": "+d.open+" open, "+d.completed+" completed"}>
    <strong>{d.open+d.completed}</strong><span className="cx-widget-week-columns"><i style={{height:d.open/max*65+"px"}}/><i style={{height:d.completed/max*65+"px"}}/></span><small>{d.label}</small>
  </button>)}</div>
  <div className="cx-widget-legend"><span><i style={{background:"#1392c8"}}/>Open due</span><span><i style={{background:"#31b49e"}}/>Completed</span>{selectedDay&&<button type="button" onClick={()=>onSelectDay(null)}>Clear day filter ×</button>}</div>
 </section>;
}

type ThreadPoint={id:string;provider:string;unreadCount:number;lastDirection:string|null;lastAt:string;status:string};
export function CommunicationPulse({threads,onSelectProvider}:{threads:ThreadPoint[];onSelectProvider:(provider:string)=>void}){
 const stats=useMemo(()=>{
  const by=new Map<string,{provider:string;total:number;unread:number;needsReply:number}>();
  for(const t of threads){const key=t.provider.toLowerCase();const old=by.get(key)||{provider:key,total:0,unread:0,needsReply:0};
   old.total++;old.unread+=t.unreadCount;old.needsReply+=t.lastDirection==="inbound"?1:0;by.set(key,old);}
  return [...by.values()].sort((a,b)=>b.total-a.total);
 },[threads]);
 const unread=threads.reduce((sum,t)=>sum+t.unreadCount,0);
 const needsReply=threads.filter(t=>t.lastDirection==="inbound").length;
 const max=Math.max(1,...stats.map(s=>s.total));
 return <section className="cx-widget cx-widget-pulse" aria-label="Communication activity">
  <header className="cx-widget-head"><div><h3>Inbox pulse</h3><p>Current loaded conversations across connected channels</p></div><span className="cx-widget-tag">{threads.length} conversations</span></header>
  <div className="cx-widget-mini-kpis"><span><strong>{unread}</strong>Unread messages</span><span><strong>{needsReply}</strong>Last message inbound</span></div>
  {stats.length===0?<p className="cx-widget-empty">No conversations available yet.</p>:<div className="cx-widget-pulse-channels">
   {stats.map(s=><button type="button" key={s.provider} onClick={()=>onSelectProvider(s.provider)} className="cx-widget-pulse-channel">
    <span className="cx-widget-pulse-channel-label">{label(s.provider)}<strong>{s.total}</strong></span>
    <span className="cx-widget-track"><span style={{background:channelColor(s.provider),width:s.total/max*100+"%"}}/></span>
    <small>{s.needsReply} last inbound · {s.unread} unread</small>
   </button>)}
  </div>}
  <p className="cx-widget-caption">Needs reply is approximated from the last message direction. Actual response-time metrics require full message-event analysis.</p>
 </section>;
}
