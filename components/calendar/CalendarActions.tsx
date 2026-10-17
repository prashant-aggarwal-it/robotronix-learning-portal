"use client";
import type {ScheduleEvent} from "@/lib/types";
import {downloadEventIcs,googleCalendarUrl} from "@/lib/calendar";

export function CalendarActions({event,compact=false}:{event:ScheduleEvent;compact?:boolean}){
 return <div className="row calendarActions" style={{flexWrap:"wrap"}}>
  <a className={"button secondary "+(compact?"smallButton":"")} href={googleCalendarUrl(event)} target="_blank" rel="noreferrer">Google Calendar</a>
  <button type="button" className={"button ghost "+(compact?"smallButton":"")} onClick={()=>downloadEventIcs(event)}>Apple / Outlook (.ics)</button>
 </div>;
}
