"use client";

import Link from "next/link";
import {FormErrorSummary} from "@/components/admin/FormErrorSummary";
import {readableSaveError,validateDraftDates,type FormIssue} from "@/lib/form-errors";
import {useEffect,useMemo,useState} from "react";
import {useParams} from "next/navigation";
import {AppShell} from "@/components/AppShell";
import {GradeSelect} from "@/components/GradeSelect";
import {RoleGuard} from "@/components/RoleGuard";
import {todayIstDate,validNewEnrollmentDate} from "@/lib/ist-date";
import {TimeZoneField} from "@/components/TimeZoneField";
import {PhoneField} from "@/components/PhoneField";
import {CountryCityFields} from "@/components/CountryCityFields";
import {PreferredAvailabilityEditor} from "@/components/PreferredAvailabilityEditor";
import {AdminPageHeader} from "@/components/admin/AdminPageHeader";
import {WeeklyScheduleEditor} from "@/components/admin/WeeklyScheduleEditor";
import {parsePreferredTimeWindows,preferredTimingNote,suggestedScheduleFromPreferences} from "@/lib/learner-options";
import type {PreferredTimeWindow} from "@/lib/learner-options";
import {activateOnboarding,getOnboardingSubmission,listAdminCohorts,listAdminCourses,listAdminTrainers,getAdminEnrollment,getAdminStudent,listTrainerAvailability,listAvailabilityOverrides,listScheduleEvents,updateOnboardingSubmission} from "@/lib/repository";
import {IST_TIMEZONE,convertWeeklyScheduleSlots,dayNames,formatClock,formatWeeklySchedule,isValidTimeZone,nextIsoDateForWeekday,shortTimeZoneLabel,timeZoneLabel,zonedRangeParts} from "@/lib/timezones";
import type {CohortAdminRecord,CourseAdminRecord,OnboardingSubmission,TrainerAdminRecord,TrainerAvailability,TrainerAvailabilityOverride,WeeklyScheduleSlot,ScheduleEvent} from "@/lib/types";
import {matchPreferredWindows,validateFinalScheduleSlots} from "@/lib/availability-match";
import {isRunningCohort,isUpcomingCohort} from "@/lib/cohort-status";
import {validInternationalPhone} from "@/lib/phones";
import {timeRangeError,weeklyScheduleError} from "@/lib/time-range-validation";
import {previewCourseSchedule,type SchedulingHorizon} from "@/lib/scheduling-v2-preview";
import {guardianRelationshipOptions,guardiansFromRecord,legacyFieldsFromGuardians,relationshipLabel} from "@/lib/guardians";
import type {GuardianRelationship} from "@/lib/types";

type Notice={type:"success"|"error"|"info";text:string}|null;
type ActiveAction="draft"|"activate"|null;

function preferredWindowAdminDisplay(window:PreferredTimeWindow,familyTimezone:string,referenceDate:string){
 const familyDate=nextIsoDateForWeekday(referenceDate,window.dayOfWeek);
 const converted=zonedRangeParts(familyDate,window.start,window.end,familyTimezone||IST_TIMEZONE,IST_TIMEZONE);
 const istStartDay=dayNames[new Date(`${converted.startDate}T12:00:00Z`).getUTCDay()];
 const istEndDay=dayNames[new Date(`${converted.endDate}T12:00:00Z`).getUTCDay()];
 const familyShort=shortTimeZoneLabel(familyTimezone,converted.startInstant);
 const istLabel=converted.startDate===converted.endDate
  ?`${istStartDay} ${formatClock(converted.startTime)}–${formatClock(converted.endTime)}`
  :`${istStartDay} ${formatClock(converted.startTime)}–${istEndDay} ${formatClock(converted.endTime)}`;
 const familyEnd=window.end<=window.start?`–${dayNames[(window.dayOfWeek+1)%7]} ${formatClock(window.end)}`:`–${formatClock(window.end)}`;
 return{
  istLabel,
  familyLabel:`${window.day.slice(0,3)} ${formatClock(window.start)}${familyEnd} · ${timeZoneLabel(familyTimezone)} (${familyShort})`,
 };
}

function signature(input:{record:OnboardingSubmission;courseId:string;trainerId:string;type:"one_to_one"|"small_group";cohortId:string;startDate:string;scheduleTimezone:string;scheduleRules:WeeklyScheduleSlot[]}){
 const r=input.record;
 return JSON.stringify({motherName:r.motherName,motherMobile:r.motherMobile,fatherName:r.fatherName,fatherMobile:r.fatherMobile,primaryContact:r.primaryContact,primaryWhatsApp:r.primaryWhatsApp,alternateWhatsApp:r.alternateWhatsApp,city:r.city,country:r.country,state:r.state??"",timezone:r.timezone,addressLine1:r.addressLine1,addressLine2:r.addressLine2??"",postalCode:r.postalCode,billingName:r.billingName,billingEmail:r.billingEmail,billingPhone:r.billingPhone,childName:r.childName,childDob:r.childDob,grade:r.grade,school:r.school,preferredClassDays:r.preferredClassDays??[],preferredTimeWindows:r.preferredTimeWindows??"",interests:r.interests,goal:r.goal,codingExperience:r.codingExperience,roboticsExperience:r.roboticsExperience,source:r.source,referringParentName:r.referringParentName??"",courseId:input.courseId,trainerId:input.trainerId,type:input.type,cohortId:input.type==="small_group"?input.cohortId:"",startDate:input.startDate,scheduleTimezone:input.scheduleTimezone,scheduleRules:input.scheduleRules});
}

