"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {getParentLearnerExperiences} from "@/lib/repository";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {money,type FeePackage,type FeePayment} from "@/lib/student-finance";
import type {LearnerExperienceSnapshot} from "@/lib/types";

type Invoice={id:string;invoice_number:string;student_id:string|null;enrollment_id:string|null;status:string;currency:string;foreign_amount:number;amount_paid?:number|null;amount_due?:number|null;issue_date:string;due_date:string;service_title:string;razorpay_short_url?:string|null};
const modelName:Record<string,string>={session_package:"Per-class package",monthly:"Monthly",per_class:"Per delivered class",fixed_course:"Fixed course",open_ended:"Open-ended",custom:"Custom agreement"};
function asMoney(value:number,currency:string){try{return money(value,currency)}catch{return currency+" "+value.toFixed(2)}}
function billReceipt(payment:FeePayment,pkg:FeePackage,learner:string){
 const safe=(v:string)=>v.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
 const html='<html><head><title>Payment acknowledgement</title><style>body{font:15px Arial,sans-serif;max-width:720px;margin:45px auto;color:#17334e}h1{color:#006d96}table{width:100%;border-collapse:collapse}td{border-bottom:1px solid #dae7ee;padding:12px 0}small{color:#60758b}</style></head><body><h1>Robotronix™</h1><h2>Payment acknowledgement</h2><p>This document summarises a payment recorded in the Robotronix learning ledger. Request an official tax invoice or numbered receipt from the billing team if needed.</p><table>'+[
 ["Learner",learner],["Package",pkg.name],["Amount",asMoney(payment.amount,pkg.currency)],["Type",payment.kind==="refund"?"Refund":"Payment received"],["Method",payment.method],["Received on",payment.payment_date],["Transaction reference",payment.reference],["Receipt number",payment.receipt_number||"Not assigned"],["Collected by",payment.collector_name||"—"],["Collection location",payment.collection_location||"—"]
 ].map(([a,b])=>'<tr><td>'+safe(a)+'</td><td>'+safe(b)+'</td></tr>').join("")+'</table><p><small>Generated from recorded finance data. Verify discrepancies with Robotronix before relying on this acknowledgement.</small></p></body></html>';
 const win=window.open("","_blank","width=820,height=900");
 if(!win)return;
 win.document.write(html);win.document.close();win.focus();win.addEventListener("load",()=>win.print());
}

