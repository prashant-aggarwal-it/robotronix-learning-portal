"use client";
import {useEffect,useMemo,useState} from "react";
import {readableSaveError} from "@/lib/form-errors";
import {GridSearch,GridReset} from "@/components/admin/GridFilterControls";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {AdminPageHeader} from "@/components/admin/AdminPageHeader";
import {adminApi} from "@/lib/admin-api-client";
import {displayLabel} from "@/lib/display";
import {exportWorkbook} from "@/lib/export-workbook";
import {useLiveRefresh} from "@/hooks/useLiveRefresh";

type Candidate={packageId:string;packageName:string;currency:string;amount:number;sessions:number;studentName:string;courseTitle:string;courseCode:string;customer:{name:string;email:string;phone:string;line1:string;line2:string;city:string;state:string;postal:string;country:string};addressComplete:boolean;international:boolean};
type Invoice={
 id:string;invoice_number:string;internal_reference:string;status:string;currency:string;amount:number;amount_due:number;amount_paid:number;
 customer_name:string;customer_email?:string;customer_phone?:string;service_name:string;issue_date:string;due_date:string;paid_at?:string|null;
 razorpay_short_url?:string;razorpay_invoice_id?:string;razorpay_payment_id?:string;razorpay_invoice_number?:string;
 exchange_rate_to_inr:number;invoice_value_inr:number;billing_country:string;last_synced_at?:string|null;sync_error?:string|null;
 last_notification_at?:string|null;last_notification_medium?:string|null;created_at?:string;
};
type Payload={ok:boolean;mode:string;invoices:Invoice[];candidates:Candidate[];error?:string};

function money(n:number,c:string){try{return new Intl.NumberFormat("en-IN",{style:"currency",currency:c}).format(Number(n||0))}catch{return c+" "+Number(n||0).toFixed(2)}}
function when(value?:string|null){return value?new Date(value).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}):"—";}
function isOverdue(i:Invoice){return ["issued","partially_paid"].includes(i.status)&&new Date(i.due_date+"T23:59:59").getTime()<Date.now();}
function statusTone(i:Invoice){if(i.sync_error)return"status-inactive";if(i.status==="paid")return"status-active";if(isOverdue(i))return"status-inactive";if(["issued","partially_paid","draft"].includes(i.status))return"status-pending";return"status-"+i.status}

export default function Invoices(){return <RoleGuard allow={["admin"]}><AppShell role="admin"><Workspace/></AppShell></RoleGuard>}

