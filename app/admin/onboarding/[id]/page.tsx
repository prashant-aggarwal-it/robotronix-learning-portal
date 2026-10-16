"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {useParams,useRouter} from "next/navigation";
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
import {activateOnboarding,getOnboardingSubmission,listAdminCohorts,listAdminCourses,listAdminTrainers,listTrainerAvailability,listAvailabilityOverrides,updateOnboardingSubmission} from "@/lib/repository";
import {IST_TIMEZONE,convertWeeklyScheduleSlots,dayNames,formatClock,formatWeeklySchedule,isValidTimeZone,nextIsoDateForWeekday,shortTimeZoneLabel,timeZoneLabel,zonedRangeParts} from "@/lib/timezones";
import type {CohortAdminRecord,CourseAdminRecord,OnboardingSubmission,TrainerAdminRecord,TrainerAvailability,TrainerAvailabilityOverride,WeeklyScheduleSlot} from "@/lib/types";
import {matchPreferredWindows,validateFinalScheduleSlots} from "@/lib/availability-match";
import {isRunningCohort,isUpcomingCohort} from "@/lib/cohort-status";
import {validInternationalPhone} from "@/lib/phones";
import {timeRangeError,weeklyScheduleError} from "@/lib/time-range-validation";
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
 return JSON.stringify({motherName:r.motherName,motherMobile:r.motherMobile,fatherName:r.fatherName,fatherMobile:r.fatherMobile,primaryContact:r.primaryContact,primaryWhatsApp:r.primaryWhatsApp,alternateWhatsApp:r.alternateWhatsApp,city:r.city,country:r.country,state:r.state??"",timezone:r.timezone,addressLine1:r.addressLine1,addressLine2:r.addressLine2??"",postalCode:r.postalCode,billingName:r.billingName,billingEmail:r.billingEmail,billingPhone:r.billingPhone,childName:r.childName,childDob:r.childDob,grade:r.grade,school:r.school,preferredClassDays:r.preferredClassDays??[],preferredTimeWindows:r.preferredTimeWindows??"",interests:r.interests,goal:r.goal,codingExperience:r.codingExperience,roboticsExperience:r.roboticsExperience,source:r.source,courseId:input.courseId,trainerId:input.trainerId,type:input.type,cohortId:input.type==="small_group"?input.cohortId:"",startDate:input.startDate,scheduleTimezone:input.scheduleTimezone,scheduleRules:input.scheduleRules});
}

