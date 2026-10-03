import type {ClassAttendanceRecord,CourseAdminRecord,EnrollmentAdminRecord,ScheduleEvent} from "@/lib/types";
import {IST_TIMEZONE,zonedRangeParts} from "@/lib/timezones";

export const STANDARD_CLASS_DURATIONS_MINUTES=[60,90,120,150] as const;
export type StandardClassDuration=(typeof STANDARD_CLASS_DURATIONS_MINUTES)[number];

export function plannedCourseHours(course?:Partial<Pick<CourseAdminRecord,"plannedHours"|"totalSessions"|"sessionDuration">>|null){
 if(!course)return 0;
 if(Number(course.plannedHours)>0)return Number(course.plannedHours);
 const sessions=Math.max(0,Number(course.totalSessions)||0);
 const minutes=Math.max(0,Number(course.sessionDuration)||0);
 return Math.round((sessions*minutes/60)*100)/100;
}

export function eventDurationMinutes(event:Pick<ScheduleEvent,"date"|"startTime"|"endTime"|"timezone">&Partial<Pick<ScheduleEvent,"status"|"actualDurationMinutes">>){
 if(event.status==="conducted"&&Number.isFinite(event.actualDurationMinutes)&&Number(event.actualDurationMinutes)>0)return Number(event.actualDurationMinutes);
 return zonedRangeParts(event.date,event.startTime,event.endTime,event.timezone||IST_TIMEZONE,IST_TIMEZONE).durationMinutes;
}

export function isDeliveredTeachingEvent(event:ScheduleEvent){
 return event.eventType==="class"&&event.status==="conducted"&&!event.rescheduledToId;
}

export function deliveredHoursForEnrollment(
 enrollment:Pick<EnrollmentAdminRecord,"id"|"enrollmentType">&Partial<Pick<EnrollmentAdminRecord,"cohortId">>,
 events:ScheduleEvent[],
 attendance:ClassAttendanceRecord[]
){
 const attendanceByEvent=new Map(attendance.filter(a=>a.enrollmentId===enrollment.id).map(a=>[a.scheduleEventId,a]));
 let minutes=0;
 for(const event of events){
  if(!isDeliveredTeachingEvent(event))continue;
  const linked=enrollment.enrollmentType==="small_group"?Boolean(enrollment.cohortId&&event.cohortId===enrollment.cohortId):event.enrollmentId===enrollment.id;
  if(!linked)continue;
  const row=attendanceByEvent.get(event.id);
  // Progress is learner-specific: cohort delivery counts only when this learner actually attended/was late.
  if(!row||!(row.status==="attended"||row.status==="late"))continue;
  minutes+=eventDurationMinutes(event);
 }
 return Math.round((minutes/60)*100)/100;
}

export function progressFromHours(planned:number,delivered:number){
 const safePlanned=Math.max(0,Number(planned)||0);
 const safeDelivered=Math.max(0,Number(delivered)||0);
 const remaining=Math.max(0,Math.round((safePlanned-safeDelivered)*100)/100);
 const percent=safePlanned?Math.min(100,Math.round((safeDelivered/safePlanned)*100)):0;
 return{plannedHours:safePlanned,hoursCompleted:Math.round(safeDelivered*100)/100,hoursRemaining:remaining,progressPercent:percent};
}

export function formatDuration(minutes:number){
 const hours=minutes/60;
 return `${Number.isInteger(hours)?hours:hours.toFixed(1)} ${hours===1?"hr":"hrs"}`;
}
