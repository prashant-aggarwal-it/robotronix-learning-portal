"use client";
import {weeklyScheduleError,classSlotError,timeRangeError} from "./time-range-validation";
import { appMode } from "./config";
import { batches, learners, trainers } from "./demo-data";
import { demoStore, makeId } from "./demo-store";
import { demoCohorts, demoEnrollments } from "./admin-demo-data";
import type {
  BatchSummary, CohortAdminRecord, CourseAdminRecord, EnrollmentAdminRecord, LearnerSummary, OnboardingSubmission, Profile, ScheduleEvent,
  SessionUpdateInput, StudentAdminRecord, TrainerAdminRecord, TrainerFinanceRecord, TrainerSummary, UserRole, DeliveryCenterRecord, LearningObservationRecord, TrainerFeedbackRecord, LearnerProjectRecord, EnrollmentHoldRecord, ProgressAlertActionRecord, ProgressAlertState, LearnerProgressRow, ProgressAlertRecord, ClassAttendanceRecord, WeeklyScheduleSlot, ReminderPolicy, TrainerCompensationPlan, TrainerEarningRecord, TrainerPayoutRecord, CorrectionRequestRecord, PortalAuditRecord, ParentCommunityProfile, FamilyIntroductionRecord, TrainerFinanceChangeRequest
} from "./types";
import { getSupabaseBrowserClient } from "./supabase/browser";
import { buildLearnerProgressRows, buildProgressAlerts } from "./progress-engine";
import { emitNotification } from "./communication-repository";
import { IST_TIMEZONE, shortTimeZoneLabel, zonedLocalToUtc, zonedParts, zonedRangeParts } from "./timezones";
import {calculateTrainerEarning,DEFAULT_COMP_PLAN} from "./trainer-payroll";
import {guardiansFromRecord} from "./guardians";
import {deliveredHoursForEnrollment,plannedCourseHours,progressFromHours} from "./course-hours";
import {validNewEnrollmentDate} from "./ist-date";

function normaliseProfile(row: any): Profile {
  return { id: row.id, fullName: row.full_name ?? "Robotronix User", role: row.role as UserRole };
}
function slugify(value:string){ return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); }
function toArray(value:any): string[] { return Array.isArray(value) ? value : value ? String(value).split(",").map(x=>x.trim()).filter(Boolean) : []; }
function nextMonthStart(month:string){const[y,m]=month.split("-").map(Number);const d=new Date(Date.UTC(y,m,1));return d.toISOString().slice(0,10);}

export async function signIn(email: string, password: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured. Use a demo role or add .env.local." };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { ok: !error, error: error?.message };
}

/** Passwordless for pre-provisioned accounts only: do not create arbitrary new portal users. */
export async function requestEmailSignInCode(email:string){
 const client=getSupabaseBrowserClient();
 if(!client)return{ok:false,error:"Authentication is unavailable."};
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))return{ok:false,error:"Enter a valid email address."};
 const redirectTo=typeof window!=="undefined"?window.location.origin+"/auth/callback":undefined;
 const {error}=await client.auth.signInWithOtp({email:email.trim(),options:{shouldCreateUser:false,emailRedirectTo:redirectTo}});
 return error?{ok:false,error:"Unable to send sign-in code. Verify your portal access with Admin."}:{ok:true};
}
export async function verifyEmailSignInCode(email:string,code:string){
 const client=getSupabaseBrowserClient();
 if(!client)return{ok:false,error:"Authentication is unavailable."};
 if(!/^\d{6,8}$/.test(code.trim()))return{ok:false,error:"Enter the code from the email."};
 const {error}=await client.auth.verifyOtp({email:email.trim(),token:code.trim(),type:"email"});
 return error?{ok:false,error:"Code expired or invalid. Request a new code."}:{ok:true};
}

export async function signInWithGoogle(nextPath?: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { ok:false, error:"Google sign-in needs Supabase live mode. Demo onboarding is available without it." };
  if (typeof window !== "undefined" && nextPath?.startsWith("/")) sessionStorage.setItem("robotronix:post-auth-next", nextPath);
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
  const { error } = await supabase.auth.signInWithOAuth({ provider:"google", options:{ redirectTo, queryParams:{prompt:"select_account"} } });
  return { ok:!error, error:error?.message };
}

export async function signOut() {
  const supabase = getSupabaseBrowserClient();
  if (supabase) await supabase.auth.signOut();
}

export async function getCurrentAuthUser() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data:{ user } } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentAccountAccess():Promise<{state:"active"|"disabled"|"unlinked";role?:Profile["role"]}>{
  const supabase=getSupabaseBrowserClient();if(!supabase)return{state:"unlinked"};
  const{data:{session}}=await supabase.auth.getSession();if(!session?.user)return{state:"unlinked"};
  const{data:profile}=await supabase.from("profiles").select("id,role,active").eq("id",session.user.id).maybeSingle();
  if(!profile)return{state:"unlinked"};
  if(profile.active===false)return{state:"disabled",role:profile.role};
  if(profile.role==="trainer"){
    const{data:trainer}=await supabase.from("trainers").select("id").eq("profile_id",session.user.id).maybeSingle();
    if(trainer?.id){const{data:access}=await supabase.from("portal_access_requests").select("status").eq("target_type","trainer").eq("target_id",trainer.id).maybeSingle();if(access?.status==="disabled")return{state:"disabled",role:"trainer"};}
  }
  return{state:"active",role:profile.role};
}
export async function getCurrentParentSetupState():Promise<{pending:number;submitted:number}>{
  const supabase=getSupabaseBrowserClient();if(!supabase)return{pending:0,submitted:0};
  const{data:{session}}=await supabase.auth.getSession();if(!session?.user)return{pending:0,submitted:0};
  const{data}=await supabase.from("onboarding_submissions").select("status").eq("user_id",session.user.id);
  const rows=data??[];return{pending:rows.filter((r:any)=>r.status!=="active").length,submitted:rows.length};
}
export async function getCurrentFamilyOnboardingDefaults():Promise<Partial<OnboardingSubmission>|null>{
  const supabase=getSupabaseBrowserClient();if(!supabase)return null;
  const{data:{session}}=await supabase.auth.getSession();if(!session?.user)return null;
  const{data:r}=await supabase.from("onboarding_submissions").select("*").eq("user_id",session.user.id).order("submitted_at",{ascending:false}).limit(1).maybeSingle();
  if(!r)return{loginEmail:session.user.email??""};
  return{
    loginEmail:session.user.email??r.login_email??"",
    primaryGuardianName:r.primary_guardian_name??"",
    primaryGuardianRelationship:r.primary_guardian_relationship??"guardian",
    primaryGuardianMobile:r.primary_guardian_mobile??"",
    secondaryGuardianName:r.secondary_guardian_name??"",
    secondaryGuardianRelationship:r.secondary_guardian_relationship??undefined,
    secondaryGuardianMobile:r.secondary_guardian_mobile??"",
    primaryContact:r.primary_contact??"guardian",
    primaryWhatsApp:r.primary_whatsapp??"",
    alternateWhatsApp:r.alternate_whatsapp??"",
    addressLine1:r.address_line1??"",addressLine2:r.address_line2??"",postalCode:r.postal_code??"",
    city:r.city??"",state:r.state??"",country:r.country??"India",timezone:r.timezone??IST_TIMEZONE,
    billingName:r.billing_name??"",billingEmail:r.billing_email??"",billingPhone:r.billing_phone??""
  } as Partial<OnboardingSubmission>;
}


export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  // Protected client pages already have the signed Supabase session in browser
  // storage. Reading that session locally avoids an unnecessary Auth network
  // validation request on every route mount. The profile query still runs through
  // Supabase/RLS, so authorization remains enforced by the database.
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("id", session.user.id)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) return null;
  return normaliseProfile(data);
}

export async function getStudentDashboard(): Promise<LearnerSummary | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return learners[0];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: student } = await supabase.from("students").select("id, full_name, grade").eq("profile_id", user.id).maybeSingle();
  if (!student) return null;
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, sessions_completed, progress_percent, course:courses(id, slug, title, total_sessions), trainer:trainers(id, full_name)")
    .eq("student_id", student.id).eq("status", "active").order("started_at", { ascending: false }).limit(1).maybeSingle();
  const { data: records } = await supabase.from("session_records").select("attendance, understanding").eq("student_id", student.id).order("session_date", { ascending: false }).limit(12);
  const total = records?.length ?? 0;
  const present = records?.filter((r: any) => r.attendance !== "absent").length ?? 0;
  const attendance = total ? Math.round((present / total) * 100) : 100;
  const { data: attempt } = await supabase.from("quiz_attempts").select("score_percent").eq("student_id", student.id).order("completed_at", { ascending: false }).limit(1).maybeSingle();
  const { count: projectCount } = await supabase.from("project_submissions").select("id", { count: "exact", head: true }).eq("student_id", student.id).in("status", ["completed", "presented"]);
  const { data: xpRows } = await supabase.from("xp_transactions").select("points").eq("student_id", student.id);
  const xp = (xpRows ?? []).reduce((sum: number, r: any) => sum + (r.points ?? 0), 0);
  const recentReinforcement = records?.filter((r: any) => ["reinforce", "intervention"].includes(r.understanding)).length ?? 0;
  const latestQuiz = attempt?.score_percent ?? 0;
  const status = attendance < 70 || (latestQuiz > 0 && latestQuiz < 50 && recentReinforcement >= 2) ? "follow_up" : attendance < 85 || (latestQuiz > 0 && latestQuiz < 60) || recentReinforcement >= 3 ? "reinforce" : "on_track";
  const course: any = enrollment?.course; const trainer: any = enrollment?.trainer;
  return { id:student.id, name:student.full_name ?? user.user_metadata?.full_name ?? "Student", grade:student.grade ?? "", course:course?.title ?? "Assigned course", courseSlug:course?.slug ?? "", trainer:trainer?.full_name ?? "Robotronix Mentor", progress:enrollment?.progress_percent ?? 0, sessionsCompleted:enrollment?.sessions_completed ?? 0, totalSessions:course?.total_sessions ?? 0, attendance, latestQuiz, projectsCompleted:projectCount ?? 0, xp, status:status as any, nextFocus:recentReinforcement ? "Reinforce recent concepts through a practical build" : "Continue to the next milestone" };
}

export async function getParentDashboard(): Promise<LearnerSummary | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return learners[0];
  const { data:{ user } } = await supabase.auth.getUser(); if(!user) return null;
  const { data: parent } = await supabase.from("parents").select("id").eq("profile_id", user.id).maybeSingle(); if(!parent) return null;
  const { data: link } = await supabase.from("parent_students").select("student:students(id,full_name,grade)").eq("parent_id", parent.id).limit(1).maybeSingle();
  const student:any = link?.student; if(!student) return null;
  const { data: enrollment } = await supabase.from("enrollments").select("id,sessions_completed,progress_percent,course:courses(slug,title,total_sessions),trainer:trainers(full_name)").eq("student_id",student.id).eq("status","active").order("started_at",{ascending:false}).limit(1).maybeSingle();
  const { data: records } = await supabase.from("session_records").select("attendance,understanding").eq("student_id", student.id).order("session_date",{ascending:false}).limit(12);
  const total=records?.length??0; const present=records?.filter((r:any)=>r.attendance!=="absent").length??0; const attendance=total?Math.round((present/total)*100):100;
  const { data: attempt }=await supabase.from("quiz_attempts").select("score_percent").eq("student_id",student.id).order("completed_at",{ascending:false}).limit(1).maybeSingle();
  const { count:projectCount }=await supabase.from("project_submissions").select("id",{count:"exact",head:true}).eq("student_id",student.id).in("status",["completed","presented"]);
  const latestQuiz=attempt?.score_percent??0; const reinforcement=records?.filter((r:any)=>["reinforce","intervention"].includes(r.understanding)).length??0;
  const status=attendance<70||(latestQuiz>0&&latestQuiz<50&&reinforcement>=2)?"follow_up":attendance<85||(latestQuiz>0&&latestQuiz<60)||reinforcement>=3?"reinforce":"on_track";
  const course:any=enrollment?.course; const trainer:any=enrollment?.trainer;
  return { id:student.id,name:student.full_name??"Learner",grade:student.grade??"",course:course?.title??"Assigned course",courseSlug:course?.slug??"",trainer:trainer?.full_name??"Robotronix Mentor",progress:enrollment?.progress_percent??0,sessionsCompleted:enrollment?.sessions_completed??0,totalSessions:course?.total_sessions??0,attendance,latestQuiz,projectsCompleted:projectCount??0,xp:0,status:status as any,nextFocus:reinforcement?"Review the recent concept during the next regular class":"Continue the current learning milestone" };
}

export async function getTrainerDashboard(): Promise<{ trainer: TrainerSummary; learners: LearnerSummary[]; batches: BatchSummary[] }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { trainer: trainers[0], learners: learners.filter(l => l.trainer === "Vikas"), batches: batches.filter(b => b.trainer === "Vikas") };
  const { data:{ user } }=await supabase.auth.getUser(); if(!user) return {trainer:{id:"",name:"Trainer",specialties:[],activeLearners:0,activeBatches:0,pendingReviews:0},learners:[],batches:[]};
  const { data:trainerRow }=await supabase.from("trainers").select("id,full_name,specialties").eq("profile_id",user.id).maybeSingle();
  if(!trainerRow) return {trainer:{id:"",name:"Trainer",specialties:[],activeLearners:0,activeBatches:0,pendingReviews:0},learners:[],batches:[]};
  const { data:enrollmentRows }=await supabase.from("enrollments").select("student:students(id,full_name,grade),sessions_completed,progress_percent,course:courses(slug,title,total_sessions)").eq("trainer_id",trainerRow.id).eq("status","active");
  const liveLearners:LearnerSummary[]=(enrollmentRows??[]).map((row:any)=>({id:row.student?.id,name:row.student?.full_name??"Student",grade:row.student?.grade??"",course:row.course?.title??"Course",courseSlug:row.course?.slug??"",trainer:trainerRow.full_name,progress:row.progress_percent??0,sessionsCompleted:row.sessions_completed??0,totalSessions:row.course?.total_sessions??0,attendance:100,latestQuiz:0,projectsCompleted:0,xp:0,status:"on_track",nextFocus:"Continue current learning path"}));
  const { data:batchRows }=await supabase.from("cohorts").select("id,name,schedule_text,status,course:courses(title)").eq("trainer_id",trainerRow.id).eq("status","active");
  const liveBatches:BatchSummary[]=(batchRows??[]).map((row:any)=>({id:row.id,name:row.name,course:row.course?.title??"Course",trainer:trainerRow.full_name,deliveryMode:"small_group",schedule:row.schedule_text??"Schedule not set",learnerCount:0,progress:0}));
  return {trainer:{id:trainerRow.id,name:trainerRow.full_name,specialties:trainerRow.specialties??[],activeLearners:liveLearners.length,activeBatches:liveBatches.length,pendingReviews:0},learners:liveLearners,batches:liveBatches};
}

export async function getAdminSnapshot() {
  const supabase=getSupabaseBrowserClient();
  if(!supabase) return {learners:demoStore.students.list(),trainers:demoStore.trainers.list(),batches};
  const [studentsRes,trainersRes,batchesRes]=await Promise.all([supabase.from("students").select("id,full_name,grade,record_status"),supabase.from("trainers").select("id,full_name,specialties,record_status"),supabase.from("cohorts").select("id,name,schedule_text,status,course:courses(title),trainer:trainers(full_name)")]);
  return {learners:studentsRes.data??[],trainers:trainersRes.data??[],batches:batchesRes.data??[]};
}

export async function saveTrainerSessionUpdate(input: SessionUpdateInput) {
  const supabase=getSupabaseBrowserClient(); if(!supabase||appMode==="demo"){await new Promise(r=>setTimeout(r,250));return {ok:true,mode:"demo" as const};}
  const { data:{ user } }=await supabase.auth.getUser(); if(!user)return {ok:false,error:"Please sign in again."};
  const { data:trainer }=await supabase.from("trainers").select("id").eq("profile_id",user.id).maybeSingle(); if(!trainer)return {ok:false,error:"Trainer profile not found."};
  let enrollmentId=input.enrollmentId; if(!enrollmentId){const {data:e}=await supabase.from("enrollments").select("id").eq("student_id",input.studentId).eq("trainer_id",trainer.id).eq("status","active").limit(1).maybeSingle();enrollmentId=e?.id;}
  if(!enrollmentId)return {ok:false,error:"No active enrollment found for this learner."};
  const {error}=await supabase.from("session_records").insert({enrollment_id:enrollmentId,course_session_id:input.courseSessionId??null,student_id:input.studentId,trainer_id:trainer.id,session_date:new Date().toISOString().slice(0,10),attendance:input.attendance,understanding:input.understanding,participation:input.participation,practice_status:input.practiceStatus,note:input.note?.trim()||null,created_by:user.id});
  return error?{ok:false,error:error.message}:{ok:true,mode:"live" as const};
}

export async function getStudentProjects(){const supabase=getSupabaseBrowserClient();if(!supabase)return null;const {data:{user}}=await supabase.auth.getUser();if(!user)return[];const {data:student}=await supabase.from("students").select("id").eq("profile_id",user.id).maybeSingle();if(!student)return[];const {data}=await supabase.from("project_submissions").select("id,status,score,student_reflection,mentor_feedback,project:projects(title,skills)").eq("student_id",student.id).order("submitted_at",{ascending:false});return data??[];}
export async function saveQuickCheck(scorePercent:number){const supabase=getSupabaseBrowserClient();if(!supabase)return{ok:true,mode:"demo" as const};const {data:{user}}=await supabase.auth.getUser();if(!user)return{ok:false,error:"Please sign in again."};const {data:student}=await supabase.from("students").select("id").eq("profile_id",user.id).maybeSingle();if(!student)return{ok:false,error:"Student profile not found."};const {data:quiz}=await supabase.from("quizzes").select("id").eq("slug","python-quick-check-1").maybeSingle();if(!quiz)return{ok:false,error:"Quick Check is not configured in Supabase yet."};const {error}=await supabase.from("quiz_attempts").insert({quiz_id:quiz.id,student_id:student.id,score_percent:scorePercent,completed_at:new Date().toISOString()});if(error)return{ok:false,error:error.message};await supabase.from("xp_transactions").insert({student_id:student.id,points:scorePercent>=80?15:10,reason:"Python Quick Check",created_by:user.id});return{ok:true,mode:"live" as const};}