export default function OnboardingDetail(){
 const{id}=useParams<{id:string}>();
 const router=useRouter();
 const[r,setR]=useState<OnboardingSubmission|null|undefined>(undefined);
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
 const[activeAction,setActiveAction]=useState<ActiveAction>(null);
 const[lastSavedAt,setLastSavedAt]=useState<string|undefined>();
 const[baseline,setBaseline]=useState("");
 const[courseId,setCourseId]=useState("");
 const[trainerId,setTrainerId]=useState("");
 const[type,setType]=useState<"one_to_one"|"small_group">("one_to_one");
 const[cohortId,setCohortId]=useState("");
 const[scheduleTimezone,setScheduleTimezone]=useState(IST_TIMEZONE);
 const[scheduleRules,setScheduleRules]=useState<WeeklyScheduleSlot[]>([]);
 const[startDate,setStartDate]=useState(todayIstDate());
 const[scheduleOverrideConfirmed,setScheduleOverrideConfirmed]=useState(false);

 async function refresh(){
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
  const nextStartDate=a.startDate??todayIstDate();
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
 }
 useEffect(()=>{refresh()},[id]);

 const eligibleTrainers=useMemo(()=>trainers.filter(t=>t.recordStatus==="active"&&(!courseId||t.courseIds.includes(courseId))),[trainers,courseId]);
 const eligibleCohorts=useMemo(()=>cohorts.filter(c=>(isRunningCohort(c)||isUpcomingCohort(c))&&c.courseId===courseId&&c.trainerId===trainerId&&c.studentIds.length<c.capacity),[cohorts,courseId,trainerId]);
 const parentWindows=useMemo(()=>parsePreferredTimeWindows(r?.preferredTimeWindows),[r?.preferredTimeWindows]);
 const parentTimingNote=useMemo(()=>preferredTimingNote(r?.preferredTimeWindows),[r?.preferredTimeWindows]);
 const parentPreferenceDaySummary=useMemo(()=>{const days=[...new Set(parentWindows.map(w=>w.day.slice(0,3)))];return days.length?days.join(", "):"No days submitted"},[parentWindows]);
 const parentWindowDisplays=useMemo(()=>parentWindows.map(window=>preferredWindowAdminDisplay(window,r?.timezone||IST_TIMEZONE,startDate)),[parentWindows,r?.timezone,startDate]);
 const selectedCourse=useMemo(()=>courses.find(c=>c.id===courseId),[courses,courseId]);
 const scheduleMatches=useMemo(()=>r&&trainerId?matchPreferredWindows({windows:parentWindows,parentTimezone:r.timezone||IST_TIMEZONE,trainerId,startDate,availability,overrides:availabilityOverrides}):[],[r,trainerId,startDate,parentWindows,availability,availabilityOverrides]);
 const trainerAvailabilityConfigured=useMemo(()=>Boolean(
  trainerId&&(
   availability.some(a=>a.trainerId===trainerId&&a.enabled)||
   availabilityOverrides.some(o=>o.trainerId===trainerId)
  )
 ),[availability,availabilityOverrides,trainerId]);
 const finalScheduleValidation=useMemo(()=>type==="one_to_one"&&trainerId?validateFinalScheduleSlots({
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

 if(r===undefined)return <RoleGuard allow={["admin"]}><AppShell role="admin"><div className="panel">Loading onboarding record…</div></AppShell></RoleGuard>;
 if(!r)return <RoleGuard allow={["admin"]}><AppShell role="admin"><div className="emptyState">Onboarding record not found.</div></AppShell></RoleGuard>;

 function patch(k:keyof OnboardingSubmission,v:any){setR(x=>x?{...x,[k]:v}:x);setNotice(null)}
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
  if(preferredRangeError||scheduleRangeError){setNotice({type:"error",text:preferredRangeError||scheduleRangeError||"Invalid time range."});return;}
  if(startDate&&!validNewEnrollmentDate(startDate)&&r?.status!=="active"){setNotice({type:"error",text:"Enrollment start date cannot be earlier than today (IST)."});return;}
  if(!dirty){setNotice({type:"info",text:"No new changes to save."});return;}
  setNotice(null);setActiveAction("draft");
  const parsedDays=[...new Set(parsePreferredTimeWindows(r!.preferredTimeWindows).map(w=>w.day))];
  const nextPreferredClassDays=parsedDays.length?parsedDays:r!.preferredClassDays;
  const result=await updateOnboardingSubmission(id,{motherName:r!.motherName,motherMobile:r!.motherMobile,fatherName:r!.fatherName,fatherMobile:r!.fatherMobile,primaryGuardianName:r!.primaryGuardianName,primaryGuardianRelationship:r!.primaryGuardianRelationship,primaryGuardianMobile:r!.primaryGuardianMobile,secondaryGuardianName:r!.secondaryGuardianName,secondaryGuardianRelationship:r!.secondaryGuardianRelationship,secondaryGuardianMobile:r!.secondaryGuardianMobile,primaryContact:r!.primaryContact,primaryWhatsApp:r!.primaryWhatsApp,alternateWhatsApp:r!.alternateWhatsApp,city:r!.city,country:r!.country,state:r!.state??"",timezone:r!.timezone,childName:r!.childName,childDob:r!.childDob,grade:r!.grade,school:r!.school,preferredClassDays:nextPreferredClassDays,preferredTimeWindows:r!.preferredTimeWindows,interests:r!.interests,goal:r!.goal,codingExperience:r!.codingExperience,roboticsExperience:r!.roboticsExperience,source:r!.source,assignedCourseId:courseId||undefined,assignedTrainerId:trainerId||undefined,enrollmentType:type,cohortId:type==="small_group"?cohortId||undefined:undefined,startDate,draftScheduleTimezone:scheduleTimezone,draftScheduleRules:scheduleRules,status:"setup_pending"});
  setActiveAction(null);
  if(!result){setNotice({type:"error",text:"Unable to save setup. Your changes are still on screen; please retry."});return;}
  const savedAt=new Date().toISOString();
  const nextRecord={...r!,preferredClassDays:nextPreferredClassDays,status:"setup_pending" as const,updatedAt:savedAt,draftScheduleTimezone:scheduleTimezone,draftScheduleRules:scheduleRules};
  setLastSavedAt(savedAt);setBaseline(signature({record:nextRecord,courseId,trainerId,type,cohortId,startDate,scheduleTimezone,scheduleRules}));setNotice({type:"success",text:"Draft saved successfully."});
  setR(nextRecord);
 }

 async function activate(){
  if(preferredRangeError||scheduleRangeError){setNotice({type:"error",text:preferredRangeError||scheduleRangeError||"Invalid time range."});return;}
  if(!validNewEnrollmentDate(startDate)){setNotice({type:"error",text:"Enrollment start date cannot be earlier than today (IST)."});return;}
  if(hasScheduleExceptions&&!scheduleOverrideConfirmed){setNotice({type:"error",text:"Review the schedule warnings and confirm the manual override before activation."});return;}
  if(!ready){setNotice({type:"error",text:"Complete all items in the readiness checklist before activation."});return;}
  setActiveAction("activate");setNotice(null);
  const res=await activateOnboarding(id,{courseId,trainerId,enrollmentType:type,cohortId:type==="small_group"?cohortId:undefined,startDate,scheduleTimezone,scheduleRules,scheduleOverrideConfirmed:hasScheduleExceptions&&scheduleOverrideConfirmed,scheduleOverrideNote:hasScheduleExceptions&&scheduleOverrideConfirmed?"Admin confirmed schedule exception against parent preference and/or trainer availability during activation.":undefined});
  setActiveAction(null);
  if(!res.ok){setNotice({type:"error",text:("error" in res?res.error:undefined)??"Unable to activate learner."});return;}
  setNotice({type:"success",text:"Learner activated successfully and linked to the family account."});await refresh();
 }

 const statusIndex=r.status==="active"?3:r.status==="setup_pending"?2:1;
 const savedLabel=lastSavedAt?new Date(lastSavedAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}):"";

 return <RoleGuard allow={["admin"]}><AppShell role="admin">
  <AdminPageHeader eyebrow="ONBOARDING SETUP" title={r.childName} description={`${r.grade} · ${r.school} · ${timeZoneLabel(r.timezone)} · submitted ${new Date(r.submittedAt).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}`} actions={<Link href="/admin/onboarding" className="button ghost">Back to onboarding</Link>}/>
  <div className="cleanStepper" aria-label="Onboarding progress">{[{n:1,t:"New"},{n:2,t:"Setup pending"},{n:3,t:"Active"}].map((s,i)=><div className={`cleanStep ${statusIndex>s.n?"done":statusIndex===s.n?"current":""}`} key={s.n}><span>{statusIndex>s.n?"✓":s.n}</span><b>{s.t}</b>{i<2&&<i/>}</div>)}</div>

  <section className="onboardingSummaryCards">
   <div className={`panel onboardingSummaryCard familyDetailsCard ${editFamilyDetails?"editMode":""}`}><div className="panelHeader"><div><div className="eyebrow">FAMILY & CHILD</div><h2>Submitted information</h2><p>Compact parent-entered summary. Edit only when a correction is needed.</p></div><button type="button" className="button ghost smallButton" onClick={()=>setEditFamilyDetails(v=>!v)}>{editFamilyDetails?"Close edit":"Edit family details"}</button></div>
    {!editFamilyDetails?<div className="summaryDefinitionGrid"><Info a="Child" b={`${r.childName} · ${r.grade||"Grade not set"}`}/><Info a="Primary guardian" b={guardianView?`${guardianView.primary.name} · ${relationshipLabel(guardianView.primary.relationship)}`:"—"}/><Info a="Secondary guardian" b={guardianView?.secondary?`${guardianView.secondary.name} · ${relationshipLabel(guardianView.secondary.relationship)}`:"Not added"}/><Info a="Primary WhatsApp" b={r.primaryWhatsApp||"—"}/><Info a="Location" b={[r.city,r.state&&r.state.toLowerCase()!==r.city.toLowerCase()?r.state:null,r.country].filter(Boolean).join(", ")}/><Info a="Timezone" b={timeZoneLabel(r.timezone)}/><Info a="School" b={r.school||"—"}/></div>:<div className="compactEditGrid familyEditWorkspace">
      <div className="editSubsection"><div className="editSubsectionHead"><b>Parent / guardian details</b><span>Phone numbers are stored with international country codes.</span></div>
       <div className="guardianContactCard primaryGuardianCard"><div className="guardianCardHead"><b>Primary parent / guardian</b><span>Required</span></div><div className="guardianIdentityGrid"><Field label="Name" value={guardianView?.primary.name??""} onChange={v=>patchGuardian("primary","name",v)}/><div className="formGroup"><label>Relationship</label><select className="input" value={guardianView?.primary.relationship??"guardian"} onChange={e=>patchGuardian("primary","relationship",e.target.value)}>{guardianRelationshipOptions.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}</select></div></div><PhoneField className="guardianPhoneFull" hint="" label="Mobile" value={guardianView?.primary.mobile??""} onChange={v=>patchGuardian("primary","mobile",v)} country={r.country}/><label className="sameAsContact"><input type="checkbox" checked={primaryWhatsAppSame} onChange={e=>togglePrimaryWhatsAppSame(e.target.checked)}/><span>WhatsApp same as mobile</span></label>{!primaryWhatsAppSame&&<PhoneField className="guardianPhoneFull" hint="" label="Primary WhatsApp" value={r.primaryWhatsApp} onChange={v=>patch("primaryWhatsApp",v)} country={r.country} required/>}</div>
       <div className="guardianContactCard secondaryGuardianCard"><div className="guardianCardHead"><b>Secondary parent / guardian</b><span>Optional</span></div><div className="guardianIdentityGrid"><Field label="Name" value={guardianView?.secondary?.name??""} onChange={v=>patchGuardian("secondary","name",v)}/><div className="formGroup"><label>Relationship</label><select className="input" value={guardianView?.secondary?.relationship??"guardian"} onChange={e=>patchGuardian("secondary","relationship",e.target.value)}>{guardianRelationshipOptions.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}</select></div></div><PhoneField className="guardianPhoneFull" hint="" label="Mobile" value={guardianView?.secondary?.mobile??""} onChange={v=>patchGuardian("secondary","mobile",v)} country={r.country}/>{Boolean(guardianView?.secondary?.name||guardianView?.secondary?.mobile)&&<><label className="sameAsContact"><input type="checkbox" checked={secondaryWhatsAppSame} onChange={e=>toggleSecondaryWhatsAppSame(e.target.checked)}/><span>WhatsApp same as mobile</span></label>{!secondaryWhatsAppSame&&<PhoneField className="guardianPhoneFull" hint="" label="Secondary WhatsApp" value={r.alternateWhatsApp} onChange={v=>patch("alternateWhatsApp",v)} country={r.country}/>}</>}</div>
      </div>
      <div className="editSubsection"><div className="editSubsectionHead"><b>Family & child details</b><span>Location and timezone are used for scheduling and time conversion.</span></div><div className="formGrid familyChildEditGrid"><CountryCityFields country={r.country} state={r.state||""} city={r.city} onCountryChange={v=>patch("country",v)} onStateChange={v=>patch("state",v)} onCityChange={v=>patch("city",v)} onTimeZoneSuggestion={v=>patch("timezone",v)}/><TimeZoneField className="fullSpan" value={r.timezone} onChange={v=>{patch("timezone",v);if(type==="one_to_one")setScheduleTimezone(IST_TIMEZONE)}} label="Family timezone" required autoMode locationLabel={[r.city,r.state].filter(Boolean).join(", ")}/><Field label="Child name" value={r.childName} onChange={v=>patch("childName",v)}/><GradeSelect value={r.grade} onChange={v=>patch("grade",v)} required/><Field label="Date of birth" value={r.childDob} onChange={v=>patch("childDob",v)} type="date"/><div className="fullSpan"><Field label="School" value={r.school} onChange={v=>patch("school",v)}/></div></div></div>
     </div>}
   </div>
   <div className="panel onboardingSummaryCard"><div className="panelHeader"><div><div className="eyebrow">LEARNING PROFILE</div><h2>Interests & starting point</h2><p>What the family told us about the learner.</p></div></div><div className="summaryDefinitionGrid"><Info a="Interests" b={r.interests.join(" · ")||"—"}/><Info a="Goal" b={r.goal||"—"}/><Info a="Coding experience" b={r.codingExperience||"—"}/><Info a="Robotics experience" b={r.roboticsExperience||"—"}/><Info a="Source" b={r.source||"—"}/><Info a="Family login" b={r.loginEmail||"—"}/></div></div>
   <div className={`panel onboardingSummaryCard parentAvailabilityPanel ${editAvailability?"editMode":""}`}><div className="panelHeader"><div><div className="eyebrow">FAMILY AVAILABILITY</div><h2>Availability snapshot</h2><p>A compact reference only. Detailed parent-versus-trainer matching is shown in Learning Setup below.</p></div><button type="button" className="button ghost smallButton" onClick={()=>setEditAvailability(v=>!v)}>{editAvailability?"Done":"View / Edit availability"}</button></div>{parentWindows.length?<div className="summaryDefinitionGrid availabilitySnapshotGrid"><Info a="Preferred windows" b={`${parentWindows.length}`}/><Info a="Preferred days" b={parentPreferenceDaySummary}/><Info a="Family timezone" b={timeZoneLabel(r.timezone||IST_TIMEZONE)}/></div>:<div className="emptyState compact">No preferred timing windows were submitted.</div>}{parentTimingNote&&<div className="infoBanner compactInfoBanner"><b>Parent note:</b><span>{parentTimingNote}</span></div>}{editAvailability&&<div className="topGap"><PreferredAvailabilityEditor value={r.preferredTimeWindows??""} timeZone={r.timezone||IST_TIMEZONE} onChange={v=>patch("preferredTimeWindows",v)}/><small className="fieldHint">Edit only when the family confirms a correction. Detailed IST matching remains in Learning Setup.</small></div>}</div>
  </section>

  {r.status!=="active"?<section className="panel assignmentPanel"><div className="panelHeader"><div><div className="eyebrow">LEARNING SETUP</div><h2>Assign course, trainer and delivery</h2><p>Save a draft at any time. The exact recurring class slot should sit inside the family’s preferred availability wherever possible.</p></div></div>
   <div className="assignmentWorkspace">
    <div className="assignmentSetupCard"><div className="subsectionHeader"><span>ASSIGNMENT</span><b>Course, delivery & trainer</b></div><div className="formGrid assignmentFields"><div className="formGroup"><label>Course *</label><select className="input" value={courseId} onChange={e=>{setCourseId(e.target.value);setTrainerId("");setCohortId("");setNotice(null)}}><option value="">Choose course</option>{courses.filter(c=>c.status==="active").map(c=><option value={c.id} key={c.id}>{c.title} · Grades {c.gradeFrom}–{c.gradeTo}</option>)}</select></div><div className="formGroup"><label>Trainer *</label><select className="input" value={trainerId} onChange={e=>{setTrainerId(e.target.value);setCohortId("");setNotice(null)}}><option value="">Choose trainer</option>{eligibleTrainers.map(t=><option value={t.id} key={t.id}>{t.fullName} · {t.designation}</option>)}</select></div><div className="formGroup"><label>Delivery *</label><select className="input" value={type} onChange={e=>{const value=e.target.value as "one_to_one"|"small_group";setType(value);setCohortId("");if(value==="one_to_one")setScheduleTimezone(IST_TIMEZONE);setNotice(null)}}><option value="one_to_one">1-to-1</option><option value="small_group">Cohort</option></select></div>{type==="small_group"&&<div className="formGroup"><label>Cohort *</label><select className="input" value={cohortId} onChange={e=>{const value=e.target.value;setCohortId(value);const c=cohorts.find(x=>x.id===value);if(c){setScheduleTimezone(c.scheduleTimezone);setScheduleRules(c.scheduleRules)}setNotice(null)}}><option value="">Choose available cohort</option>{eligibleCohorts.map(c=><option value={c.id} key={c.id}>{c.name} · {c.studentIds.length}/{c.capacity}</option>)}</select></div>}<div className="formGroup"><label>Enrollment start date *</label><input className="input" type="date" min={todayIstDate()} value={startDate} onChange={e=>{setStartDate(e.target.value);setNotice(null)}}/></div></div><div className="assignmentContextGrid"><div><span>Session duration</span><b>{selectedCourse?`${selectedCourse.sessionDuration} min`:"Choose course"}</b></div><div><span>Family timezone</span><b>{shortTimeZoneLabel(r.timezone||IST_TIMEZONE)}</b></div><div><span>Preferred windows</span><b>{parentWindows.length}</b></div><div><span>Trainer availability</span><b>{trainerId?(trainerAvailabilityConfigured?"Configured":"Not configured"):"Choose trainer"}</b></div></div></div>
    <div className="schedulingAssistColumn">{type==="one_to_one"?<div className="preferenceAssist schedulingAssist"><div className="schedulingAssistHead"><div><span className="experienceLabel">SCHEDULE MATCHING</span><b>Preferred timings vs trainer availability</b><small>This is the detailed working view. Parent windows are shown in IST with family-local reference, then compared against the selected trainer.</small></div></div>{parentWindows.length?<><div className="scheduleMatchSummary">{trainerId?<><span><b>{scheduleMatches.filter(m=>m.status==="available").length}</b> full matches</span><span><b>{scheduleMatches.filter(m=>m.status==="partial").length}</b> partial</span><span><b>{scheduleMatches.filter(m=>m.status==="unavailable").length}</b> unavailable</span></>:<span>Select a trainer to compare these windows.</span>}</div><div className="availabilityMatchList">{(trainerId?scheduleMatches:parentWindows.map(w=>({window:w,status:"unavailable" as const,date:"",parentLabel:"",trainerLabel:""}))).map((m,i)=>{const display=preferredWindowAdminDisplay(m.window,r.timezone||IST_TIMEZONE,startDate);return <div className={`availabilityMatchRow match-${m.status}`} key={`${m.window.day}-${i}`}><div><b>{display.istLabel} IST</b><small>Family: {display.familyLabel}</small><small>{trainerId?!trainerAvailabilityConfigured?"Trainer availability not configured":m.status==="available"?"Trainer available for this full IST window":m.status==="partial"?`Partial trainer overlap · ${m.overlapLabel}`:"Trainer not available for this IST window":"Select a trainer to compare this IST window"}</small>{"reason" in m&&m.reason&&<small>{m.reason}</small>}</div><span className={`softBadge ${m.status==="available"?"softGreen":m.status==="partial"?"softAmber":""}`}>{trainerId?(!trainerAvailabilityConfigured?"Not configured":m.status==="available"?"Available":m.status==="partial"?"Partial":"Not available"):"Not checked"}</span></div>})}</div></>:<div className="emptyState compact">No parent availability captured.</div>}</div>:<div className="cohortSetupHint"><span>COHORT DELIVERY</span><b>Select an available cohort</b><p>The cohort's saved schedule and timezone will become the learner's final recurring schedule.</p></div>}</div>
   </div>
   <div className="finalScheduleSection"><div className="subsectionHeader"><span>FINAL CLASS PLAN</span><b>Weekly class schedule</b><small>Start empty, then add only the recurring class slot(s) you actually confirm after checking the parent window, course duration and trainer availability.</small></div>
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
   <div className="readinessCard"><div><b>Ready to activate</b><span>Complete the required learner, course, trainer and final scheduling setup before activation.</span></div><ul><li className={guardianView?.primary.name&&contactsValid?"ok":""}>Primary parent / guardian contact + country code</li><li className={r.childName&&r.childDob&&r.grade&&r.school&&r.timezone?"ok":""}>Child profile + timezone</li><li className={courseId?"ok":""}>Course selected</li><li className={trainerId?"ok":""}>Trainer assigned</li><li className={startDate&&scheduleRules.length&&(type==="one_to_one"||cohortId)?"ok":""}>Delivery setup + weekly schedule</li>{type==="one_to_one"&&scheduleRules.length>0&&<li className={!hasScheduleExceptions||scheduleOverrideConfirmed?"ok":""}>{hasScheduleExceptions?"Schedule exceptions reviewed / override confirmed":"Parent + trainer timing checks passed"}</li>}</ul></div>
   <div className={`saveStateBar ${dirty?"dirty":"clean"}`}><span>{dirty?"● Unsaved changes":activeAction==="draft"?"Saving…":lastSavedAt?`✓ Last saved at ${savedLabel}`:"✓ No unsaved changes"}</span><small>{dirty?"Save the setup before leaving this page.":"Draft schedule and assignment are preserved on reload."}</small></div>
   {notice&&<div className={notice.type==="error"?"errorBanner":notice.type==="success"?"successBanner":"infoBanner"}>{notice.text}</div>}
   <div className="formActions stickyOnboardingActions"><button className="button ghost" disabled={busy||!dirty} onClick={saveDraft}>{activeAction==="draft"?"Saving draft…":dirty?"Save draft":"Draft saved"}</button><button className="button" disabled={busy||!ready} onClick={activate}>{activeAction==="activate"?"Activating…":"Activate learner"}</button></div>
  </section>:<section className="successPanel familyActivationPanel"><div><span>✓</span><div><b>Learner active</b><p>The student and enrollment are active. {r.childName} is available inside the parent’s Family Account; a separate student login is optional, not required.</p><small>Family login: {r.loginEmail||"linked parent account"}</small></div></div><div className="row"><button className="button ghost" onClick={()=>router.push("/admin/students")}>Open Students</button><Link className="button" href="/admin/enrollments">Open Enrollments</Link></div></section>}
 </AppShell></RoleGuard>;
}

function Info({a,b}:{a:string;b:string}){return <div><span>{a}</span><b>{b||"—"}</b></div>}
function Field({label,value,onChange,type="text"}:{label:string;value:string;onChange:(v:string)=>void;type?:string}){return <div className="formGroup"><label>{label}</label><input className="input" type={type} value={value} onChange={e=>onChange(e.target.value)}/></div>}
