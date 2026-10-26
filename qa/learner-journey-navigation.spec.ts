import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";
import {readCanonicalSql} from "../scripts/read-canonical-sql.mjs";

const source=(path:string)=>readFileSync(path,"utf8");

test.describe("Learner journey navigation contracts (offline)",()=>{
 test("onboarding returns newly created entity IDs and offers exact next-step links",()=>{
  const repository=source("lib/repository.ts");
  const onboarding=source("app/admin/onboarding/[id]/page.tsx");
  expect(repository).toContain("enrollmentId:enrollment.id");
  expect(repository).toContain("generateEnrollmentScheduleV2(enrollment.id");
  expect(onboarding).toContain("View enrollment");
  expect(onboarding).toContain("activationResult?.enrollmentId");
   expect(onboarding).toContain("activatedEnrollmentId");
  expect(onboarding).toContain("activationResult?.studentId");
   expect(onboarding).toContain("Student profile & corrections");
  expect(onboarding).toContain("result.schedulingWarning");
 });
 test("activated onboarding link fields exist in the canonical fresh schema",()=>{
  const repo=source("lib/repository.ts");
  const schema=readCanonicalSql();
  const onboarding=source("app/admin/onboarding/[id]/page.tsx");
  expect(repo).toContain("activatedStudentId:created.id,activatedEnrollmentId:enrollment.id");
  expect(onboarding).toContain('r?.status==="active"');
   expect(onboarding).toContain("activatedEnrollmentId");
   expect(onboarding).not.toContain("Open Students");
   expect(onboarding).not.toContain("Open Enrollments");
  for(const field of ["activated_student_id","activated_enrollment_id"]) {
    expect(schema).toContain(field);
  }
 });
 test("quick class wrap-up asks for trainer-confirmed evidence once and shows parent draft",()=>{
  const editor=source("components/operations/ClassRecordEditor.tsx");
  const cards=source("components/experience/ExperienceCards.tsx");
  expect(editor).toContain("QUICK CLASS WRAP-UP");
  expect(editor).toContain("confirmedOutcomes");
  expect(editor).toContain("sessionMeta.sessionTopic.trim()");
  expect(editor).toContain("parentUpdateDraft");
  expect(editor).toContain("Parent update preview");
  expect(editor).toContain("Internal trainer / admin note");
  expect(editor).toContain("Parent-visible progress note");
  expect(cards).toContain("observation.feedback");
 });
 test("learner progress distinguishes attendance from learning evidence across roles",()=>{
  const workspace=source("components/progress/LearnerProgressWorkspace.tsx");
  const cards=source("components/experience/ExperienceCards.tsx");
  const parent=source("app/parent/page.tsx");
  const learner=source("app/parent/learner/[studentId]/page.tsx");
  const student=source("app/student/page.tsx");
  expect(workspace).toContain("hasLearningEvidence");
  expect(workspace).toContain("attendedCount");
  expect(workspace).toContain("Not enough evidence");
  expect(workspace).toContain('role==="admin"&&<Link');
  expect(cards).toContain("learnerHasLearningEvidence(snapshot)");
  expect(parent).toContain("learnerHasLearningEvidence(selected)");
  expect(learner).toContain("learnerHasLearningEvidence(data)");
  expect(student).toContain("learnerHasLearningEvidence(data)");
 });
 test("learner lifecycle and portal linking use consistent role-specific presentation",()=>{
  const stage=source("lib/learner-lifecycle.ts");
  const studentProfile=source("app/admin/students/[id]/page.tsx");
  const parent=source("app/parent/page.tsx");
  const student=source("app/student/page.tsx");
  const trainer=source("app/trainer/page.tsx");
  const accessApi=source("app/api/admin/portal-access/route.ts");
  const accessUi=source("components/admin/PortalAccessPanel.tsx");
  expect(stage).toContain("enrollmentLearningLabel");
  expect(stage).toContain("familyLearningStage");
  expect(studentProfile).toContain("enrollmentLearningLabel(current,todayIstDate())");
  expect(parent).toContain("familyLearningStage(selected)");
  expect(student).toContain("familyLearningStage(data)");
  expect(trainer).toContain("zonedRangeParts(e.date");
  expect(accessApi).toContain('linked&&(type==="student"');
  expect(accessUi).toContain("Family account linked");
 });
 test("onboarding handoff is linked across Admin, Parent and Trainer",()=>{
  const onboarding=source("app/admin/onboarding/[id]/page.tsx");
  const student=source("app/admin/students/[id]/page.tsx");
  const enrollment=source("app/admin/enrollments/[id]/page.tsx");
  const parent=source("app/parent/page.tsx");
  const trainer=source("app/trainer/page.tsx");
  expect(onboarding).toContain("getAdminEnrollment(enrollmentId)");
  expect(onboarding).toContain("getAdminStudent(studentId)");
  expect(onboarding).toContain("linkedState?.enrollment!==false");
  expect(student).toContain("item.activatedStudentId===id");
  expect(enrollment).toContain("item.activatedEnrollmentId===id");
  expect(parent).toContain("awaiting activation");
  expect(trainer).toContain("after Admin activates their enrollment");
 });
 test("billing link scrolls after enrollment detail loads",()=>{
  const profile=source("app/admin/students/[id]/page.tsx");
  const enrollment=source("app/admin/enrollments/[id]/page.tsx");
  const invoice=source("components/finance/EnrollmentInvoicePanel.tsx");
  expect(profile).toContain("#billing-invoice");
  expect(invoice).toContain('id="billing-invoice"');
  expect(enrollment).toContain("window.location.hash");
  expect(enrollment).toContain("scrollIntoView");
  expect(enrollment).toContain('window.addEventListener("hashchange",focusLinkedSection)');
 });
 test("enrollment is class hub using existing idempotent generator",()=>{
  const enrollment=source("app/admin/enrollments/[id]/page.tsx");
  expect(enrollment).toContain("generateEnrollmentScheduleV2(record.id,\"full\")");
  expect(enrollment).toContain("allClassRecords");
  expect(enrollment).toContain("showAllClasses?visibleClassRecords:visibleClassRecords.slice(0,3)");
   expect(enrollment).toContain("Estimated not yet arranged");
   expect(enrollment).toContain("Class filters");
  expect(enrollment).toContain("Show fewer classes");
  expect(enrollment).toContain("nextClass.id");
  expect(enrollment).toContain("?enrollment=${encodeURIComponent(record.id)}");
 });
 test("each schedule calendar view opens consistent class details",()=>{
  const schedule=source("app/admin/schedule/page.tsx");
  expect((schedule.match(/onClick=\{\(\)=>setSelectedClass\(e\)\}/g)||[]).length).toBeGreaterThanOrEqual(4);
  expect(schedule).toContain("/admin/classes/");
  expect(schedule).not.toContain('href={`/classroom/${encodeURIComponent(selectedClass.id)}`}');
 });
 test("calendar dialog shows IST date and hides class action for non-class events",()=>{
  const schedule=source("app/admin/schedule/page.tsx");
  expect(schedule).toContain("selectedClass.eventType===\"class\"&&");
  expect(schedule).toContain("IST date:");
  expect(schedule).toContain('e.key==="Escape"');
  expect(schedule).toContain("classDialogRef.current?.focus()");
 });
 test("class editor is authoritative for Zoom, cancellation and enrollment return",()=>{
  const editor=source("components/operations/ClassRecordEditor.tsx");
  for(const action of ["ZoomClassActions","cancelClassV2","rescheduleClassV2","saveClassAttendance","Back to enrollment"])expect(editor).toContain(action);
 });
 test("classes accept a filtered enrollment history route",()=>{
  const classes=source("app/admin/classes/page.tsx");
  expect(classes).toContain('params.get("enrollment")');
  expect(classes).toContain('view==="all"');
  expect(classes).toContain("enrollmentFilter");
 });
 test("trainer week offers direct class access and is based on IST",()=>{
  const trainerSchedule=source("app/trainer/schedule/page.tsx");
  expect(trainerSchedule).toContain("/trainer/classes/");
  expect(trainerSchedule).toContain("timeZone:IST_TIMEZONE");
 });
 test("Zoom shows meeting pending or failures rather than empty controls",()=>{
  const zoom=source("components/ZoomClassActions.tsx");
  expect(zoom).toContain("Zoom setup scheduled");
  expect(zoom).toContain("The Zoom room is set up automatically closer to class time");
  expect(zoom).toContain("Review Zoom Classroom");
  expect(zoom).toContain("data.meeting?.lastError");
  expect(zoom).toContain("!data.available&&reusableLink&&data.canJoin");
  expect(zoom).toContain("data.withinJoinWindow");
  expect(zoom).not.toContain("if(reusableLink)return");
 });
 test("availability requires an authorized atomic transaction",()=>{
  const sql=readCanonicalSql();
  const repo=source("lib/repository.ts");
  expect(sql).toContain("function public.replace_trainer_availability_v1");
  expect(sql).toContain("pg_advisory_xact_lock");
  expect(sql).toContain("public.current_trainer_id()=p_trainer_id");
  expect(sql).toContain("Overlapping trainer availability slots");
  expect(repo).toContain('supabase.rpc("replace_trainer_availability_v1"');
  expect(repo).toContain("Trainer availability upgrade missing");
  expect(repo).not.toContain("Previous slots could NOT be restored automatically");
  expect(repo).toContain('notifyAdminOfOwnAvailability(trainerId,"weekly")');
 });
 test("recording playback offers secure stream refresh on media errors",()=>{
  const playback=source("app/admin/zoom/recording/[recordingId]/page.tsx");
  expect(playback).toContain("Refresh secure access");
  expect(playback).toContain("onError={()=>setPlaybackError");
  expect(playback).toContain("adminApi(\"/api/zoom/recordings/\"");
 });
 test("Zoom recording actions report results and refresh listing",()=>{
  const admin=source("app/admin/zoom/page.tsx");
  expect(admin).toContain("Recording moved to Zoom trash and removed from active list.");
  expect(admin).toContain("Recording protection updated.");
  expect(admin).toContain("Learner recording access updated.");
 });
 test("Zoom host overlap and remote meeting cleanup remain wired",()=>{
  const schema=readCanonicalSql();
  const classroom=source("lib/server/zoom-classroom.ts");
  expect(schema).toContain("zoom_host_active_meeting_no_overlap");
  expect(schema).toContain("exclude using gist");
  expect(classroom).toContain('error.code==="23P01"');
  expect(classroom).toContain("deleteRemoteMeetingSafely(host.id,String(created.id))");
 });
 test("Recording streaming remains permission-gated and avoids public URLs",()=>{
  const route=source("app/api/zoom/recordings/[recordingId]/route.ts");
  const stream=source("app/api/zoom/recordings/[recordingId]/stream/route.ts");
  expect(route).toContain("requirePortalUser");
  expect(route).toContain("createRecordingStreamToken");
  expect(stream).toContain("readRecordingStreamToken");
  expect(stream).toContain("classAccessForProfile");
  expect(stream).toContain("Cache-Control");
 });
 test("trainer today is calculated in IST rather than UTC",()=>{
  const trainer=source("app/trainer/classes/page.tsx");
  expect(trainer).toContain('timeZone:"Asia/Kolkata"');
  expect(trainer).not.toContain("const today=new Date().toISOString()");
 });
});