// ---------------- Parent onboarding ----------------
export async function submitOnboarding(input: Omit<OnboardingSubmission,"id"|"userId"|"status"|"submittedAt"|"activatedAt">) {
  const supabase=getSupabaseBrowserClient();
  const record:OnboardingSubmission={...input,id:makeId("onb"),status:"new",submittedAt:new Date().toISOString()};
  if(!supabase){demoStore.onboarding.create(record);return{ok:true,id:record.id,mode:"demo" as const};}
  const {data:{user}}=await supabase.auth.getUser();if(!user)return{ok:false,error:"Please continue with Google or email sign-in first."};
  const fullName=user.user_metadata?.full_name||input.primaryGuardianName||input.motherName||input.fatherName||"Parent";
  await supabase.from("profiles").upsert({id:user.id,full_name:fullName,role:"parent",active:true},{onConflict:"id"});
  const {data:parent}=await supabase.from("parents").upsert({profile_id:user.id,primary_phone:input.primaryWhatsApp},{onConflict:"profile_id"}).select("id").single();
  if(parent?.id){
    const now=new Date().toISOString();
    const {data:existingAddress}=await supabase.from("parent_addresses").select("id").eq("parent_id",parent.id).eq("is_primary",true).eq("is_active",true).maybeSingle();
    const addressRow={address_line1:input.addressLine1,address_line2:input.addressLine2||"",city:input.city,state:input.state??"",postal_code:input.postalCode,country:input.country,country_code:"",is_primary:true,is_active:true,updated_at:now};
    if(existingAddress?.id)await supabase.from("parent_addresses").update(addressRow).eq("id",existingAddress.id);
    else await supabase.from("parent_addresses").insert({parent_id:parent.id,...addressRow});
    await supabase.from("parent_billing_profiles").upsert({parent_id:parent.id,same_as_primary_guardian:true,same_as_primary_address:true,billing_name:input.billingName||input.primaryGuardianName,billing_email:input.billingEmail||input.loginEmail,billing_phone:input.billingPhone||input.primaryWhatsApp,billing_address_line1:null,billing_address_line2:null,billing_city:null,billing_state:null,billing_postal_code:null,billing_country:null,billing_country_code:null,updated_at:now},{onConflict:"parent_id"});
  }
  const payload={user_id:user.id,login_email:user.email??input.loginEmail,mother_name:input.motherName,mother_mobile:input.motherMobile,father_name:input.fatherName,father_mobile:input.fatherMobile,primary_contact:input.primaryContact,primary_whatsapp:input.primaryWhatsApp,alternate_whatsapp:input.alternateWhatsApp,primary_guardian_name:input.primaryGuardianName??"",primary_guardian_relationship:input.primaryGuardianRelationship??"guardian",primary_guardian_mobile:input.primaryGuardianMobile??"",secondary_guardian_name:input.secondaryGuardianName??"",secondary_guardian_relationship:input.secondaryGuardianRelationship??null,secondary_guardian_mobile:input.secondaryGuardianMobile??"",city:input.city,country:input.country,state:input.state??"",timezone:input.timezone||IST_TIMEZONE,address_line1:input.addressLine1,address_line2:input.addressLine2||"",postal_code:input.postalCode,billing_name:input.billingName,billing_email:input.billingEmail,billing_phone:input.billingPhone,child_name:input.childName,child_dob:input.childDob,grade:input.grade,school:input.school,preferred_class_days:input.preferredClassDays??[],preferred_time_windows:input.preferredTimeWindows??"",interests:input.interests,goal:input.goal,coding_experience:input.codingExperience,robotics_experience:input.roboticsExperience,source:input.source,referring_parent_name:(input.source==="Existing parent"||input.source==="Referred by an existing Robotronix parent")?(input.referringParentName??"").trim():"",data_consent:input.dataConsent,portfolio_consent:input.portfolioConsent,status:"new",submitted_at:new Date().toISOString()};
  const {data,error}=await supabase.from("onboarding_submissions").insert(payload).select("id").single();
  return error?{ok:false,error:error.message}:{ok:true,id:data.id,mode:"live" as const};
}

function mapOnboardingStatus(value:any):OnboardingSubmission["status"]{if(value==="submitted")return"new";if(value==="reviewed"||value==="assigned")return"setup_pending";return(value??"new") as any;}
export async function listOnboardingSubmissions():Promise<OnboardingSubmission[]>{
  const supabase=getSupabaseBrowserClient();if(!supabase)return demoStore.onboarding.list();
  const {data}=await supabase.from("onboarding_submissions").select("*").order("submitted_at",{ascending:false});
  return(data??[]).map((r:any)=>{const base:OnboardingSubmission={id:r.id,userId:r.user_id,loginEmail:r.login_email??"",motherName:r.mother_name??"",motherMobile:r.mother_mobile??"",fatherName:r.father_name??"",fatherMobile:r.father_mobile??"",primaryGuardianName:r.primary_guardian_name??"",primaryGuardianRelationship:r.primary_guardian_relationship??undefined,primaryGuardianMobile:r.primary_guardian_mobile??"",secondaryGuardianName:r.secondary_guardian_name??"",secondaryGuardianRelationship:r.secondary_guardian_relationship??undefined,secondaryGuardianMobile:r.secondary_guardian_mobile??"",primaryContact:r.primary_contact??"mother",primaryWhatsApp:r.primary_whatsapp??"",alternateWhatsApp:r.alternate_whatsapp??"",city:r.city??"",country:r.country??"",state:r.state??"",timezone:r.timezone??IST_TIMEZONE,addressLine1:r.address_line1??"",addressLine2:r.address_line2??"",postalCode:r.postal_code??"",billingName:r.billing_name??r.primary_guardian_name??"",billingEmail:r.billing_email??r.login_email??"",billingPhone:r.billing_phone??r.primary_whatsapp??"",childName:r.child_name??"",childDob:r.child_dob??"",grade:r.grade??"",school:r.school??"",preferredClassDays:r.preferred_class_days??[],preferredTimeWindows:r.preferred_time_windows??"",interests:r.interests??[],goal:r.goal??"",codingExperience:r.coding_experience??"",roboticsExperience:r.robotics_experience??"",source:r.source??"",referringParentName:r.referring_parent_name??"",dataConsent:r.data_consent??false,portfolioConsent:r.portfolio_consent??false,marketingMediaConsent:r.marketing_media_consent??false,status:mapOnboardingStatus(r.status),assignedCourseId:r.assigned_course_id??undefined,assignedTrainerId:r.assigned_trainer_id??undefined,enrollmentType:r.enrollment_type??undefined,cohortId:r.cohort_id??undefined,startDate:r.start_date??undefined,draftScheduleTimezone:r.draft_schedule_timezone??undefined,draftScheduleRules:Array.isArray(r.draft_schedule_rules)?r.draft_schedule_rules:[],submittedAt:r.submitted_at,activatedAt:r.activated_at??undefined,updatedAt:r.updated_at??undefined};const g=guardiansFromRecord(base);return{...base,primaryGuardianName:g.primary.name,primaryGuardianRelationship:g.primary.relationship,primaryGuardianMobile:g.primary.mobile,secondaryGuardianName:g.secondary?.name??"",secondaryGuardianRelationship:g.secondary?.relationship,secondaryGuardianMobile:g.secondary?.mobile??""};});
}
export async function getOnboardingSubmission(id:string){return(await listOnboardingSubmissions()).find(x=>x.id===id)??null;}
export async function updateOnboardingSubmission(id:string,patch:Partial<OnboardingSubmission>){
  const supabase=getSupabaseBrowserClient();const now=new Date().toISOString();if(!supabase)return demoStore.onboarding.update(id,{...patch,updatedAt:now});
  const db:any={};const map:any={motherName:"mother_name",motherMobile:"mother_mobile",fatherName:"father_name",fatherMobile:"father_mobile",primaryGuardianName:"primary_guardian_name",primaryGuardianRelationship:"primary_guardian_relationship",primaryGuardianMobile:"primary_guardian_mobile",secondaryGuardianName:"secondary_guardian_name",secondaryGuardianRelationship:"secondary_guardian_relationship",secondaryGuardianMobile:"secondary_guardian_mobile",primaryContact:"primary_contact",primaryWhatsApp:"primary_whatsapp",alternateWhatsApp:"alternate_whatsapp",city:"city",country:"country",state:"state",timezone:"timezone",addressLine1:"address_line1",addressLine2:"address_line2",postalCode:"postal_code",billingName:"billing_name",billingEmail:"billing_email",billingPhone:"billing_phone",childName:"child_name",childDob:"child_dob",grade:"grade",school:"school",preferredClassDays:"preferred_class_days",preferredTimeWindows:"preferred_time_windows",interests:"interests",goal:"goal",codingExperience:"coding_experience",roboticsExperience:"robotics_experience",source:"source",referringParentName:"referring_parent_name",assignedCourseId:"assigned_course_id",assignedTrainerId:"assigned_trainer_id",enrollmentType:"enrollment_type",cohortId:"cohort_id",startDate:"start_date",draftScheduleTimezone:"draft_schedule_timezone",draftScheduleRules:"draft_schedule_rules",status:"status",activatedAt:"activated_at"};
  Object.entries(patch).forEach(([k,v])=>{if(map[k])db[map[k]]=v===undefined?null:v});const {data,error}=await supabase.from("onboarding_submissions").update({...db,updated_at:now}).eq("id",id).select().maybeSingle();return error?null:data;
}

/** Fetch all records visible to this account without Supabase's default 1,000-row response cap.
 * Queries are constructed fresh on each page; stable server ordering is essential.
 */
async function readAllPages(makeQuery:()=>any):Promise<any[]>{
 const all:any[]=[];const size=500;
 for(let offset=0;offset<50000;offset+=size){
  const{data,error}=await makeQuery().range(offset,offset+size-1);
  if(error)throw new Error(error.message);
  const rows=data??[];all.push(...rows);
  if(rows.length<size)return all;
 }
 throw new Error("This directory exceeds the 50,000-record export limit. Contact an administrator for a database export.");
}

// ---------------- Admin Student CRUD ----------------
export async function listAdminStudents():Promise<StudentAdminRecord[]>{
  const supabase=getSupabaseBrowserClient();if(!supabase)return demoStore.students.list();
  const [rows,guardians]=await Promise.all([
  readAllPages(()=>supabase.from("students").select("*").order("updated_at",{ascending:false}).order("id")),
  readAllPages(()=>supabase.from("student_guardians").select("*").order("student_id"))
 ]);
  return rows.map((r:any)=>{const g=(guardians??[]).find((x:any)=>x.student_id===r.id);const base:StudentAdminRecord={id:r.id,fullName:r.full_name??"",dob:r.dob??"",grade:r.grade??"",school:r.school??"",city:r.city??"",country:r.country??"India",state:r.state??"",timezone:r.timezone??IST_TIMEZONE,addressLine1:g?.billing_address_line1??"",addressLine2:g?.billing_address_line2??"",postalCode:g?.billing_postal_code??"",billingName:g?.billing_name??g?.primary_guardian_name??"",billingEmail:g?.billing_email??g?.parent_login_email??"",billingPhone:g?.billing_phone??g?.primary_whatsapp??"",preferredClassDays:r.preferred_class_days??[],preferredTimeWindows:r.preferred_time_windows??"",motherName:g?.mother_name??"",motherMobile:g?.mother_mobile??"",fatherName:g?.father_name??"",fatherMobile:g?.father_mobile??"",primaryGuardianName:g?.primary_guardian_name??"",primaryGuardianRelationship:g?.primary_guardian_relationship??undefined,primaryGuardianMobile:g?.primary_guardian_mobile??"",secondaryGuardianName:g?.secondary_guardian_name??"",secondaryGuardianRelationship:g?.secondary_guardian_relationship??undefined,secondaryGuardianMobile:g?.secondary_guardian_mobile??"",primaryContact:g?.primary_contact??"mother",primaryWhatsApp:g?.primary_whatsapp??"",alternateWhatsApp:g?.alternate_whatsapp??"",parentLoginEmail:g?.parent_login_email??"",interests:r.interests??[],previousExperience:r.previous_experience??"",source:r.source??"",recordStatus:r.record_status??"active",updatedAt:r.updated_at};const view=guardiansFromRecord(base);return{...base,primaryGuardianName:view.primary.name,primaryGuardianRelationship:view.primary.relationship,primaryGuardianMobile:view.primary.mobile,secondaryGuardianName:view.secondary?.name??"",secondaryGuardianRelationship:view.secondary?.relationship,secondaryGuardianMobile:view.secondary?.mobile??""};});
}
export async function getAdminStudent(id:string){return(await listAdminStudents()).find(x=>x.id===id)??null;}
export async function createAdminStudent(input:Omit<StudentAdminRecord,"id"|"updatedAt">){
  const supabase=getSupabaseBrowserClient();const id=slugify(input.fullName)||makeId("student");const record:StudentAdminRecord={...input,id,updatedAt:new Date().toISOString()};
  if(!supabase)return{ok:true,id:demoStore.students.create(record).id};
  const {data,error}=await supabase.from("students").insert({full_name:input.fullName,dob:input.dob||null,grade:input.grade,school:input.school,city:input.city,country:input.country,state:input.state??"",timezone:input.timezone||IST_TIMEZONE,preferred_class_days:input.preferredClassDays??[],preferred_time_windows:input.preferredTimeWindows??"",interests:input.interests,previous_experience:input.previousExperience,source:input.source,record_status:input.recordStatus}).select("id").single();if(error)return{ok:false,error:error.message};
  const {error:gerr}=await supabase.from("student_guardians").insert({student_id:data.id,mother_name:input.motherName,mother_mobile:input.motherMobile,father_name:input.fatherName,father_mobile:input.fatherMobile,primary_contact:input.primaryContact,primary_whatsapp:input.primaryWhatsApp,alternate_whatsapp:input.alternateWhatsApp,parent_login_email:input.parentLoginEmail,primary_guardian_name:input.primaryGuardianName??"",primary_guardian_relationship:input.primaryGuardianRelationship??"guardian",primary_guardian_mobile:input.primaryGuardianMobile??"",secondary_guardian_name:input.secondaryGuardianName??"",secondary_guardian_relationship:input.secondaryGuardianRelationship??null,secondary_guardian_mobile:input.secondaryGuardianMobile??"",billing_name:input.billingName??input.primaryGuardianName??"",billing_email:input.billingEmail??input.parentLoginEmail??"",billing_phone:input.billingPhone??input.primaryWhatsApp??"",billing_address_line1:input.addressLine1??"",billing_address_line2:input.addressLine2??"",billing_city:input.city??"",billing_state:input.state??"",billing_postal_code:input.postalCode??"",billing_country:input.country??""});if(gerr){await supabase.from("students").delete().eq("id",data.id);return{ok:false,error:gerr.message};}return{ok:true,id:data.id};
}
export async function updateAdminStudent(id:string,input:Partial<StudentAdminRecord>){
  const supabase=getSupabaseBrowserClient();if(!supabase)return{ok:true,data:demoStore.students.update(id,input)};
  const student:any={};const studentMap:any={fullName:"full_name",dob:"dob",grade:"grade",school:"school",city:"city",country:"country",state:"state",timezone:"timezone",preferredClassDays:"preferred_class_days",preferredTimeWindows:"preferred_time_windows",interests:"interests",previousExperience:"previous_experience",source:"source",recordStatus:"record_status",zoomJoinUrl:"zoom_join_url"};Object.entries(input).forEach(([k,v])=>{if(studentMap[k])student[studentMap[k]]=v||null});
  if(Object.keys(student).length){const {error}=await supabase.from("students").update({...student,updated_at:new Date().toISOString()}).eq("id",id);if(error)return{ok:false,error:error.message};}
  const guard:any={};const guardMap:any={motherName:"mother_name",motherMobile:"mother_mobile",fatherName:"father_name",fatherMobile:"father_mobile",primaryGuardianName:"primary_guardian_name",primaryGuardianRelationship:"primary_guardian_relationship",primaryGuardianMobile:"primary_guardian_mobile",secondaryGuardianName:"secondary_guardian_name",secondaryGuardianRelationship:"secondary_guardian_relationship",secondaryGuardianMobile:"secondary_guardian_mobile",primaryContact:"primary_contact",primaryWhatsApp:"primary_whatsapp",alternateWhatsApp:"alternate_whatsapp",parentLoginEmail:"parent_login_email",billingName:"billing_name",billingEmail:"billing_email",billingPhone:"billing_phone",addressLine1:"billing_address_line1",addressLine2:"billing_address_line2",postalCode:"billing_postal_code"};Object.entries(input).forEach(([k,v])=>{if(guardMap[k])guard[guardMap[k]]=v});if(input.city!==undefined)guard.billing_city=input.city;if(input.state!==undefined)guard.billing_state=input.state??"";if(input.country!==undefined)guard.billing_country=input.country;if(Object.keys(guard).length){const {error}=await supabase.from("student_guardians").upsert({student_id:id,...guard},{onConflict:"student_id"});if(error)return{ok:false,error:error.message};}return{ok:true};
}
export async function deleteAdminStudent(id:string){
 const supabase=getSupabaseBrowserClient();
 if(!supabase){
  const used=demoStore.enrollments.list().some(e=>e.studentId===id)||demoStore.schedule.list().some(e=>e.studentId===id)||demoStore.attendance.list().some(a=>a.studentId===id)||demoStore.projects.list().some(p=>p.studentId===id);
  if(used)return{ok:false,error:"This learner has enrollment, class, attendance or project history. Archive the learner instead of deleting it."};
  demoStore.students.remove(id);return{ok:true};
 }
 const checks=await Promise.all([
  supabase.from("enrollments").select("id",{head:true,count:"exact"}).eq("student_id",id),
  supabase.from("schedule_events").select("id",{head:true,count:"exact"}).eq("student_id",id),
  supabase.from("class_attendance").select("id",{head:true,count:"exact"}).eq("student_id",id),
  supabase.from("learner_projects").select("id",{head:true,count:"exact"}).eq("student_id",id)
 ]);
 if(checks.some(x=>(x.count??0)>0))return{ok:false,error:"This learner has operational or historical records. Archive the learner instead of deleting it."};
 const {error}=await supabase.from("students").delete().eq("id",id);return error?{ok:false,error:error.message}:{ok:true};
}

