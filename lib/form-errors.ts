/** UI-safe interpretation of persistence failures. Technical details belong in server logs, not customer-facing forms. */
export type FormIssue={field:string;message:string};
export function readableSaveError(error:unknown):string{
 const value=error instanceof Error?error.message:String(error??"");
 if(/invalid input syntax for type date|date\/time field value out of range|invalid date/i.test(value))return "One of the dates is invalid. Correct the highlighted date field or leave optional dates blank.";
 if(/foreign key constraint|23503/i.test(value))return "A selected course, trainer or cohort no longer exists. Select it again and retry.";
 if(/not-null constraint|23502/i.test(value))return "A required field is missing. Check the highlighted fields before saving.";
 if(/check constraint|23514/i.test(value))return "One or more fields contain an unsupported value. Review the marked fields.";
 if(/permission denied|row.level.security|42501|not authorised|not authorized/i.test(value))return "Your account does not have permission to save this record. Contact an administrator.";
 if(/duplicate key|23505/i.test(value))return "A record with these details already exists. Review duplicates before retrying.";
 if(/trainer.*(unavailable|availability|busy|conflict)|schedule.*(overlap|conflict)|overlap.*(booking|class)|no available host|host.*capacity/i.test(value))return "The selected trainer, classroom host or time slot is unavailable. Check availability and choose another slot.";
 if(/invalid.*(time|date|duration)|time.*(range|after start|before end)/i.test(value))return "The selected date, time or duration is invalid. Review the schedule and try again.";
 if(/already.*(enrolled|enrollment|scheduled|linked)|active.*enrollment.*exists/i.test(value))return "This learner already has an existing active assignment. Review the existing enrollment or schedule before creating another.";
 if(/payment.*(locked|paid|finalized)|payroll.*(locked|finalized)|cannot.*edit.*paid/i.test(value))return "This payment or payroll period is finalized. Request an authorized correction instead of editing it.";
 if(/missing.*(course|trainer|cohort|student|learner|enrollment)|must.*(select|choose).*?(course|trainer|cohort|student)/i.test(value))return "A required learner, course, trainer or cohort selection is missing. Complete the relevant selection and retry.";

 if(/failed to fetch|network|timeout|fetch failed/i.test(value))return "Unable to reach the server. Your changes are still on screen; check your connection and try again.";
 if(/no matching onboarding record|record was not updated/i.test(value))return "This record was not updated. Refresh the page and check that you still have access.";
 return "Unable to save. Your changes remain on screen. Retry or contact an administrator if the problem continues.";
}
export function validateDraftDates(input:{childDob?:string|null;startDate?:string|null},today?:string):FormIssue[]{
 const issues:FormIssue[]=[];
 const valid=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v+"T00:00:00Z").toISOString().slice(0,10)===v;
 if(input.childDob&&!valid(input.childDob))issues.push({field:"childDob",message:"Enter a valid date of birth or leave it blank for a draft."});
 if(input.startDate&&!valid(input.startDate))issues.push({field:"startDate",message:"Enter a valid enrollment start date or leave it blank."});
 if(today&&input.startDate&&valid(input.startDate)&&input.startDate<today)issues.push({field:"startDate",message:"Enrollment start date cannot be earlier than today (IST)."});
 return issues;
}
