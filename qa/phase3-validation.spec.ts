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
 test("canonical fresh-install schema contains P0/P1 audit and onboarding triggers",()=>{
  const schema=source("database/01_install/01_CREATE_SCHEMA.sql");
  expect(schema).toContain("onboarding_submission_admin_notification_trg");
  for(const table of ["portal_access_requests","student_invoices","zoom_meetings","zoom_recordings"])expect(schema).toContain(table);
  expect(source("database/03_verify/01_VERIFY_RELEASE.sql")).toContain("CONSOLIDATED_AUDIT_COVERAGE_GATE");
 });
});
