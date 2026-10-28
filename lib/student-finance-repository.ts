"use client";
import {getSupabaseBrowserClient} from "./supabase/browser";
import {FeePackage,FeePayment,validatePackage} from "./student-finance";
const key="robotronix-finance-v1.8";
type Ledger={packages:FeePackage[];payments:FeePayment[]};
export async function loadFeeLedger():Promise<Ledger>{
 const db=getSupabaseBrowserClient();if(!db)return JSON.parse(localStorage.getItem(key)||'{"packages":[],"payments":[]}');
 const [p,r]=await Promise.all([db.from("student_fee_packages").select("*"),db.from("student_fee_payments").select("*")]);
 if(p.error||r.error)throw Error(p.error?.message||r.error?.message);
 return {packages:p.data as FeePackage[],payments:r.data as FeePayment[]};
}
export async function addFeePackage(p:FeePackage){const ledger=await loadFeeLedger();validatePackage(p,ledger.packages);const db=getSupabaseBrowserClient();if(db){const {error}=await db.from("student_fee_packages").insert(p);if(error)throw Error(error.message);}else{ledger.packages.push(p);localStorage.setItem(key,JSON.stringify(ledger));}}
/**
 * An agreement may be revised only before any payment or invoice exists.
 * Subsequent terms must be represented as a new renewal/adjustment record.
 */
export async function reviseUnbilledFeePackage(p:FeePackage){
 const ledger=await loadFeeLedger();
 const original=ledger.packages.find(row=>row.id===p.id);
 if(!original)throw Error("Package could not be found.");
 if(ledger.payments.some(row=>row.package_id===p.id))throw Error("This package already has payments. Create a new renewal or documented adjustment instead of changing the original terms.");
 validatePackage(p,ledger.packages.filter(row=>row.id!==p.id));
 const db=getSupabaseBrowserClient();
 if(!db){
  ledger.packages=ledger.packages.map(row=>row.id===p.id?p:row);
  localStorage.setItem(key,JSON.stringify(ledger));return;
 }
 const {data:invoices,error:invError}=await db.from("student_invoices").select("id").eq("fee_package_id",p.id).limit(1);
 if(invError)throw Error(invError.message);
 if(invoices?.length)throw Error("An invoice already exists for this package. Amendments must be handled through a new documented transaction.");
 const {data,error}=await db.from("student_fee_packages").update({
  name:p.name,scheme:p.scheme,currency:p.currency,amount:p.amount,
  sessions:p.sessions,billing_model:p.billing_model??"session_package",charge_absences:Boolean(p.charge_absences),
  start_date:p.start_date,end_date:p.end_date,installments:p.installments,notes:p.notes||""
 }).eq("id",p.id).select("id").single();
 if(error||!data)throw Error(error?.message||"Unable to update the billing agreement.");
}

export async function addFeePayment(p:FeePayment){const ledger=await loadFeeLedger();const pkg=ledger.packages.find(x=>x.id===p.package_id);if(!pkg||!Number.isFinite(p.amount)||p.amount<=0||!p.payment_date||!p.reference.trim())throw Error("Select a package and enter a positive amount, date and unique reference.");
 if(ledger.payments.some(x=>x.package_id===p.package_id&&x.reference===p.reference))throw Error("That payment reference already exists for this package.");
 if(p.payment_date>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()))throw Error("Payment date cannot be in the future.");
 const net=ledger.payments.filter(x=>x.package_id===p.package_id).reduce((s,x)=>s+(x.kind==="refund"?-x.amount:x.amount),0);if(p.kind==="refund"&&p.amount>net+.001)throw Error("Refund exceeds net payments received.");
 const db=getSupabaseBrowserClient();if(db){const{error}=await db.from("student_fee_payments").insert(p);if(error)throw Error(error.message);}else{ledger.payments.push(p);localStorage.setItem(key,JSON.stringify(ledger));}}


export async function createOpeningFinanceSnapshot(input:{enrollmentId:string;packageName:string;scheme:string;currency:string;agreedFee:number;sessions:number;startDate:string;endDate:string;collectedBeforePortal:number;nextDueDate?:string;note?:string}){
 if(!input.enrollmentId||!input.packageName.trim())throw Error("Add the agreed package name.");
 if(!Number.isFinite(input.agreedFee)||input.agreedFee<=0)throw Error("Agreed fee must be greater than zero.");
 if(!Number.isInteger(input.sessions)||input.sessions<1)throw Error("Package sessions must be at least 1.");
 if(!input.startDate||!input.endDate||input.endDate<input.startDate)throw Error("Choose a valid package date range.");
 if(!Number.isFinite(input.collectedBeforePortal)||input.collectedBeforePortal<0||input.collectedBeforePortal>input.agreedFee)throw Error("Historical amount collected must be between zero and the agreed fee.");
 const packageId=crypto.randomUUID();
 const pkg:FeePackage={id:packageId,enrollment_id:input.enrollmentId,name:input.packageName.trim(),scheme:input.scheme||"Custom",currency:input.currency||"INR",amount:input.agreedFee,sessions:input.sessions,start_date:input.startDate,end_date:input.endDate,installments:[{due:input.nextDueDate||input.endDate,amount:input.agreedFee}],source:"migration",notes:input.note?.trim()||"Migrated opening commercial position"};
 await addFeePackage(pkg);
 if(input.collectedBeforePortal>0){
  const payment:FeePayment={id:crypto.randomUUID(),package_id:packageId,amount:input.collectedBeforePortal,payment_date:input.startDate,method:"Opening balance",reference:`MIGRATED-${packageId.slice(0,8).toUpperCase()}`,kind:"payment",source:"migration"};
  await addFeePayment(payment);
 }
 return{packageId};
}
