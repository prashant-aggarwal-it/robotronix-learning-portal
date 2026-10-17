"use client";
import type {ScheduleEvent} from "@/lib/types";
import {zonedLocalToUtc} from "@/lib/timezones";

function pad(n:number){return String(n).padStart(2,"0")}
function utcStamp(d:Date){return d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+"T"+pad(d.getUTCHours())+pad(d.getUTCMinutes())+"00Z"}
function esc(value:string){return String(value||"").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;")}
function instantPair(event:ScheduleEvent){
 const start=zonedLocalToUtc(event.date,event.startTime,event.timezone);
 const endDate=event.endTime<=event.startTime?new Date(new Date(event.date+"T12:00:00Z").getTime()+86400000).toISOString().slice(0,10):event.date;
 const end=zonedLocalToUtc(endDate,event.endTime,event.timezone);
 return{start,end};
}
export function googleCalendarUrl(event:ScheduleEvent){
 const{start,end}=instantPair(event);
 const q=new URLSearchParams({
  action:"TEMPLATE",
  text:event.title,
  dates:utcStamp(start)+"/"+utcStamp(end),
  details:["Robotronix™ Learning Portal",event.deliveryMode?"Delivery: "+event.deliveryMode.replaceAll("_"," "):"",event.status?"Status: "+event.status:""].filter(Boolean).join("\n"),
 });
 return"https://calendar.google.com/calendar/render?"+q.toString();
}
export function eventIcs(event:ScheduleEvent){
 const{start,end}=instantPair(event);
 return[
  "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Robotronix//Learning Portal//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH",
  "BEGIN:VEVENT",
  "UID:"+esc(event.id)+"@portal.robotronixstemlab.com",
  "DTSTAMP:"+utcStamp(new Date()),
  "DTSTART:"+utcStamp(start),
  "DTEND:"+utcStamp(end),
  "SUMMARY:"+esc(event.title),
  "DESCRIPTION:"+esc("Robotronix™ Learning Portal\\nDelivery: "+event.deliveryMode.replaceAll("_"," ")+"\\nStatus: "+event.status),
  "STATUS:"+(event.status==="cancelled"?"CANCELLED":"CONFIRMED"),
  "END:VEVENT","END:VCALENDAR"
 ].join("\r\n");
}
export function downloadEventIcs(event:ScheduleEvent){
 const blob=new Blob([eventIcs(event)],{type:"text/calendar;charset=utf-8"});
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download="Robotronix-"+event.date+"-"+event.title.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"")+".ics";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
export function calendarEventDate(event:ScheduleEvent){return event.date}
export function monthCells(year:number,month:number){
 const first=new Date(Date.UTC(year,month,1));const mondayIndex=(first.getUTCDay()+6)%7;const start=new Date(first);start.setUTCDate(first.getUTCDate()-mondayIndex);
 return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setUTCDate(start.getUTCDate()+i);return d.toISOString().slice(0,10)});
}