// ---------------- Admin Trainer CRUD ----------------
export async function listAdminTrainers():Promise<TrainerAdminRecord[]>{const supabase=getSupabaseBrowserClient();if(!supabase)return demoStore.trainers.list();const[{data},{data:links},{data:access}]=await Promise.all([supabase.from("trainers").select("*").order("full_name"),supabase.from("trainer_courses").select("trainer_id,course_id"),supabase.from("portal_access_requests").select("target_id,status").eq("target_type","trainer")]);return(data??[]).map((r:any)=>({id:r.id,fullName:r.full_name??"",mobile:r.mobile??"",email:r.email??"",city:r.city??"",country:r.country??"India",state:r.state??"",timezone:r.timezone??"Asia/Kolkata",designation:r.designation??"",joiningDate:r.joining_date??"",specialties:r.specialties??[],courseIds:(links??[]).filter((x:any)=>x.trainer_id===r.id).map((x:any)=>x.course_id),recordStatus:r.record_status??"active",zoomJoinUrl:r.zoom_join_url??"",loginLinked:Boolean(r.profile_id),portalAccessStatus:(access??[]).find((a:any)=>a.target_id===r.id)?.status==="invited"?"invite_sent":(access??[]).find((a:any)=>a.target_id===r.id)?.status==="disabled"?"disabled":r.profile_id?"portal_ready":"not_linked",updatedAt:r.updated_at}));}
export async function getAdminTrainer(id:string){return(await listAdminTrainers()).find(x=>x.id===id)??null;}
export async function createAdminTrainer(input:Omit<TrainerAdminRecord,"id"|"loginLinked"|"updatedAt">){const supabase=getSupabaseBrowserClient();const record:TrainerAdminRecord={...input,id:slugify(input.fullName)||makeId("trainer"),loginLinked:false,updatedAt:new Date().toISOString()};if(!supabase)return{ok:true,id:demoStore.trainers.create(record).id};const {data,error}=await supabase.from("trainers").insert({full_name:input.fullName,mobile:input.mobile,email:input.email,city:input.city,country:input.country??"India",state:input.state??"",timezone:input.timezone??"Asia/Kolkata",designation:input.designation,joining_date:input.joiningDate||null,specialties:input.specialties,record_status:input.recordStatus}).select("id").single();if(error)return{ok:false,error:error.message};if(input.courseIds.length){const {error:tc}=await supabase.from("trainer_courses").insert(input.courseIds.map(courseId=>({trainer_id:data.id,course_id:courseId})));if(tc)return{ok:false,error:tc.message};}return{ok:true,id:data.id};}
export async function updateAdminTrainer(id:string,input:Partial<TrainerAdminRecord>){const supabase=getSupabaseBrowserClient();if(!supabase)return{ok:true,data:demoStore.trainers.update(id,input)};const db:any={};const map:any={fullName:"full_name",mobile:"mobile",email:"email",city:"city",country:"country",state:"state",timezone:"timezone",designation:"designation",joiningDate:"joining_date",specialties:"specialties",recordStatus:"record_status"};Object.entries(input).forEach(([k,v])=>{if(map[k])db[map[k]]=v});const{error}=await supabase.from("trainers").update({...db,updated_at:new Date().toISOString()}).eq("id",id);if(error)return{ok:false,error:error.message};if(input.courseIds){await supabase.from("trainer_courses").delete().eq("trainer_id",id);if(input.courseIds.length){const{error:tc}=await supabase.from("trainer_courses").insert(input.courseIds.map(courseId=>({trainer_id:id,course_id:courseId})));if(tc)return{ok:false,error:tc.message};}}return{ok:true};}
export async function deleteAdminTrainer(id:string){
 const supabase=getSupabaseBrowserClient();
 if(!supabase){
  const used=demoStore.enrollments.list().some(e=>e.trainerId===id)||demoStore.cohorts.list().some(c=>c.trainerId===id)||demoStore.schedule.list().some(e=>e.trainerId===id)||demoStore.feedback.list().some(f=>f.trainerId===id)||demoStore.observations.list().some(o=>o.trainerId===id);
  if(used)return{ok:false,error:"This trainer has teaching or historical records. Reassign active learners/classes if needed, then deactivate or archive the trainer instead of deleting."};
  demoStore.trainerFinance.list().filter(x=>x.trainerId===id).forEach(x=>demoStore.trainerFinance.remove(x.id));demoStore.trainers.remove(id);return{ok:true};
 }
 const checks=await Promise.all([
  supabase.from("enrollments").select("id",{head:true,count:"exact"}).eq("trainer_id",id),
  supabase.from("cohorts").select("id",{head:true,count:"exact"}).eq("trainer_id",id),
  supabase.from("schedule_events").select("id",{head:true,count:"exact"}).eq("trainer_id",id),
  supabase.from("trainer_feedback").select("id",{head:true,count:"exact"}).eq("trainer_id",id),
  supabase.from("learning_observations").select("id",{head:true,count:"exact"}).eq("trainer_id",id)
 ]);
 if(checks.some(x=>(x.count??0)>0))return{ok:false,error:"This trainer has teaching or historical records. Deactivate/offboard the trainer and preserve history."};
 const{error}=await supabase.from("trainers").delete().eq("id",id);return error?{ok:false,error:error.message}:{ok:true};
}

// ---------------- Trainer Finance & Compliance (Admin-only UI; RLS protects live data) ----------------
export async function getTrainerFinance(trainerId:string):Promise<TrainerFinanceRecord|null>{
 const supabase=getSupabaseBrowserClient();if(!supabase)return demoStore.trainerFinance.list().find(x=>x.trainerId===trainerId)??null;
 const{data}=await supabase.from("trainer_finance").select("*").eq("trainer_id",trainerId).maybeSingle();if(!data)return null;
 return{id:data.id,trainerId:data.trainer_id,accountHolderName:data.account_holder_name??"",bankName:data.bank_name??"",accountNumber:data.account_number??"",ifsc:data.ifsc??"",upiId:data.upi_id??"",preferredPayoutMethod:data.preferred_payout_method??"bank",paymentModel:data.payment_model??"per_class",paymentRate:data.payment_rate??undefined,pan:data.pan??"",complianceStatus:data.compliance_status??"pending",notes:data.notes??"",updatedAt:data.updated_at};
}
export async function saveTrainerFinance(trainerId:string,input:Omit<TrainerFinanceRecord,"id"|"trainerId"|"updatedAt">){
 const supabase=getSupabaseBrowserClient();const now=new Date().toISOString();
 if(!supabase){const existing=demoStore.trainerFinance.list().find(x=>x.trainerId===trainerId);if(existing){demoStore.trainerFinance.update(existing.id,{...input,updatedAt:now});return{ok:true,id:existing.id};}const record:TrainerFinanceRecord={...input,id:makeId("finance"),trainerId,updatedAt:now};demoStore.trainerFinance.create(record);return{ok:true,id:record.id};}
 const payload={trainer_id:trainerId,account_holder_name:input.accountHolderName,bank_name:input.bankName,account_number:input.accountNumber,ifsc:input.ifsc,upi_id:input.upiId,preferred_payout_method:input.preferredPayoutMethod,payment_model:input.paymentModel,payment_rate:input.paymentRate??null,pan:input.pan,compliance_status:input.complianceStatus,notes:input.notes,updated_at:now};
 const{data,error}=await supabase.from("trainer_finance").upsert(payload,{onConflict:"trainer_id"}).select("id").single();return error?{ok:false,error:error.message}:{ok:true,id:data.id};
}

// ---------------- Admin Course CRUD ----------------
export async function listAdminCourses():Promise<CourseAdminRecord[]>{const supabase=getSupabaseBrowserClient();if(!supabase)return demoStore.courses.list();const{data}=await supabase.from("courses").select("*").order("title");return(data??[]).map((r:any)=>({id:r.id,slug:r.slug,title:r.title,shortTitle:r.short_title??r.title,publicName:r.public_name??r.title,internalName:r.internal_name??r.short_title??r.title,outcomeSubtitle:r.outcome_subtitle??"",code:r.code??"",category:r.category??"",gradeFrom:r.grade_from??0,gradeTo:r.grade_to??0,ageFrom:r.age_from??0,ageTo:r.age_to??0,level:r.level??"",totalSessions:r.total_sessions??0,sessionDuration:r.session_duration??60,plannedHours:r.planned_hours??((r.total_sessions??0)*(r.session_duration??60)/60),deliveryModes:r.delivery_modes??[],codingType:r.coding_type??"",technologies:r.technologies??[],description:r.description??"",outcomes:r.outcomes??[],projects:r.projects??[],assessmentPattern:r.assessment_pattern??"",practiceMissions:r.practice_missions??true,certificate:r.certificate??true,status:r.status??"draft",defaultCohortCapacity:r.default_cohort_capacity??4,minimumCohortSize:r.minimum_cohort_size??2,updatedAt:r.updated_at}));}
export async function getAdminCourse(id:string){return(await listAdminCourses()).find(x=>x.id===id||x.slug===id)??null;}
export async function createAdminCourse(input:Omit<CourseAdminRecord,"id"|"updatedAt">){const supabase=getSupabaseBrowserClient();const id=slugify(input.slug||input.title)||makeId("course");const record:CourseAdminRecord={...input,id,slug:id,updatedAt:new Date().toISOString()};if(!supabase)return{ok:true,id:demoStore.courses.create(record).id};const{data,error}=await supabase.from("courses").insert({slug:record.slug,title:record.title,short_title:record.shortTitle,public_name:record.publicName||record.title,internal_name:record.internalName||record.shortTitle||record.title,outcome_subtitle:record.outcomeSubtitle||"",code:record.code,category:record.category,grade_from:record.gradeFrom,grade_to:record.gradeTo,age_from:record.ageFrom,age_to:record.ageTo,level:record.level,total_sessions:record.totalSessions,session_duration:record.sessionDuration,planned_hours:record.plannedHours??plannedCourseHours(record),delivery_modes:record.deliveryModes,coding_type:record.codingType,technologies:record.technologies,description:record.description,outcomes:record.outcomes,projects:record.projects,assessment_pattern:record.assessmentPattern,practice_missions:record.practiceMissions,certificate:record.certificate,status:record.status,default_cohort_capacity:record.defaultCohortCapacity??4,minimum_cohort_size:record.minimumCohortSize??2}).select("id").single();return error?{ok:false,error:error.message}:{ok:true,id:data.id};}
export async function updateAdminCourse(id:string,input:Partial<CourseAdminRecord>){const supabase=getSupabaseBrowserClient();if(!supabase)return{ok:true,data:demoStore.courses.update(id,input)};const db:any={};const map:any={slug:"slug",title:"title",shortTitle:"short_title",publicName:"public_name",internalName:"internal_name",outcomeSubtitle:"outcome_subtitle",code:"code",category:"category",gradeFrom:"grade_from",gradeTo:"grade_to",ageFrom:"age_from",ageTo:"age_to",level:"level",totalSessions:"total_sessions",sessionDuration:"session_duration",plannedHours:"planned_hours",deliveryModes:"delivery_modes",codingType:"coding_type",technologies:"technologies",description:"description",outcomes:"outcomes",projects:"projects",assessmentPattern:"assessment_pattern",practiceMissions:"practice_missions",certificate:"certificate",status:"status",defaultCohortCapacity:"default_cohort_capacity",minimumCohortSize:"minimum_cohort_size"};Object.entries(input).forEach(([k,v])=>{if(map[k])db[map[k]]=v});const{error}=await supabase.from("courses").update({...db,updated_at:new Date().toISOString()}).eq("id",id);return error?{ok:false,error:error.message}:{ok:true};}
export async function deleteAdminCourse(id:string){
 const supabase=getSupabaseBrowserClient();
 if(!supabase){
  const used=demoStore.enrollments.list().some(e=>e.courseId===id)||demoStore.cohorts.list().some(c=>c.courseId===id)||demoStore.schedule.list().some(e=>e.courseId===id)||demoStore.trainers.list().some(t=>t.courseIds.includes(id));
  if(used)return{ok:false,error:"This course/program is already referenced by trainer permissions, enrollments, cohorts or class history. Archive it instead of deleting it."};
  demoStore.courses.remove(id);return{ok:true};
 }
 const checks=await Promise.all([
  supabase.from("enrollments").select("id",{head:true,count:"exact"}).eq("course_id",id),
  supabase.from("cohorts").select("id",{head:true,count:"exact"}).eq("course_id",id),
  supabase.from("schedule_events").select("id",{head:true,count:"exact"}).eq("course_id",id),
  supabase.from("trainer_courses").select("course_id",{head:true,count:"exact"}).eq("course_id",id)
 ]);
 if(checks.some(x=>(x.count??0)>0))return{ok:false,error:"This course/program has operational or historical references. Archive it instead of deleting it."};
 const{error}=await supabase.from("courses").delete().eq("id",id);return error?{ok:false,error:error.message}:{ok:true};
}

// ---------------- Offline delivery centers ----------------
const demoDeliveryCenters:DeliveryCenterRecord[]=[
 {id:"center-robotronix",name:"Robotronix Center",centerType:"robotronix_center",area:"Delhi",city:"Delhi",state:"Delhi",country:"India",address:"Delhi",active:true},
];
export async function listDeliveryCenters():Promise<DeliveryCenterRecord[]>{const supabase=getSupabaseBrowserClient();if(!supabase)return demoDeliveryCenters;const{data,error}=await supabase.from("delivery_centers").select("*").eq("active",true).order("name");if(error)return[];return(data??[]).map((r:any)=>({id:r.id,name:r.name,centerType:r.center_type,area:r.area??undefined,city:r.city??"",state:r.state??undefined,country:r.country??"",address:r.address??"",contactPerson:r.contact_person??undefined,contactNumber:r.contact_number??undefined,capacity:r.capacity??undefined,notes:r.notes??undefined,active:r.active!==false,updatedAt:r.updated_at??undefined}));}
export async function createDeliveryCenter(input:Omit<DeliveryCenterRecord,"id"|"updatedAt">){const supabase=getSupabaseBrowserClient();if(!supabase){const row={...input,id:makeId("center"),updatedAt:new Date().toISOString()};demoDeliveryCenters.push(row);return{ok:true,id:row.id};}const{data,error}=await supabase.from("delivery_centers").insert({name:input.name,center_type:input.centerType,area:input.area||null,city:input.city,state:input.state||null,country:input.country,address:input.address,contact_person:input.contactPerson||null,contact_number:input.contactNumber||null,capacity:input.capacity??null,notes:input.notes||null,active:input.active}).select("id").single();return error?{ok:false,error:error.message}:{ok:true,id:data.id};}

// ---------------- Enrollment + Cohort operations ----------------
function countAttended(rows:any[]){return rows.filter(r=>r.status==="attended"||r.status==="late").length;}
function mapDbScheduleEvent(r:any):ScheduleEvent{return{id:r.id,trainerId:r.trainer_id,courseId:r.course_id??"",enrollmentId:r.enrollment_id??undefined,cohortId:r.cohort_id??undefined,studentId:r.student_id??undefined,title:r.title,date:r.date,startTime:String(r.start_time).slice(0,5),endTime:String(r.end_time).slice(0,5),timezone:r.timezone??IST_TIMEZONE,eventType:r.event_type,deliveryMode:r.delivery_mode,status:r.status,actualDurationMinutes:r.actual_duration_minutes??undefined,occurrenceKind:r.occurrence_kind??"regular",notes:r.notes??"",rescheduledToId:r.rescheduled_to_id??undefined,originalEventId:r.original_event_id??undefined,requestedBy:r.requested_by??undefined,changeReason:r.change_reason??undefined,sessionTopic:r.session_topic??undefined,projectWorkedOn:r.project_worked_on??undefined,skillsWorked:r.skills_worked??[]};}
export async function listAdminEnrollments():Promise<EnrollmentAdminRecord[]>{
  const supabase=getSupabaseBrowserClient();
  if(!supabase){
    const attendance=demoStore.attendance.list();const courses=demoStore.courses.list();const events=demoStore.schedule.list();
    return demoStore.enrollments.list().map(e=>{
      const completed=(e.openingCompletedSessions??0)+countAttended(attendance.filter(a=>a.enrollmentId===e.id));
      const course=courses.find(c=>c.id===e.courseId);const planned=e.plannedSessions&&course?Math.round((e.plannedSessions*course.sessionDuration/60)*100)/100:plannedCourseHours(course);
      const delivered=(e.openingCompletedMinutes??0)/60+deliveredHoursForEnrollment(e,events,attendance);
      return{...e,sessionsCompleted:completed,...progressFromHours(planned,delivered)};
    });
  }
  const [data,att,ev]=await Promise.all([
    readAllPages(()=>supabase.from("enrollments").select("id,student_id,course_id,trainer_id,cohort_id,status,started_at,completed_at,hold_reason,hold_from,hold_until,hold_note,delivery_channel,center_location,schedule_mode,schedule_timezone,schedule_rules,program_model,planned_sessions,paid_session_balance,planned_end_date,auto_complete_on_session_limit,schedule_override_confirmed,schedule_override_note,migration_type,opening_completed_sessions,opening_completed_minutes,migration_note,portal_tracking_started_at,course:courses(total_sessions,session_duration,planned_hours)").order("started_at",{ascending:false}).order("id")),
    readAllPages(()=>supabase.from("class_attendance").select("id,schedule_event_id,student_id,enrollment_id,status,note,updated_at").order("id")),
    readAllPages(()=>supabase.from("schedule_events").select("*").order("id"))
  ]);
  const events=(ev??[]).map((r:any)=>mapDbScheduleEvent(r));
  const attendance=(att??[]).map((a:any)=>({id:a.id,scheduleEventId:a.schedule_event_id,studentId:a.student_id,enrollmentId:a.enrollment_id,status:a.status,note:a.note??undefined,updatedAt:a.updated_at??undefined})) as ClassAttendanceRecord[];
  return(data??[]).map((r:any)=>{
    const base:EnrollmentAdminRecord={id:r.id,studentId:r.student_id,courseId:r.course_id,trainerId:r.trainer_id??"",enrollmentType:r.cohort_id?"small_group":"one_to_one",cohortId:r.cohort_id??undefined,status:r.status,startedAt:r.started_at,completedAt:r.completed_at??undefined,holdReason:r.hold_reason??undefined,holdFrom:r.hold_from??undefined,holdUntil:r.hold_until??undefined,holdNote:r.hold_note??undefined,deliveryChannel:r.delivery_channel??"online",centerLocation:r.center_location??undefined,scheduleMode:r.schedule_mode??"recurring",scheduleTimezone:r.schedule_timezone??IST_TIMEZONE,scheduleRules:r.schedule_rules??[],programModel:r.program_model??"fixed_program",plannedSessions:r.planned_sessions??undefined,paidSessionBalance:r.paid_session_balance??undefined,plannedEndDate:r.planned_end_date??undefined,autoCompleteOnSessionLimit:r.auto_complete_on_session_limit??true,scheduleOverrideConfirmed:r.schedule_override_confirmed??false,scheduleOverrideNote:r.schedule_override_note??undefined,migrationType:r.migration_type??"native",openingCompletedSessions:Number(r.opening_completed_sessions??0),openingCompletedMinutes:Number(r.opening_completed_minutes??0),migrationNote:r.migration_note??undefined,portalTrackingStartedAt:r.portal_tracking_started_at??undefined,sessionsCompleted:0,progressPercent:0};
    const rows=attendance.filter(a=>a.enrollmentId===r.id);const completed=(base.openingCompletedSessions??0)+countAttended(rows);
    const planned=base.plannedSessions?Math.round((base.plannedSessions*Number(r.course?.session_duration??60)/60)*100)/100:plannedCourseHours({plannedHours:r.course?.planned_hours,totalSessions:r.course?.total_sessions??0,sessionDuration:r.course?.session_duration??60} as CourseAdminRecord);
    const delivered=(base.openingCompletedMinutes??0)/60+deliveredHoursForEnrollment(base,events,attendance);
    return{...base,sessionsCompleted:completed,...progressFromHours(planned,delivered)};
  });
}
export async function getAdminEnrollment(id:string){return(await listAdminEnrollments()).find(x=>x.id===id)??null;}
export async function updateAdminEnrollment(id:string,input:Partial<EnrollmentAdminRecord>){if(input.scheduleRules?.length){const e=weeklyScheduleError(input.scheduleRules);if(e)return{ok:false,error:e};}const supabase=getSupabaseBrowserClient();const safe={...input};delete(safe as any).sessionsCompleted;delete(safe as any).plannedHours;delete(safe as any).hoursCompleted;delete(safe as any).hoursRemaining;delete(safe as any).progressPercent;if(!supabase)return{ok:true,data:demoStore.enrollments.update(id,safe)};const patch:any={};const map:any={studentId:"student_id",courseId:"course_id",trainerId:"trainer_id",enrollmentType:"enrollment_type",cohortId:"cohort_id",status:"status",startedAt:"started_at",completedAt:"completed_at",holdReason:"hold_reason",holdFrom:"hold_from",holdUntil:"hold_until",holdNote:"hold_note",deliveryChannel:"delivery_channel",centerLocation:"center_location",scheduleMode:"schedule_mode",scheduleTimezone:"schedule_timezone",scheduleRules:"schedule_rules",programModel:"program_model",plannedSessions:"planned_sessions",paidSessionBalance:"paid_session_balance",plannedEndDate:"planned_end_date",autoCompleteOnSessionLimit:"auto_complete_on_session_limit",scheduleOverrideConfirmed:"schedule_override_confirmed",scheduleOverrideNote:"schedule_override_note",migrationType:"migration_type",openingCompletedSessions:"opening_completed_sessions",openingCompletedMinutes:"opening_completed_minutes",migrationNote:"migration_note",portalTrackingStartedAt:"portal_tracking_started_at"};Object.entries(safe).forEach(([k,v])=>{if(map[k])patch[map[k]]=v===undefined?null:v});if(input.enrollmentType==="one_to_one")patch.cohort_id=null;const{error}=await supabase.from("enrollments").update(patch).eq("id",id);return error?{ok:false,error:error.message}:{ok:true};}
export async function createAdminEnrollment(input:Omit<EnrollmentAdminRecord,"id"|"sessionsCompleted"|"plannedHours"|"hoursCompleted"|"hoursRemaining"|"progressPercent">){if((input.scheduleMode||"recurring")==="recurring"&&weeklyScheduleError(input.scheduleRules??[]))return{ok:false,error:weeklyScheduleError(input.scheduleRules??[])!};if((input.migrationType??"native")!=="active_existing"&&!validNewEnrollmentDate(input.startedAt))return{ok:false,error:"Enrollment start date cannot be earlier than today (IST) for a new enrollment."};const supabase=getSupabaseBrowserClient();const record:EnrollmentAdminRecord={...input,id:makeId("enr"),sessionsCompleted:input.openingCompletedSessions??0,plannedHours:0,hoursCompleted:(input.openingCompletedMinutes??0)/60,hoursRemaining:0,progressPercent:0};if(!supabase){demoStore.enrollments.create(record);return{ok:true,id:record.id};}const{data,error}=await supabase.from("enrollments").insert({student_id:input.studentId,course_id:input.courseId,trainer_id:input.trainerId,enrollment_type:input.enrollmentType,cohort_id:input.cohortId||null,status:input.status,started_at:input.startedAt,completed_at:input.completedAt||null,hold_reason:input.holdReason||null,hold_from:input.holdFrom||null,hold_until:input.holdUntil||null,hold_note:input.holdNote||null,delivery_channel:input.deliveryChannel||"online",center_location:input.centerLocation||"",schedule_mode:input.scheduleMode||"recurring",schedule_timezone:input.scheduleTimezone||IST_TIMEZONE,schedule_rules:input.scheduleRules??[],program_model:input.programModel??"fixed_program",planned_sessions:input.plannedSessions??null,paid_session_balance:input.paidSessionBalance??null,planned_end_date:input.plannedEndDate??null,auto_complete_on_session_limit:input.autoCompleteOnSessionLimit??true,schedule_override_confirmed:input.scheduleOverrideConfirmed??false,schedule_override_note:input.scheduleOverrideNote||null,migration_type:input.migrationType??"native",opening_completed_sessions:input.openingCompletedSessions??0,opening_completed_minutes:input.openingCompletedMinutes??0,migration_note:input.migrationNote||null,portal_tracking_started_at:input.portalTrackingStartedAt||null,sessions_completed:input.openingCompletedSessions??0}).select("id").single();return error?{ok:false,error:error.message}:{ok:true,id:data.id};}

