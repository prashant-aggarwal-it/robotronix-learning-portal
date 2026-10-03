"use client";
import {
  demoAvailability,demoAvailabilityOverrides,demoClassAttendance,demoCohorts,demoCourses,demoEnrollments,demoOnboarding,demoSchedule,demoStudents,demoTrainers
} from "./admin-demo-data";
import { demoEnrollmentHolds, demoLearnerProjects, demoLearningObservations, demoProgressAlertActions, demoTrainerFeedback } from "./progress-demo-data";
import {demoTrainerFinance} from "./trainer-finance-demo-data";
import {demoReminderPolicies} from "./reminder-demo-data";
import {demoTrainerCompensationPlans,demoTrainerEarnings,demoTrainerPayouts} from "./trainer-payroll-demo-data";
import type {
  ClassAttendanceRecord,CohortAdminRecord,CourseAdminRecord,EnrollmentAdminRecord,OnboardingSubmission,ScheduleEvent,StudentAdminRecord,TrainerAdminRecord,TrainerAvailability,TrainerAvailabilityOverride,EnrollmentHoldRecord,LearnerProjectRecord,LearningObservationRecord,ProgressAlertActionRecord,TrainerFeedbackRecord,TrainerFinanceRecord,ReminderPolicy,TrainerCompensationPlan,TrainerEarningRecord,TrainerPayoutRecord,CorrectionRequestRecord,PortalAuditRecord
} from "./types";

const KEYS={students:"robotronix_v27_students",trainers:"robotronix_v27_trainers",courses:"robotronix_v27_courses",onboarding:"robotronix_v27_onboarding",schedule:"robotronix_v27_schedule",enrollments:"robotronix_v27_enrollments",cohorts:"robotronix_v27_cohorts",availability:"robotronix_v27_availability",availabilityOverrides:"robotronix_v27_availability_overrides",attendance:"robotronix_v27_attendance",observations:"robotronix_v27_observations",projects:"robotronix_v27_projects",feedback:"robotronix_v27_feedback",holds:"robotronix_v27_holds",progressAlertActions:"robotronix_v27_progress_alert_actions",trainerFinance:"robotronix_v27_trainer_finance",reminderPolicies:"robotronix_v27_reminder_policies",trainerCompensationPlans:"robotronix_v27_trainer_comp_plans",trainerEarnings:"robotronix_v27_trainer_earnings",trainerPayouts:"robotronix_v27_trainer_payouts",correctionRequests:"robotronix_v27_correction_requests",auditLog:"robotronix_v27_audit_log"} as const;
function read<T>(key:string,fallback:T[]):T[]{if(typeof window==="undefined")return fallback;const raw=window.localStorage.getItem(key);if(!raw){window.localStorage.setItem(key,JSON.stringify(fallback));return fallback;}try{return JSON.parse(raw) as T[]}catch{return fallback}}
function write<T>(key:string,value:T[]){if(typeof window!=="undefined")window.localStorage.setItem(key,JSON.stringify(value));return value}
export function makeId(prefix:string){return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`}
function entity<T extends {id:string}>(key:string,fallback:T[]){return{list:()=>read<T>(key,fallback),get:(id:string)=>read<T>(key,fallback).find(x=>x.id===id)??null,create:(record:T)=>{const rows=read<T>(key,fallback);write(key,[record,...rows]);return record},update:(id:string,patch:Partial<T>)=>{const rows=read<T>(key,fallback);const next=rows.map(x=>x.id===id?{...x,...patch}:x);write(key,next);return next.find(x=>x.id===id)??null},remove:(id:string)=>write(key,read<T>(key,fallback).filter(x=>x.id!==id))}}
export const demoStore={
 students:entity<StudentAdminRecord>(KEYS.students,demoStudents),trainers:entity<TrainerAdminRecord>(KEYS.trainers,demoTrainers),courses:entity<CourseAdminRecord>(KEYS.courses,demoCourses),onboarding:entity<OnboardingSubmission>(KEYS.onboarding,demoOnboarding),enrollments:entity<EnrollmentAdminRecord>(KEYS.enrollments,demoEnrollments),cohorts:entity<CohortAdminRecord>(KEYS.cohorts,demoCohorts),schedule:entity<ScheduleEvent>(KEYS.schedule,demoSchedule),availability:entity<TrainerAvailability>(KEYS.availability,demoAvailability),availabilityOverrides:entity<TrainerAvailabilityOverride>(KEYS.availabilityOverrides,demoAvailabilityOverrides),attendance:entity<ClassAttendanceRecord>(KEYS.attendance,demoClassAttendance),
 observations:entity<LearningObservationRecord>(KEYS.observations,demoLearningObservations),
 projects:entity<LearnerProjectRecord>(KEYS.projects,demoLearnerProjects),
 feedback:entity<TrainerFeedbackRecord>(KEYS.feedback,demoTrainerFeedback),
 holds:entity<EnrollmentHoldRecord>(KEYS.holds,demoEnrollmentHolds),
 progressAlertActions:entity<ProgressAlertActionRecord>(KEYS.progressAlertActions,demoProgressAlertActions),
 trainerFinance:entity<TrainerFinanceRecord>(KEYS.trainerFinance,demoTrainerFinance),
 reminderPolicies:entity<ReminderPolicy>(KEYS.reminderPolicies,demoReminderPolicies),
 trainerCompensationPlans:entity<TrainerCompensationPlan>(KEYS.trainerCompensationPlans,demoTrainerCompensationPlans),
 trainerEarnings:entity<TrainerEarningRecord>(KEYS.trainerEarnings,demoTrainerEarnings),
 trainerPayouts:entity<TrainerPayoutRecord>(KEYS.trainerPayouts,demoTrainerPayouts),
 correctionRequests:entity<CorrectionRequestRecord>(KEYS.correctionRequests,[]),
 auditLog:entity<PortalAuditRecord>(KEYS.auditLog,[]),
 reset:()=>{if(typeof window==="undefined")return;Object.values(KEYS).forEach(k=>window.localStorage.removeItem(k));}
};
