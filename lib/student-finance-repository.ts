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