export async function listAdminCohorts():Promise<CohortAdminRecord[]>{const supabase=getSupabaseBrowserClient();if(!supabase){const enrs=demoStore.enrollments.list();return demoStore.cohorts.list().map(c=>({...c,studentIds:enrs.filter(e=>e.cohortId===c.id&&["active","on_hold"].includes(e.status)).map(e=>e.studentId)}));}const{data:rows}=await supabase.from("cohorts").select("*").order("created_at",{ascending:false});const{data:enrs}=await supabase.from("enrollments").select("student_id,cohort_id,status").not("cohort_id","is",null);return(rows??[]).map((r:any)=>({id:r.id,name:r.name,code:r.code,courseId:r.course_id,trainerId:r.trainer_id??"",capacity:r.capacity??4,minimumStartSize:r.minimum_start_size??2,studentIds:(enrs??[]).filter((e:any)=>e.cohort_id===r.id&&["active","on_hold"].includes(e.status)).map((e:any)=>e.student_id),deliveryChannel:r.delivery_channel??"online",centerLocation:r.center_location??undefined,scheduleMode:r.schedule_mode??"recurring",status:r.status,startedAt:r.started_at??"",daysOfWeek:r.days_of_week??[],startTime:String(r.start_time??"").slice(0,5),endTime:String(r.end_time??"").slice(0,5),cohortLabel:r.cohort_label??"A",scheduleTimezone:r.schedule_timezone??IST_TIMEZONE,scheduleRules:r.schedule_rules??[],schedule:r.schedule_text??""}));}
export async function getAdminCohort(id:string){return(await listAdminCohorts()).find(x=>x.id===id)??null;}
export async function updateAdminCohort(id:string,input:Partial<CohortAdminRecord>){if(input.scheduleRules?.length){const e=weeklyScheduleError(input.scheduleRules);if(e)return{ok:false,error:e};}const supabase=getSupabaseBrowserClient();if(!supabase)return{ok:true,data:demoStore.cohorts.update(id,input)};const patch:any={};const map:any={name:"name",code:"code",courseId:"course_id",trainerId:"trainer_id",capacity:"capacity",minimumStartSize:"minimum_start_size",status:"status",startedAt:"started_at",daysOfWeek:"days_of_week",startTime:"start_time",endTime:"end_time",cohortLabel:"cohort_label",deliveryChannel:"delivery_channel",centerLocation:"center_location",scheduleMode:"schedule_mode",scheduleTimezone:"schedule_timezone",scheduleRules:"schedule_rules",schedule:"schedule_text"};Object.entries(input).forEach(([k,v])=>{if(map[k])patch[map[k]]=v});const{error}=await supabase.from("cohorts").update({...patch,updated_at:new Date().toISOString()}).eq("id",id);return error?{ok:false,error:error.message}:{ok:true};}
export async function createAdminCohort(input:Omit<CohortAdminRecord,"id"|"studentIds">){if((input.scheduleMode||"recurring")==="recurring"){const e=weeklyScheduleError(input.scheduleRules??[]);if(e)return{ok:false,error:e};}const supabase=getSupabaseBrowserClient();const record:CohortAdminRecord={...input,id:makeId("cohort"),studentIds:[]};if(!supabase){demoStore.cohorts.create(record);return{ok:true,id:record.id};}const{data,error}=await supabase.from("cohorts").insert({name:input.name,code:input.code,course_id:input.courseId,trainer_id:input.trainerId||null,capacity:input.capacity,minimum_start_size:input.minimumStartSize??2,status:input.status,started_at:input.startedAt,days_of_week:input.daysOfWeek,start_time:input.startTime,end_time:input.endTime,cohort_label:input.cohortLabel,delivery_channel:input.deliveryChannel||"online",center_location:input.centerLocation||"",schedule_mode:input.scheduleMode||"recurring",schedule_timezone:input.scheduleTimezone||IST_TIMEZONE,schedule_rules:input.scheduleRules??[],schedule_text:input.schedule}).select("id").single();return error?{ok:false,error:error.message}:{ok:true,id:data.id};}

// ---------------- Scheduling, availability & class tracking ----------------
export async function listTrainerAvailability(trainerId?:string,strict=false){const supabase=getSupabaseBrowserClient();if(!supabase){const rows=demoStore.availability.list();return trainerId?rows.filter(x=>x.trainerId===trainerId):rows;}let q=supabase.from("trainer_availability").select("*").order("day_of_week");if(trainerId)q=q.eq("trainer_id",trainerId);const{data,error}=await q;if(error&&strict)throw new Error("Unable to load trainer availability: "+error.message);return(data??[]).map((r:any)=>({id:r.id,trainerId:r.trainer_id,dayOfWeek:r.day_of_week,startTime:String(r.start_time).slice(0,5),endTime:String(r.end_time).slice(0,5),enabled:r.enabled}));}
async function notifyAdminOfOwnAvailability(trainerId:string,kind:"weekly"|"override_added"|"override_removed"){
 const db=getSupabaseBrowserClient();
 if(!db)return{ok:true};
 const {data:{user}}=await db.auth.getUser();
 if(!user)return{ok:false,error:"Signed-in user not found for Admin notification."};
 const {data:trainer,error:lookupError}=await db.from("trainers").select("profile_id").eq("id",trainerId).maybeSingle();
 if(lookupError)return{ok:false,error:lookupError.message};
 if(trainer?.profile_id!==user.id)return{ok:true,skipped:true}; // Admin editing on a trainer's behalf: no trainer-origin alert.
 const {error}=await db.rpc("notify_admin_trainer_availability_change",{p_trainer_id:trainerId,p_change_kind:kind});
 return error?{ok:false,error:error.message}:{ok:true};
}
export async function saveTrainerAvailability(trainerId:string,rows:Array<{dayOfWeek:number;startTime:string;endTime:string;enabled:boolean}>){const supabase=getSupabaseBrowserClient();const active=rows.filter(r=>r.enabled);for(const row of active){if(!row.startTime||!row.endTime||row.endTime<=row.startTime)return{ok:false,error:"Every availability slot needs a valid start and end time."};}for(let day=0;day<7;day++){const dayRows=active.filter(r=>r.dayOfWeek===day).sort((a,b)=>a.startTime.localeCompare(b.startTime));for(let i=1;i<dayRows.length;i++)if(dayRows[i].startTime<dayRows[i-1].endTime)return{ok:false,error:"Availability slots on the same day cannot overlap."};}if(!supabase){for(const existing of demoStore.availability.list().filter(x=>x.trainerId===trainerId))demoStore.availability.remove(existing.id);for(const row of active)demoStore.availability.create({id:makeId("avail"),trainerId,...row});return{ok:true};}await supabase.from("trainer_availability").delete().eq("trainer_id",trainerId);if(!active.length){const notification=await notifyAdminOfOwnAvailability(trainerId,"weekly");return{ok:true,notificationSkipped:'skipped' in notification&&notification.skipped===true,notificationWarning:notification.ok?undefined:notification.error};}const inserts=active.map(r=>({trainer_id:trainerId,day_of_week:r.dayOfWeek,start_time:r.startTime,end_time:r.endTime,enabled:true}));const{error}=await supabase.from("trainer_availability").insert(inserts);if(error)return{ok:false,error:error.message};const notification=await notifyAdminOfOwnAvailability(trainerId,"weekly");return{ok:true,notificationSkipped:'skipped' in notification&&notification.skipped===true,notificationWarning:notification.ok?undefined:notification.error};}
export async function listAvailabilityOverrides(trainerId?:string,strict=false){const supabase=getSupabaseBrowserClient();if(!supabase){const rows=demoStore.availabilityOverrides.list();return trainerId?rows.filter(x=>x.trainerId===trainerId):rows;}let q=supabase.from("trainer_availability_overrides").select("*").order("date");if(trainerId)q=q.eq("trainer_id",trainerId);const{data,error}=await q;if(error&&strict)throw new Error("Unable to load availability overrides: "+error.message);return(data??[]).map((r:any)=>({id:r.id,trainerId:r.trainer_id,date:r.date,startTime:String(r.start_time).slice(0,5),endTime:String(r.end_time).slice(0,5),type:r.override_type,reason:r.reason??""}));}
export async function createAvailabilityOverride(input:Omit<import("./types").TrainerAvailabilityOverride,"id">){if(input.startTime&&input.endTime){const e=timeRangeError(input.startTime,input.endTime,false);if(e)return{ok:false,error:e};}const supabase=getSupabaseBrowserClient();const row={...input,id:makeId("override")};if(!supabase){demoStore.availabilityOverrides.create(row);return{ok:true,id:row.id};}const{data,error}=await supabase.from("trainer_availability_overrides").insert({trainer_id:input.trainerId,date:input.date,start_time:input.startTime,end_time:input.endTime,override_type:input.type,reason:input.reason}).select("id").single();if(error)return{ok:false,error:error.message};const notification=await notifyAdminOfOwnAvailability(input.trainerId,"override_added");return{ok:true,id:data.id,notificationSkipped:'skipped' in notification&&notification.skipped===true,notificationWarning:notification.ok?undefined:notification.error};}
export async function deleteAvailabilityOverride(id:string){const supabase=getSupabaseBrowserClient();if(!supabase){demoStore.availabilityOverrides.remove(id);return{ok:true};}const{data:existing}=await supabase.from("trainer_availability_overrides").select("trainer_id").eq("id",id).maybeSingle();const{error}=await supabase.from("trainer_availability_overrides").delete().eq("id",id);if(error)return{ok:false,error:error.message};if(!existing?.trainer_id)return{ok:true};const notification=await notifyAdminOfOwnAvailability(existing.trainer_id,"override_removed");return{ok:true,notificationSkipped:'skipped' in notification&&notification.skipped===true,notificationWarning:notification.ok?undefined:notification.error};}

export async function listScheduleEvents(trainerId?:string,strict=false):Promise<ScheduleEvent[]>{const supabase=getSupabaseBrowserClient();if(!supabase){const rows=demoStore.schedule.list();return trainerId?rows.filter(x=>x.trainerId===trainerId):rows;}let q=supabase.from("schedule_events").select("*").order("date").order("start_time");if(trainerId)q=q.eq("trainer_id",trainerId);const{data,error}=await q;if(error&&strict)throw new Error("Unable to load schedule events: "+error.message);return(data??[]).map((r:any)=>({id:r.id,trainerId:r.trainer_id,courseId:r.course_id??"",enrollmentId:r.enrollment_id??undefined,cohortId:r.cohort_id??undefined,studentId:r.student_id??undefined,title:r.title,date:r.date,startTime:String(r.start_time).slice(0,5),endTime:String(r.end_time).slice(0,5),timezone:r.timezone??IST_TIMEZONE,eventType:r.event_type,deliveryMode:r.delivery_mode,status:r.status,actualDurationMinutes:r.actual_duration_minutes??undefined,occurrenceKind:r.occurrence_kind??"regular",notes:r.notes??"",rescheduledToId:r.rescheduled_to_id??undefined,originalEventId:r.original_event_id??undefined,requestedBy:r.requested_by??undefined,changeReason:r.change_reason??undefined,sessionTopic:r.session_topic??undefined,projectWorkedOn:r.project_worked_on??undefined,skillsWorked:r.skills_worked??[]}));}
function timeOverlap(aStart:string,aEnd:string,bStart:string,bEnd:string){return aStart<bEnd&&aEnd>bStart;}
function eventRange(e:Pick<ScheduleEvent,"date"|"startTime"|"endTime"|"timezone">){const range=zonedRangeParts(e.date,e.startTime,e.endTime,e.timezone||IST_TIMEZONE,IST_TIMEZONE);return{start:range.startInstant.getTime(),end:range.endInstant.getTime()};}
async function availabilityCheck(trainerId:string,date:string,startTime:string,endTime:string,timeZone:string){const startIst=zonedParts(date,startTime,timeZone||IST_TIMEZONE,IST_TIMEZONE);const endIst=zonedParts(date,endTime,timeZone||IST_TIMEZONE,IST_TIMEZONE);if(startIst.date!==endIst.date)return{ok:false,error:"This class crosses midnight in the trainer’s IST working calendar. Split or adjust the time."};const istDate=startIst.date,istStart=startIst.time,istEnd=endIst.time;const day=new Date(`${istDate}T12:00:00`).getDay();const [base,overrides]=await Promise.all([listTrainerAvailability(trainerId),listAvailabilityOverrides(trainerId)]);const dateOverrides=overrides.filter(o=>o.date===istDate&&timeOverlap(istStart,istEnd,o.startTime,o.endTime));if(dateOverrides.some(o=>o.type==="unavailable"))return{ok:false,error:`Trainer is unavailable during this time (${dateOverrides.find(o=>o.type==="unavailable")?.reason||"blocked"}).`};if(dateOverrides.some(o=>o.type==="available"&&istStart>=o.startTime&&istEnd<=o.endTime))return{ok:true};const window=base.find(a=>a.dayOfWeek===day&&a.enabled&&istStart>=a.startTime&&istEnd<=a.endTime);return window?{ok:true}:{ok:false,error:`Selected learner time converts to ${istStart}–${istEnd} IST, outside this trainer’s working availability.`};}
async function syncZoomScheduleEvent(scheduleEventId:string,action:"sync"|"delete"="sync"){
 const supabase=getSupabaseBrowserClient();if(!supabase)return{ok:true as const};
 const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)return{ok:false as const,error:"Admin session is unavailable for Zoom synchronization."};
 try{
  const response=await fetch("/api/zoom/schedule/sync",{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({scheduleEventId,action})});
  const json=await response.json().catch(()=>({}));
  return response.ok&&json.ok!==false?{ok:true as const,data:json}:{ok:false as const,error:json.error||"Zoom synchronization failed."};
 }catch(error){return{ok:false as const,error:error instanceof Error?error.message:String(error)}}
}