test("AI Flow is the default appearance, while a saved Classic preference is respected",()=>{
 const layout=source("app/layout.tsx");
 const switcher=source("components/ThemeSwitcher.tsx");
 expect(layout).toContain('data-portal-theme="ai-flow"');
 expect(switcher).toContain('useState<PortalTheme>("ai-flow")');
 expect(switcher).toContain('let saved:PortalTheme="ai-flow"');
 expect(switcher).toContain('if(isPortalTheme(value))saved=value');
 expect(switcher).toContain('window.localStorage.setItem(STORAGE_KEY,next)');
});

test("Admin and Trainer schedule expose availability and bookings with a shared legend",()=>{
 const admin=source("app/admin/schedule/page.tsx");
 const trainer=source("app/trainer/schedule/page.tsx");
 const css=source("app/schedule-unified.css");
 expect(admin).toContain('const[showTrainerAvailability,setShowTrainerAvailability]=useState(true)');
 expect(admin).toContain('scheduleDateNavigator');
 expect(admin).toContain('freeWindowsFor(t.id,date,rows)');
 expect(admin).toContain('className="blockedBand"');
 expect(admin).toContain("Remaining hours*");
 expect(trainer).toContain('trainer_availability_overrides');
 expect(trainer).toContain('scheduleStatusLegend');
 for(const marker of ['legendAvailable','legendBooked','legendBlocked','legendCompleted'])expect(css).toContain(marker);
});
test("Parent and Student calendar has upcoming classes and status differentiation",()=>{
 const component=source("components/calendar/LearnerCalendar.tsx");
 expect(component).toContain('upcoming class');
 expect(component).toContain('status-${e.status}');
 expect(component).toContain("learnerUpcomingSummary");
 expect(source("app/parent/calendar/page.tsx")).toContain('<LearnerCalendar');
 expect(source("app/student/calendar/page.tsx")).toContain('<LearnerCalendar');
});

