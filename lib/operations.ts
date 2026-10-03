import type {CohortAdminRecord,EnrollmentAdminRecord,ScheduleEvent,StudentAdminRecord,TrainerAdminRecord} from "./types";
import {isRunningCohort,isUpcomingCohort} from "./cohort-status";

export function activeEnrollments(rows:EnrollmentAdminRecord[]){return rows.filter(e=>e.status==="active")}
export function currentLearnerIds(rows:EnrollmentAdminRecord[]){return new Set(activeEnrollments(rows).map(e=>e.studentId))}
export function currentLearnerCount(rows:EnrollmentAdminRecord[]){return currentLearnerIds(rows).size}
export function currentLearners(students:StudentAdminRecord[],enrollments:EnrollmentAdminRecord[]){const ids=currentLearnerIds(enrollments);return students.filter(s=>ids.has(s.id))}
export function trainerActiveEnrollments(rows:EnrollmentAdminRecord[],trainerId:string){return rows.filter(e=>e.trainerId===trainerId&&e.status==="active")}
export function trainerCurrentLearnerCount(rows:EnrollmentAdminRecord[],trainerId:string){return new Set(trainerActiveEnrollments(rows,trainerId).map(e=>e.studentId)).size}
export function runningCohorts(rows:CohortAdminRecord[]){return rows.filter(isRunningCohort)}
export function upcomingCohorts(rows:CohortAdminRecord[]){return rows.filter(isUpcomingCohort)}
export function openSeats(rows:CohortAdminRecord[]){return rows.reduce((n,c)=>n+Math.max(0,c.capacity-c.studentIds.length),0)}
export function activeTrainerCount(rows:TrainerAdminRecord[]){return rows.filter(t=>t.recordStatus==="active").length}
export function currentClassEvents(rows:ScheduleEvent[]){return rows.filter(e=>e.eventType==="class"&&!['cancelled','rescheduled'].includes(e.status))}
