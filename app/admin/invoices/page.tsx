"use client";
import {useEffect,useState} from "react";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {AdminPageHeader} from "@/components/admin/AdminPageHeader";
import {adminApi} from "@/lib/admin-api-client";
import {displayLabel} from "@/lib/display";

type Candidate={packageId:string;packageName:string;currency:string;amount:number;sessions:number;studentName:string;courseTitle:string;courseCode:string;customer:{name:string;email:string;phone:string;line1:string;line2:string;city:string;state:string;postal:string;country:string};addressComplete:boolean;international:boolean};
type Invoice={id:string;invoice_number:string;internal_reference:string;status:string;currency:string;amount:number;amount_due:number;customer_name:string;service_name:string;issue_date:string;due_date:string;razorpay_short_url?:string;razorpay_invoice_id?:string;exchange_rate_to_inr:number;invoice_value_inr:number;billing_country:string};
type Payload={ok:boolean;mode:string;invoices:Invoice[];candidates:Candidate[];error?:string};

function money(n:number,c:string){return new Intl.NumberFormat("en-IN",{style:"currency",currency:c}).format(n)}

export default function Invoices(){return <RoleGuard allow={["admin"]}><AppShell role="admin"><Workspace/></AppShell></RoleGuard>}
function Workspace(){
 const[data,setData]=useState<Payload|null>(null),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 async function reload(){setError("");try{setData(await adminApi("/api/admin/invoices"))}catch(e){setError(e instanceof Error?e.message:String(e))}}
 useEffect(()=>{reload()},[]);
 async function act(body:any){setBusy(true);setError("");setNotice("");try{await adminApi("/api/admin/invoices",{method:"POST",body:JSON.stringify(body)});setNotice("Invoice action completed successfully.");await reload();}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 const invoiceRows=data?.invoices||[];const outstanding=invoiceRows.filter(i=>["issued","partially_paid"].includes(i.status)).reduce((s,i)=>s+Number(i.amount_due||0),0);
 return <>
  <AdminPageHeader eyebrow="INTERNATIONAL RECEIVABLES" title="Razorpay Invoices" description="Review, issue and track international parent invoices. Create invoices from the learner/enrollment fee-package workflow; this page is the central ledger."/>
  {data&&<div className="infoBanner razorpayModeBanner"><b>Razorpay mode: {data.mode.toUpperCase()}</b><span>{data.mode==="test"?"Safe for integration testing. Switch to live keys only after Production sanity testing.":data.mode==="live"?"LIVE credentials are active. Invoice actions affect real customers.":"Razorpay credentials are not configured yet."}</span></div>}
  {error&&<div className="errorBanner">{error}</div>}{notice&&<div className="successBanner">{notice}</div>}
  <section className="dashboardKpis invoiceKpis"><div className="kpiCard"><b>{invoiceRows.length}</b><span>Total invoices</span><small>International invoice ledger</small></div><div className="kpiCard"><b>{data?.candidates.length||0}</b><span>Invoice required</span><small>Foreign-currency packages awaiting invoice</small></div><div className="kpiCard"><b>{invoiceRows.filter(i=>["issued","partially_paid"].includes(i.status)).length}</b><span>Outstanding</span><small>Issued or partly paid</small></div><div className="kpiCard"><b>{invoiceRows.filter(i=>i.status==="paid").length}</b><span>Paid</span><small>Payment status synced by webhook</small></div></section>

  <section className="infoBanner"><b>Where to create an invoice</b><span>Open the learner/enrollment fee package and use Create Invoice there. Student, enrollment, billing address, package and currency are carried automatically into the draft.</span></section>

  <section className="dataSection"><div className="panelHeader"><div><div className="eyebrow">INVOICE LEDGER</div><h2>International invoices</h2></div></div><div className="tableWrap professionalTable"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Service</th><th>Amount</th><th>FX / INR value</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead><tbody>{invoiceRows.length?invoiceRows.map(i=><tr key={i.id}><td><b>{i.invoice_number}</b><div className="cellSub">{i.internal_reference}</div></td><td><b>{i.customer_name}</b><div className="cellSub">{i.billing_country}</div></td><td>{i.service_name}</td><td><b>{money(Number(i.amount),i.currency)}</b></td><td><span>1 {i.currency} = {Number(i.exchange_rate_to_inr).toFixed(4)} INR</span><div className="cellSub">₹{Number(i.invoice_value_inr).toFixed(2)}</div></td><td>{i.due_date}</td><td><span className={`statusBadge status-${i.status}`}>{displayLabel(i.status)}</span></td><td><div className="row">{i.status==="draft"&&<button className="button smallButton" disabled={busy} onClick={()=>act({action:"issue",id:i.id})}>Issue</button>}{["issued","partially_paid"].includes(i.status)&&<button className="button secondary smallButton" disabled={busy} onClick={()=>act({action:"notify",id:i.id,medium:"email"})}>Send email</button>}{i.razorpay_short_url&&<a className="button ghost smallButton" href={i.razorpay_short_url} target="_blank" rel="noreferrer">Open</a>}{!["paid","cancelled","expired"].includes(i.status)&&<button className="button ghost smallButton" disabled={busy} onClick={()=>confirm(`Cancel ${i.invoice_number}? This preserves the record.`)&&act({action:"cancel",id:i.id})}>Cancel</button>}</div></td></tr>):<tr><td colSpan={8}><div className="emptyState compact">No international invoices created yet.</div></td></tr>}</tbody></table></div></section>
 </>;
}