test("Historical payouts never report invented changed-field counts; pending changes stand out",()=>{
 const review=source("components/finance/PayoutReview.tsx");
 const admin=source("app/admin/trainers/[id]/page.tsx");
 expect(review).toContain('useState<""|"approve"|"request_correction"|"reject">("")');
 expect(review).toContain("Current approved (not historical)");
 expect(review).toContain("change counts cannot be reconstructed reliably");
 expect(review).toContain("financeChangeBadge");
 expect(review).toContain("financeValueNew");
 expect(review).toContain("aria-pressed={showFull}");
 expect(admin).toContain("PAYOUT REVIEW HISTORY");
 expect(admin).toContain("PAYOUT CHANGES REQUIRING REVIEW");
});

test("Cross-role class navigation keeps the learner calendar and trainer history in context",()=>{
 const calendar=source("components/calendar/LearnerCalendar.tsx");
 const parent=source("app/parent/calendar/page.tsx");
 const student=source("app/student/calendar/page.tsx");
 const trainer=source("app/trainer/classes/page.tsx");
 const classEditor=source("components/operations/ClassRecordEditor.tsx");
 expect(parent).toContain('<LearnerCalendar events={scoped} role="parent"');
 expect(student).toContain('<LearnerCalendar events={scoped} role="student"');
 for(const marker of ["showAllUpcoming","showHistory","Class history","Show all ${upcoming.length} upcoming classes","setShowHistory(true);selectDate(e.date)"])expect(calendar).toContain(marker);
 expect(trainer).toContain("['all','All classes']");
 expect(trainer).toContain('view==="history"');
 expect(classEditor).toContain('role==="admin"?"/admin/classes":"/trainer/classes"');
});