export default function ParentBilling(){
 const[learners,setLearners]=useState<LearnerExperienceSnapshot[]>([]);
 const[packages,setPackages]=useState<FeePackage[]>([]);
 const[payments,setPayments]=useState<FeePayment[]>([]);
 const[invoices,setInvoices]=useState<Invoice[]>([]);
 const[loading,setLoading]=useState(true),[error,setError]=useState("");
 const[selected,setSelected]=useState("");
 const[tab,setTab]=useState<"overview"|"payments"|"invoices">("overview");
 useEffect(()=>{let cancelled=false;(async()=>{
  try{
   const db=getSupabaseBrowserClient();if(!db)throw Error("Billing requires the connected database.");
   const children=await getParentLearnerExperiences();if(cancelled)return;
   setLearners(children);setSelected(current=>current||children[0]?.learner.id||"");
   const ids=[...new Set(children.map(child=>child.enrollmentId).filter(Boolean))];
   const studentIds=[...new Set(children.map(child=>child.learner.id))];
   if(!ids.length){setLoading(false);return;}
   // All reads are additionally protected by parent-scoped database RLS policies.
   const [feeRows,invoiceRows]=await Promise.all([
    db.from("student_fee_packages").select("*").in("enrollment_id",ids),
    db.from("student_invoices").select("id,invoice_number,student_id,enrollment_id,status,currency,foreign_amount,amount_paid,amount_due,issue_date,due_date,service_title,razorpay_short_url").in("student_id",studentIds).order("issue_date",{ascending:false})
   ]);
   if(feeRows.error)throw Error("Unable to load your fee packages: "+feeRows.error.message);
   if(invoiceRows.error)throw Error("Unable to load your invoices: "+invoiceRows.error.message);
   const rows=feeRows.data as FeePackage[];
   const paymentRows=rows.length?await db.from("student_fee_payments").select("*").in("package_id",rows.map(x=>x.id)).order("payment_date",{ascending:false}):{data:[],error:null};
   if(paymentRows.error)throw Error("Unable to load payment history: "+paymentRows.error.message);
   if(!cancelled){setPackages(rows);setPayments(paymentRows.data as FeePayment[]);setInvoices(invoiceRows.data as Invoice[])}
  }catch(e){if(!cancelled)setError(e instanceof Error?e.message:"Unable to load billing information")}
  finally{if(!cancelled)setLoading(false)}
 })();return()=>{cancelled=true}},[]);
 const active=learners.find(x=>x.learner.id===selected)||learners[0];
 const scoped=useMemo(()=>packages.filter(x=>x.enrollment_id===active?.enrollmentId).sort((a,b)=>b.start_date.localeCompare(a.start_date)),[packages,active]);
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const display=useMemo(()=>scoped.map(p=>{
  const ledger=payments.filter(x=>x.package_id===p.id&&x.payment_date<=today);
  const collected=Math.round(ledger.reduce((s,x)=>s+(x.kind==="refund"?-x.amount:x.amount),0)*100)/100;
  const due=(p.installments||[]).filter(x=>x.due<=today).reduce((s,x)=>s+x.amount,0);
  const nextDue=(p.installments||[]).filter(x=>x.due>today).sort((a,b)=>a.due.localeCompare(b.due))[0];
  return {p,ledger,collected,outstanding:Math.max(0,p.amount-collected),overdue:Math.max(0,due-collected),nextDue};
 }),[scoped,payments,today]);
 const scopedInvoices=invoices.filter(x=>x.student_id===active?.learner.id);
 const history=display.flatMap(x=>x.ledger.map(payment=>({...payment,package:x.p}))).sort((a,b)=>b.payment_date.localeCompare(a.payment_date));
 return <RoleGuard allow={["parent"]}><AppShell role="parent"><main className="parentBillingPage">
  <header className="parentBillingHeader"><div><span className="parentEyebrow">FAMILY BILLING</span><h1>Fees & Payments</h1><p>Clear payment history and billing arrangements for your child's learning.</p></div><Link href="/parent/messages" className="parentLinkButton">Billing support →</Link></header>
  {loading?<div className="panel" role="status">Loading family billing…</div>:error?<div className="errorBanner" role="alert">{error}</div>:!learners.length?<section className="panel"><h2>No active learner yet</h2><p>Billing details appear after the learner is activated.</p><Link href="/parent">Go to Family Dashboard →</Link></section>:<>
  <section className="parentBillingChildren" aria-label="Choose child">{learners.map(child=><button type="button" key={child.learner.id} className={child.learner.id===active?.learner.id?"selected":""} onClick={()=>setSelected(child.learner.id)}>{child.learner.name}</button>)}</section>
  <div className="parentBillingTabs" role="group" aria-label="Billing sections">{(["overview","payments","invoices"] as const).map(x=><button type="button" className={tab===x?"selected":""} key={x} onClick={()=>setTab(x)}>{x==="overview"?"Overview":x==="payments"?"Payments & acknowledgements":"Invoices"}</button>)}</div>
  {tab==="overview"&&<div className="parentBillingStack">{!display.length?<section className="panel"><h2>Billing arrangement not added yet</h2><p>Your learner is active, but no fee agreement has been recorded. Contact Robotronix for the correct fee status.</p></section>:display.map(({p,collected,outstanding,overdue,nextDue})=><section className="parentBillingPackage" key={p.id}>
   <div className="parentBillingPackageHeading"><div><span className="parentEyebrow">{modelName[p.billing_model||"session_package"]||"Custom agreement"}</span><h2>{p.name}</h2><p>{p.start_date} to {p.end_date} · {p.currency}</p></div><span className={"parentBillingStatus "+(outstanding===0?"paid":overdue>0?"overdue":"pending")}>{outstanding===0?"Paid":overdue>0?"Payment due":"Partially paid / pending"}</span></div>
   <div className="parentBillingKpis"><div><small>Agreed fee</small><strong>{asMoney(p.amount,p.currency)}</strong></div><div><small>Received (net)</small><strong>{asMoney(collected,p.currency)}</strong></div><div><small>Outstanding</small><strong>{asMoney(outstanding,p.currency)}</strong></div><div><small>{p.billing_model==="session_package"?"Included classes":"Billing arrangement"}</small><strong>{p.billing_model==="session_package"&&p.sessions?p.sessions+" classes":"Flexible"}</strong></div></div>
   <div className="parentBillingTrack"><span style={{width:Math.min(100,p.amount>0?collected/p.amount*100:0)+"%"}}/></div>
   <p className="parentBillingFoot">{overdue>0?`Payment due: ${asMoney(overdue,p.currency)}`:nextDue?`Next instalment: ${asMoney(nextDue.amount,p.currency)} on ${nextDue.due}`:outstanding===0?"Payment recorded in full.":"Please check your agreed payment schedule."} {p.billing_model==="session_package"?"Session delivery and payment entitlement are tracked separately.":"This arrangement does not assume a fixed number of classes."}</p>
  </section>)}</div>}
  {tab==="payments"&&<section className="parentBillingPackage"><h2>Recorded payments & refunds</h2>{history.length?history.map(row=><div className="parentBillingRecord" key={row.id}><div><b>{row.kind==="refund"?"Refund":"Payment"} · {asMoney(row.amount,row.package.currency)}</b><p>{row.payment_date} · {row.method} · {row.package.name}</p><small>Reference: {row.reference}{row.receipt_number?` · Receipt: ${row.receipt_number}`:""}</small></div><button type="button" className="parentLinkButton" onClick={()=>billReceipt(row,row.package,active?.learner.name||"Learner")}>Print acknowledgement</button></div>):<p>No payments have been recorded for this learner. A payment made recently may still require verification.</p>}</section>}
  {tab==="invoices"&&<section className="parentBillingPackage"><h2>Issued invoices</h2>{scopedInvoices.length?scopedInvoices.map(invoice=><div className="parentBillingRecord" key={invoice.id}><div><b>{invoice.invoice_number} · {invoice.service_title}</b><p>{invoice.issue_date} · {invoice.status.replaceAll("_"," ")} · {asMoney(Number(invoice.foreign_amount),invoice.currency)}</p><small>Due: {invoice.due_date}</small></div>{invoice.razorpay_short_url&&<a className="parentLinkButton" href={invoice.razorpay_short_url} target="_blank" rel="noopener noreferrer">View Razorpay invoice ↗</a>}</div>):<p>No issued invoices are available yet. Recorded payments can still be viewed under Payments.</p>}</section>}
  <p className="parentBillingDisclaimer">Amounts and class coverage reflect verified records entered in the Robotronix portal. If you paid via cash, UPI, bank transfer or Razorpay and do not see the transaction, please contact the billing team. An acknowledgement is not a tax invoice.</p>
  </>}
 </main></AppShell></RoleGuard>
}