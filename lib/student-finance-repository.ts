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
