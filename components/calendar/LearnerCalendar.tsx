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
 const now=new Date(),[cursor,setCursor]=useState(()=>ym(now)),[selected,setSelected]=useState<string>(()=>new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit"}).format(now));
 const cells=useMemo(()=>monthCells(cursor.year,cursor.month),[cursor]);
 const monthKey=key(cursor.year,cursor.month);
 const visible=events.filter(e=>!["cancelled","rescheduled"].includes(e.status));
 const byDate=useMemo(()=>new Map(cells.map(d=>[d,visible.filter(e=>e.date===d).sort((a,b)=>a.startTime.localeCompare(b.startTime))])),[cells,visible]);
 const selectedEvents=byDate.get(selected)||[];
 function move(delta:number){const d=new Date(cursor.year,cursor.month+delta,1);setCursor(ym(d));setSelected(new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit"}).format(d))}
 return <div className="calendarWorkspace">
  <section className="dataSection learnerCalendarPanel">
   <div className="panelHeader"><div><div className="eyebrow">MY CALENDAR</div><h2>{new Date(cursor.year,cursor.month,1).toLocaleDateString("en-IN",{month:"long",year:"numeric"})}</h2><p>Classes stay synchronized with the Robotronix schedule. Add any confirmed class to your personal calendar.</p></div><div className="row"><button className="button ghost smallButton" onClick={()=>move(-1)}>← Previous</button><button className="button ghost smallButton" onClick={()=>{const d=new Date();setCursor(ym(d));setSelected(new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit"}).format(d))}}>Today</button><button className="button ghost smallButton" onClick={()=>move(1)}>Next →</button></div></div>
   <div className="monthCalendar">
    {days.map(d=><div className="monthDayName" key={d}>{d}</div>)}
    {cells.map(d=>{const items=byDate.get(d)||[],outside=!d.startsWith(monthKey),active=d===selected;return <button type="button" onClick={()=>setSelected(d)} className={"monthCell "+(outside?"outside ":"")+(active?"selected ":"")} key={d}><span>{Number(d.slice(-2))}</span><div>{items.slice(0,3).map(e=><i key={e.id}>{e.startTime} · {e.title}</i>)}{items.length>3&&<small>+{items.length-3} more</small>}</div></button>})}
   </div>
  </section>
  <section className="dataSection calendarDayDetail">
   <div className="panelHeader"><div><div className="eyebrow">SELECTED DAY</div><h2>{formatShortDate(selected)}</h2><p>{selectedEvents.length?selectedEvents.length+" scheduled class"+(selectedEvents.length===1?"":"es"):"No class scheduled for this day."}</p></div></div>
   <div className="calendarEventList">{selectedEvents.map(e=><article className="calendarEventCard" key={e.id}><div><span className="softBadge">{e.deliveryMode.replaceAll("_"," ")}</span><h3>{formatTime(e.startTime)}–{formatTime(e.endTime)} · {e.title}</h3><p>{e.timezone} · {e.status}</p></div><div className="calendarEventActions"><ZoomClassActions scheduleEventId={e.id} compact/><CalendarActions event={e} compact/></div></article>)}{!selectedEvents.length&&<div className="emptyState compact">Nothing scheduled. Your confirmed Robotronix classes will appear automatically.</div>}</div>
  </section>
 </div>;
}