export default function OnboardingDetail(){
 const{id}=useParams<{id:string}>();
 const[r,setR]=useState<OnboardingSubmission|null|undefined>(undefined);
 const[loadError,setLoadError]=useState("");
 const[courses,setCourses]=useState<CourseAdminRecord[]>([]);
 const[trainers,setTrainers]=useState<TrainerAdminRecord[]>([]);
 const[cohorts,setCohorts]=useState<CohortAdminRecord[]>([]);
 const[availability,setAvailability]=useState<TrainerAvailability[]>([]);
 const[availabilityOverrides,setAvailabilityOverrides]=useState<TrainerAvailabilityOverride[]>([]);
 const[editAvailability,setEditAvailability]=useState(false);
 const[editFamilyDetails,setEditFamilyDetails]=useState(false);
 const[primaryWhatsAppSame,setPrimaryWhatsAppSame]=useState(true);
 const[secondaryWhatsAppSame,setSecondaryWhatsAppSame]=useState(true);
 const[notice,setNotice]=useState<Notice>(null);
 useEffect(()=>{if(notice?.type!=="success")return;const timer=window.setTimeout(()=>setNotice(current=>current?.type==="success"?null:current),4000);return()=>window.clearTimeout(timer)},[notice]);
 const[formIssues,setFormIssues]=useState<FormIssue[]>([]);
 const[activationResult,setActivationResult]=useState<{studentId:string;enrollmentId:string;classesCreated?:number;schedulingWarning?:string}|null>(null);
 const[activeAction,setActiveAction]=useState<ActiveAction>(null);
 const[lastSavedAt,setLastSavedAt]=useState<string|undefined>();
 const[baseline,setBaseline]=useState("");
 const[courseId,setCourseId]=useState("");
 const[trainerId,setTrainerId]=useState("");
 const[type,setType]=useState<"one_to_one"|"small_group">("one_to_one");
 const[cohortId,setCohortId]=useState("");
 const[scheduleTimezone,setScheduleTimezone]=useState(IST_TIMEZONE);
 const[scheduleRules,setScheduleRules]=useState<WeeklyScheduleSlot[]>([]);
 const[startDate,setStartDate]=useState("");
 const[schedulingHorizon,setSchedulingHorizon]=useState<SchedulingHorizon>("full");
 const[schedulingWeeks,setSchedulingWeeks]=useState(4);
 const[existingClasses,setExistingClasses]=useState<ScheduleEvent[]>([]);
 const[linkedState,setLinkedState]=useState<{student:boolean;enrollment:boolean;error?:string}|null>(null);
 const[previewBookingsLoaded,setPreviewBookingsLoaded]=useState(false);
 useEffect(()=>{let cancelled=false;listScheduleEvents().then(items=>{if(!cancelled){setExistingClasses(items);setPreviewBookingsLoaded(true)}}).catch(()=>{if(!cancelled)setPreviewBookingsLoaded(false)});return()=>{cancelled=true}},[]);
 const[scheduleOverrideConfirmed,setScheduleOverrideConfirmed]=useState(false);

 async function refresh(){
  setLoadError("");
  try {
  const[a,c,t,h,av,ov]=await Promise.all([getOnboardingSubmission(id),listAdminCourses(),listAdminTrainers(),listAdminCohorts(),listTrainerAvailability(),listAvailabilityOverrides()]);
  setR(a);setCourses(c);setTrainers(t);setCohorts(h);setAvailability(av);setAvailabilityOverrides(ov);
  if(!a)return;
  const loadedGuardians=guardiansFromRecord(a);
  setPrimaryWhatsAppSame(!a.primaryWhatsApp||a.primaryWhatsApp===loadedGuardians.primary.mobile);
  setSecondaryWhatsAppSame(!a.alternateWhatsApp||a.alternateWhatsApp===loadedGuardians.secondary?.mobile);
  const nextCourseId=a.assignedCourseId??"";
  const nextTrainerId=a.assignedTrainerId??"";
  const nextType=a.enrollmentType??"one_to_one";
  const nextCohortId=a.cohortId??"";
  const nextStartDate=a.startDate??"";
  const existingCohort=h.find(x=>x.id===nextCohortId);
  const course=c.find(x=>x.id===nextCourseId);
  const preferred=suggestedScheduleFromPreferences(a.preferredTimeWindows,course?.sessionDuration??60);
  let nextTimezone=existingCohort?.scheduleTimezone??IST_TIMEZONE;
  let nextRules=existingCohort?.scheduleRules??[];
  if(nextType==="one_to_one"){
   const sourceTimezone=a.draftScheduleTimezone??a.timezone??IST_TIMEZONE;
   const sourceRules=a.draftScheduleRules?.length?a.draftScheduleRules:[];
   nextTimezone=IST_TIMEZONE;
   nextRules=sourceTimezone===IST_TIMEZONE?sourceRules:convertWeeklyScheduleSlots(sourceRules,sourceTimezone,IST_TIMEZONE,nextStartDate);
  }else if(!existingCohort){
   nextTimezone=a.draftScheduleTimezone??IST_TIMEZONE;
   nextRules=a.draftScheduleRules?.length?a.draftScheduleRules:[];
  }
  setCourseId(nextCourseId);setTrainerId(nextTrainerId);setType(nextType);setCohortId(nextCohortId);setScheduleTimezone(nextTimezone);setScheduleRules(nextRules);setStartDate(nextStartDate);
  setBaseline(signature({record:a,courseId:nextCourseId,trainerId:nextTrainerId,type:nextType,cohortId:nextCohortId,startDate:nextStartDate,scheduleTimezone:nextTimezone,scheduleRules:nextRules}));
  setLastSavedAt(a.updatedAt);
  } catch (error) {
   setLoadError(error instanceof Error?error.message:"Unable to load onboarding details.");
  }
 }
 useEffect(()=>{void refresh()},[id]);
 useEffect(()=>{
  const studentId=r?.activatedStudentId||activationResult?.studentId;
  const enrollmentId=r?.activatedEnrollmentId||activationResult?.enrollmentId;
  if(r?.status!=="active"||!studentId||!enrollmentId){setLinkedState(null);return;}
  let live=true;
  Promise.all([getAdminStudent(studentId),getAdminEnrollment(enrollmentId)])
   .then(([student,enrollment])=>{if(live)setLinkedState({student:Boolean(student),enrollment:Boolean(enrollment&&enrollment.studentId===studentId)})})
   .catch(()=>{if(live)setLinkedState({student:false,enrollment:false,error:"Linked learner records could not be verified. Retry later."})});
  return()=>{live=false};
 },[r?.status,r?.activatedStudentId,r?.activatedEnrollmentId,activationResult?.studentId,activationResult?.enrollmentId]);

 const eligibleTrainers=useMemo(()=>trainers.filter(t=>t.recordStatus==="active"&&(!courseId||t.courseIds.includes(courseId))),[trainers,courseId]);
 const eligibleCohorts=useMemo(()=>cohorts.filter(c=>(isRunningCohort(c)||isUpcomingCohort(c))&&c.courseId===courseId&&c.trainerId===trainerId&&c.studentIds.length<c.capacity),[cohorts,courseId,trainerId]);
 const parentWindows=useMemo(()=>parsePreferredTimeWindows(r?.preferredTimeWindows),[r?.preferredTimeWindows]);
 const parentTimingNote=useMemo(()=>preferredTimingNote(r?.preferredTimeWindows),[r?.preferredTimeWindows]);
 const parentWindowDisplays=useMemo(()=>parentWindows.map(window=>preferredWindowAdminDisplay(window,r?.timezone||IST_TIMEZONE,startDate||todayIstDate())),[parentWindows,r?.timezone,startDate]);
 const selectedCourse=useMemo(()=>courses.find(c=>c.id===courseId),[courses,courseId]);
 const schedulePreview=useMemo(()=>{if(!startDate)return{items:[],error:"Choose a start date before generating class dates."};try{return{items:previewCourseSchedule({startDate,timezone:scheduleTimezone,rules:scheduleRules,horizon:schedulingHorizon,totalSessions:selectedCourse?.totalSessions??0,weeks:schedulingWeeks,trainerId,existingEvents:existingClasses}),error:""}}catch(error){return{items:[],error:error instanceof Error?error.message:"Unable to preview schedule."}}},[startDate,scheduleTimezone,scheduleRules,schedulingHorizon,schedulingWeeks,selectedCourse?.totalSessions,trainerId,existingClasses]);
 const scheduleMatches=useMemo(()=>r&&trainerId&&startDate?matchPreferredWindows({windows:parentWindows,parentTimezone:r.timezone||IST_TIMEZONE,trainerId,startDate,availability,overrides:availabilityOverrides}):[],[r,trainerId,startDate,parentWindows,availability,availabilityOverrides]);
 const trainerAvailabilityConfigured=useMemo(()=>Boolean(
  trainerId&&(
   availability.some(a=>a.trainerId===trainerId&&a.enabled)||
   availabilityOverrides.some(o=>o.trainerId===trainerId)
  )
 ),[availability,availabilityOverrides,trainerId]);
 const finalScheduleValidation=useMemo(()=>type==="one_to_one"&&trainerId&&startDate?validateFinalScheduleSlots({
  slots:scheduleRules,
  parentWindows,
  parentTimezone:r?.timezone||IST_TIMEZONE,
  trainerId,
  startDate,
  availability,
  overrides:availabilityOverrides,
 }):[],[type,trainerId,scheduleRules,parentWindows,r?.timezone,startDate,availability,availabilityOverrides]);
 const hasScheduleExceptions=useMemo(()=>finalScheduleValidation.some(v=>v.parentStatus!=="inside"||v.trainerStatus!=="available"),[finalScheduleValidation]);
 const scheduleValidationKey=useMemo(()=>JSON.stringify({
  trainerId,startDate,scheduleRules,parentWindows:r?.preferredTimeWindows??""
 }),[trainerId,startDate,scheduleRules,r?.preferredTimeWindows]);
 useEffect(()=>{setScheduleOverrideConfirmed(false)},[scheduleValidationKey]);
 const currentSignature=r?signature({record:r,courseId,trainerId,type,cohortId,startDate,scheduleTimezone,scheduleRules}):"";
 const guardianView=useMemo(()=>r?guardiansFromRecord(r):null,[r]);
 const dirty=Boolean(r&&baseline&&currentSignature!==baseline);
 const busy=activeAction!==null;
 const activated=r?.status==="active";
 const activatedEnrollmentId=activationResult?.enrollmentId||r?.activatedEnrollmentId||"";
 const activatedStudentId=activationResult?.studentId||r?.activatedStudentId||"";
 const courseSummary=courses.find(x=>x.id===(r?.assignedCourseId||courseId));
 const trainerSummary=trainers.find(x=>x.id===(r?.assignedTrainerId||trainerId));
 const nextClass=existingClasses.filter(e=>e.eventType==="class"&&["scheduled","tentative","makeup"].includes(e.status)&&
  (e.enrollmentId===activatedEnrollmentId||(r?.cohortId&&e.cohortId===r.cohortId))&&e.date>=todayIstDate())
  .sort((a,b)=>(a.date+a.startTime).localeCompare(b.date+b.startTime))[0];
 useEffect(()=>{
  if(!dirty||activated)return;
  const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
  window.addEventListener("beforeunload",warn);
  return()=>window.removeEventListener("beforeunload",warn);
 },[dirty,activated]);

 if(loadError)return <RoleGuard allow={["admin"]}><AppShell role="admin"><div className="panel" role="alert"><h2>Unable to load onboarding</h2><p>{loadError}</p><button type="button" className="button" onClick={()=>void refresh()}>Retry</button></div></AppShell></RoleGuard>;
 if(r===undefined)return <RoleGuard allow={["admin"]}><AppShell role="admin"><div className="panel">Loading onboarding record…</div></AppShell></RoleGuard>;
 if(!r)return <RoleGuard allow={["admin"]}><AppShell role="admin"><div className="emptyState">Onboarding record not found.</div></AppShell></RoleGuard>;

 function patch(k:keyof OnboardingSubmission,v:any){setR(x=>x?{...x,[k]:v}:x);setNotice(null);setFormIssues(current=>current.filter(issue=>issue.field!==k))}
 function patchGuardian(which:"primary"|"secondary",field:"name"|"relationship"|"mobile",value:string){setR(current=>{if(!current)return current;const view=guardiansFromRecord(current);const primary={...view.primary};const secondary={...(view.secondary??{name:"",relationship:"guardian" as GuardianRelationship,mobile:""})};if(which==="primary"){if(field==="name")primary.name=value;if(field==="relationship")primary.relationship=value as GuardianRelationship;if(field==="mobile")primary.mobile=value;}else{if(field==="name")secondary.name=value;if(field==="relationship")secondary.relationship=value as GuardianRelationship;if(field==="mobile")secondary.mobile=value;}const legacy=legacyFieldsFromGuardians(primary,secondary.name.trim()?secondary:undefined);return{...current,...legacy,...(which==="primary"&&field==="mobile"&&primaryWhatsAppSame?{primaryWhatsApp:value}:{}),...(which==="secondary"&&field==="mobile"&&secondaryWhatsAppSame?{alternateWhatsApp:value}:{})};});setNotice(null)}
 function togglePrimaryWhatsAppSame(checked:boolean){setPrimaryWhatsAppSame(checked);if(checked&&guardianView?.primary.mobile)patch("primaryWhatsApp",guardianView.primary.mobile)}
 function toggleSecondaryWhatsAppSame(checked:boolean){setSecondaryWhatsAppSame(checked);if(checked&&guardianView?.secondary?.mobile)patch("alternateWhatsApp",guardianView.secondary.mobile)}
 function applyParentPreferences(){
  const suggestions=suggestedScheduleFromPreferences(r!.preferredTimeWindows,selectedCourse?.sessionDuration??60);
  if(!suggestions.length){setNotice({type:"error",text:"No structured parent timing windows are available to apply. Add or correct the preferred timing windows first."});return;}
  const istSuggestions=convertWeeklyScheduleSlots(suggestions,r!.timezone||IST_TIMEZONE,IST_TIMEZONE,startDate);
  setScheduleTimezone(IST_TIMEZONE);setScheduleRules(istSuggestions);
  setNotice({type:"info",text:`Parent availability applied as ${istSuggestions.length} suggested IST class ${istSuggestions.length===1?"slot":"slots"}. Confirm the exact start times before activation.`});
 }

 const preferredRangeError=parentWindows.map(w=>timeRangeError(w.start,w.end,w.endsNextDay,12*60)).find(Boolean)??null;
 const scheduleRangeError=type==="one_to_one"&&scheduleRules.length?weeklyScheduleError(scheduleRules):null;
 const contactsValid=Boolean(guardianView?.primary.name&&validInternationalPhone(guardianView.primary.mobile)&&validInternationalPhone(r.primaryWhatsApp)&&(!guardianView.secondary?.mobile||validInternationalPhone(guardianView.secondary.mobile))&&(!r.alternateWhatsApp||validInternationalPhone(r.alternateWhatsApp)));
 const ready=Boolean(guardianView?.primary.name&&contactsValid&&r.childName&&r.childDob&&r.grade&&r.school&&isValidTimeZone(r.timezone)&&courseId&&trainerId&&startDate&&isValidTimeZone(scheduleTimezone)&&scheduleRules.length&&(type==="one_to_one"||cohortId)&&!preferredRangeError&&!scheduleRangeError&&(!hasScheduleExceptions||scheduleOverrideConfirmed));

 async function saveDraft(){
  if(busy)return;
  const issues=validateDraftDates({childDob:r?.childDob,startDate},todayIstDate());
  setFormIssues(issues);
  if(issues.length){if(issues.some(issue=>issue.field==="childDob"))setEditFamilyDetails(true);setNotice({type:"error",text:"Please review the highlighted date fields. Unsaved changes remain on this page."});return;}
  if(preferredRangeError||scheduleRangeError){setNotice({type:"error",text:preferredRangeError||scheduleRangeError||"Invalid time range."});return;}
  if(startDate&&!validNewEnrollmentDate(startDate)&&r?.status!=="active"){setNotice({type:"error",text:"Enrollment start date cannot be earlier than today (IST)."});return;}
  if(!dirty){setNotice({type:"info",text:"No new changes to save."});return;}
  setNotice(null);setActiveAction("draft");
  const parsedDays=[...new Set(parsePreferredTimeWindows(r!.preferredTimeWindows).map(w=>w.day))];
  const nextPreferredClassDays=parsedDays.length?parsedDays:r!.preferredClassDays;
  try {
  const result=await updateOnboardingSubmission(id,{motherName:r!.motherName,motherMobile:r!.motherMobile,fatherName:r!.fatherName,fatherMobile:r!.fatherMobile,primaryGuardianName:r!.primaryGuardianName,primaryGuardianRelationship:r!.primaryGuardianRelationship,primaryGuardianMobile:r!.primaryGuardianMobile,secondaryGuardianName:r!.secondaryGuardianName,secondaryGuardianRelationship:r!.secondaryGuardianRelationship,secondaryGuardianMobile:r!.secondaryGuardianMobile,primaryContact:guardianView?.primary.relationship==="father"?"father":guardianView?.primary.relationship==="mother"?"mother":"guardian",primaryWhatsApp:r!.primaryWhatsApp,alternateWhatsApp:r!.alternateWhatsApp,city:r!.city,country:r!.country,state:r!.state??"",timezone:r!.timezone,childName:r!.childName,childDob:r!.childDob,grade:r!.grade,school:r!.school,preferredClassDays:nextPreferredClassDays,preferredTimeWindows:r!.preferredTimeWindows,interests:r!.interests,goal:r!.goal,codingExperience:r!.codingExperience,roboticsExperience:r!.roboticsExperience,source:r!.source,referringParentName:(r!.source==="Existing parent"||r!.source==="Referred by an existing Robotronix parent")?(r!.referringParentName??"").trim():"",assignedCourseId:courseId||undefined,assignedTrainerId:trainerId||undefined,enrollmentType:type,cohortId:type==="small_group"?cohortId||undefined:undefined,startDate,draftScheduleTimezone:scheduleTimezone,draftScheduleRules:scheduleRules,status:r!.status});
  setActiveAction(null);
  if(!result){setNotice({type:"error",text:"Unable to save setup. Your changes are still on screen; please retry."});return;}
  const savedAt=new Date().toISOString();
  const nextRecord={...r!,primaryContact:guardianView?.primary.relationship==="father"?"father" as const:guardianView?.primary.relationship==="mother"?"mother" as const:"guardian" as const,preferredClassDays:nextPreferredClassDays,status:r!.status,updatedAt:savedAt,draftScheduleTimezone:scheduleTimezone,draftScheduleRules:scheduleRules};
  setLastSavedAt(savedAt);setBaseline(signature({record:nextRecord,courseId,trainerId,type,cohortId,startDate,scheduleTimezone,scheduleRules}));setNotice({type:"success",text:"Draft saved successfully."});
  setR(nextRecord);
  } catch (error) {
   setNotice({type:"error",text:readableSaveError(error)});
  } finally {
   setActiveAction(null);
  }
 }

 async function activate(){
  if(busy)return;
  const issues:FormIssue[]=[...validateDraftDates({childDob:r!.childDob,startDate},todayIstDate())];
  if(!guardianView?.primary.name?.trim())issues.push({field:"primaryGuardian",message:"Enter the primary parent or guardian's name."});
  if(!guardianView?.primary.mobile||!validInternationalPhone(guardianView.primary.mobile))issues.push({field:"primaryGuardian",message:"Enter a valid primary guardian mobile number with country code."});
  if(!r!.primaryWhatsApp||!validInternationalPhone(r!.primaryWhatsApp))issues.push({field:"primaryGuardian",message:"Enter a valid primary WhatsApp number with country code."});
  if(guardianView?.secondary?.mobile&&!validInternationalPhone(guardianView.secondary.mobile))issues.push({field:"primaryGuardian",message:"Correct the secondary guardian's mobile number."});
  if(r!.alternateWhatsApp&&!validInternationalPhone(r!.alternateWhatsApp))issues.push({field:"primaryGuardian",message:"Correct the alternate WhatsApp number."});
  if(!r!.childName?.trim())issues.push({field:"childProfile",message:"Enter the child's name."});
  if(!r!.childDob)issues.push({field:"childDob",message:"Enter the child's date of birth before activation."});
  if(!r!.grade)issues.push({field:"childProfile",message:"Select the child's grade or class."});
  if(!r!.school?.trim())issues.push({field:"school",message:"Enter the child's school."});
  if(!isValidTimeZone(r!.timezone))issues.push({field:"childProfile",message:"Select a valid family timezone."});
  if(!courseId)issues.push({field:"assignment",message:"Select a course."});
  if(!trainerId)issues.push({field:"assignment",message:"Assign a trainer."});
  if(type==="small_group"&&!cohortId)issues.push({field:"assignment",message:"Choose a cohort for group delivery."});
  if(!startDate)issues.push({field:"startDate",message:"Select the learner's course start date."});
  if(!isValidTimeZone(scheduleTimezone))issues.push({field:"schedule",message:"Select a valid schedule timezone."});
  if(!scheduleRules.length)issues.push({field:"schedule",message:"Add at least one confirmed weekly class slot."});
  if(preferredRangeError||scheduleRangeError)issues.push({field:"schedule",message:preferredRangeError||scheduleRangeError||"Correct the weekly schedule."});
  if(hasScheduleExceptions&&!scheduleOverrideConfirmed)issues.push({field:"schedule",message:"Review the schedule warning and confirm the manual override."});
  setFormIssues(issues);
  if(issues.length){if(issues.some(x=>["primaryGuardian","childProfile","childDob"].includes(x.field)))setEditFamilyDetails(true);setNotice({type:"error",text:"Activation is not ready. Select a highlighted requirement to correct it; your changes remain on screen."});return;}
  if(preferredRangeError||scheduleRangeError){setNotice({type:"error",text:preferredRangeError||scheduleRangeError||"Invalid time range."});return;}
  if(!validNewEnrollmentDate(startDate)){setNotice({type:"error",text:"Enrollment start date cannot be earlier than today (IST)."});return;}
  if(hasScheduleExceptions&&!scheduleOverrideConfirmed){setNotice({type:"error",text:"Review the schedule warnings and confirm the manual override before activation."});return;}
  if(!ready){setNotice({type:"error",text:"Complete all items in the readiness checklist before activation."});return;}
  setActiveAction("activate");setNotice(null);
  const res=await activateOnboarding(id,{courseId,trainerId,enrollmentType:type,cohortId:type==="small_group"?cohortId:undefined,startDate,scheduleTimezone,scheduleRules,scheduleOverrideConfirmed:hasScheduleExceptions&&scheduleOverrideConfirmed,scheduleOverrideNote:hasScheduleExceptions&&scheduleOverrideConfirmed?"Admin confirmed schedule exception against parent preference and/or trainer availability during activation.":undefined,schedulingHorizon:type==="small_group"?"manual":schedulingHorizon,schedulingWeeks:schedulingHorizon==="weeks"?schedulingWeeks:undefined});
  if(!res.ok){setActiveAction(null);setNotice({type:"error",text:("error" in res?res.error:undefined)??"Unable to activate learner."});return;}
  setActiveAction(null);
  const result={studentId:("studentId" in res?res.studentId:"")??"",enrollmentId:("enrollmentId" in res?res.enrollmentId:"")??"",classesCreated:("classesCreated" in res?res.classesCreated:undefined),schedulingWarning:("schedulingWarning" in res?res.schedulingWarning:undefined)};
  setActivationResult(result);
  setNotice(result.schedulingWarning?{type:"error",text:result.schedulingWarning}:{type:"success",text:"Learner activated successfully. Zoom classrooms will be provisioned near class time."});await refresh();
 }

 const statusIndex=r.status==="active"?3:r.status==="setup_pending"?2:1;
 const savedLabel=lastSavedAt?new Date(lastSavedAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}):"";

 return <RoleGuard allow={["admin"]}><AppShell role="admin">
  <AdminPageHeader eyebrow="ONBOARDING / LEARNER DETAILS" title={r.childName}
 description={[r.grade||"Class not provided",[r.city,r.country].filter(Boolean).join(", "),timeZoneLabel(r.timezone),`Submitted ${new Date(r.submittedAt).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}`].filter(Boolean).join(" · ")}
 actions={<Link href="/admin/onboarding" className="button ghost" onClick={event=>{if(dirty&&!window.confirm("Unsaved changes will be lost. Leave onboarding?"))event.preventDefault()}}>← Back to onboarding</Link>}/>
 <div className="cleanStepper" aria-label="Onboarding progress">{[{n:1,t:"New"},{n:2,t:"Setup pending"},{n:3,t:"Active"}].map((s,i)=><div className={`cleanStep ${statusIndex>s.n?"done":statusIndex===s.n?"current":""}`} key={s.n}><span>{statusIndex>s.n?"✓":s.n}</span><b>{s.t}</b>{i<2&&<i/>}</div>)}</div>
 {activated&&<section className="panel" aria-label="Learner enrollment summary" style={{marginTop:18}}>
  <div className="panelHeader"><div><div className="eyebrow">ACTIVE LEARNER · ENROLLMENT</div><h2>Learner ready for classes</h2>
   <p>The student profile and enrollment are active. Classes are managed through the enrollment. Zoom rooms are created shortly before class time.</p></div><span className="softBadge softGreen">✓ Active</span></div>
  <div className="summaryDefinitionGrid" style={{marginBottom:16}}>
   <Info a="Course" b={courseSummary?.title||"View enrollment for details"}/>
   <Info a="Trainer" b={trainerSummary?.fullName||"View enrollment for details"}/>
   <Info a="Delivery" b={r.enrollmentType==="small_group"?"Cohort":"1-to-1"}/>
   <Info a="Start date" b={r.startDate||"Not provided"}/>
   <Info a="Next scheduled class" b={nextClass?`${nextClass.date} · ${formatClock(nextClass.startTime)} (${shortTimeZoneLabel(nextClass.timezone||IST_TIMEZONE)})`:"No upcoming class found"}/>
   <Info a="Family login" b={r.loginEmail||"Not linked"}/>
  </div>
  {linkedState&&(!linkedState.student||!linkedState.enrollment)&&<div className="errorBanner" role="alert" style={{marginBottom:12}}>{linkedState.error||"The activated student or enrollment could not be found or does not match this onboarding record. Review the linked records before taking further action."}</div>}
  {!r.school?.trim()&&<div className="infoBanner" role="status" style={{marginBottom:12}}>School information is missing. Please correct it in the student profile.</div>}
  {activationResult?.schedulingWarning&&<div className="infoBanner" role="status" style={{marginBottom:12}}>{activationResult.schedulingWarning}</div>}
  <div className="formActions" style={{display:"flex",flexWrap:"wrap",gap:10}}>
   {activatedEnrollmentId&&linkedState?.enrollment!==false?<Link className="button" href={`/admin/enrollments/${encodeURIComponent(activatedEnrollmentId)}`}>View enrollment</Link>:<span className="fieldHint">Enrollment link unavailable.</span>}
   {activatedStudentId&&linkedState?.student!==false&&<Link className="button secondary" href={`/admin/students/${encodeURIComponent(activatedStudentId)}`}>Student profile & corrections</Link>}
  </div>
 </section>}
 <section className="onboardingSummaryCards">
   <div className={`panel onboardingSummaryCard familyDetailsCard ${editFamilyDetails?"editMode":""}`}><div className="panelHeader"><div><div className="eyebrow">FAMILY & CONTACT</div><h2>Family details</h2><p>{activated?"Submitted details are read-only here. Make post-activation corrections in the student profile.":"Review and correct family information before activation."}</p></div>{!activated&&<button type="button" className="button ghost smallButton" onClick={()=>setEditFamilyDetails(v=>!v)}>{editFamilyDetails?"Hide editor":"Edit family details"}</button>}</div>
    {!editFamilyDetails?<div className="summaryDefinitionGrid"><Info a="Child" b={`${r.childName} · ${r.grade||"Grade not set"}`}/><Info a="Primary guardian" b={guardianView?`${guardianView.primary.name} · ${relationshipLabel(guardianView.primary.relationship)}`:"—"}/><Info a="Secondary guardian" b={guardianView?.secondary?`${guardianView.secondary.name} · ${relationshipLabel(guardianView.secondary.relationship)}`:"Not added"}/><Info a="Primary WhatsApp" b={r.primaryWhatsApp||"—"}/><Info a="Location" b={[r.city,r.state&&r.state.toLowerCase()!==r.city.toLowerCase()?r.state:null,r.country].filter(Boolean).join(", ")}/><Info a="Timezone" b={timeZoneLabel(r.timezone)}/><Info a="School" b={r.school||"Not provided"}/></div>:<div className="compactEditGrid familyEditWorkspace">
      <div className="editSubsection"><div className="editSubsectionHead"><b>Parent / guardian details</b><span>Phone numbers are stored with international country codes.</span></div>
       <div id="field-primaryGuardian" tabIndex={-1} className="guardianContactCard primaryGuardianCard" style={formIssues.some(x=>x.field==="primaryGuardian")?{outline:"2px solid #dc2626",outlineOffset:3}:undefined}><div className="guardianCardHead"><b>Primary parent / guardian</b><span>Required</span></div><div className="guardianIdentityGrid"><Field label="Name" value={guardianView?.primary.name??""} onChange={v=>patchGuardian("primary","name",v)}/><div className="formGroup"><label>Relationship</label><select className="input" value={guardianView?.primary.relationship??"guardian"} onChange={e=>patchGuardian("primary","relationship",e.target.value)}>{guardianRelationshipOptions.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}</select></div></div><PhoneField className="guardianPhoneFull" hint="" label="Mobile" value={guardianView?.primary.mobile??""} onChange={v=>patchGuardian("primary","mobile",v)} country={r.country}/><label className="sameAsContact"><input type="checkbox" checked={primaryWhatsAppSame} onChange={e=>togglePrimaryWhatsAppSame(e.target.checked)}/><span>WhatsApp same as mobile</span></label>{!primaryWhatsAppSame&&<PhoneField className="guardianPhoneFull" hint="" label="Primary WhatsApp" value={r.primaryWhatsApp} onChange={v=>patch("primaryWhatsApp",v)} country={r.country} required/>}</div>
       <div className="guardianContactCard secondaryGuardianCard"><div className="guardianCardHead"><b>Secondary parent / guardian</b><span>Optional</span></div><div className="guardianIdentityGrid"><Field label="Name" value={guardianView?.secondary?.name??""} onChange={v=>patchGuardian("secondary","name",v)}/><div className="formGroup"><label>Relationship</label><select className="input" value={guardianView?.secondary?.relationship??"guardian"} onChange={e=>patchGuardian("secondary","relationship",e.target.value)}>{guardianRelationshipOptions.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}</select></div></div><PhoneField className="guardianPhoneFull" hint="" label="Mobile" value={guardianView?.secondary?.mobile??""} onChange={v=>patchGuardian("secondary","mobile",v)} country={r.country}/>{Boolean(guardianView?.secondary?.name||guardianView?.secondary?.mobile)&&<><label className="sameAsContact"><input type="checkbox" checked={secondaryWhatsAppSame} onChange={e=>toggleSecondaryWhatsAppSame(e.target.checked)}/><span>WhatsApp same as mobile</span></label>{!secondaryWhatsAppSame&&<PhoneField className="guardianPhoneFull" hint="" label="Secondary WhatsApp" value={r.alternateWhatsApp} onChange={v=>patch("alternateWhatsApp",v)} country={r.country}/>}</>}</div>
      </div>
      <div id="field-childProfile" tabIndex={-1} className="editSubsection" style={formIssues.some(x=>x.field==="childProfile")?{outline:"2px solid #dc2626",outlineOffset:3}:undefined}><div className="editSubsectionHead"><b>Family & child details</b><span>Location and timezone are used for scheduling and time conversion.</span></div><div className="formGrid familyChildEditGrid"><CountryCityFields country={r.country} state={r.state||""} city={r.city} onCountryChange={v=>patch("country",v)} onStateChange={v=>patch("state",v)} onCityChange={v=>patch("city",v)} onTimeZoneSuggestion={v=>patch("timezone",v)}/><TimeZoneField className="fullSpan" value={r.timezone} onChange={v=>{patch("timezone",v);if(type==="one_to_one")setScheduleTimezone(IST_TIMEZONE)}} label="Family timezone" required autoMode locationLabel={[r.city,r.state].filter(Boolean).join(", ")}/><Field label="Child name" required value={r.childName} onChange={v=>patch("childName",v)}/><GradeSelect value={r.grade} onChange={v=>patch("grade",v)} required/><Field label="Date of birth" required value={r.childDob??""} onChange={v=>patch("childDob",v)} type="date" id="field-childDob" error={formIssues.find(x=>x.field==="childDob")?.message}/><div className="fullSpan"><Field label="School" required id="field-school" error={formIssues.find(x=>x.field==="school")?.message} value={r.school} onChange={v=>patch("school",v)}/></div></div></div>
     </div>}
   </div>
   <div className="panel onboardingSummaryCard"><div className="panelHeader"><div><div className="eyebrow">LEARNING PROFILE</div><h2>Interests & starting point</h2><p>What the family told us about the learner.</p></div></div><div className="summaryDefinitionGrid"><Info a="Interests" b={r.interests.join(" · ")||"Not provided"}/><Info a="Goal" b={r.goal||"Not provided"}/><Info a="Coding experience" b={r.codingExperience||"Not provided"}/><Info a="Robotics experience" b={r.roboticsExperience||"Not provided"}/><Info a="Source" b={r.source||"Not provided"}/>{(r.source==="Existing parent"||r.source==="Referred by an existing Robotronix parent")&&<Info a="Referring parent" b={r.referringParentName?.trim()||"Not provided"}/>}{!activated&&<Info a="Family login" b={r.loginEmail||"Not linked"}/>}</div></div>
  </section>

  {r.status!=="active"?<section className="panel assignmentPanel"><div className="panelHeader"><div><div className="eyebrow">LEARNING SETUP</div><h2>Assign course, trainer and delivery</h2><p>Save a draft at any time. The exact recurring class slot should sit inside the family’s preferred availability wherever possible.</p></div></div>
   <div className="assignmentWorkspace">
    <div id="field-assignment" tabIndex={-1} className="assignmentSetupCard" style={formIssues.some(x=>x.field==="assignment")?{outline:"2px solid #dc2626",outlineOffset:3}:undefined}><div className="subsectionHeader"><span>ASSIGNMENT</span><b>Course, delivery & trainer</b></div><div className="formGrid assignmentFields"><div className="formGroup"><label>Course *</label><select className="input" value={courseId} onChange={e=>{setCourseId(e.target.value);setTrainerId("");setCohortId("");setNotice(null)}}><option value="">Choose course</option>{courses.filter(c=>c.status==="active").map(c=><option value={c.id} key={c.id}>{c.title} · Grades {c.gradeFrom}–{c.gradeTo}</option>)}</select></div><div className="formGroup"><label>Trainer *</label><select className="input" value={trainerId} onChange={e=>{setTrainerId(e.target.value);setCohortId("");setNotice(null)}}><option value="">Choose trainer</option>{eligibleTrainers.map(t=><option value={t.id} key={t.id}>{t.fullName} · {t.designation}</option>)}</select></div><div className="formGroup"><label>Delivery *</label><select className="input" value={type} onChange={e=>{const value=e.target.value as "one_to_one"|"small_group";setType(value);setCohortId("");if(value==="one_to_one")setScheduleTimezone(IST_TIMEZONE);setNotice(null)}}><option value="one_to_one">1-to-1</option><option value="small_group">Cohort</option></select></div>{type==="small_group"&&<div className="formGroup"><label>Cohort *</label><select className="input" value={cohortId} onChange={e=>{const value=e.target.value;setCohortId(value);const c=cohorts.find(x=>x.id===value);if(c){setScheduleTimezone(c.scheduleTimezone);setScheduleRules(c.scheduleRules)}setNotice(null)}}><option value="">Choose available cohort</option>{eligibleCohorts.map(c=><option value={c.id} key={c.id}>{c.name} · {c.studentIds.length}/{c.capacity}</option>)}</select></div>}</div><div className="assignmentContextGrid"><div><span>Session duration</span><b>{selectedCourse?`${selectedCourse.sessionDuration} min`:"Choose course"}</b></div><div><span>Family timezone</span><b>{shortTimeZoneLabel(r.timezone||IST_TIMEZONE)}</b></div><div><span>Preferred windows</span><b>{parentWindows.length}</b></div><div><span>Trainer availability</span><b>{trainerId?(trainerAvailabilityConfigured?"Configured":"Not configured"):"Choose trainer"}</b></div></div></div>
    <div className="schedulingAssistColumn"><div className="parentAvailabilitySetupEditor"><div className="schedulingAssistHead"><div><span className="experienceLabel">FAMILY AVAILABILITY</span><b>Parent preferred availability</b><small>Review the family's preferred class days and time windows.</small></div><button type="button" className="button ghost smallButton" aria-expanded={editAvailability} onClick={()=>setEditAvailability(v=>!v)}>{editAvailability?"Close editor":"Edit availability"}</button></div>{!editAvailability&&<div className="parentAvailabilitySummary">{parentWindows.length?<><div className="parentAvailabilityChips">{parentWindows.map((w,i)=><span key={w.day+"-"+i}>{w.day.slice(0,3)} {formatClock(w.start)}–{formatClock(w.end)} {shortTimeZoneLabel(r.timezone||IST_TIMEZONE)}</span>)}</div><small>{parentWindows.length} preferred window{parentWindows.length===1?"":"s"} saved. Choose Edit availability to make changes.</small></>:<div className="parentAvailabilityEmpty"><b>No preferred timings recorded</b><span>Add the family's confirmed days and times to compare them with a trainer.</span></div>}</div>}{parentTimingNote&&<div className="infoBanner compactInfoBanner"><b>Parent note:</b><span>{parentTimingNote}</span></div>}{editAvailability&&<div className="topGap"><PreferredAvailabilityEditor value={r.preferredTimeWindows??""} timeZone={r.timezone||IST_TIMEZONE} onChange={v=>patch("preferredTimeWindows",v)}/><small className="fieldHint">Changes are not saved until you select Save draft.</small></div>}</div>{type==="one_to_one"?<div className="preferenceAssist schedulingAssist"><div className="schedulingAssistHead"><div><span className="experienceLabel">SCHEDULE MATCHING</span><b>Trainer schedule matching</b><small>Compare saved family preferences with trainer availability (IST).</small></div></div>{parentWindows.length?<><div className="scheduleMatchSummary">{trainerId?<><span><b>{scheduleMatches.filter(m=>m.status==="available").length}</b> full matches</span><span><b>{scheduleMatches.filter(m=>m.status==="partial").length}</b> partial</span><span><b>{scheduleMatches.filter(m=>m.status==="unavailable").length}</b> unavailable</span></>:<span>Select a trainer to compare these windows.</span>}</div><div className="availabilityMatchList">{(trainerId?scheduleMatches:parentWindows.map(w=>({window:w,status:"unavailable" as const,date:"",parentLabel:"",trainerLabel:""}))).map((m,i)=>{const display=preferredWindowAdminDisplay(m.window,r.timezone||IST_TIMEZONE,startDate||todayIstDate());return <div className={`availabilityMatchRow match-${m.status}`} key={`${m.window.day}-${i}`}><div><b>{display.istLabel} IST</b><small>Family: {display.familyLabel}</small><small>{trainerId?!trainerAvailabilityConfigured?"Trainer availability not configured":m.status==="available"?"Trainer available for this full IST window":m.status==="partial"?`Partial trainer overlap · ${m.overlapLabel}`:"Trainer not available for this IST window":"Select a trainer to compare this IST window"}</small>{"reason" in m&&m.reason&&<small>{m.reason}</small>}</div><span className={`softBadge ${m.status==="available"?"softGreen":m.status==="partial"?"softAmber":""}`}>{trainerId?(!trainerAvailabilityConfigured?"Not configured":m.status==="available"?"Available":m.status==="partial"?"Partial":"Not available"):"Not checked"}</span></div>})}</div></>:<div className="emptyState compact">No preferred timings yet. Use Edit availability above to add confirmed windows.</div>}</div>:<div className="cohortSetupHint"><span>COHORT DELIVERY</span><b>Select an available cohort</b><p>The cohort's saved schedule and timezone will become the learner's final recurring schedule.</p></div>}</div>
   </div>
   <div id="field-schedule" tabIndex={-1} className="finalScheduleSection" style={formIssues.some(x=>x.field==="schedule")?{outline:"2px solid #dc2626",outlineOffset:3}:undefined}><div className="subsectionHeader"><span>FINAL CLASS PLAN</span><b>Weekly class schedule</b><small>Start empty, then add only the recurring class slot(s) you actually confirm after checking the parent window, course duration and trainer availability.</small></div>
   <WeeklyScheduleEditor timezone={scheduleTimezone} slots={scheduleRules} defaultDurationMinutes={selectedCourse?.sessionDuration??60} required disabled={type==="small_group"&&Boolean(cohortId)} adminIstFirst={type==="one_to_one"} familyTimezone={r.timezone||IST_TIMEZONE} referenceDate={startDate} onTimezoneChange={v=>{setScheduleTimezone(type==="one_to_one"?IST_TIMEZONE:v);setNotice(null)}} onSlotsChange={v=>{setScheduleRules(v);setNotice(null)}}/>
   {scheduleRules.length>0&&<div className="finalPlanSnapshot"><div><span>Course</span><b>{selectedCourse?.shortTitle||selectedCourse?.title||"—"}</b></div><div><span>Trainer</span><b>{trainers.find(t=>t.id===trainerId)?.fullName||"—"}</b></div><div><span>Delivery</span><b>{type==="one_to_one"?"1-to-1":cohorts.find(c=>c.id===cohortId)?.name||"Cohort"}</b></div><div><span>Recurring plan</span><b>{formatWeeklySchedule(scheduleRules,scheduleTimezone)}</b></div></div>}
   {type==="one_to_one"&&scheduleRules.length>0&&<div className="finalScheduleValidationPanel">
    <div className="finalScheduleValidationHead"><div><span className="experienceLabel">SCHEDULE CHECK</span><b>Final slot validation</b><small>Parent preferences and trainer availability are soft constraints. Exceptions are allowed only after Admin confirms them.</small></div></div>
    <div className="finalScheduleValidationList">{finalScheduleValidation.map(v=><div className={`finalScheduleValidationRow ${v.parentStatus==="inside"&&v.trainerStatus==="available"?"validationOk":"validationWarning"}`} key={`${v.slot.dayOfWeek}-${v.slot.startTime}-${v.index}`}>
     <div className="validationSlot"><b>{dayNames[v.slot.dayOfWeek].slice(0,3)} · {formatClock(v.slot.startTime)}–{formatClock(v.slot.endTime)} IST</b></div>
     <div className={v.parentStatus==="inside"?"validationLine ok":"validationLine warn"}><span>{v.parentStatus==="inside"?"✓":"⚠"}</span><span>{v.parentMessage}</span></div>
     <div className={v.trainerStatus==="available"?"validationLine ok":"validationLine warn"}><span>{v.trainerStatus==="available"?"✓":"⚠"}</span><span>{v.trainerMessage}</span></div>
    </div>)}</div>
    {hasScheduleExceptions?<label className="scheduleOverrideConfirm"><input type="checkbox" checked={scheduleOverrideConfirmed} onChange={e=>setScheduleOverrideConfirmed(e.target.checked)}/><span><b>Manual schedule override confirmed</b><small>I have confirmed these exception timings with the family and/or trainer and approve activation with this schedule.</small></span></label>:<div className="scheduleValidationSuccess">✓ Final class plan is within the parent preference and trainer availability.</div>}
   </div>}
   {type==="small_group"&&cohortId&&<div className="entityBoundaryNote"><b>Cohort schedule</b><span>{formatWeeklySchedule(scheduleRules,scheduleTimezone)}</span></div>}
   </div>
   <div className="panel" style={{marginTop:16}}>
    <div className="subsectionHeader"><span>COURSE SCHEDULE</span><b>Course calendar preview</b><small>Review class dates and times before activating this learner.</small></div>
    <div className="formGrid">
     <div className="formGroup"><label>Course start date *</label><input id="field-startDate" className="input" type="date" min={todayIstDate()} value={startDate} aria-invalid={Boolean(formIssues.some(x=>x.field==="startDate"))} style={formIssues.some(x=>x.field==="startDate")?{borderColor:"#dc2626"}:undefined} onChange={e=>{setStartDate(e.target.value);setNotice(null);setFormIssues(a=>a.filter(x=>x.field!=="startDate"))}}/>{formIssues.find(x=>x.field==="startDate")&&<small className="fieldError">{formIssues.find(x=>x.field==="startDate")?.message}</small>}<small className="fieldHint">Choose when the learner can begin. The first class will fall on or after this date, according to the confirmed weekly plan.</small></div>
     <div className="formGroup"><label>How should classes be booked?</label><select className="input" value={schedulingHorizon} onChange={e=>setSchedulingHorizon(e.target.value as SchedulingHorizon)}><option value="full">Automatically schedule the entire course</option><option value="weeks">Automatically schedule selected weeks</option><option value="manual">I will schedule classes manually</option></select></div>
     {schedulingHorizon==="weeks"&&<div className="formGroup"><label>Weeks to preview</label><input className="input" type="number" min={1} max={104} value={schedulingWeeks} onChange={e=>setSchedulingWeeks(Number(e.target.value))}/></div>}
    </div>
    {type==="small_group"?<p className="fieldHint">Batch classes must be generated once per cohort, not for each learner. This preview does not create duplicate cohort bookings.</p>:schedulingHorizon==="manual"?<p className="fieldHint">No classes will be automatically booked at activation. After activation, use Admin → Schedule → + Schedule item to add regular, ad-hoc, makeup or extra classes for this enrollment.</p>:schedulePreview.error?<div className="errorBanner">{schedulePreview.error}</div>:<><p className="fieldHint"><b>{schedulePreview.items.length} class dates previewed</b> · {selectedCourse?.totalSessions??0} sessions in course · {schedulePreview.items.filter(x=>x.conflicts.length).length} flagged date(s). {previewBookingsLoaded?"Existing scheduled events included in conflict preview.":"Existing bookings could not be loaded; conflict checks are incomplete."} Actual booking conflicts must also be checked server-side.</p><div style={{maxHeight:220,overflowY:"auto"}}><table className="table"><thead><tr><th>#</th><th>Date</th><th>Time ({shortTimeZoneLabel(scheduleTimezone)})</th><th>Preview checks</th></tr></thead><tbody>{schedulePreview.items.map((slot,i)=><tr key={i}><td>{i+1}</td><td>{slot.date}</td><td>{formatClock(slot.startTime)} – {formatClock(slot.endTime)}</td><td>{slot.conflicts.length?slot.conflicts.join(", ") :previewBookingsLoaded?"No detected overlap":"Not fully checked"}</td></tr>)}</tbody></table></div></>}
   </div>
   <div className="readinessCard"><div><b>Ready to activate</b><span>Select any incomplete requirement to jump to the field. Saving a draft does not require completing activation fields.</span></div><ul>{([
 ["Primary guardian name and contact",Boolean(guardianView?.primary.name&&contactsValid),"primaryGuardian",true],
 ["Child name",Boolean(r.childName?.trim()),"childProfile",true],
 ["Date of birth",Boolean(r.childDob),"childDob",true],
 ["Grade / class",Boolean(r.grade),"childProfile",true],
 ["School",Boolean(r.school?.trim()),"school",true],
 ["Family timezone",isValidTimeZone(r.timezone),"childProfile",true],
 ["Course selected",Boolean(courseId),"assignment",false],
 ["Trainer assigned",Boolean(trainerId),"assignment",false],
 ["Course start date",Boolean(startDate),"startDate",false],
 ["Delivery and weekly schedule",Boolean(scheduleRules.length&&(type==="one_to_one"||cohortId)&&isValidTimeZone(scheduleTimezone)),"schedule",false],
 ...(type==="one_to_one"&&scheduleRules.length>0?[["Parent and trainer timing checks",Boolean(!hasScheduleExceptions||scheduleOverrideConfirmed),"schedule",false] as [string,boolean,string,boolean]]:[])
 ] as [string,boolean,string,boolean][]).map(([label,done,field,expand])=><li key={label} className={done?"ok":""}><button type="button" aria-label={done?label+" completed":"Complete "+label} onClick={()=>{if(expand)setEditFamilyDetails(true);window.setTimeout(()=>{const target=document.getElementById("field-"+field);target?.scrollIntoView({behavior:"smooth",block:"center"});target?.focus()},0)}} style={{all:"unset",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:8}}><span aria-hidden="true" style={{flex:"0 0 16px",textAlign:"center",fontWeight:900,lineHeight:1}}>{done?"✓":"○"}</span><span>{label}{!done?" — required":""}</span></button></li>)}</ul></div>
   <div className={`saveStateBar ${dirty?"dirty":"clean"}`}><span>{dirty?"● Unsaved changes":activeAction==="draft"?"Saving…":lastSavedAt?`✓ Last saved at ${savedLabel}`:"✓ No unsaved changes"}</span><small>{dirty?"Save the setup before leaving this page.":"Draft schedule and assignment are preserved on reload."}</small></div>
   <FormErrorSummary issues={formIssues}/>{notice&&notice.type!=="success"&&<div className={notice.type==="error"?"errorBanner":"infoBanner"}>{notice.text}</div>}
   <div className="formActions stickyOnboardingActions"><div role="status" aria-live="polite" aria-atomic="true" style={{flex:"1 1 240px",minWidth:0}}>{notice?.type==="success"?<span className="successBanner" style={{display:"inline-block",margin:0,padding:"8px 12px",fontSize:"0.9rem"}}>{notice.text}</span>:notice?<span style={{fontSize:"0.85rem",color:"var(--text-muted, #64748b)"}}>Review the message above.</span>:<span style={{fontSize:"0.85rem",color:"var(--text-muted, #64748b)"}}>{dirty?"● Unsaved changes":lastSavedAt?"✓ Draft saved":"No unsaved changes"}</span>}</div><button className="button ghost" disabled={busy||!dirty} onClick={saveDraft}>{activeAction==="draft"?"Saving draft…":dirty?"Save draft":"Draft saved"}</button><button className="button" disabled={busy} onClick={activate}>{activeAction==="activate"?"Activating…":"Activate learner"}</button></div>
  </section>:null}
 </AppShell></RoleGuard>;
}

function Info({a,b}:{a:string;b:string}){return <div><span>{a}</span><b>{b||"—"}</b></div>}
function Field({label,value,onChange,type="text",id,error,required=false}:{label:string;value:string;onChange:(v:string)=>void;type?:string;id?:string;error?:string;required?:boolean}){return <div className="formGroup"><label htmlFor={id}>{label}{required?" *":""}</label><input required={required} id={id} className="input" type={type} value={value} aria-invalid={Boolean(error)} aria-describedby={error&&id?id+"-error":undefined} style={error?{borderColor:"#dc2626"}:undefined} onChange={e=>onChange(e.target.value)}/>{error&&<small id={id+"-error"} className="fieldError">{error}</small>}</div>}
