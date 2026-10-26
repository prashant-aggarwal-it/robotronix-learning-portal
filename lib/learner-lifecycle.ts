import type {EnrollmentAdminRecord,LearnerExperienceSnapshot} from "./types";

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

/** Shared Parent/Student presentation for enrollment stage; does not change learning signals. */
export function familyLearningStage(snapshot:LearnerExperienceSnapshot):string{
 if(snapshot.enrollmentStatus==="on_hold"||snapshot.activeHold)return "On hold";
 if(snapshot.enrollmentStatus==="completed")return "Completed";
 if(snapshot.enrollmentStatus!=="active")return "Not started";
 if((snapshot.learner.hoursCompleted??0)>0||snapshot.learner.sessionsCompleted>0)return "In progress";
 return snapshot.nextClass?"Ready for first class":"Awaiting first class";
}

/** Attendance alone is not evidence of understanding or skill mastery. */
export function learnerHasLearningEvidence(snapshot:LearnerExperienceSnapshot):boolean{
 return snapshot.observations.length>0||snapshot.feedback.length>0;
}