export async function createScheduleEvent(input:Omit<ScheduleEvent,"id">){if(input.eventType==="class"){const e=classSlotError(input);if(e)return{ok:false,error:e};}else if(input.startTime&&input.endTime){const e=timeRangeError(input.startTime,input.endTime,false);if(e)return{ok:false,error:e};}if(input.eventType==="class"&&(!/:(00|30)$/.test(input.startTime)||!/:(00|30)$/.test(input.endTime)))return{ok:false,error:"Class times must use :00 or :30 minute intervals."};
const supabaseForLimit=getSupabaseBrowserClient();
if(input.eventType==="class"&&input.enrollmentId&&supabaseForLimit){
 const{data:enrollment}=await supabaseForLimit.from("enrollments").select("status,program_model,planned_sessions,paid_session_balance,sessions_completed,schedule_override_confirmed").eq("id",input.enrollmentId).maybeSingle();
 if(enrollment?.status==="completed"||enrollment?.status==="cancelled")return{ok:false,error:"This enrollment is no longer active for scheduling."};
 const target=Number(enrollment?.planned_sessions||0),done=Number(enrollment?.sessions_completed||0);
 if(enrollment?.program_model==="fixed_program"&&target>0&&done>=target)return{ok:false,error:"The planned session limit has been reached. Complete or extend the enrollment before scheduling another class."};
 if(["short_package","open_ended"].includes(enrollment?.program_model)&&enrollment?.paid_session_balance!==null&&enrollment?.paid_session_balance!==undefined&&Number(enrollment.paid_session_balance)<=0)return{ok:false,error:"No paid sessions remain. Add/renew a fee package before scheduling another class."};
}
const existing=await listScheduleEvents();
const nextRange=eventRange(input);
const activeExisting=existing.filter(e=>!['cancelled','rescheduled'].includes(e.status));
const trainerConflict=activeExisting.some(e=>{if(e.trainerId!==input.trainerId)return false;const r=eventRange(e);return nextRange.start<r.end&&nextRange.end>r.start;});
if(trainerConflict)return{ok:false,error:"Trainer is already occupied during this time (after timezone conversion)."};
if(input.eventType==="class"){
 const enrollments=await listAdminEnrollments();
 const targetStudentIds=new Set<string>();
 if(input.studentId)targetStudentIds.add(input.studentId);
 if(input.enrollmentId){const enr=enrollments.find(e=>e.id===input.enrollmentId);if(enr?.studentId)targetStudentIds.add(enr.studentId);}
 if(input.cohortId)for(const enr of enrollments.filter(e=>e.cohortId===input.cohortId&&e.status==="active"))targetStudentIds.add(enr.studentId);
 if(targetStudentIds.size){
  const learnerConflict=activeExisting.some(e=>{
   const r=eventRange(e);if(!(nextRange.start<r.end&&nextRange.end>r.start))return false;
   const existingStudentIds=new Set<string>();
   if(e.studentId)existingStudentIds.add(e.studentId);
   if(e.enrollmentId){const enr=enrollments.find(x=>x.id===e.enrollmentId);if(enr?.studentId)existingStudentIds.add(enr.studentId);}
   if(e.cohortId)for(const enr of enrollments.filter(x=>x.cohortId===e.cohortId&&x.status==="active"))existingStudentIds.add(enr.studentId);
   return [...targetStudentIds].some(id=>existingStudentIds.has(id));
  });
  if(learnerConflict)return{ok:false,error:"Learner already has another class during this time (after timezone conversion)."};
 }
}
if(!['blocked','leave'].includes(input.eventType)){const available=await availabilityCheck(input.trainerId,input.date,input.startTime,input.endTime,input.timezone||IST_TIMEZONE);if(!available.ok){let overrideConfirmed=false;if(input.enrollmentId&&supabaseForLimit){const{data:policy}=await supabaseForLimit.from("enrollments").select("schedule_override_confirmed").eq("id",input.enrollmentId).maybeSingle();overrideConfirmed=Boolean(policy?.schedule_override_confirmed);}if(!overrideConfirmed)return available;}}const supabase=getSupabaseBrowserClient();const record={...input,id:makeId("event")};if(!supabase){demoStore.schedule.create(record);if(input.eventType==="class"){await emitNotification({recipientRole:"trainer",trainerId:input.trainerId,studentId:input.studentId,type:"class_scheduled",priority:"info",title:"Class scheduled",message:`${input.title} · ${input.date} ${input.startTime} ${shortTimeZoneLabel(input.timezone)}`,href:"/trainer/schedule"});const studentIds=input.studentId?[input.studentId]:(input.cohortId?demoStore.enrollments.list().filter(e=>e.cohortId===input.cohortId).map(e=>e.studentId):[]);for(const studentId of studentIds){await emitNotification({recipientRole:"parent",studentId,trainerId:input.trainerId,type:"class_scheduled",priority:"info",title:"Class scheduled",message:`A learning session is scheduled for ${input.date} at ${input.startTime} ${shortTimeZoneLabel(input.timezone)}.`,href:"/parent"});await emitNotification({recipientRole:"student",studentId,trainerId:input.trainerId,type:"class_scheduled",priority:"info",title:"Next class confirmed",message:`Your next class is scheduled for ${input.date} at ${input.startTime} ${shortTimeZoneLabel(input.timezone)}.`,href:"/student"});}}return{ok:true,id:record.id};}const{data,error}=await supabase.from("schedule_events").insert({trainer_id:input.trainerId,course_id:input.courseId||null,enrollment_id:input.enrollmentId||null,cohort_id:input.cohortId||null,student_id:input.studentId||null,title:input.title,date:input.date,start_time:input.startTime,end_time:input.endTime,timezone:input.timezone||IST_TIMEZONE,event_type:input.eventType,delivery_mode:input.deliveryMode,status:input.status,occurrence_kind:input.occurrenceKind||"regular",notes:input.notes||null,rescheduled_to_id:input.rescheduledToId||null,original_event_id:input.originalEventId||null,requested_by:input.requestedBy||null,change_reason:input.changeReason||null,session_topic:input.sessionTopic||null,project_worked_on:input.projectWorkedOn||null,skills_worked:input.skillsWorked||[]}).select("id").single();if(error)return{ok:false,error:error.message};if(input.eventType==="class"){const zoom=await syncZoomScheduleEvent(data.id);if(!zoom.ok){await supabase.from("schedule_events").delete().eq("id",data.id);return{ok:false,error:"Class was not scheduled because Zoom capacity or provisioning failed: "+zoom.error};}}return{ok:true,id:data.id};}
export async function updateScheduleEvent(id:string,patch:Partial<ScheduleEvent>){const supabase=getSupabaseBrowserClient();if(!supabase){const before=demoStore.schedule.get(id);const data=demoStore.schedule.update(id,patch);if(before&&before.eventType==="class"&&(patch.status==="cancelled"||patch.status==="rescheduled"||patch.date&&patch.date!==before.date||patch.startTime&&patch.startTime!==before.startTime)){const type=patch.status==="cancelled"?"class_cancelled":"class_rescheduled";const title=patch.status==="cancelled"?"Class cancelled":"Class schedule updated";const studentIds=before.studentId?[before.studentId]:(before.cohortId?demoStore.enrollments.list().filter(e=>e.cohortId===before.cohortId).map(e=>e.studentId):[]);for(const studentId of studentIds){await emitNotification({recipientRole:"parent",studentId,trainerId:before.trainerId,type:type as any,priority:"action",title,message:`${before.title} has an important schedule update.`,href:"/parent"});await emitNotification({recipientRole:"student",studentId,trainerId:before.trainerId,type:type as any,priority:"info",title,message:`${before.title} has an important schedule update.`,href:"/student"});}await emitNotification({recipientRole:"trainer",trainerId:before.trainerId,studentId:before.studentId,type:type as any,priority:"info",title,message:`${before.title} has an important schedule update.`,href:"/trainer/schedule"});}return{ok:true,data};} const db:any={};const map:any={title:"title",date:"date",startTime:"start_time",endTime:"end_time",timezone:"timezone",eventType:"event_type",deliveryMode:"delivery_mode",status:"status",actualDurationMinutes:"actual_duration_minutes",notes:"notes",rescheduledToId:"rescheduled_to_id",originalEventId:"original_event_id",occurrenceKind:"occurrence_kind",requestedBy:"requested_by",changeReason:"change_reason",sessionTopic:"session_topic",projectWorkedOn:"project_worked_on",skillsWorked:"skills_worked"};Object.entries(patch).forEach(([k,v])=>{if(map[k])db[map[k]]=v});const{data:beforeRow}=await supabase.from("schedule_events").select("*").eq("id",id).maybeSingle();const{error}=await supabase.from("schedule_events").update(db).eq("id",id);if(error)return{ok:false,error:error.message};const zoomRelevant=["date","startTime","endTime","timezone","status","title"].some(k=>Object.prototype.hasOwnProperty.call(patch,k));if(zoomRelevant&&patch.status!=="conducted"){const zoom=await syncZoomScheduleEvent(id);if(!zoom.ok){if(beforeRow){const rollback:any={};Object.keys(db).forEach(col=>rollback[col]=(beforeRow as any)[col]);await supabase.from("schedule_events").update(rollback).eq("id",id);await syncZoomScheduleEvent(id);}return{ok:false,error:"Schedule change was rolled back because Zoom capacity or provisioning failed: "+zoom.error};}}return{ok:true};}
export async function deleteScheduleEvent(id:string){
 const supabase=getSupabaseBrowserClient();
 if(!supabase){
  if(demoStore.attendance.list().some(a=>a.scheduleEventId===id)||demoStore.observations.list().some(o=>o.scheduleEventId===id))return{ok:false,error:"This class already has attendance or learning history. Cancel/reschedule it instead of deleting it."};
  demoStore.schedule.remove(id);return{ok:true};
 }
 const checks=await Promise.all([
  supabase.from("class_attendance").select("id",{head:true,count:"exact"}).eq("schedule_event_id",id),
  supabase.from("learning_observations").select("id",{head:true,count:"exact"}).eq("schedule_event_id",id)
 ]);
 if(checks.some(x=>(x.count??0)>0))return{ok:false,error:"This class already has attendance or learning history. Preserve it and use Cancelled/Rescheduled instead."};
 const zoomCleanup=await syncZoomScheduleEvent(id,"delete");if(!zoomCleanup.ok)return{ok:false,error:"Unable to remove the linked Zoom classroom: "+zoomCleanup.error};
 const{error}=await supabase.from("schedule_events").delete().eq("id",id);return error?{ok:false,error:error.message}:{ok:true};
}
export async function listClassAttendance(scheduleEventId?:string):Promise<ClassAttendanceRecord[]>{const supabase=getSupabaseBrowserClient();if(!supabase){const rows=demoStore.attendance.list();return scheduleEventId?rows.filter(x=>x.scheduleEventId===scheduleEventId):rows;}let q=supabase.from("class_attendance").select("*");if(scheduleEventId)q=q.eq("schedule_event_id",scheduleEventId);const{data}=await q;return(data??[]).map((r:any)=>({id:r.id,scheduleEventId:r.schedule_event_id,studentId:r.student_id,enrollmentId:r.enrollment_id,status:r.status,note:r.note??"",updatedAt:r.updated_at}));}
export async function saveClassAttendance(scheduleEventId:string,rows:Array<{studentId:string;enrollmentId:string;status:import("./types").AttendanceStatus;note?:string}>,markComplete=true){const supabase=getSupabaseBrowserClient();if(!supabase){for(const row of rows){const existing=demoStore.attendance.list().find(x=>x.scheduleEventId===scheduleEventId&&x.studentId===row.studentId);if(existing)demoStore.attendance.update(existing.id,row);else demoStore.attendance.create({id:makeId("att"),scheduleEventId,...row,updatedAt:new Date().toISOString()});if(row.status==="absent")await emitNotification({recipientRole:"parent",studentId:row.studentId,type:"attendance_absent",priority:"important",title:"Attendance update",message:"Your child was marked absent for a scheduled class. The session has not been counted as attended.",href:"/parent"});}if(markComplete){demoStore.schedule.update(scheduleEventId,{status:"conducted"});await syncTrainerEarningForEvent(scheduleEventId);}return{ok:true};}const payload=rows.map(r=>({schedule_event_id:scheduleEventId,student_id:r.studentId,enrollment_id:r.enrollmentId,status:r.status,note:r.note||null,updated_at:new Date().toISOString()}));const{error}=await supabase.from("class_attendance").upsert(payload,{onConflict:"schedule_event_id,student_id"});if(error)return{ok:false,error:error.message};if(markComplete){const{error:completeError}=await supabase.from("schedule_events").update({status:"conducted"}).eq("id",scheduleEventId);if(completeError)return{ok:false,error:completeError.message};const{error:payError}=await supabase.rpc("sync_trainer_earning",{p_event_id:scheduleEventId});if(payError)return{ok:false,error:`Attendance saved, but trainer payment sync needs review: ${payError.message}`};}return{ok:true};}

export async function cancelClassV2(eventId:string,requestedBy:"parent"|"student"|"trainer"|"admin",reason:string):Promise<{ok:true}|{ok:false;error:string}>{
 const supabase=getSupabaseBrowserClient();if(!supabase)return{ok:false,error:"Cancellation requires the database."};
 const {error}=await supabase.rpc("cancel_class_v2",{p_event_id:eventId,p_requested_by:requestedBy,p_reason:reason});
 return error?{ok:false,error:error.message}:{ok:true};
}
export async function rescheduleClassV2(eventId:string,date:string,startTime:string,endTime:string,requestedBy:"parent"|"student"|"trainer"|"admin",reason:string):Promise<{ok:true;id:string}|{ok:false;error:string}>{
 const supabase=getSupabaseBrowserClient();if(!supabase)return{ok:false,error:"Rescheduling requires the database."};
 const {data,error}=await supabase.rpc("reschedule_class_v2",{p_event_id:eventId,p_date:date,p_start:startTime,p_end:endTime,p_requested_by:requestedBy,p_reason:reason});
 return error?{ok:false,error:error.message}:{ok:true,id:String(data)};
}

export async function pauseEnrollmentV2(enrollmentId:string,from:string,resume:string,reason:"exams"|"medical"|"travel"|"family"|"other",note=""):Promise<{ok:true;moved:number;shiftDays:number}|{ok:false;error:string}>{
 const supabase=getSupabaseBrowserClient();
 if(!supabase)return{ok:false,error:"Pauses require the scheduling database."};
 const {data,error}=await supabase.rpc("pause_enrollment_v2",{p_enrollment_id:enrollmentId,p_from:from,p_resume:resume,p_reason:reason,p_note:note});
 return error?{ok:false,error:error.message}:{ok:true,moved:Number(data?.moved??0),shiftDays:Number(data?.shiftDays??0)};
}
export async function resumeEnrollmentV2(enrollmentId:string,note=""):Promise<{ok:true}|{ok:false;error:string}>{
 const supabase=getSupabaseBrowserClient();
 if(!supabase)return{ok:false,error:"Resume requires the scheduling database."};
 const {error}=await supabase.rpc("resume_enrollment_v2",{p_enrollment_id:enrollmentId,p_note:note});
 return error?{ok:false,error:error.message}:{ok:true};
}

export async function getClassReusableZoomLinkV2(eventId:string):Promise<string>{
 const supabase=getSupabaseBrowserClient();if(!supabase)return"";
 const {data,error}=await supabase.rpc("class_reusable_zoom_link_v2",{p_event_id:eventId});
 if(error)return"";
 return typeof data==="string"?data:"";
}

export async function reassignEnrollmentTrainerV2(enrollmentId:string,trainerId:string,reason:string):Promise<{ok:true;updated:number}|{ok:false;error:string}>{
 const supabase=getSupabaseBrowserClient();
 if(!supabase)return{ok:false,error:"Trainer reassignment requires the database."};
 const {data,error}=await supabase.rpc("reassign_enrollment_trainer_v2",{p_enrollment_id:enrollmentId,p_new_trainer_id:trainerId,p_reason:reason});
 return error?{ok:false,error:error.message}:{ok:true,updated:Number(data?.updated??0)};
}

export async function generateEnrollmentScheduleV2(enrollmentId:string,horizon:"full"|"weeks"|"manual"="full",weeks?:number):Promise<{ok:true;created:number;total:number}|{ok:false;error:string}>{
 if(horizon==="manual")return{ok:true,created:0,total:0};
 const supabase=getSupabaseBrowserClient();
 if(!supabase)return{ok:false,error:"Automatic class booking requires an installed database."};
 const {data,error}=await supabase.rpc("generate_enrollment_schedule_v2",{p_enrollment_id:enrollmentId,p_horizon:horizon,p_weeks:horizon==="weeks"?weeks:null});
 if(error)return{ok:false,error:error.message};
 return{ok:true,created:Number(data?.created??0),total:Number(data?.total??0)};
}

export async function activateOnboarding(id:string,assignment:{courseId:string;trainerId:string;enrollmentType:"one_to_one"|"small_group";cohortId?:string;startDate?:string;scheduleTimezone?:string;scheduleRules?:WeeklyScheduleSlot[];scheduleOverrideConfirmed?:boolean;scheduleOverrideNote?:string}){
  const submission=await getOnboardingSubmission(id);
  if(!submission)return{ok:false,error:"Onboarding submission not found."};
  if(submission.status==="active")return{ok:false,error:"This onboarding submission is already active."};
  if(!assignment.courseId||!assignment.trainerId||!assignment.startDate)return{ok:false,error:"Course, trainer and start date are required before activation."};
  if(!validNewEnrollmentDate(assignment.startDate))return{ok:false,error:"Enrollment start date cannot be earlier than today (IST)."};
  if(assignment.enrollmentType==="small_group"&&!assignment.cohortId)return{ok:false,error:"Choose a cohort for cohort enrollment."};

  // Resolve and validate the recurring schedule before creating the learner record.
  // This avoids creating an orphan learner when setup is still incomplete.
  let scheduleTimezone=assignment.scheduleTimezone||submission.timezone||IST_TIMEZONE;
  let scheduleRules=assignment.scheduleRules??[];
  if(assignment.enrollmentType==="small_group"&&assignment.cohortId){
    const cohort=(await listAdminCohorts()).find(c=>c.id===assignment.cohortId);
    if(!cohort)return{ok:false,error:"Selected cohort could not be found."};
    scheduleTimezone=cohort.scheduleTimezone;
    scheduleRules=cohort.scheduleRules;
  }
  if(!scheduleRules.length)return{ok:false,error:"Add at least one recurring class slot before activation."};

  const created=await createAdminStudent({fullName:submission.childName,dob:submission.childDob,grade:submission.grade,school:submission.school,city:submission.city,country:submission.country,state:submission.state??"",timezone:submission.timezone||IST_TIMEZONE,addressLine1:submission.addressLine1,addressLine2:submission.addressLine2,postalCode:submission.postalCode,billingName:submission.billingName,billingEmail:submission.billingEmail,billingPhone:submission.billingPhone,preferredClassDays:submission.preferredClassDays,preferredTimeWindows:submission.preferredTimeWindows,motherName:submission.motherName,motherMobile:submission.motherMobile,fatherName:submission.fatherName,fatherMobile:submission.fatherMobile,primaryGuardianName:submission.primaryGuardianName,primaryGuardianRelationship:submission.primaryGuardianRelationship,primaryGuardianMobile:submission.primaryGuardianMobile,secondaryGuardianName:submission.secondaryGuardianName,secondaryGuardianRelationship:submission.secondaryGuardianRelationship,secondaryGuardianMobile:submission.secondaryGuardianMobile,primaryContact:submission.primaryContact,primaryWhatsApp:submission.primaryWhatsApp,alternateWhatsApp:submission.alternateWhatsApp,parentLoginEmail:submission.loginEmail,interests:submission.interests,previousExperience:`Coding: ${submission.codingExperience}; Robotics: ${submission.roboticsExperience}`,source:submission.source,recordStatus:"active"});if(!created.ok)return created;
  const enrollment=await createAdminEnrollment({studentId:created.id!,courseId:assignment.courseId,trainerId:assignment.trainerId,enrollmentType:assignment.enrollmentType,cohortId:assignment.enrollmentType==="small_group"?assignment.cohortId:undefined,status:"active",startedAt:assignment.startDate,deliveryChannel:"online",centerLocation:"",scheduleMode:"recurring",scheduleTimezone,scheduleRules,scheduleOverrideConfirmed:assignment.scheduleOverrideConfirmed??false,scheduleOverrideNote:assignment.scheduleOverrideNote});if(!enrollment.ok){const supabase=getSupabaseBrowserClient();if(supabase&&created.id){await supabase.from("students").delete().eq("id",created.id);}return{ok:false,error:"Unable to activate learner. No enrollment was created. "+(enrollment.error??"Please review the delivery setup and try again.")};}
  const supabase=getSupabaseBrowserClient();if(supabase&&submission.userId){const{data:parent}=await supabase.from("parents").select("id").eq("profile_id",submission.userId).maybeSingle();if(parent)await supabase.from("parent_students").upsert({parent_id:parent.id,student_id:created.id,relationship_label:"Parent"},{onConflict:"parent_id,student_id"});}
  await updateOnboardingSubmission(id,{status:"active",assignedCourseId:assignment.courseId,assignedTrainerId:assignment.trainerId,enrollmentType:assignment.enrollmentType,cohortId:assignment.cohortId,startDate:assignment.startDate,draftScheduleTimezone:scheduleTimezone,draftScheduleRules:scheduleRules,activatedAt:new Date().toISOString()});
  // Activation and class booking are separate existing operations. Never claim the
  // student creation was rolled back if the atomic booking RPC fails.
  if(assignment.enrollmentType==="one_to_one"&&assignment.schedulingHorizon!=="manual"&&enrollment.id){
   const booking=await generateEnrollmentScheduleV2(enrollment.id,assignment.schedulingHorizon??"full",assignment.schedulingWeeks);
   if(!booking.ok)return{ok:true,studentId:created.id,enrollmentId:enrollment.id,schedulingWarning:"Learner activated, but future classes were NOT booked: "+booking.error};
   return{ok:true,studentId:created.id,enrollmentId:enrollment.id,classesCreated:booking.created};
  }
  return{ok:true,studentId:created.id,enrollmentId:enrollment.id};
}


