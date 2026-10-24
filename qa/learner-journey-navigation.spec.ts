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
  expect(onboarding).toContain("activationResult.enrollmentId");
  expect(onboarding).toContain("activationResult.studentId");
  expect(onboarding).toContain("booking needs attention");
 });
 test("enrollment is class hub using existing idempotent generator",()=>{
  const enrollment=source("app/admin/enrollments/[id]/page.tsx");
  expect(enrollment).toContain("generateEnrollmentScheduleV2(record.id,\"full\")");
  expect(enrollment).toContain("countedBookings");
  expect(enrollment).toContain("nextClass.id");
  expect(enrollment).toContain("/admin/classes?enrollment=");
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
 });
 test("class editor is authoritative for Zoom, cancellation and enrollment return",()=>{
  const editor=source("components/operations/ClassRecordEditor.tsx");
  for(const action of ["ZoomClassActions","cancelClassV2","rescheduleClassV2","saveClassAttendance","Open enrollment"])expect(editor).toContain(action);
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
  expect(zoom).toContain("Zoom meeting not ready yet");
  expect(zoom).toContain("data.meeting?.lastError");
 });
 test("availability save checks delete errors before reporting success",()=>{
  const repo=source("lib/repository.ts");
  expect(repo).toContain("if(deleteError)return{ok:false,error:");
  expect(repo).toContain("previousRows");
  expect(repo).toContain("Previous slots could NOT be restored automatically");
  expect(repo).toContain("notifyAdminOfOwnAvailability(trainerId,\"weekly\")");
 });
 test("trainer today is calculated in IST rather than UTC",()=>{
  const trainer=source("app/trainer/classes/page.tsx");
  expect(trainer).toContain('timeZone:"Asia/Kolkata"');
  expect(trainer).not.toContain("const today=new Date().toISOString()");
 });
});
