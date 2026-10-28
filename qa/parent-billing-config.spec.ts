import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {packageSummary,validatePackage,currencyUnits,type FeePackage,type FeePayment} from "../lib/student-finance";

const root=process.cwd();
const pkg=(changes:Partial<FeePackage>={}):FeePackage=>({
 id:"fee-test",enrollment_id:"en-test",name:"8-class package",scheme:"Per 8 Classes",
 currency:"INR",amount:4000,sessions:8,billing_model:"session_package",
 start_date:"2026-01-01",end_date:"2026-12-31",
 installments:[{due:"2026-01-01",amount:4000}],...changes
});
const pay=(amount:number,kind:"payment"|"refund"="payment"):FeePayment=>({
 id:String(Math.random()),package_id:"fee-test",amount,payment_date:"2026-02-02",
 method:"Cash",reference:"TEST",kind
});
const event=(id:string,date:string,status="conducted")=>({id,date,status}) as any;
const att=(id:string,status="attended")=>({scheduleEventId:id,enrollmentId:"en-test",status}) as any;
const asOf="2026-04-01";

test.describe("Parent billing and flexible fee contracts",()=>{
 test("8-class prepaid package tracks paid amount independently of delivered classes",()=>{
  const result=packageSummary(pkg(),[pay(2000)],[att("e1")],[event("e1","2026-02-01")],asOf);
  expect(result.collected).toBe(2000);
  expect(result.balance).toBe(2000);
  expect(result.completed).toBe(1);
  expect(result.remainingSessions).toBe(7);
 });
 test("open-ended agreement does not force a session limit",()=>{
  const agreement=pkg({scheme:"Open Ended",billing_model:"open_ended",sessions:null});
  expect(()=>validatePackage(agreement,[])).not.toThrow();
  const result=packageSummary(agreement,[pay(4000)],[att("e1")],[event("e1","2026-02-01")],asOf);
  expect(result.remainingSessions).toBeNull();
  expect(result.balance).toBe(0);
 });
 test("pay-per-class accumulates eligible delivered classes, not scheduled ones",()=>{
  const agreement=pkg({name:"Per-class",scheme:"Per Class",billing_model:"per_class",sessions:null,amount:750,installments:[]});
  expect(()=>validatePackage(agreement,[])).not.toThrow();
  const result=packageSummary(agreement,[],[att("e1"),att("e2")],
   [event("e1","2026-02-01"),event("e2","2026-02-08"),event("e3","2026-02-15","scheduled")],asOf);
  expect(result.billedAmount).toBe(1500);
  expect(result.balance).toBe(1500);
  expect(result.completed).toBe(2);
  expect(result.remainingSessions).toBeNull();
 });
 test("absences only count when configured, and refunds reduce collected balance",()=>{
  const events=[event("e1","2026-02-01")],attendance=[att("e1","absent")];
  expect(packageSummary(pkg(),[],attendance,events,asOf).completed).toBe(0);
  expect(packageSummary(pkg({charge_absences:true}),[],attendance,events,asOf).completed).toBe(1);
  expect(packageSummary(pkg(),[pay(2000),pay(500,"refund")],[],[],asOf).collected).toBe(1500);
 });
 test("three-decimal currencies retain payment precision and reject excess fractional digits",()=>{
  expect(currencyUnits("KWD")).toBe(1000);
  const agreement=pkg({currency:"KWD",amount:1.234,installments:[{due:"2026-01-01",amount:1.234}]});
  expect(()=>validatePackage(agreement,[])).not.toThrow();
  expect(()=>validatePackage({...agreement,amount:1.2345},[])).toThrow();
 });
 test("canonical schema enforces parent-linked reads and family payment allocations",()=>{
  const schema=readFileSync(resolve(root,"database/01_install/modules/schema/03_academic_delivery_finance.sql"),"utf8");
  const invoices=readFileSync(resolve(root,"database/01_install/modules/schema/04_billing_razorpay.sql"),"utf8");
  for(const marker of ["fees_parent_read","payments_parent_read","family_receipts_parent_read","record_family_payment_v1","Allocations must equal the received amount","billing_model","charge_absences"])
   expect(schema).toContain(marker);
  expect(invoices).toContain("invoices_parent_read");
  const parent=readFileSync(resolve(root,"app/parent/billing/page.tsx"),"utf8");
  expect(parent).toContain("getParentLearnerExperiences");
  expect(parent).toContain("packageSummary");
 });
});