// ---------------- Reminder policies ----------------
export async function listReminderPolicies():Promise<ReminderPolicy[]>{const supabase=getSupabaseBrowserClient();if(!supabase)return demoStore.reminderPolicies.list();const{data}=await supabase.from("reminder_policies").select("*").order("recipient_role");return(data??[]).map((r:any)=>({id:r.id,eventType:r.event_type,recipientRole:r.recipient_role,minutesBefore:r.minutes_before??undefined,minutesAfter:r.minutes_after??undefined,enabled:r.enabled}));}
export async function saveReminderPolicy(id:string,patch:Partial<ReminderPolicy>){const supabase=getSupabaseBrowserClient();if(!supabase){const row=demoStore.reminderPolicies.update(id,patch);return row?{ok:true,data:row}:{ok:false,error:"Reminder policy not found."};}const db:any={};if(patch.minutesBefore!==undefined)db.minutes_before=patch.minutesBefore;if(patch.minutesAfter!==undefined)db.minutes_after=patch.minutesAfter;if(patch.enabled!==undefined)db.enabled=patch.enabled;const{error}=await supabase.from("reminder_policies").update(db).eq("id",id);return error?{ok:false,error:error.message}:{ok:true};}

// ---------------- Progress Core ----------------
export async function listLearningObservations(filters?:{scheduleEventId?:string;enrollmentId?:string;studentId?:string}):Promise<LearningObservationRecord[]>{
  const supabase=getSupabaseBrowserClient();
  if(!supabase){let rows=demoStore.observations.list();if(filters?.scheduleEventId)rows=rows.filter(x=>x.scheduleEventId===filters.scheduleEventId);if(filters?.enrollmentId)rows=rows.filter(x=>x.enrollmentId===filters.enrollmentId);if(filters?.studentId)rows=rows.filter(x=>x.studentId===filters.studentId);return rows.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
  let q=supabase.from("learning_observations").select("*").order("created_at",{ascending:false});if(filters?.scheduleEventId)q=q.eq("schedule_event_id",filters.scheduleEventId);if(filters?.enrollmentId)q=q.eq("enrollment_id",filters.enrollmentId);if(filters?.studentId)q=q.eq("student_id",filters.studentId);const{data}=await q;
  let iq=supabase.from("learning_observation_internal_notes").select("schedule_event_id,student_id,note");if(filters?.scheduleEventId)iq=iq.eq("schedule_event_id",filters.scheduleEventId);if(filters?.enrollmentId)iq=iq.eq("enrollment_id",filters.enrollmentId);if(filters?.studentId)iq=iq.eq("student_id",filters.studentId);const{data:internalRows}=await iq;const internal=new Map((internalRows??[]).map((r:any)=>[`${r.schedule_event_id}:${r.student_id}`,r.note??""]));
  return(data??[]).map((r:any)=>({id:r.id,scheduleEventId:r.schedule_event_id,studentId:r.student_id,enrollmentId:r.enrollment_id,trainerId:r.trainer_id,signal:r.signal,strength:r.strength??"",nextFocus:r.next_focus??"",feedback:r.feedback??"",internalNote:internal.get(`${r.schedule_event_id}:${r.student_id}`)??"",createdAt:r.created_at,updatedAt:r.updated_at}));
}

export async function saveLearningObservations(scheduleEventId:string,trainerId:string,rows:Array<{studentId:string;enrollmentId:string;signal:import("./types").LearningStatus;strength?:string;nextFocus?:string;feedback?:string;internalNote?:string}>){
  const supabase=getSupabaseBrowserClient();
  if(!supabase){for(const row of rows){const existing=demoStore.observations.list().find(x=>x.scheduleEventId===scheduleEventId&&x.studentId===row.studentId);const patch={trainerId,signal:row.signal,strength:row.strength??"",nextFocus:row.nextFocus??"",feedback:row.feedback??"",internalNote:row.internalNote??"",updatedAt:new Date().toISOString()};if(existing)demoStore.observations.update(existing.id,patch);else demoStore.observations.create({id:makeId("obs"),scheduleEventId,studentId:row.studentId,enrollmentId:row.enrollmentId,createdAt:new Date().toISOString(),...patch});}return{ok:true};}
  const payload=rows.map(r=>({schedule_event_id:scheduleEventId,student_id:r.studentId,enrollment_id:r.enrollmentId,trainer_id:trainerId,signal:r.signal,strength:r.strength||"",next_focus:r.nextFocus||"",feedback:r.feedback||"",updated_at:new Date().toISOString()}));const{error}=await supabase.from("learning_observations").upsert(payload,{onConflict:"schedule_event_id,student_id"});if(error)return{ok:false,error:error.message};const internalPayload=rows.map(r=>({schedule_event_id:scheduleEventId,student_id:r.studentId,enrollment_id:r.enrollmentId,trainer_id:trainerId,note:r.internalNote||"",updated_at:new Date().toISOString()}));const{error:internalError}=await supabase.from("learning_observation_internal_notes").upsert(internalPayload,{onConflict:"schedule_event_id,student_id"});return internalError?{ok:false,error:internalError.message}:{ok:true};
}

export async function listTrainerFeedback(filters?:{studentId?:string;enrollmentId?:string}):Promise<TrainerFeedbackRecord[]>{
  const supabase=getSupabaseBrowserClient();if(!supabase){let rows=demoStore.feedback.list();if(filters?.studentId)rows=rows.filter(x=>x.studentId===filters.studentId);if(filters?.enrollmentId)rows=rows.filter(x=>x.enrollmentId===filters.enrollmentId);return rows.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
  let q=supabase.from("trainer_feedback").select("*").order("created_at",{ascending:false});if(filters?.studentId)q=q.eq("student_id",filters.studentId);if(filters?.enrollmentId)q=q.eq("enrollment_id",filters.enrollmentId);const{data}=await q;return(data??[]).map((r:any)=>({id:r.id,studentId:r.student_id,enrollmentId:r.enrollment_id,trainerId:r.trainer_id,type:r.feedback_type,title:r.title,summary:r.summary,strengths:r.strengths??"",nextFocus:r.next_focus??"",signal:r.signal,createdAt:r.created_at,updatedAt:r.updated_at}));
}
export async function createTrainerFeedback(input:Omit<TrainerFeedbackRecord,"id"|"createdAt"|"updatedAt">){const supabase=getSupabaseBrowserClient();const record:TrainerFeedbackRecord={...input,id:makeId("feedback"),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};if(!supabase){demoStore.feedback.create(record);await emitNotification({recipientRole:"parent",studentId:input.studentId,trainerId:input.trainerId,type:"feedback_posted",priority:"info",title:"New mentor feedback",message:input.title,href:`/parent/learner/${input.studentId}`});await emitNotification({recipientRole:"student",studentId:input.studentId,trainerId:input.trainerId,type:"feedback_posted",priority:"info",title:"New mentor feedback",message:input.title,href:"/student"});return{ok:true,id:record.id};}const{data,error}=await supabase.from("trainer_feedback").insert({student_id:input.studentId,enrollment_id:input.enrollmentId,trainer_id:input.trainerId,feedback_type:input.type,title:input.title,summary:input.summary,strengths:input.strengths,next_focus:input.nextFocus,signal:input.signal}).select("id").single();return error?{ok:false,error:error.message}:{ok:true,id:data.id};}
export async function updateTrainerFeedback(id:string,patch:Partial<TrainerFeedbackRecord>){const supabase=getSupabaseBrowserClient();if(!supabase)return{ok:true,data:demoStore.feedback.update(id,{...patch,updatedAt:new Date().toISOString()})};const db:any={};const map:any={type:"feedback_type",title:"title",summary:"summary",strengths:"strengths",nextFocus:"next_focus",signal:"signal"};Object.entries(patch).forEach(([k,v])=>{if(map[k])db[map[k]]=v});const{error}=await supabase.from("trainer_feedback").update({...db,updated_at:new Date().toISOString()}).eq("id",id);return error?{ok:false,error:error.message}:{ok:true};}

export async function listLearnerProjects(filters?:{studentId?:string;enrollmentId?:string;trainerId?:string}):Promise<LearnerProjectRecord[]>{
  const supabase=getSupabaseBrowserClient();if(!supabase){let rows=demoStore.projects.list();if(filters?.studentId)rows=rows.filter(x=>x.studentId===filters.studentId);if(filters?.enrollmentId)rows=rows.filter(x=>x.enrollmentId===filters.enrollmentId);if(filters?.trainerId){const enrs=demoStore.enrollments.list().filter(e=>e.trainerId===filters.trainerId).map(e=>e.id);rows=rows.filter(x=>enrs.includes(x.enrollmentId));}return rows.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
  let q=supabase.from("learner_projects").select("*").order("updated_at",{ascending:false});if(filters?.studentId)q=q.eq("student_id",filters.studentId);if(filters?.enrollmentId)q=q.eq("enrollment_id",filters.enrollmentId);if(filters?.trainerId){const{data:enrs}=await supabase.from("enrollments").select("id").eq("trainer_id",filters.trainerId);const ids=(enrs??[]).map((e:any)=>e.id);if(!ids.length)return[];q=q.in("enrollment_id",ids);}const{data}=await q;return(data??[]).map((r:any)=>({id:r.id,studentId:r.student_id,enrollmentId:r.enrollment_id,courseId:r.course_id,title:r.title,type:r.project_type,status:r.status,skills:r.skills??[],evidenceUrl:r.evidence_url??undefined,studentReflection:r.student_reflection??undefined,trainerFeedback:r.trainer_feedback??undefined,startedAt:r.started_at,submittedAt:r.submitted_at??undefined,reviewedAt:r.reviewed_at??undefined,completedAt:r.completed_at??undefined,updatedAt:r.updated_at}));
}
export async function createLearnerProject(input:Omit<LearnerProjectRecord,"id"|"updatedAt">){const supabase=getSupabaseBrowserClient();const record:LearnerProjectRecord={...input,id:makeId("project"),updatedAt:new Date().toISOString()};if(!supabase){demoStore.projects.create(record);return{ok:true,id:record.id};}const{data,error}=await supabase.from("learner_projects").insert({student_id:input.studentId,enrollment_id:input.enrollmentId,course_id:input.courseId,title:input.title,project_type:input.type,status:input.status,skills:input.skills,evidence_url:input.evidenceUrl||null,student_reflection:input.studentReflection||null,trainer_feedback:input.trainerFeedback||null,started_at:input.startedAt,submitted_at:input.submittedAt||null,reviewed_at:input.reviewedAt||null,completed_at:input.completedAt||null}).select("id").single();return error?{ok:false,error:error.message}:{ok:true,id:data.id};}
export async function updateLearnerProject(id:string,patch:Partial<LearnerProjectRecord>){const supabase=getSupabaseBrowserClient();if(!supabase){const before=demoStore.projects.get(id);const data=demoStore.projects.update(id,{...patch,updatedAt:new Date().toISOString()});if(before&&patch.status&&["reviewed","completed"].includes(patch.status)&&patch.status!==before.status){const enrollment=demoStore.enrollments.get(before.enrollmentId);await emitNotification({recipientRole:"parent",studentId:before.studentId,trainerId:enrollment?.trainerId,type:"project_reviewed",priority:"info",title:"Project reviewed",message:`${before.title} has a new mentor review.`,href:`/parent/learner/${before.studentId}`});await emitNotification({recipientRole:"student",studentId:before.studentId,trainerId:enrollment?.trainerId,type:"project_reviewed",priority:"info",title:"Project review complete",message:`${before.title} has a new mentor review.`,href:"/student/portfolio"});}return{ok:true,data};} const db:any={};const map:any={title:"title",type:"project_type",status:"status",skills:"skills",evidenceUrl:"evidence_url",studentReflection:"student_reflection",trainerFeedback:"trainer_feedback",startedAt:"started_at",submittedAt:"submitted_at",reviewedAt:"reviewed_at",completedAt:"completed_at"};Object.entries(patch).forEach(([k,v])=>{if(map[k])db[map[k]]=v===undefined?null:v});const{error}=await supabase.from("learner_projects").update({...db,updated_at:new Date().toISOString()}).eq("id",id);return error?{ok:false,error:error.message}:{ok:true};}
export async function deleteLearnerProject(id:string){const supabase=getSupabaseBrowserClient();if(!supabase){demoStore.projects.remove(id);return{ok:true};}const{error}=await supabase.from("learner_projects").delete().eq("id",id);return error?{ok:false,error:error.message}:{ok:true};}

export async function listEnrollmentHolds(enrollmentId?:string):Promise<EnrollmentHoldRecord[]>{const supabase=getSupabaseBrowserClient();if(!supabase){const rows=demoStore.holds.list();return (enrollmentId?rows.filter(x=>x.enrollmentId===enrollmentId):rows).sort((a,b)=>b.startDate.localeCompare(a.startDate));}let q=supabase.from("enrollment_holds").select("*").order("start_date",{ascending:false});if(enrollmentId)q=q.eq("enrollment_id",enrollmentId);const{data}=await q;return(data??[]).map((r:any)=>({id:r.id,enrollmentId:r.enrollment_id,studentId:r.student_id,reason:r.reason,startDate:r.start_date,endDate:r.end_date??undefined,status:r.status,note:r.note??undefined,createdAt:r.created_at,endedAt:r.ended_at??undefined}));}
export async function createEnrollmentHold(input:Omit<EnrollmentHoldRecord,"id"|"status"|"createdAt"|"endedAt">){const supabase=getSupabaseBrowserClient();const record:EnrollmentHoldRecord={...input,id:makeId("hold"),status:"active",createdAt:new Date().toISOString()};if(!supabase){demoStore.holds.create(record);demoStore.enrollments.update(input.enrollmentId,{status:"on_hold",holdReason:input.reason,holdFrom:input.startDate,holdUntil:input.endDate,holdNote:input.note});return{ok:true,id:record.id};}const{data,error}=await supabase.from("enrollment_holds").insert({enrollment_id:input.enrollmentId,student_id:input.studentId,reason:input.reason,start_date:input.startDate,end_date:input.endDate||null,note:input.note||null,status:"active"}).select("id").single();if(error)return{ok:false,error:error.message};await supabase.from("enrollments").update({status:"on_hold",hold_reason:input.reason,hold_from:input.startDate,hold_until:input.endDate||null,hold_note:input.note||null}).eq("id",input.enrollmentId);return{ok:true,id:data.id};}
export async function endEnrollmentHold(id:string,endDate?:string){const supabase=getSupabaseBrowserClient();const when=endDate??new Date().toISOString().slice(0,10);if(!supabase){const hold=demoStore.holds.get(id);if(!hold)return{ok:false,error:"Hold record not found."};demoStore.holds.update(id,{status:"ended",endDate:when,endedAt:new Date().toISOString()});demoStore.enrollments.update(hold.enrollmentId,{status:"active",holdReason:undefined,holdFrom:undefined,holdUntil:undefined,holdNote:undefined});return{ok:true};}const{data:hold}=await supabase.from("enrollment_holds").select("enrollment_id").eq("id",id).maybeSingle();if(!hold)return{ok:false,error:"Hold record not found."};const{error}=await supabase.from("enrollment_holds").update({status:"ended",end_date:when,ended_at:new Date().toISOString()}).eq("id",id);if(error)return{ok:false,error:error.message};await supabase.from("enrollments").update({status:"active",hold_reason:null,hold_from:null,hold_until:null,hold_note:null}).eq("id",hold.enrollment_id);return{ok:true};}

export async function listProgressAlertActions():Promise<ProgressAlertActionRecord[]>{const supabase=getSupabaseBrowserClient();if(!supabase)return demoStore.progressAlertActions.list();const{data}=await supabase.from("progress_alert_actions").select("*");return(data??[]).map((r:any)=>({id:r.id,ruleKey:r.rule_key,studentId:r.student_id,enrollmentId:r.enrollment_id,status:r.status,reviewedAt:r.reviewed_at??undefined,resolvedAt:r.resolved_at??undefined,note:r.note??undefined,updatedAt:r.updated_at}));}
export async function setProgressAlertState(input:{ruleKey:string;studentId:string;enrollmentId:string;status:ProgressAlertState;note?:string}){const supabase=getSupabaseBrowserClient();const now=new Date().toISOString();if(!supabase){const existing=demoStore.progressAlertActions.list().find(x=>x.ruleKey===input.ruleKey);const patch={...input,reviewedAt:input.status==="reviewed"?now:existing?.reviewedAt,resolvedAt:input.status==="resolved"?now:existing?.resolvedAt,updatedAt:now};if(existing)demoStore.progressAlertActions.update(existing.id,patch);else demoStore.progressAlertActions.create({id:makeId("alert-action"),...patch});return{ok:true};}const{error}=await supabase.from("progress_alert_actions").upsert({rule_key:input.ruleKey,student_id:input.studentId,enrollment_id:input.enrollmentId,status:input.status,note:input.note||null,reviewed_at:input.status==="reviewed"?now:null,resolved_at:input.status==="resolved"?now:null,updated_at:now},{onConflict:"rule_key"});return error?{ok:false,error:error.message}:{ok:true};}

async function progressData(){const [students,enrollments,courses,trainers,attendance,events,observations,feedback,projects,holds,actions]=await Promise.all([listAdminStudents(),listAdminEnrollments(),listAdminCourses(),listAdminTrainers(),listClassAttendance(),listScheduleEvents(),listLearningObservations(),listTrainerFeedback(),listLearnerProjects(),listEnrollmentHolds(),listProgressAlertActions()]);return{students,enrollments,courses,trainers,attendance,events,observations,feedback,projects,holds,actions};}
export async function listProgressAlerts(trainerId?:string):Promise<ProgressAlertRecord[]>{const d=await progressData();const alerts=buildProgressAlerts(d);return trainerId?alerts.filter(a=>d.enrollments.find(e=>e.id===a.enrollmentId)?.trainerId===trainerId):alerts;}
export async function listLearnerProgressRows(trainerId?:string):Promise<LearnerProgressRow[]>{const d=await progressData();const alerts=buildProgressAlerts(d);const rows=buildLearnerProgressRows({...d,alerts});return trainerId?rows.filter(r=>r.trainerId===trainerId):rows;}
export async function deleteLearningObservation(scheduleEventId:string,studentId:string){const supabase=getSupabaseBrowserClient();if(!supabase){const row=demoStore.observations.list().find(x=>x.scheduleEventId===scheduleEventId&&x.studentId===studentId);if(row)demoStore.observations.remove(row.id);return{ok:true};}await supabase.from("learning_observation_internal_notes").delete().eq("schedule_event_id",scheduleEventId).eq("student_id",studentId);const{error}=await supabase.from("learning_observations").delete().eq("schedule_event_id",scheduleEventId).eq("student_id",studentId);return error?{ok:false,error:error.message}:{ok:true};}

// ---------------- Experience Layer ----------------
async function loadLearnerExperienceOnce(studentId:string):Promise<import("./types").LearnerExperienceSnapshot|null>{
  const [rows,enrollments,courses,events,attendance,projects,feedback,observations,holds]=await Promise.all([
    listLearnerProgressRows(),listAdminEnrollments(),listAdminCourses(),listScheduleEvents(),listClassAttendance(),listLearnerProjects({studentId}),listTrainerFeedback({studentId}),listLearningObservations({studentId}),listEnrollmentHolds()
  ]);
  const candidateEnrollments=enrollments.filter(e=>e.studentId===studentId&&e.status!=="cancelled").sort((a,b)=>{const rank=(x:EnrollmentAdminRecord)=>x.status==="active"?0:x.status==="on_hold"?1:x.status==="completed"?2:3;return rank(a)-rank(b)||b.startedAt.localeCompare(a.startedAt)});const preferred=candidateEnrollments[0];const row=rows.find(r=>r.enrollmentId===preferred?.id)??rows.find(r=>r.studentId===studentId);if(!row)return null;
  const enrollment=enrollments.find(e=>e.id===row.enrollmentId);
  const experienceCourse=courses.find(c=>c.id===row.courseId);
  const experienceCourseTitle=experienceCourse?.publicName||experienceCourse?.title||experienceCourse?.shortTitle||row.courseTitle;
  const enrollmentEvents=events.filter(e=>e.eventType==="class"&&(e.enrollmentId===row.enrollmentId||Boolean(e.cohortId&&enrollment?.cohortId===e.cohortId)));
  const now=Date.now();const eventInstant=(e:ScheduleEvent)=>zonedLocalToUtc(e.date,e.startTime,e.timezone||IST_TIMEZONE).getTime();
  const nextClass=enrollmentEvents.filter(e=>eventInstant(e)>=now&&e.status==="scheduled").sort((a,b)=>eventInstant(a)-eventInstant(b))[0];
  const att=attendance.filter(a=>a.studentId===studentId&&a.enrollmentId===row.enrollmentId);
  const eventMap=new Map<string,ScheduleEvent>(events.map((e:ScheduleEvent)=>[e.id,e]));
  const recentClasses=att.map((a:ClassAttendanceRecord)=>{const e=eventMap.get(a.scheduleEventId);return e?{scheduleEventId:e.id,date:e.date,startTime:e.startTime,endTime:e.endTime,title:e.title,attendance:a.status,actualDurationMinutes:e.actualDurationMinutes,sessionTopic:e.sessionTopic,projectWorkedOn:e.projectWorkedOn,skillsWorked:e.skillsWorked??[]}:null}).filter(Boolean).sort((a:any,b:any)=>b.date.localeCompare(a.date)).slice(0,5) as import("./types").ExperienceRecentClass[];
  const xp=appMode==="demo"?(learners.find(l=>l.id===studentId)?.xp??0):await (async()=>{const supabase=getSupabaseBrowserClient();if(!supabase)return 0;const{data}=await supabase.from("xp_transactions").select("points").eq("student_id",studentId);return(data??[]).reduce((sum:number,x:any)=>sum+(x.points??0),0)})();
  const latestQuiz=appMode==="demo"?(learners.find(l=>l.id===studentId)?.latestQuiz??0):await (async()=>{const supabase=getSupabaseBrowserClient();if(!supabase)return 0;const{data}=await supabase.from("quiz_attempts").select("score_percent").eq("student_id",studentId).order("completed_at",{ascending:false}).limit(1).maybeSingle();return data?.score_percent??0})();
  const learner:LearnerSummary={id:row.studentId,name:row.studentName,grade:row.grade,course:experienceCourseTitle,courseSlug:row.courseId,trainer:row.trainerName,progress:row.progressPercent,sessionsCompleted:row.sessionsAttended,totalSessions:row.totalSessions,plannedHours:row.plannedHours,hoursCompleted:row.hoursCompleted,hoursRemaining:row.hoursRemaining,attendance:row.attendanceRate,latestQuiz,projectsCompleted:row.projectsCompleted,xp,status:row.currentSignal,nextFocus:feedback[0]?.nextFocus??observations.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0]?.nextFocus??"Continue the current learning path"};
  return {learner,enrollmentId:row.enrollmentId,enrollmentStatus:row.enrollmentStatus,enrollmentType:row.enrollmentType,courseId:row.courseId,courseTitle:experienceCourseTitle,trainerId:row.trainerId,trainerName:row.trainerName,nextClass,upcomingClassCount:enrollmentEvents.filter(e=>eventInstant(e)>=now&&e.status==="scheduled").length,recentClasses,projects:projects.filter(p=>p.enrollmentId===row.enrollmentId).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),feedback:feedback.filter(f=>f.enrollmentId===row.enrollmentId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),observations:observations.filter(o=>o.enrollmentId===row.enrollmentId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),activeHold:holds.find(h=>h.enrollmentId===row.enrollmentId&&h.status==="active"),attendanceRecorded:row.attendanceRecorded,absentCount:row.absentCount,excusedCount:row.excusedCount,plannedSessions:enrollment?.plannedSessions,paidSessionBalance:enrollment?.paidSessionBalance,plannedEndDate:enrollment?.plannedEndDate,scheduleTimezone:enrollment?.scheduleTimezone,cohortId:enrollment?.cohortId};
}

function learnerExperienceRetryDelay(attempt:number){
  return new Promise(resolve=>setTimeout(resolve,attempt===0?180:420));
}

export async function getLearnerExperience(studentId:string):Promise<import("./types").LearnerExperienceSnapshot|null>{
  // A learner experience is assembled from several RLS-protected relations.
  // Immediately after a workflow write, one broad read can occasionally return an
  // incomplete snapshot. Retry only an unexpected empty result; successful reads
  // are returned immediately and normal page loads pay no retry cost.
  for(let attempt=0;attempt<3;attempt++){
    try{
      const snapshot=await loadLearnerExperienceOnce(studentId);
      if(snapshot)return snapshot;
    }catch{
      // Retry a transient/incomplete experience read. Do not expose DB details in UI logs.
    }
    if(attempt<2)await learnerExperienceRetryDelay(attempt);
  }
  return null;
}

export async function getParentLearnerExperience(studentId:string):Promise<import("./types").LearnerExperienceSnapshot|null>{
  if(appMode==="demo")return getLearnerExperience(studentId);
  const supabase=getSupabaseBrowserClient();
  if(!supabase)return null;

  const{data:{session},error:sessionError}=await supabase.auth.getSession();
  if(sessionError||!session?.user)return null;
  const user=session.user;

  const{data:parent,error:parentError}=await supabase
    .from("parents")
    .select("id")
    .eq("profile_id",user.id)
    .maybeSingle();
  if(parentError||!parent)return null;

  const{data:link,error:linkError}=await supabase
    .from("parent_students")
    .select("student_id")
    .eq("parent_id",parent.id)
    .eq("student_id",studentId)
    .maybeSingle();
  if(linkError||!link)return null;

  return getLearnerExperience(studentId);
}

export async function getStudentExperience():Promise<import("./types").LearnerExperienceSnapshot|null>{
  if(appMode==="demo")return getLearnerExperience(learners[0].id);
  const supabase=getSupabaseBrowserClient();if(!supabase)return null;const{data:{session},error:sessionError}=await supabase.auth.getSession();if(sessionError||!session?.user)return null;const user=session.user;const{data}=await supabase.from("students").select("id").eq("profile_id",user.id).maybeSingle();return data?.id?getLearnerExperience(data.id):null;
}

export async function getParentLearnerExperiences():Promise<import("./types").LearnerExperienceSnapshot[]>{
  if(appMode==="demo"){
    const ids=[learners[0]?.id,learners[1]?.id].filter(Boolean) as string[];
    const rows:import("./types").LearnerExperienceSnapshot[]=[];
    for(const id of ids){
      const snapshot=await getLearnerExperience(id);
      if(snapshot)rows.push(snapshot);
    }
    return rows;
  }

  const supabase=getSupabaseBrowserClient();
  if(!supabase)return[];

  const{data:{session},error:sessionError}=await supabase.auth.getSession();
  if(sessionError||!session?.user)return[];
  const user=session.user;

  const{data:parent,error:parentError}=await supabase
    .from("parents")
    .select("id")
    .eq("profile_id",user.id)
    .maybeSingle();
  if(parentError||!parent)return[];

  const{data:links,error:linksError}=await supabase
    .from("parent_students")
    .select("student_id")
    .eq("parent_id",parent.id);
  if(linksError||!links?.length)return[];

  // Load linked learners sequentially. This avoids several simultaneous copies of
  // the broad experience aggregation competing for the same browser Supabase client.
  const snapshots:import("./types").LearnerExperienceSnapshot[]=[];
  for(const link of links as Array<{student_id:string}>){
    const snapshot=await getLearnerExperience(link.student_id);
    if(snapshot)snapshots.push(snapshot);
  }
  return snapshots;
}


// ---------------- Trainer Payroll / Class Earnings ----------------
export async function getTrainerCompensationPlan(trainerId:string):Promise<TrainerCompensationPlan|null>{
 const supabase=getSupabaseBrowserClient();if(!supabase)return demoStore.trainerCompensationPlans.list().find(x=>x.trainerId===trainerId)??null;
 const{data}=await supabase.from("trainer_compensation_plans").select("*").eq("trainer_id",trainerId).order("effective_from",{ascending:false}).limit(1).maybeSingle();if(!data)return null;
 return{id:data.id,trainerId:data.trainer_id,timezone:data.timezone,dayStart:data.day_start,dayEnd:data.day_end,oneToOneDay:Number(data.one_to_one_day),oneToOneNight:Number(data.one_to_one_night),groupDay:Number(data.group_day),groupNight:Number(data.group_night),demoDay:Number(data.demo_day),demoNight:Number(data.demo_night),demoConversionDay:Number(data.demo_conversion_day),demoConversionNight:Number(data.demo_conversion_night),trainerNoShowPenaltyPercent:Number(data.trainer_no_show_penalty_percent??100),lateGraceMinutes:Number(data.late_grace_minutes??5),latePenaltyPercent:Number(data.late_penalty_percent??0),effectiveFrom:data.effective_from,notes:data.notes??"",updatedAt:data.updated_at};
}
export async function saveTrainerCompensationPlan(trainerId:string,input:Omit<TrainerCompensationPlan,"id"|"trainerId"|"updatedAt">){
 const now=new Date().toISOString(),supabase=getSupabaseBrowserClient();if(!supabase){const existing=demoStore.trainerCompensationPlans.list().find(x=>x.trainerId===trainerId);if(existing){demoStore.trainerCompensationPlans.update(existing.id,{...input,updatedAt:now});return{ok:true,id:existing.id};}const record={...input,id:makeId("payplan"),trainerId,updatedAt:now};demoStore.trainerCompensationPlans.create(record);return{ok:true,id:record.id};}
 const payload={trainer_id:trainerId,timezone:input.timezone,day_start:input.dayStart,day_end:input.dayEnd,one_to_one_day:input.oneToOneDay,one_to_one_night:input.oneToOneNight,group_day:input.groupDay,group_night:input.groupNight,demo_day:input.demoDay,demo_night:input.demoNight,demo_conversion_day:input.demoConversionDay,demo_conversion_night:input.demoConversionNight,trainer_no_show_penalty_percent:input.trainerNoShowPenaltyPercent,late_grace_minutes:input.lateGraceMinutes,late_penalty_percent:input.latePenaltyPercent,effective_from:input.effectiveFrom,notes:input.notes,updated_at:now};
 const{data,error}=await supabase.from("trainer_compensation_plans").upsert(payload,{onConflict:"trainer_id,effective_from"}).select("id").single();return error?{ok:false,error:error.message}:{ok:true,id:data.id};
}
function defaultPlan(trainerId:string):TrainerCompensationPlan{return{id:`default-${trainerId}`,trainerId,updatedAt:new Date().toISOString(),...DEFAULT_COMP_PLAN};}
export async function syncTrainerEarningForEvent(eventId:string,force=false){
 const supabase=getSupabaseBrowserClient();if(supabase){const{data,error}=await supabase.rpc("sync_trainer_earning",{p_event_id:eventId});return error?{ok:false,error:error.message}:{ok:true,data};}
 const event=demoStore.schedule.get(eventId);if(!event||!["class","demo"].includes(event.eventType))return{ok:true};
 if(["scheduled","tentative","rescheduled","blocked","missed","makeup"].includes(event.status)&&event.status!=="cancelled")return{ok:true};
 const existing=demoStore.trainerEarnings.list().find(x=>x.scheduleEventId===eventId);if(existing&&!force)return{ok:true,id:existing.id};if(existing&&["approved","paid"].includes(existing.status))return{ok:true,id:existing.id};
 const plan=demoStore.trainerCompensationPlans.list().filter(x=>x.trainerId===event.trainerId).sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom))[0]??defaultPlan(event.trainerId);
 const calc=calculateTrainerEarning({event,plan,attendance:demoStore.attendance.list(),enrollments:demoStore.enrollments.list(),existing});const now=new Date().toISOString();
 const patch={...calc,trainerId:event.trainerId,scheduleEventId:event.id,status:event.status==="cancelled"?"void" as const:(existing?.status??"pending" as const),notes:existing?.notes??"",createdAt:existing?.createdAt??now,updatedAt:now,paymentReference:existing?.paymentReference,approvedAt:existing?.approvedAt,paidAt:existing?.paidAt};
 if(existing){demoStore.trainerEarnings.update(existing.id,patch);return{ok:true,id:existing.id};}const record:TrainerEarningRecord={id:makeId("earning"),...patch};demoStore.trainerEarnings.create(record);return{ok:true,id:record.id};
}
async function ensureDemoEarnings(){if(getSupabaseBrowserClient())return;for(const event of demoStore.schedule.list().filter(e=>["conducted","cancelled"].includes(e.status)))await syncTrainerEarningForEvent(event.id);}
export async function listTrainerEarnings(filters?:{trainerId?:string;month?:string;status?:string}):Promise<TrainerEarningRecord[]>{
 const supabase=getSupabaseBrowserClient();if(!supabase){await ensureDemoEarnings();let rows=demoStore.trainerEarnings.list();if(filters?.trainerId)rows=rows.filter(x=>x.trainerId===filters.trainerId);if(filters?.month)rows=rows.filter(x=>x.earningDate.startsWith(filters.month!));if(filters?.status)rows=rows.filter(x=>x.status===filters.status);return [...rows].sort((a,b)=>b.earningDate.localeCompare(a.earningDate)||b.createdAt.localeCompare(a.createdAt));}
 let q=supabase.from("trainer_earnings").select("*").order("earning_date",{ascending:false});if(filters?.trainerId)q=q.eq("trainer_id",filters.trainerId);if(filters?.month)q=q.gte("earning_date",`${filters.month}-01`).lt("earning_date",nextMonthStart(filters.month));if(filters?.status)q=q.eq("status",filters.status);const{data}=await q;
 return(data??[]).map((r:any)=>({id:r.id,trainerId:r.trainer_id,scheduleEventId:r.schedule_event_id,earningDate:r.earning_date,sessionType:r.session_type,payBand:r.pay_band,durationMinutes:r.duration_minutes,learnerCount:r.learner_count,classOutcome:r.class_outcome,baseRate:Number(r.base_rate),durationFactor:Number(r.duration_factor),conversionBonus:Number(r.conversion_bonus),adjustment:Number(r.adjustment),totalAmount:Number(r.total_amount),conversionApplied:r.conversion_applied,status:r.status,adjustmentReason:r.adjustment_reason??undefined,notes:r.notes??undefined,approvedAt:r.approved_at??undefined,paidAt:r.paid_at??undefined,paymentReference:r.payment_reference??undefined,createdAt:r.created_at,updatedAt:r.updated_at}));
}
export async function updateTrainerEarning(id:string,patch:Partial<Pick<TrainerEarningRecord,"conversionApplied"|"adjustment"|"adjustmentReason"|"notes"|"status"|"paymentReference">>){
 const supabase=getSupabaseBrowserClient();if(!supabase){const row=demoStore.trainerEarnings.get(id);if(!row)return{ok:false,error:"Earning record not found."};if(row.status==="paid"&&patch.status!=="paid")return{ok:false,error:"Paid earnings are locked. Create an adjustment instead."};const event=demoStore.schedule.get(row.scheduleEventId);const plan=demoStore.trainerCompensationPlans.list().filter(x=>x.trainerId===row.trainerId).sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom))[0]??defaultPlan(row.trainerId);let next:any={...patch,updatedAt:new Date().toISOString()};if(event&&(patch.conversionApplied!==undefined||patch.adjustment!==undefined||patch.adjustmentReason!==undefined)){const calc=calculateTrainerEarning({event,plan,attendance:demoStore.attendance.list(),enrollments:demoStore.enrollments.list(),existing:row,conversionApplied:patch.conversionApplied,adjustment:patch.adjustment,adjustmentReason:patch.adjustmentReason});next={...next,...calc};}if(patch.status==="approved")next.approvedAt=new Date().toISOString();if(patch.status==="paid")next.paidAt=new Date().toISOString();demoStore.trainerEarnings.update(id,next);return{ok:true};}
 const db:any={updated_at:new Date().toISOString()};if(patch.conversionApplied!==undefined)db.conversion_applied=patch.conversionApplied;if(patch.adjustment!==undefined)db.adjustment=patch.adjustment;if(patch.adjustmentReason!==undefined)db.adjustment_reason=patch.adjustmentReason;if(patch.notes!==undefined)db.notes=patch.notes;if(patch.status!==undefined){db.status=patch.status;if(patch.status==="approved")db.approved_at=new Date().toISOString();if(patch.status==="paid")db.paid_at=new Date().toISOString();}if(patch.paymentReference!==undefined)db.payment_reference=patch.paymentReference;const{error}=await supabase.from("trainer_earnings").update(db).eq("id",id);if(error)return{ok:false,error:error.message};const row=(await listTrainerEarnings()).find(x=>x.id===id);if(row&&(patch.conversionApplied!==undefined||patch.adjustment!==undefined))await supabase.rpc("sync_trainer_earning",{p_event_id:row.scheduleEventId,p_force:true});return{ok:true};
}
export async function listTrainerPayouts(trainerId?:string):Promise<TrainerPayoutRecord[]>{const supabase=getSupabaseBrowserClient();if(!supabase){let rows=demoStore.trainerPayouts.list();if(trainerId)rows=rows.filter(x=>x.trainerId===trainerId);return [...rows].sort((a,b)=>b.periodMonth.localeCompare(a.periodMonth));}let q=supabase.from("trainer_payouts").select("*").order("period_month",{ascending:false});if(trainerId)q=q.eq("trainer_id",trainerId);const{data}=await q;return(data??[]).map((r:any)=>({id:r.id,trainerId:r.trainer_id,periodMonth:r.period_month,grossAmount:Number(r.gross_amount),adjustmentAmount:Number(r.adjustment_amount),payableAmount:Number(r.payable_amount),status:r.status,approvedAt:r.approved_at??undefined,paidAt:r.paid_at??undefined,paymentReference:r.payment_reference??undefined,notes:r.notes??undefined,updatedAt:r.updated_at}));}
export async function saveTrainerPayout(input:Omit<TrainerPayoutRecord,"id"|"updatedAt">){const supabase=getSupabaseBrowserClient(),now=new Date().toISOString();if(!supabase){const existing=demoStore.trainerPayouts.list().find(x=>x.trainerId===input.trainerId&&x.periodMonth===input.periodMonth);const record={...input,id:existing?.id??makeId("payout"),updatedAt:now};if(existing)demoStore.trainerPayouts.update(existing.id,record);else demoStore.trainerPayouts.create(record);if(input.status==="paid"){demoStore.trainerEarnings.list().filter(x=>x.trainerId===input.trainerId&&x.earningDate.startsWith(input.periodMonth)&&x.status!=="void").forEach(x=>demoStore.trainerEarnings.update(x.id,{status:"paid",paidAt:input.paidAt??now,paymentReference:input.paymentReference,updatedAt:now}));}return{ok:true,id:record.id};}const payload={trainer_id:input.trainerId,period_month:input.periodMonth,gross_amount:input.grossAmount,adjustment_amount:input.adjustmentAmount,payable_amount:input.payableAmount,status:input.status,approved_at:input.approvedAt??null,paid_at:input.paidAt??null,payment_reference:input.paymentReference??null,notes:input.notes??null,updated_at:now};const{data,error}=await supabase.from("trainer_payouts").upsert(payload,{onConflict:"trainer_id,period_month"}).select("id").single();if(error)return{ok:false,error:error.message};if(input.status==="paid"){await supabase.from("trainer_earnings").update({status:"paid",paid_at:input.paidAt??now,payment_reference:input.paymentReference??null,updated_at:now}).eq("trainer_id",input.trainerId).gte("earning_date",`${input.periodMonth}-01`).lt("earning_date",nextMonthStart(input.periodMonth)).neq("status","void");}return{ok:true,id:data.id};}

