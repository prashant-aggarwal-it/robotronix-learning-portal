"use client";
import {useMemo,useState} from "react";
import type {ConnectTask,ConnectPerson,ConnectOpportunity} from "@/features/connect/api/client";
import styles from "./ConnectFollowupsBoard.module.css";
import {FollowupWeekWidget} from "./ConnectDataWidgets";

type Filter="open"|"overdue"|"today"|"upcoming"|"undated"|"completed"|"all";
type Props={
 tasks:ConnectTask[];people:ConnectPerson[];opportunities:ConnectOpportunity[];
 canWrite:boolean;busy:boolean;onComplete:(taskId:string)=>void;
 onOpenContact:(personId:string)=>void;onOpenOpportunity:(personId:string,opportunityId:string)=>void;
};
const completed=(t:ConnectTask)=>t.status==="done"||t.status==="completed";
const timeValue=(date:string|null)=>date?new Date(date).getTime():Number.POSITIVE_INFINITY;
function dayKey(date:Date){const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",day:"2-digit",month:"2-digit",year:"numeric"}).formatToParts(date);
 const part=(type:string)=>parts.find(p=>p.type===type)?.value||"";
 return part("year")+"-"+part("month")+"-"+part("day");
}
function dateLabel(date:string|null){if(!date)return "No due date";
 const d=new Date(date);if(Number.isNaN(d.getTime()))return "Invalid due date";
 return d.toLocaleString("en-IN",{timeZone:"Asia/Kolkata",day:"numeric",month:"short",hour:"numeric",minute:"2-digit"});
}
function state(t:ConnectTask,today:string):Filter{
 if(completed(t))return "completed";
 if(!t.due_at||!Number.isFinite(Date.parse(t.due_at)))return "undated";
 const due=dayKey(new Date(t.due_at));
 return due<today?"overdue":due===today?"today":"upcoming";
}
const labels:Record<Filter,string>={all:"All",open:"Open",overdue:"Overdue",today:"Due today",upcoming:"Upcoming",undated:"No due date",completed:"Completed"};
export function ConnectFollowupsBoard({tasks,people,opportunities,canWrite,busy,onComplete,onOpenContact,onOpenOpportunity}:Props){
 const [filter,setFilter]=useState<Filter>("open");
 const [search,setSearch]=useState("");
 const [sort,setSort]=useState<"due"|"newest">("due");
 const [selectedDay,setSelectedDay]=useState<string|null>(null);
 const now=new Date(),today=dayKey(now);
 const peopleById=useMemo(()=>new Map(people.map(p=>[p.id,p])),[people]);
 const opportunitiesById=useMemo(()=>new Map(opportunities.map(o=>[o.id,o])),[opportunities]);
 const personFor=(t:ConnectTask)=>peopleById.get(t.person_id||opportunitiesById.get(t.opportunity_id||"")?.contact_id||"");
 const counts=useMemo(()=>{
  const out:Record<Filter,number>={all:tasks.length,open:0,overdue:0,today:0,upcoming:0,undated:0,completed:0};
  for(const task of tasks){const status=state(task,today);out[status]++;if(status!=="completed")out.open++;}
  return out;
 },[tasks,today]);
 const filtered=tasks.filter(t=>{
  if(selectedDay&&(!t.due_at||!Number.isFinite(Date.parse(t.due_at))||dayKey(new Date(t.due_at))!==selectedDay))return false;
  const status=state(t,today);
  if(filter==="open"&&status==="completed")return false;
  if(filter!=="open"&&filter!=="all"&&status!==filter)return false;
  const q=search.trim().toLowerCase();
  if(!q)return true;
  const contact=personFor(t),opportunity=opportunitiesById.get(t.opportunity_id||"");
  return [t.title,contact?.full_name,opportunity?.title,...(contact?.contact_methods.map(m=>m.value)||[])].some(x=>(x||"").toLowerCase().includes(q));
 }).sort((a,b)=>{
  if(sort==="newest")return timeValue(b.created_at)-timeValue(a.created_at);
  const rank=(t:ConnectTask)=>({overdue:0,today:1,upcoming:2,undated:3,completed:4,all:5,open:5})[state(t,today)];
  const diff=rank(a)-rank(b);return diff||timeValue(a.due_at)-timeValue(b.due_at);
 });
 const filters:Filter[]=["open","overdue","today","upcoming","completed"];
 return <section className={styles.board} aria-label="Team follow-ups">
  <div className={styles.heading}><div><h2>Team follow-ups</h2><p>Follow up with customers, track due dates and close completed work</p></div>
   <span className={styles.total}>{counts.open} open tasks</span></div>
  <div className={styles.summary}>
   {(["overdue","today","upcoming","completed"] as Filter[]).map(f=><button key={f} type="button" className={filter===f?styles.summaryActive:styles.summaryItem} data-tone={f} onClick={()=>setFilter(filter===f?"open":f)} aria-pressed={filter===f}>
    <strong>{counts[f]}</strong><span>{labels[f]}</span>
   </button>)}
  </div>
  <FollowupWeekWidget tasks={tasks} onSelectDay={setSelectedDay} selectedDay={selectedDay}/>
  <div className={styles.toolbar}>
   <div className={styles.tabs} role="group" aria-label="Follow-up filter">
    {filters.map(f=><button key={f} type="button" className={filter===f?styles.tabActive:styles.tab} onClick={()=>setFilter(f)} aria-pressed={filter===f}>{labels[f]}</button>)}
   </div>
   <div className={styles.tools}><label className={styles.search}><span className={styles.srOnly}>Search follow-ups</span><input type="search" placeholder="Search task or customer…" value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search follow-ups"/></label>
    <select aria-label="Sort follow-ups" value={sort} onChange={e=>setSort(e.target.value==="newest"?"newest":"due")}><option value="due">Due date</option><option value="newest">Recently created</option></select>
   </div>
  </div>
  <p className={styles.count}>{filtered.length} of {tasks.length} loaded tasks shown{filter==="open"?" · Open tasks":filter!=="all"?" · "+labels[filter]:""}{search?" · Search results":""}</p>
  <div className={styles.list}>
   {filtered.length===0?<div className={styles.empty}><strong>{tasks.length?"No matching follow-ups":"No follow-ups yet"}</strong><p>{tasks.length?"Try another filter or search term.":"Open a contact to schedule your first follow-up."}</p>{filter!=="open"&&<button type="button" onClick={()=>{setFilter("open");setSearch("");}}>Show open tasks</button>}</div>:
    filtered.map(t=>{
     const status=state(t,today),contact=personFor(t),opportunity=opportunitiesById.get(t.opportunity_id||"");
     return <article key={t.id} className={styles.task}>
      <span className={status==="completed"?styles.doneSymbol:styles.symbol} aria-hidden="true">{status==="completed"?"✓":"○"}</span>
      <div className={styles.detail}><strong>{contact?.full_name||opportunity?.title||t.title}</strong>
       <span className={styles.description}>{contact||opportunity?t.title:"No customer linked · "+t.title}</span>
       {opportunity&&contact&&<small className={styles.opportunity}>{opportunity.title}</small>}
      </div>
      <div className={styles.due}><span className={status==="overdue"?styles.overdue:status==="today"?styles.today:status==="completed"?styles.complete:styles.status}>{labels[status]}</span>
       <time dateTime={t.due_at||undefined}>{dateLabel(t.due_at)}</time></div>
      <div className={styles.actions}>
       {contact&&<button className={styles.secondary} type="button" onClick={()=>onOpenContact(contact.id)}>Contact</button>}
       {contact&&opportunity&&<button className={styles.secondary} type="button" onClick={()=>onOpenOpportunity(contact.id,opportunity.id)}>Admission</button>}
       {canWrite&&!completed(t)&&<button className={styles.primary} type="button" disabled={busy} onClick={()=>onComplete(t.id)}>Mark done</button>}
      </div>
     </article>;
    })}
  </div>
  <p className={styles.footnote}>Dates shown in India time (IST). The list includes the latest {tasks.length} loaded tasks.</p>
 </section>;
}