test("Zoom scheduling repairs missing join URLs and performs bounded automatic retry",()=>{
 const zoom=source("lib/server/zoom-classroom.ts");
 const reconciliation=source("app/api/zoom/reconcile-classes/route.ts");
 const cron=source("app/api/zoom/auto-reconcile/route.ts");
 const job=source("netlify/functions/zoom-auto-reconcile.mts");
 const config=source("netlify.toml");
 const repository=source("lib/repository.ts");
 const classroom=source("app/api/zoom/classroom/[scheduleEventId]/route.ts");
 const enrollment=source("app/admin/enrollments/[id]/page.tsx");
 expect(zoom).toContain('action:"repaired" as const');
 expect(zoom).toContain("join_url:joinUrl");
 expect(zoom).toContain("Zoom did not return a valid meeting ID and join URL");
 expect(reconciliation).toContain(".range(page*200,page*200+199)");
 expect(reconciliation).toContain("eligibleCount");
 expect(reconciliation).toContain("batch.length<12");
 expect(reconciliation).toContain("linked.get(event.id)");
 expect(cron).toContain('["scheduled","makeup"]');
 expect(cron).toContain("x-robotronix-cron-secret");
 expect(cron).toContain(".slice(0,12)");
 expect(cron).toContain("35*60_000");
 expect(job).toContain("/api/zoom/auto-reconcile");
 expect(config).toContain('[functions."zoom-auto-reconcile"]');
 expect(repository).toContain('adminApi("/api/zoom/reconcile-classes"');
 expect(repository).toContain("zoomWarning");
 expect(classroom).toContain("meeting.join_url");
 expect(enrollment).toContain('"Zoom ready"');
});
