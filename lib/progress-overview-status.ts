import type {LearnerProgressRow,ScheduleEvent} from "./types";
export type ProgressStatus="not_started"|"awaiting_update"|"in_progress"|"on_track"|"needs_attention"|"near_completion"|"on_hold"|"completed";
export type ProgressAssessment={status:ProgressStatus;label:string;reasons:string[];nextClass?:ScheduleEvent;pastPending:number};
export function assessLearnerProgress(row:LearnerProgressRow,events:ScheduleEvent[],today:string):ProgressAssessment{
 const matching=events.filter(e=>e.eventType==="class"&&(e.enrollmentId===row.enrollmentId||(!e.enrollmentId&&e.studentId===row.studentId&&e.courseId===row.courseId)));
 const upcoming=matching.filter(e=>e.status==="scheduled"&&e.date>=today).sort((a,b)=>(a.date+a.startTime).localeCompare(b.date+b.startTime));
 const pending=matching.filter(e=>e.status==="scheduled"&&e.date<today).length;
 const reasons:string[]=[];
 if(row.activeHold||row.enrollmentStatus==="on_hold")reasons.push("Enrollment is on hold");
 if(pending)reasons.push(pending+" past scheduled "+(pending===1?"class awaits":"classes await")+" an outcome");
 if(row.currentSignal==="follow_up")reasons.push("Trainer learning feedback needs follow-up");
 if(row.recentSignalCount>=2&&row.currentSignal==="reinforce")reasons.push("Recent learning observations suggest reinforcement");
 if(row.openAlertCount)reasons.push(row.openAlertCount+" unresolved learner progress "+(row.openAlertCount===1?"alert":"alerts"));
 if(row.projectsAwaitingReview)reasons.push(row.projectsAwaitingReview+" "+(row.projectsAwaitingReview===1?"project awaits":"projects await")+" review");
 if(row.attendanceRecorded>=3&&row.attendanceRate<75)reasons.push("Attendance below 75% across recorded classes");
 if(row.lastAttendedDate&&row.lastAttendedDate<today){
  const days=Math.floor((Date.parse(today+"T12:00:00Z")-Date.parse(row.lastAttendedDate+"T12:00:00Z"))/86400000);
  if(days>=21)reasons.push("No recorded attended class for "+days+" days");
 }
 const near=(row.plannedHours??0)>0&&(row.hoursRemaining??Infinity)<=Math.max(2,(row.plannedHours??0)*0.2);
 let status:ProgressStatus="on_track",label="On track";
 if(row.enrollmentStatus==="completed"){status="completed";label="Completed";}
 else if(row.enrollmentStatus==="on_hold"||row.activeHold){status="on_hold";label="On hold";}
 else if(reasons.length>0&&!(pending>0&&reasons.length===1)){status="needs_attention";label="Needs attention";}
 else if(pending){status="awaiting_update";label="Awaiting class update";}
 else if(!row.hoursCompleted&&!row.attendanceRecorded){status="not_started";label="Not started / unrecorded";}
 else if(near){status="near_completion";label="Near completion";}
 else if((row.hoursCompleted??0)>0){status="in_progress";label="In progress";}
 return {status,label,reasons,nextClass:upcoming[0],pastPending:pending};
}
