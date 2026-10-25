import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

const source=(path:string)=>readFileSync(path,"utf8");

test.describe("Learner journey navigation contracts (offline)",()=>{
 test("onboarding returns newly created entity IDs and offers exact next-step links",()=>{
  const repository=source("lib/repository.ts");
  const onboarding=source("app/admin/onboarding/[id]/page.tsx");
  expect(repository).toContain("enrollmentId:enrollment.id");
  expect(repository).toContain("generateEnrollmentScheduleV2(enrollment.id");
  expect(onboarding).toContain("Continue to enrollment");
  expect(onboarding).toContain("activationResult?.enrollmentId");
  expect(onboarding).toContain("activationResult?.studentId");
  expect(onboarding).toContain("booking needs attention");
 });
 test("activated onboarding persists links and existing Supabase needs additive migration",()=>{
  const repo=source("lib/repository.ts");
  const schema=source("database/01_install/01_CREATE_SCHEMA.sql");
  const migration=source("database/04_migrations/2026_10_24_PHASES_2_3_4_ADDITIVE.sql");
  const onboarding=source("app/admin/onboarding/[id]/page.tsx");
  expect(repo).toContain("activatedStudentId:created.id,activatedEnrollmentId:enrollment.id");
  expect(onboarding).toContain('r.status==="active"&&r.activatedStudentId&&r.activatedEnrollmentId');
  for(const field of ["activated_student_id","activated_enrollment_id"]) {
    expect(schema).toContain(field);
    expect(migration).toContain(field);
  }
 });
 test("enrollment is class hub using existing idempotent generator",()=>{
  const enrollment=source("app/admin/enrollments/[id]/page.tsx");
  expect(enrollment).toContain("generateEnrollmentScheduleV2(record.id,\"full\")");
  expect(enrollment).toContain("allClassRecords");
  expect(enrollment).toContain("showAllClasses?allClassRecords:futureBookings.slice(0,3)");
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
  expect(zoom).toContain("Zoom setup required");
  expect(zoom).toContain("reconcile missing meetings");
  expect(zoom).toContain("Open Zoom Classroom");
  expect(zoom).toContain("data.meeting?.lastError");
  expect(zoom).toContain("!data.available&&reusableLink&&data.canJoin");
  expect(zoom).toContain("data.withinJoinWindow");
  expect(zoom).not.toContain("if(reusableLink)return");
 });
 test("availability requires an authorized atomic transaction",()=>{
  const sql=source("database/01_install/01_CREATE_SCHEMA.sql");
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
  const schema=source("database/01_install/01_CREATE_SCHEMA.sql");
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
