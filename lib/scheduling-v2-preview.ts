import type {ScheduleEvent,WeeklyScheduleSlot} from "./types";
import {zonedLocalToUtc} from "./timezones";

export type SchedulingHorizon="full"|"weeks"|"manual";
export interface GeneratedClassSlot {date:string;startTime:string;endTime:string;timezone:string;startUtc:number;endUtc:number;conflicts:string[];}
export interface SchedulePreviewOptions {
 startDate:string; timezone:string; rules:WeeklyScheduleSlot[]; horizon:SchedulingHorizon;
 totalSessions:number; weeks?:number; trainerId:string; learnerId?:string; ownedEnrollmentId?:string; ownedCohortId?:string; existingEvents?:ScheduleEvent[];
}

/** Read-only preview. Booking must be performed by a transaction-safe server operation. */
export function previewCourseSchedule(options:SchedulePreviewOptions):GeneratedClassSlot[]{
 const {startDate,timezone,rules,horizon,trainerId,learnerId,existingEvents=[]}=options;
 if(horizon==="manual")return [];
 if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate))throw new Error("A valid course start date is required.");
 if(!rules.length)throw new Error("Add a weekly class slot before generating dates.");
 if(!Number.isSafeInteger(options.totalSessions)||options.totalSessions<1||options.totalSessions>500)throw new Error("Course session count must be between 1 and 500.");
 if(horizon==="weeks"&&(!Number.isSafeInteger(options.weeks)||!options.weeks||options.weeks<1||options.weeks>104))throw new Error("Select between 1 and 104 weeks.");
 const sorted=[...rules].sort((a,b)=>a.dayOfWeek-b.dayOfWeek||a.startTime.localeCompare(b.startTime));
 if(sorted.some(s=>!Number.isInteger(s.dayOfWeek)||s.dayOfWeek<0||s.dayOfWeek>6||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.startTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.endTime)))throw new Error("Invalid weekly slot.");
 const start=new Date(startDate+"T12:00:00Z");
 if(Number.isNaN(start.getTime())||start.toISOString().slice(0,10)!==startDate)throw new Error("Invalid start date.");
 const output:GeneratedClassSlot[]=[];
 const limit=horizon==="weeks" ? Math.min(735,options.weeks!*7) : 366*4;
 for(let offset=0;offset<limit&&output.length<options.totalSessions;offset++){
  const day=new Date(start.getTime()+offset*86400000);
  const date=day.toISOString().slice(0,10);
  for(const slot of sorted.filter(s=>s.dayOfWeek===day.getUTCDay())){
   if(output.length>=options.totalSessions)break;
   const endsTomorrow=slot.endsNextDay||slot.endTime<=slot.startTime;
   const endDate=endsTomorrow?new Date(day.getTime()+86400000).toISOString().slice(0,10):date;
   const startUtc=zonedLocalToUtc(date,slot.startTime,timezone).getTime();
   const endUtc=zonedLocalToUtc(endDate,slot.endTime,timezone).getTime();
   if(!Number.isFinite(startUtc)||!Number.isFinite(endUtc)||endUtc<=startUtc)throw new Error("Invalid timezone or class duration.");
   const conflicts:string[]=[];
   for(const event of existingEvents){
    if(["cancelled","rescheduled"].includes(event.status))continue;
    // Previously generated identical occurrences are idempotent bookings, not conflicts.
    if(event.occurrenceKind==="regular"&&event.date===date&&event.startTime===slot.startTime&&event.endTime===slot.endTime
      &&((options.ownedEnrollmentId&&event.enrollmentId===options.ownedEnrollmentId)
       ||(options.ownedCohortId&&event.cohortId===options.ownedCohortId)))continue;
    const eventEndDate=event.endTime<=event.startTime?new Date(new Date(event.date+"T12:00:00Z").getTime()+86400000).toISOString().slice(0,10):event.date;
    const from=zonedLocalToUtc(event.date,event.startTime,event.timezone).getTime();
    const to=zonedLocalToUtc(eventEndDate,event.endTime,event.timezone).getTime();
    if(startUtc<to&&endUtc>from&&(event.trainerId===trainerId||(learnerId&&event.studentId===learnerId)))conflicts.push(event.trainerId===trainerId?"Trainer busy":"Learner busy");
   }
   if(output.some(x=>startUtc<x.endUtc&&endUtc>x.startUtc))conflicts.push("Overlapping weekly slots");
   output.push({date,startTime:slot.startTime,endTime:slot.endTime,timezone,startUtc,endUtc,conflicts:[...new Set(conflicts)]});
  }
 }
 if(horizon==="full"&&output.length<options.totalSessions)throw new Error("Unable to generate the complete course within four years.");
 return output;
}
