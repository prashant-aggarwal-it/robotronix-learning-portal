"use client";
import {useMemo,useState} from "react";
import type {ScheduleEvent} from "@/lib/types";
import {monthCells} from "@/lib/calendar";
import {formatShortDate,formatTime} from "@/components/experience/ExperienceCards";
import {CalendarActions} from "@/components/calendar/CalendarActions";
import {ZoomClassActions} from "@/components/ZoomClassActions";

const days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
function ym(d:Date){return{year:d.getFullYear(),month:d.getMonth()}}
function key(year:number,month:number){return year+"-"+String(month+1).padStart(2,"0")}
export function LearnerCalendar({events,role}:{events:ScheduleEvent[];role:"parent"|"student"}){
 const [showAllUpcoming,setShowAllUpcoming]=useState(false),[showHistory,setShowHistory]=useState(false);
 const now=new Date(),[mode,setMode]=useState<"month"|"week">("month"),[cursor,setCursor]=useState(()=>ym(now)),[selected,setSelected]=useState<string>(()=>new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit"}).format(now));
 const cells=useMemo(()=>monthCells(cursor.year,cursor.month),[cursor]);
 const monthKey=key(cursor.year,cursor.month);
 const visible=events.filter(e=>!["cancelled","rescheduled"].includes(e.status));
 const byDate=useMemo(()=>new Map(cells.map(d=>[d,visible.filter(e=>e.date===d).sort((a,b)=>a.startTime.localeCompare(b.startTime))])),[cells,visible]);
 const selectedEvents=byDate.get(selected)||[];
 const weekDates=useMemo(()=>{const anchor=new Date(`${selected}T12:00:00Z`);const offset=(anchor.getUTCDay()+6)%7;anchor.setUTCDate(anchor.getUTCDate()-offset);return Array.from({length:7},(_,i)=>{const d=new Date(anchor);d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10)})},[selected]);
 const history=events.filter(e=>e.eventType==="class"&&(e.status==="conducted"||e.status==="cancelled"||e.status==="rescheduled"||e.status==="missed")).sort((a,b)=>(b.date+b.startTime).localeCompare(a.date+a.startTime));
 const upcoming=visible.filter(e=>e.date>=new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())&&e.status!=="conducted").sort((a,b)=>(a.date+a.startTime).localeCompare(b.date+b.startTime));
 function move(delta:number){const d=mode==="month"?new Date(cursor.year,cursor.month+delta,1):new Date(`${selected}T12:00:00Z`);if(mode==="week")d.setUTCDate(d.getUTCDate()+delta*7);setCursor(ym(d));setSelected(new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit"}).format(d))}
 function selectDate(d:string){setSelected(d);const parsed=new Date(`${d}T12:00:00Z`);setCursor(ym(parsed))}
 return <div className="calendarWorkspace">
  <div className="learnerUpcomingSummary" aria-label="Calendar summary"><span className="softBadge">{upcoming.length} upcoming class{upcoming.length===1?"":"es"}</span><span className="softBadge">{visible.filter(e=>e.status==="conducted").length} completed</span><span className="softBadge">Times shown in each class timezone</span></div>
  <section className="dataSection learnerCalendarPanel">
   <div className="panelHeader"><div><div className="eyebrow">MY CALENDAR</div><h2>{new Date(cursor.year,cursor.month,1).toLocaleDateString("en-IN",{month:"long",year:"numeric"})}</h2><p>Classes stay synchronized with the Robotronix schedule. Add any confirmed class to your personal calendar.</p></div><div className="row"><label className="calendarViewToggle">View <select className="input compactInput" aria-label="Calendar view" value={mode} onChange={e=>setMode(e.target.value as "month"|"week")}><option value="month">Month</option><option value="week">Week</option></select></label><button className="button ghost smallButton" onClick={()=>move(-1)}>← Previous</button><button className="button ghost smallButton" onClick={()=>{const d=new Date();setCursor(ym(d));setSelected(new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit"}).format(d))}}>Today</button><button className="button ghost smallButton" onClick={()=>move(1)}>Next →</button></div></div>
   <div className="scheduleStatusLegend" aria-label="Class calendar legend"><span className="legendBooked">Scheduled</span><span className="legendCompleted">Completed</span><span className="legendBlocked">Unavailable</span></div>{mode==="month"?<div className="monthCalendar">
    {days.map(d=><div className="monthDayName" key={d}>{d}</div>)}
    {cells.map(d=>{const items=byDate.get(d)||[],outside=!d.startsWith(monthKey),active=d===selected;return <button type="button" onClick={()=>selectDate(d)} className={"monthCell "+(outside?"outside ":"")+(active?"selected ":"")} key={d}><span>{Number(d.slice(-2))}</span><div>{items.slice(0,3).map(e=><i key={e.id} className={`status-${e.status}`} title={`${e.title} · ${e.status}`}>{formatTime(e.startTime)} · {e.title}</i>)}{items.length>3&&<small>+{items.length-3} more</small>}</div></button>})}
   </div>:<div className="learnerWeekCalendar" role="group" aria-label="Weekly learner schedule">{weekDates.map(d=>{const items=visible.filter(e=>e.date===d);return <button type="button" className={`learnerWeekDay ${selected===d?"selected":""}`} key={d} onClick={()=>selectDate(d)} aria-label={`View ${d}, ${items.length} classes`}><b>{new Date(`${d}T12:00:00Z`).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})}</b><span>{items.length? `${items.length} class${items.length===1?"":"es"}`:"No classes"}</span>{items.slice(0,2).map(e=><small key={e.id}>{formatTime(e.startTime)} · {e.title}</small>)}</button>})}</div>}
  </section>
  <section className="dataSection learnerUpcomingList" aria-label="Upcoming classes"><div className="panelHeader"><div><div className="eyebrow">NEXT LESSONS</div><h2>Upcoming classes</h2><p>Select a class to jump to its calendar date.</p></div></div><div className="row" style={{flexWrap:"wrap",gap:8}}>{(showAllUpcoming?upcoming:upcoming.slice(0,5)).map(e=><button type="button" className="button ghost smallButton" key={e.id} onClick={()=>selectDate(e.date)}>{formatShortDate(e.date)} · {formatTime(e.startTime)} · {e.title}</button>)}{upcoming.length===0&&<p className="fieldHint">No upcoming classes yet.</p>}</div>{upcoming.length>5&&<button type="button" className="button ghost smallButton" aria-expanded={showAllUpcoming} onClick={()=>setShowAllUpcoming(v=>!v)}>{showAllUpcoming?"Show fewer upcoming classes":`Show all ${upcoming.length} upcoming classes`}</button>}</section>
  {history.length>0&&<section className="dataSection" aria-label="Class history">
   <div className="panelHeader"><div><div className="eyebrow">PAST & CHANGED SESSIONS</div><h2>Class history</h2><p>Review previous classes and schedule changes without leaving your calendar.</p></div>
   <button type="button" className="button ghost smallButton" aria-expanded={showHistory} onClick={()=>setShowHistory(v=>!v)}>{showHistory?"Hide history":`Show history (${history.length})`}</button></div>
   {showHistory&&<div className="tableWrap professionalTable"><table><thead><tr><th>Date</th><th>Class</th><th>Status</th><th>Action</th></tr></thead><tbody>
    {history.map(e=><tr key={e.id}><td>{formatShortDate(e.date)}</td><td>{e.title}</td><td>{e.status.replaceAll("_"," ")}</td><td><button type="button" className="linkButton" onClick={()=>selectDate(e.date)}>View date →</button></td></tr>)}
   </tbody></table></div>}
  </section>}
  <section className="dataSection calendarDayDetail">
   <div className="panelHeader"><div><div className="eyebrow">SELECTED DAY</div><h2>{formatShortDate(selected)}</h2><p>{selectedEvents.length?selectedEvents.length+" scheduled class"+(selectedEvents.length===1?"":"es"):"No class scheduled for this day."}</p></div></div>
   <div className="calendarEventList">{selectedEvents.map(e=><article className={`calendarEventCard status-${e.status}`} key={e.id}><div><span className="softBadge">{e.deliveryMode.replaceAll("_"," ")}</span><h3>{formatTime(e.startTime)}–{formatTime(e.endTime)} · {e.title}</h3><p>{e.timezone} · {e.status.replaceAll("_"," ")}</p></div><div className="calendarEventActions"><ZoomClassActions scheduleEventId={e.id} compact/><CalendarActions event={e} compact/></div></article>)}{!selectedEvents.length&&<div className="emptyState compact">Nothing scheduled. Your confirmed Robotronix classes will appear automatically.</div>}</div>
  </section>
 </div>;
}