// ---------------- Corrections & Audit ----------------
export async function listCorrectionRequests(filters?:{entityType?:string;entityId?:string;status?:string}):Promise<CorrectionRequestRecord[]>{
 const supabase=getSupabaseBrowserClient();
 if(!supabase){let rows=demoStore.correctionRequests.list();if(filters?.entityType)rows=rows.filter(x=>x.entityType===filters.entityType);if(filters?.entityId)rows=rows.filter(x=>x.entityId===filters.entityId);if(filters?.status)rows=rows.filter(x=>x.status===filters.status);return[...rows].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
 let q=supabase.from("correction_requests").select("*").order("created_at",{ascending:false});if(filters?.entityType)q=q.eq("entity_type",filters.entityType);if(filters?.entityId)q=q.eq("entity_id",filters.entityId);if(filters?.status)q=q.eq("status",filters.status);const{data}=await q;
 return(data??[]).map((r:any)=>({id:r.id,requestedByProfileId:r.requested_by_profile_id??undefined,requestedByRole:r.requested_by_role,entityType:r.entity_type,entityId:r.entity_id,reason:r.reason,requestedChanges:r.requested_changes,status:r.status,adminNote:r.admin_note??undefined,createdAt:r.created_at,resolvedAt:r.resolved_at??undefined,resolvedByProfileId:r.resolved_by_profile_id??undefined}));
}
export async function createCorrectionRequest(input:{requestedByRole:UserRole;entityType:string;entityId:string;reason:string;requestedChanges:string}){
 const supabase=getSupabaseBrowserClient(),now=new Date().toISOString();if(!input.reason.trim()||!input.requestedChanges.trim())return{ok:false,error:"Add both a reason and the correction required."};
 if(!supabase){const record:CorrectionRequestRecord={...input,id:makeId("correction"),status:"open",createdAt:now};demoStore.correctionRequests.create(record);demoStore.auditLog.create({id:makeId("audit"),entityType:"correction_requests",entityId:record.id,action:"INSERT",afterData:record as unknown as Record<string,unknown>,createdAt:now});return{ok:true,id:record.id};}
 const{data,error}=await supabase.from("correction_requests").insert({requested_by_role:input.requestedByRole,entity_type:input.entityType,entity_id:input.entityId,reason:input.reason.trim(),requested_changes:input.requestedChanges.trim()}).select("id").single();return error?{ok:false,error:error.message}:{ok:true,id:data.id};
}
export async function resolveCorrectionRequest(id:string,status:"approved"|"rejected"|"completed",adminNote:string){
 const supabase=getSupabaseBrowserClient(),now=new Date().toISOString();if(!supabase){const before=demoStore.correctionRequests.get(id);if(!before)return{ok:false,error:"Correction request not found."};const next=demoStore.correctionRequests.update(id,{status,adminNote,resolvedAt:now});demoStore.auditLog.create({id:makeId("audit"),entityType:"correction_requests",entityId:id,action:"UPDATE",beforeData:before as unknown as Record<string,unknown>,afterData:next as unknown as Record<string,unknown>,createdAt:now});return{ok:true};}
 const{error}=await supabase.from("correction_requests").update({status,admin_note:adminNote||null,resolved_at:now}).eq("id",id);return error?{ok:false,error:error.message}:{ok:true};
}
export async function listPortalAuditLog(limit=100):Promise<PortalAuditRecord[]>{
 const supabase=getSupabaseBrowserClient();if(!supabase)return[...demoStore.auditLog.list()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,limit);
 const{data}=await supabase.from("portal_audit_log").select("*").order("created_at",{ascending:false}).limit(limit);return(data??[]).map((r:any)=>({id:String(r.id),actorProfileId:r.actor_profile_id??undefined,entityType:r.entity_type,entityId:r.entity_id,action:r.action,beforeData:r.before_data??undefined,afterData:r.after_data??undefined,createdAt:r.created_at}));
}


// ---------------- Role profile, community and trainer finance self-service ----------------
export async function getCurrentTrainerRecord():Promise<TrainerAdminRecord|null>{
 const supabase=getSupabaseBrowserClient();if(!supabase)return demoStore.trainers.list()[0]??null;
 const{data:{user}}=await supabase.auth.getUser();if(!user)return null;
 const{data}=await supabase.from("trainers").select("*").eq("profile_id",user.id).maybeSingle();if(!data)return null;
 const{data:links}=await supabase.from("trainer_courses").select("course_id").eq("trainer_id",data.id);
 return{id:data.id,fullName:data.full_name??"",mobile:data.mobile??"",email:data.email??"",city:data.city??"",country:data.country??"India",state:data.state??"",timezone:data.timezone??IST_TIMEZONE,designation:data.designation??"Trainer",joiningDate:data.joining_date??"",specialties:data.specialties??[],courseIds:(links??[]).map((x:any)=>x.course_id),recordStatus:data.record_status??"active",loginLinked:Boolean(data.profile_id),portalAccessStatus:data.profile_id?"portal_ready":"not_linked",updatedAt:data.updated_at};
}
export async function updateOwnTrainerProfile(input:{mobile:string;city:string;state?:string;country?:string;timezone?:string;specialties:string[]}){
 const supabase=getSupabaseBrowserClient();if(!supabase)return{ok:true};
 const{data,error}=await supabase.rpc("update_own_trainer_profile",{p_mobile:input.mobile,p_city:input.city,p_state:input.state??"",p_country:input.country??"India",p_timezone:input.timezone??IST_TIMEZONE,p_specialties:input.specialties});
 return error?{ok:false,error:error.message}:{ok:true,data};
}
export async function getTrainerFinanceRequest(trainerId?:string):Promise<TrainerFinanceChangeRequest|null>{
 const supabase=getSupabaseBrowserClient();if(!supabase)return null;
 let tid=trainerId;if(!tid){const t=await getCurrentTrainerRecord();tid=t?.id}if(!tid)return null;
 const{data}=await supabase.from("trainer_finance_change_requests").select("*").eq("trainer_id",tid).in("status",["pending","correction_requested"]).order("submitted_at",{ascending:false}).limit(1).maybeSingle();if(!data)return null;
 return{id:data.id,trainerId:data.trainer_id,accountHolderName:data.account_holder_name??"",bankName:data.bank_name??"",accountNumber:data.account_number??"",ifsc:data.ifsc??"",upiId:data.upi_id??"",pan:data.pan??"",preferredPayoutMethod:data.preferred_payout_method??"bank",status:data.status,trainerNote:data.trainer_note??"",adminNote:data.admin_note??"",submittedAt:data.submitted_at,reviewedAt:data.reviewed_at??undefined,reviewedBy:data.reviewed_by??undefined,effectivePayrollMonth:data.effective_payroll_month??undefined};
}
export async function getLatestApprovedTrainerPayoutCycle(trainerId?:string):Promise<{effectiveMonth:string;approvedAt:string}|null>{
 const supabase=getSupabaseBrowserClient();if(!supabase)return null;
 let id=trainerId;if(!id){const trainer=await getCurrentTrainerRecord();id=trainer?.id;}if(!id)return null;
 const {data,error}=await supabase.from("trainer_finance_change_requests")
  .select("effective_payroll_month,reviewed_at").eq("trainer_id",id)
  .eq("status","approved").order("reviewed_at",{ascending:false}).limit(1).maybeSingle();
 if(error||!data)return null;
 return{effectiveMonth:data.effective_payroll_month||"",approvedAt:data.reviewed_at||""};
}
export async function submitTrainerFinanceRequest(input:{accountHolderName:string;bankName:string;accountNumber:string;ifsc:string;upiId:string;pan:string;preferredPayoutMethod:"bank"|"upi"|"other";trainerNote:string}){
 const supabase=getSupabaseBrowserClient();if(!supabase)return{ok:true};const t=await getCurrentTrainerRecord();if(!t)return{ok:false,error:"Trainer profile not linked."};
 const{data,error}=await supabase.from("trainer_finance_change_requests").insert({trainer_id:t.id,account_holder_name:input.accountHolderName,bank_name:input.bankName,account_number:input.accountNumber,ifsc:input.ifsc,upi_id:input.upiId,pan:input.pan,preferred_payout_method:input.preferredPayoutMethod,trainer_note:input.trainerNote,status:"pending"}).select("id").single();return error?{ok:false,error:error.message}:{ok:true,id:data.id};
}
export async function listTrainerFinanceRequests(trainerId:string):Promise<TrainerFinanceChangeRequest[]>{
 const supabase=getSupabaseBrowserClient();if(!supabase)return[];const{data}=await supabase.from("trainer_finance_change_requests").select("*").eq("trainer_id",trainerId).order("submitted_at",{ascending:false});return(data??[]).map((x:any)=>({id:x.id,trainerId:x.trainer_id,accountHolderName:x.account_holder_name??"",bankName:x.bank_name??"",accountNumber:x.account_number??"",ifsc:x.ifsc??"",upiId:x.upi_id??"",pan:x.pan??"",preferredPayoutMethod:x.preferred_payout_method??"bank",status:x.status,trainerNote:x.trainer_note??"",adminNote:x.admin_note??"",submittedAt:x.submitted_at,reviewedAt:x.reviewed_at??undefined,reviewedBy:x.reviewed_by??undefined,effectivePayrollMonth:x.effective_payroll_month??undefined}));
}
export async function reviewTrainerFinanceRequest(id:string,action:"approve"|"reject"|"request_correction",adminNote:string){
 const supabase=getSupabaseBrowserClient();if(!supabase)return{ok:true};const{data,error}=await supabase.rpc("review_trainer_finance_request",{p_request_id:id,p_action:action,p_admin_note:adminNote});return error?{ok:false,error:error.message}:{ok:true,data};
}
export async function getCurrentParentCommunityProfile():Promise<ParentCommunityProfile|null>{
 const supabase=getSupabaseBrowserClient();if(!supabase)return null;const{data:{user}}=await supabase.auth.getUser();if(!user)return null;const{data:p}=await supabase.from("parents").select("id").eq("profile_id",user.id).maybeSingle();if(!p)return null;const{data}=await supabase.from("parent_community_profiles").select("*").eq("parent_id",p.id).maybeSingle();
 if(!data)return{parentId:p.id,profession:"",organization:"",designation:"",linkedinUrl:"",instagramHandle:"",facebookUrl:"",expertise:[],contributionInterests:[],foundationInterests:[],ambassadorInterest:false,socialTagConsent:false,communityContactConsent:false};
 return{parentId:data.parent_id,profession:data.profession??"",organization:data.organization??"",designation:data.designation??"",linkedinUrl:data.linkedin_url??"",instagramHandle:data.instagram_handle??"",facebookUrl:data.facebook_url??"",expertise:data.expertise??[],contributionInterests:data.contribution_interests??[],foundationInterests:data.foundation_interests??[],ambassadorInterest:Boolean(data.ambassador_interest),socialTagConsent:Boolean(data.social_tag_consent),communityContactConsent:Boolean(data.community_contact_consent),updatedAt:data.updated_at};
}
export async function saveCurrentParentCommunityProfile(input:Omit<ParentCommunityProfile,"parentId"|"updatedAt">){
 const supabase=getSupabaseBrowserClient();if(!supabase)return{ok:true};const current=await getCurrentParentCommunityProfile();if(!current)return{ok:false,error:"Parent profile not linked."};const row={parent_id:current.parentId,profession:input.profession,organization:input.organization,designation:input.designation,linkedin_url:input.linkedinUrl,instagram_handle:input.instagramHandle,facebook_url:input.facebookUrl,expertise:input.expertise,contribution_interests:input.contributionInterests,foundation_interests:input.foundationInterests,ambassador_interest:input.ambassadorInterest,social_tag_consent:input.socialTagConsent,community_contact_consent:input.communityContactConsent,updated_at:new Date().toISOString()};const{error}=await supabase.from("parent_community_profiles").upsert(row,{onConflict:"parent_id"});return error?{ok:false,error:error.message}:{ok:true};
}
export async function createFamilyIntroduction(input:{introducedName:string;introducedContact:string;note:string}){
 const supabase=getSupabaseBrowserClient();if(!supabase)return{ok:true};const p=await getCurrentParentCommunityProfile();if(!p)return{ok:false,error:"Parent profile not linked."};const{error}=await supabase.from("family_introductions").insert({parent_id:p.parentId,introduced_name:input.introducedName,introduced_contact:input.introducedContact,note:input.note});return error?{ok:false,error:error.message}:{ok:true};
}
export async function listCurrentFamilyIntroductions():Promise<FamilyIntroductionRecord[]>{
 const supabase=getSupabaseBrowserClient();if(!supabase)return[];const p=await getCurrentParentCommunityProfile();if(!p)return[];const{data}=await supabase.from("family_introductions").select("*").eq("parent_id",p.parentId).order("created_at",{ascending:false});return(data??[]).map((x:any)=>({id:x.id,parentId:x.parent_id,introducedName:x.introduced_name,introducedContact:x.introduced_contact??"",note:x.note??"",status:x.status,convertedAt:x.converted_at??undefined,benefitStatus:x.benefit_status??"none",benefitValueInr:x.benefit_value_inr??undefined,createdAt:x.created_at,updatedAt:x.updated_at}));
}
export async function listAdminParentCommunity(){const supabase=getSupabaseBrowserClient();if(!supabase)return[];const{data}=await supabase.from("parent_community_profiles").select("*,parent:parents(id,profile:profiles(full_name))").order("updated_at",{ascending:false});return data??[]}
export async function listAdminFamilyIntroductions(){const supabase=getSupabaseBrowserClient();if(!supabase)return[];const{data}=await supabase.from("family_introductions").select("*,parent:parents(id,profile:profiles(full_name))").order("created_at",{ascending:false});return data??[]}
export async function updateFamilyIntroductionStatus(id:string,status:string){const supabase=getSupabaseBrowserClient();if(!supabase)return{ok:true};const patch:any={status,updated_at:new Date().toISOString()};if(status==="enrolled")patch.converted_at=new Date().toISOString();const{error}=await supabase.from("family_introductions").update(patch).eq("id",id);return error?{ok:false,error:error.message}:{ok:true}}
export async function updateMyAccount(input:{fullName:string;phone:string;timezone:string}){const supabase=getSupabaseBrowserClient();if(!supabase)return{ok:true};const{data:{user}}=await supabase.auth.getUser();if(!user)return{ok:false,error:"Not signed in."};const{error}=await supabase.from("profiles").update({full_name:input.fullName,phone:input.phone,timezone:input.timezone,updated_at:new Date().toISOString()}).eq("id",user.id);return error?{ok:false,error:error.message}:{ok:true}}
export async function getMyAccount(){const supabase=getSupabaseBrowserClient();if(!supabase)return null;const{data:{user}}=await supabase.auth.getUser();if(!user)return null;const{data}=await supabase.from("profiles").select("id,full_name,role,phone,timezone,active").eq("id",user.id).maybeSingle();return data?{id:data.id,fullName:data.full_name??"",role:data.role,phone:data.phone??"",timezone:data.timezone??IST_TIMEZONE,active:data.active,email:user.email??""}:null}
