import {test,expect} from "@playwright/test";
import {readableSaveError,validateDraftDates} from "../lib/form-errors";

test.describe("Onboarding draft validation and safe messages",()=>{
 test("empty optional dates do not block saving a draft",()=>{
  expect(validateDraftDates({childDob:"",startDate:""}, "2026-10-25")).toEqual([]);
  expect(validateDraftDates({childDob:null,startDate:null},"2026-10-25")).toEqual([]);
 });
 test("invalid birth dates identify the correct field",()=>{
  expect(validateDraftDates({childDob:"2026-02-30"}, "2026-10-25")).toEqual([
   {field:"childDob",message:"Enter a valid date of birth or leave it blank for a draft."}
  ]);
 });
 test("past enrollment dates identify the correct field",()=>{
  expect(validateDraftDates({startDate:"2026-10-24"}, "2026-10-25")).toEqual([
   {field:"startDate",message:"Enrollment start date cannot be earlier than today (IST)."}
  ]);
 });
 test("database errors are translated without exposing SQL details",()=>{
  const raw='invalid input syntax for type date: ""';
  const message=readableSaveError(new Error(raw));
  expect(message).toContain("date");
  expect(message).not.toContain(raw);
  expect(readableSaveError(new Error('permission denied for table onboarding_submissions'))).toContain("permission");
  expect(readableSaveError(new Error('duplicate key value violates unique constraint'))).toContain("already exists");
  expect(readableSaveError(new Error('Failed to fetch'))).toContain("connection");
 });
});
