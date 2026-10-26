import type {EnrollmentAdminRecord} from "./types";

/** UI-only lifecycle wording. Enrollment status in the database remains authoritative. */
export function enrollmentLearningLabel(enrollment:Pick<EnrollmentAdminRecord,"status"|"startedAt"|"sessionsCompleted"|"hoursCompleted">|null|undefined, today:string){
 if(!enrollment)return "No active enrollment";
 if(enrollment.status==="on_hold")return "On hold";
 if(enrollment.status==="completed")return "Completed";
 if(enrollment.status==="cancelled")return "Cancelled";
 if(enrollment.status!=="active")return "Not started";
 if((enrollment.hoursCompleted??0)>0||(enrollment.sessionsCompleted??0)>0)return "In progress";
 return enrollment.startedAt>today?"Scheduled":"Not started";
}