function Workspace(){
 const[data,setData]=useState<Payload|null>(null),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const[query,setQuery]=useState(""),[filter,setFilter]=useState<"all"|"needs_invoice"|"draft"|"outstanding"|"overdue"|"paid"|"attention">("all");
 const[selectedId,setSelectedId]=useState<string|null>(null);

 async function reload(){setError("");try{setData(await adminApi("/api/admin/invoices"))}catch(e){setError(readableSaveError(e))}}
 useEffect(()=>{void reload()},[]);
 useLiveRefresh(["student_invoices","student_fee_payments"],reload,"admin-invoices");
 async function act(body:any,success="Invoice action completed successfully."){
  if(busy)return;
  setBusy(true);setError("");setNotice("");
  try{const r=await adminApi("/api/admin/invoices",{method:"POST",body:JSON.stringify(body)});setNotice(r.reused?"An invoice already existed for this fee package, so Robotronix reused it.":success);await reload()}
  catch(e){setError(readableSaveError(e))}finally{setBusy(false)}
 }
 async function copy(value?:string|null){if(!value)return;try{await navigator.clipboard.writeText(value);setNotice("Payment link copied.");window.setTimeout(()=>setNotice(""),1800)}catch{setError("Unable to copy the payment link in this browser.")}}

 const invoiceRows=data?.invoices||[];
 const counts={
  draft:invoiceRows.filter(i=>i.status==="draft").length,
  outstanding:invoiceRows.filter(i=>["issued","partially_paid"].includes(i.status)).length,
  overdue:invoiceRows.filter(isOverdue).length,
  paid:invoiceRows.filter(i=>i.status==="paid").length,
  attention:invoiceRows.filter(i=>Boolean(i.sync_error)).length
 };
 const filtered=useMemo(()=>invoiceRows.filter(i=>{
  const q=query.trim().toLowerCase();
  const matches=!q||[i.invoice_number,i.internal_reference,i.customer_name,i.customer_email,i.service_name,i.razorpay_payment_id].some(v=>String(v||"").toLowerCase().includes(q));
  if(!matches)return false;
  if(filter==="all")return true;
  if(filter==="draft")return i.status==="draft";
  if(filter==="outstanding")return ["issued","partially_paid"].includes(i.status);
  if(filter==="overdue")return isOverdue(i);
  if(filter==="paid")return i.status==="paid";
  if(filter==="attention")return Boolean(i.sync_error);
  return true;
 }),[invoiceRows,query,filter]);
 const selected=invoiceRows.find(i=>i.id===selectedId)||null;
 async function exportInvoices(){await exportWorkbook(`Robotronix-Razorpay-Invoices-${filter}-${new Date().toISOString().slice(0,10)}.xlsx`,[{name:"Invoices",rows:filtered.map(i=>({
  "Invoice Number":i.invoice_number,"Internal Reference":i.internal_reference,"Customer":i.customer_name,"Email":i.customer_email||"","Phone":i.customer_phone||"",
  "Country":i.billing_country,"Service":i.service_name,"Currency":i.currency,"Invoice Amount":i.amount,"Amount Paid":i.amount_paid,"Amount Due":i.amount_due,
  "FX Rate to INR":i.exchange_rate_to_inr,"Invoice Value INR":i.invoice_value_inr,"Issue Date":i.issue_date,"Due Date":i.due_date,"Status":displayLabel(i.status),
  "Overdue":isOverdue(i)?"Yes":"No","Razorpay Invoice ID":i.razorpay_invoice_id||"","Razorpay Invoice Number":i.razorpay_invoice_number||"",
  "Razorpay Payment ID":i.razorpay_payment_id||"","Payment Link":i.razorpay_short_url||"","Paid At":i.paid_at||"","Last Synced At":i.last_synced_at||"",
  "Sync Error":i.sync_error||"","Last Notification At":i.last_notification_at||"","Notification Medium":i.last_notification_medium||""
 }))}])}

 return <>
  <AdminPageHeader eyebrow="INTERNATIONAL RECEIVABLES" title="Razorpay Billing" description="Create, issue, reconcile and track international parent invoices from one Robotronix billing workspace."/>
  {data&&<div className="infoBanner razorpayModeBanner"><b>Razorpay mode: {data.mode.toUpperCase()}</b><span>{data.mode==="test"?"Test credentials are active. Use SANITY/QA families for write tests.":data.mode==="live"?"LIVE credentials are active. Actions affect real customers.":"Razorpay credentials are not configured yet."}</span></div>}
  {error&&<div className="errorBanner" role="alert">{error}</div>}{notice&&<div className="successBanner" role="status">{notice}</div>}

  <section className="dashboardKpis invoiceKpis">
   <div className="kpiCard"><b>{data?.candidates.length||0}</b><span>Needs invoice</span><small>International packages awaiting invoice</small></div>
   <div className="kpiCard"><b>{counts.outstanding}</b><span>Outstanding</span><small>Issued or partly paid</small></div>
   <div className="kpiCard"><b>{counts.overdue}</b><span>Overdue</span><small>Past due with balance remaining</small></div>
   <div className="kpiCard"><b>{counts.paid}</b><span>Paid</span><small>Reconciled with Razorpay</small></div>
  </section>

  <section className="dataSection">
   <div className="panelHeader"><div><div className="eyebrow">BILLING CONTROL CENTRE</div><h2>International invoices</h2><p>Create invoices from the learner enrollment billing panel. Use this ledger to issue, send, sync and investigate payments.</p></div><div className="row"><button className="button ghost" disabled={busy||!filtered.length} onClick={exportInvoices}>Export Excel</button><button className="button secondary" disabled={busy} onClick={reload}>Refresh data</button></div></div>
   <div className="row" style={{gap:8,flexWrap:"wrap",marginBottom:12}}>
    <button className={filter==="all"?"button":"button secondary"} onClick={()=>setFilter("all")}>All · {invoiceRows.length}</button>
    <button className={filter==="draft"?"button":"button secondary"} onClick={()=>setFilter("draft")}>Draft · {counts.draft}</button>
    <button className={filter==="outstanding"?"button":"button secondary"} onClick={()=>setFilter("outstanding")}>Outstanding · {counts.outstanding}</button>
    <button className={filter==="overdue"?"button":"button secondary"} onClick={()=>setFilter("overdue")}>Overdue · {counts.overdue}</button>
    <button className={filter==="paid"?"button":"button secondary"} onClick={()=>setFilter("paid")}>Paid · {counts.paid}</button>
    <button className={filter==="attention"?"button":"button secondary"} onClick={()=>setFilter("attention")}>Needs attention · {counts.attention}</button>
   </div>
   <div className="dataToolbar" style={{marginBottom:14}}><GridSearch value={query} onChange={setQuery} placeholder="Search invoice, parent, email, service or payment ID"/><GridReset changed={Boolean(query||filter!=="all")} onReset={()=>{setQuery("");setFilter("all")}}/></div>

   <div className="tableWrap professionalTable"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Amount</th><th>Balance</th><th>Due</th><th>Status</th><th>Payment</th><th>Actions</th></tr></thead><tbody>
    {filtered.length?filtered.map(i=><tr key={i.id}>
     <td><b>{i.invoice_number}</b><div className="cellSub">{i.internal_reference}</div><div className="cellSub">{i.service_name}</div></td>
     <td><b>{i.customer_name}</b><div className="cellSub">{i.billing_country}{i.customer_email?" · "+i.customer_email:""}</div></td>
     <td><b>{money(i.amount,i.currency)}</b><div className="cellSub">₹{Number(i.invoice_value_inr||0).toFixed(2)} at {Number(i.exchange_rate_to_inr||0).toFixed(4)}</div></td>
     <td>{money(i.amount_due,i.currency)}<div className="cellSub">Paid {money(i.amount_paid,i.currency)}</div></td>
     <td>{i.due_date}{isOverdue(i)&&<div className="cellSub">Overdue</div>}</td>
     <td><span className={"statusBadge "+statusTone(i)}>{i.sync_error?"Needs attention":displayLabel(i.status)}</span>{i.last_synced_at&&<div className="cellSub">Synced {when(i.last_synced_at)}</div>}</td>
     <td>{i.razorpay_payment_id?<><b>{i.razorpay_payment_id}</b><div className="cellSub">{i.paid_at?"Paid "+when(i.paid_at):"Payment linked"}</div></>:<span className="cellSub">No payment yet</span>}</td>
     <td><div className="row" style={{gap:6,flexWrap:"wrap"}}>
      {i.status==="draft"&&<button className="button smallButton" disabled={busy} onClick={()=>act({action:"issue",id:i.id},"Invoice issued successfully.")}>Issue</button>}
      {["issued","partially_paid"].includes(i.status)&&<button className="button secondary smallButton" disabled={busy} onClick={()=>act({action:"notify",id:i.id,medium:"email"},"Invoice email sent.")}>Send Email</button>}
      <button className="button secondary smallButton" disabled={busy||!i.razorpay_invoice_id} onClick={()=>act({action:"sync",id:i.id},"Invoice synced with Razorpay.")}>Sync</button>
      {i.razorpay_short_url&&<button className="button ghost smallButton" onClick={()=>copy(i.razorpay_short_url)}>Copy Link</button>}
      {i.razorpay_short_url&&<a className="button ghost smallButton" href={i.razorpay_short_url} target="_blank" rel="noreferrer">Open</a>}
      <button className="button ghost smallButton" onClick={()=>setSelectedId(i.id)}>Details</button>
      {!["paid","cancelled","expired"].includes(i.status)&&<button className="button ghost smallButton" disabled={busy} onClick={()=>confirm("Cancel "+i.invoice_number+"? The financial record will be preserved.")&&act({action:"cancel",id:i.id},"Invoice cancelled.")}>Cancel</button>}
     </div></td>
    </tr>):<tr><td colSpan={8}><div className="emptyState compact">No invoices match this view.</div></td></tr>}
   </tbody></table></div>
  </section>

  {selected&&<section className="dataSection">
   <div className="panelHeader"><div><div className="eyebrow">INVOICE DETAIL</div><h2>{selected.invoice_number}</h2><p>{selected.customer_name} · {selected.service_name}</p></div><button className="button secondary" onClick={()=>setSelectedId(null)}>Close</button></div>
   {selected.sync_error&&<div className="errorBanner"><b>Reconciliation needs attention</b><div>{selected.sync_error}</div><button className="button smallButton topGap" disabled={busy} onClick={()=>act({action:"sync",id:selected.id},"Invoice reconciled with Razorpay.")}>Retry Sync</button></div>}
   <div className="invoicePreviewGrid">
    <div className="panel"><div className="eyebrow">PAYMENT</div><h3>{money(selected.amount,selected.currency)}</h3><p><b>Paid:</b> {money(selected.amount_paid,selected.currency)}<br/><b>Balance:</b> {money(selected.amount_due,selected.currency)}<br/><b>Status:</b> {displayLabel(selected.status)}<br/><b>Payment ID:</b> {selected.razorpay_payment_id||"—"}<br/><b>Paid at:</b> {when(selected.paid_at)}</p></div>
    <div className="panel"><div className="eyebrow">RAZORPAY</div><h3>{selected.razorpay_invoice_number||selected.razorpay_invoice_id||"Invoice"}</h3><p><b>Last sync:</b> {when(selected.last_synced_at)}<br/><b>Last email:</b> {when(selected.last_notification_at)}<br/><b>Notification:</b> {selected.last_notification_medium||"—"}<br/><b>Due:</b> {selected.due_date}</p>{selected.razorpay_short_url&&<div className="row"><button className="button secondary smallButton" onClick={()=>copy(selected.razorpay_short_url)}>Copy Payment Link</button><a className="button ghost smallButton" href={selected.razorpay_short_url} target="_blank" rel="noreferrer">Open Razorpay</a></div>}</div>
   </div>
  </section>}

  <section className="infoBanner"><b>Invoice creation</b><span>Open a learner enrollment and use its Fee package and invoice section. Student, package, billing address, course and currency are carried automatically into the Razorpay draft.</span></section>
 </>;
}
