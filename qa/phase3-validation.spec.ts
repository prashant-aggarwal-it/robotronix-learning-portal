import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {readableSaveError} from "../lib/form-errors";

const root=process.cwd();
function source(relative:string){return readFileSync(resolve(root,relative),"utf8")}

test.describe("Phase 3 form quality release contracts",()=>{
 test("shared error translation never exposes raw database or network details",()=>{
  for(const raw of [
   'invalid input syntax for type date: ""',
   'duplicate key value violates unique constraint "secret_index"',
   'permission denied for relation private_record',
   'no available host for meeting',
   'trainer availability conflict',
   'payroll period locked',
   'Failed to fetch'
  ]){
   const response=readableSaveError(new Error(raw));
   expect(response.length).toBeGreaterThan(20);
   expect(response).not.toBe(raw);
   expect(response).not.toContain("secret_index");
   expect(response).not.toContain("private_record");
  }
 });
 test("student, trainer and course forms render a clickable error summary",()=>{
  for(const file of ["components/admin/StudentForm.tsx","components/admin/TrainerForm.tsx","components/admin/CourseForm.tsx"]){
   const text=source(file);
   expect(text).toContain("<FormErrorSummary issues={formIssues}/>");
   expect(text).toContain("setFormIssues(issues)");
   expect(text).toContain("readableSaveError");
  }
 });
 test("enrollment and cohort create/edit flows report field validation",()=>{
  for(const file of ["app/admin/enrollments/page.tsx","app/admin/enrollments/[id]/page.tsx","app/admin/cohorts/[id]/page.tsx"]){
   const text=source(file);
   expect(text).toContain("<FormErrorSummary");
   expect(text).toContain("readableSaveError");
  }
 });
 test("classes, finance and integrations preserve safe error feedback",()=>{
  for(const file of ["app/admin/schedule/page.tsx","components/operations/ClassRecordEditor.tsx","app/admin/finance/page.tsx","app/admin/invoices/page.tsx","app/admin/demos/page.tsx","app/admin/zoom/page.tsx"]){
   expect(source(file)).toContain("readableSaveError");
  }
 });
 test("project and self-service forms use shared validation",()=>{
  for(const file of ["components/progress/ProjectReviewWorkspace.tsx","components/progress/LearnerProgressWorkspace.tsx","app/trainer/profile/page.tsx","app/parent/profile/page.tsx"]){
   const text=source(file);
   expect(text).toContain("FormErrorSummary");
   expect(text).toContain("readableSaveError");
  }
 });
 test("onboarding activation requirements are individually visible and navigable",()=>{
  const text=source("app/admin/onboarding/[id]/page.tsx");
  expect(text).toContain('label="School" required id="field-school"');
  expect(text).toContain('label="Date of birth" required');
  expect(text).toContain('label="Child name" required');
  expect(text).toContain('field:"school",message:"Enter the child');
  expect(text).toContain('["School",Boolean(r.school?.trim()),"school",true]');
  expect(text).toContain('["Family timezone",isValidTimeZone(r.timezone),"childProfile",true]');
  expect(text).toContain('Select any incomplete requirement to jump to the field');
  expect(text).toContain('disabled={busy} onClick={activate}');
 });
 test("manual student entry reflects migration-specific required fields",()=>{
  const text=source("components/admin/StudentForm.tsx");
  expect(text).toContain('existingActiveEntry&&!record?"School":"School *"');
  expect(text).toContain('existingActiveEntry&&!record?"Address Line 1":"Address Line 1 *"');
  expect(text).toContain('existingActiveEntry&&!record?"Postal / ZIP Code":"Postal / ZIP Code *"');
 });
 test("required indicators align with conditional finance, trainer and review validation",()=>{
  const finance=source("app/admin/finance/page.tsx");
  for(const label of ["Student / enrollment *","Package name *","Agreed fee after discount *","Included sessions *","Student package *","Payment date *","Unique reference / receipt number *"])expect(finance).toContain(label);
  const trainer=source("app/trainer/profile/page.tsx");
  expect(trainer).toContain('>Mobile *<input');
  expect(trainer).toContain('>Timezone *<input');
  expect(trainer).toContain('>IFSC {draft.preferredPayoutMethod==="bank"?"*":""}<input');
  expect(trainer).toContain('>UPI ID {draft.preferredPayoutMethod==="upi"?"*":""}<input');
  expect(source("app/admin/zoom/page.tsx")).toContain("Meeting title *<input");
  expect(source("app/parent/profile/page.tsx")).toContain('>Name *<input className="input" value={intro.introducedName}');
  expect(source("components/progress/ProjectReviewWorkspace.tsx")).toContain("required to review/complete");
 });
 test("canonical fresh-install schema contains P0/P1 audit and onboarding triggers",()=>{
  const schema=source("database/01_install/01_CREATE_SCHEMA.sql");
  expect(schema).toContain("onboarding_submission_admin_notification_trg");
  for(const table of ["portal_access_requests","student_invoices","zoom_meetings","zoom_recordings"])expect(schema).toContain(table);
  expect(source("database/03_verify/01_VERIFY_RELEASE.sql")).toContain("CONSOLIDATED_AUDIT_COVERAGE_GATE");
 });
});
