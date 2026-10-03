import type {CohortAdminRecord} from "./types";
import {IST_TIMEZONE} from "./timezones";

function todayInIst(){
  return new Intl.DateTimeFormat("en-CA",{timeZone:IST_TIMEZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}

export function isRunningCohort(cohort:CohortAdminRecord){
  return cohort.status==="active" && (!cohort.startedAt || cohort.startedAt<=todayInIst());
}

export function isUpcomingCohort(cohort:CohortAdminRecord){
  return cohort.status==="planned" || (cohort.status==="active" && Boolean(cohort.startedAt) && cohort.startedAt>todayInIst());
}

export function operationalCohortLabel(cohort:CohortAdminRecord){
  if(isRunningCohort(cohort))return "Active";
  if(isUpcomingCohort(cohort))return "Upcoming";
  if(cohort.status==="completed")return "Completed";
  return "Archived";
}
