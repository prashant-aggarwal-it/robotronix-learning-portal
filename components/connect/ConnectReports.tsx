"use client";
import {FormEvent,useCallback,useEffect,useRef,useState} from "react";
import {connectFetch,type ConnectOpportunity,type ConnectPipeline} from "@/lib/connect-client";
type Summary={opportunities:number;won:number;conversionRate:number|null;inquiries:number;expectedValue:number;currency:string;fromDate:string;toDate:string};
type Stage={pipelineId:string;pipeline:string;stageId:string;stage:string;sortOrder:number;outcome:string;opportunities:number};
type Staff={memberId:string;role:string;opportunities:number;won:number;open:number;lost:number;conversionRate:number|null;tasksCompleted:number};
type Source={source:string;inquiries:number;opportunities:number;won:number;conversionRate:number|null;spend:number|null;revenue:number|null;roiPercent:number|null};
type Campaign={id:string;name:string;source:string|null;spend:number|null;revenue:number|null;opportunities:number;won:number;costPerAcquisition:number|null;roiPercent:number|null};
type Report={summary:Summary;funnel:Stage[];staff:Staff[];sources:Source[];campaigns:Campaign[];definitions:Record<string,string>};
type Assignee={id:string;label:string;role:string};
function iso(d:Date){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return [y,m,day].join("-");}
function money(v:number|null|undefined,currency:string){if(v===null||v===undefined)return "Not recorded";return new Intl.NumberFormat("en-IN",{style:"currency",currency,maximumFractionDigits:0}).format(v);}
function pct(v:number|null|undefined){return v===null||v===undefined?"—":v.toFixed(1)+"%";}
const today=new Date(),prior=new Date(today.getFullYear(),today.getMonth(),today.getDate()-29);
export function ConnectReports({tenantId}:{tenantId:string}){
 const[from,setFrom]=useState(iso(prior)),[to,setTo]=useState(iso(today)),[pipelineId,setPipelineId]=useState("");
 const[report,setReport]=useState<Report|null>(null),[pipelines,setPipelines]=useState<ConnectPipeline[]>([]);
 const[assignees,setAssignees]=useState<Assignee[]>([]);
 const[opportunities,setOpportunities]=useState<ConnectOpportunity[]>([]);
 const[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const[form,setForm]=useState({campaignName:"",source:"facebook",campaignId:"",spend:"",revenue:"",opportunityId:"",date:iso(today),reference:""});
 const requestRef=useRef(0),tenantRef=useRef(tenantId);tenantRef.current=tenantId;
 const load=useCallback(async()=>{
  const id=++requestRef.current;
  setLoading(true);setError("");
  try{
   const q=new URLSearchParams({from,to});
   if(pipelineId)q.set("pipelineId",pipelineId);
   const [r,p,a,o]=await Promise.all([
    connectFetch<{report:Report}>(`/api/connect/workspaces/${tenantId}/reports?${q}`),
    connectFetch<{items:ConnectPipeline[]}>(`/api/connect/workspaces/${tenantId}/crm/pipelines?limit=100`),
    connectFetch<{assignees:Assignee[]}>(`/api/connect/workspaces/${tenantId}/assignees`),
    connectFetch<{items:ConnectOpportunity[]}>(`/api/connect/workspaces/${tenantId}/crm/opportunities?limit=100`)
   ]);
   if(requestRef.current===id){setReport(r.report);setPipelines(p.items||[]);setAssignees(a.assignees||[]);setOpportunities(o.items||[]);}
  }catch(e){if(requestRef.current===id)setError(e instanceof Error?e.message:"Reporting unavailable.");}
  finally{if(requestRef.current===id)setLoading(false);}
 },[tenantId,from,to,pipelineId]);
 useEffect(()=>{setReport(null);setPipelines([]);setAssignees([]);setOpportunities([]);setNotice("");void load();return ()=>{requestRef.current++;};},[load]);
 async function save(action:string,data:Record<string,unknown>){
  if(busy)return;const scope=tenantId;setBusy(true);setError("");setNotice("");
  try{
   await connectFetch(`/api/connect/workspaces/${scope}/reports`,{method:"POST",body:JSON.stringify({action,data})});
   if(tenantRef.current!==scope)return;
   setNotice("Reporting record saved.");await load();
  }catch(e){if(tenantRef.current===scope)setError(e instanceof Error?e.message:"Unable to save reporting record.");}
  finally{if(tenantRef.current===scope)setBusy(false);}
 }
 function createCampaign(e:FormEvent){e.preventDefault();void save("create_campaign",{name:form.campaignName,source:form.source});}
 function recordSpend(e:FormEvent){e.preventDefault();if(!form.campaignId)return;
  void save("record_spend",{campaignId:form.campaignId,date:form.date,amount:Number(form.spend),currency:report?.summary.currency});
 }
 function recordRevenue(e:FormEvent){e.preventDefault();if(!form.opportunityId)return;
  void save("record_revenue",{opportunityId:form.opportunityId,date:form.date,amount:Number(form.revenue),
   currency:report?.summary.currency,reference:form.reference||null});
 }
 function assignCampaign(e:FormEvent){e.preventDefault();if(!form.campaignId||!form.opportunityId)return;
  void save("attribute_campaign",{campaignId:form.campaignId,opportunityId:form.opportunityId});
 }
 const currency=report?.summary.currency||"INR";
 const availableRevenue=report?.sources.reduce((sum,s)=>sum+(s.revenue||0),0)||0;
 const availableSpend=report?.sources.reduce((sum,s)=>sum+(s.spend||0),0)||0;
 return <div className="cx-reports">
  <section className="cx-report-filters">
   <label>From<input aria-label="Report start date" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
   <label>To<input aria-label="Report end date" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
   <label>Pipeline<select value={pipelineId} onChange={e=>setPipelineId(e.target.value)}><option value="">All admissions pipelines</option>
    {pipelines.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   <button type="button" className="cx-secondary" onClick={()=>void load()}>Refresh reports</button>
  </section>
  {error&&<div className="cx-alert" role="alert">{error}</div>}
  {notice&&<div className="cx-success" role="status">{notice}</div>}
  {loading&&!report?<p className="cx-muted">Calculating admissions reports…</p>:report&&<>
   <div className="cx-metrics">
    {[
     {label:"Enquiries received",value:report.summary.inquiries,foot:"Messages/forms received in period"},
     {label:"Admissions opened",value:report.summary.opportunities,foot:"New opportunities in period"},
     {label:"Won admissions",value:report.summary.won,foot:"Currently won from that cohort"},
     {label:"Conversion rate",value:pct(report.summary.conversionRate),foot:"Won ÷ new opportunities"}
    ].map(item=><article className="cx-metric" key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.foot}</small></article>)}
   </div>
   <div className="cx-report-financials">
    <div><span>Expected opportunity value</span><strong>{money(report.summary.expectedValue,currency)}</strong><small>Not actual revenue</small></div>
    <div><span>Recorded receipts</span><strong>{money(availableRevenue,currency)}</strong><small>Cash entered for the selected dates</small></div>
    <div><span>Recorded campaign spend</span><strong>{pipelineId?"Not allocated":money(availableSpend,currency)}</strong><small>Only manually recorded spend</small></div>
   </div>
   <section className="cx-panel">
    <div className="cx-panel-header"><div><h2>Admissions stage distribution</h2><p>Current stages of admissions created during the selected dates. Not historical stage-entry conversion.</p></div></div>
    <div className="cx-report-bars">
     {report.funnel.length===0?<p className="cx-muted">Configure an admissions pipeline to see its stages.</p>:
      report.funnel.map(stage=>{
       const total=report.funnel.filter(x=>x.pipelineId===stage.pipelineId).reduce((sum,x)=>sum+x.opportunities,0);
       return <div className="cx-report-bar-row" key={stage.stageId}>
        <div><strong>{stage.stage}</strong><small>{stage.pipeline} · {stage.outcome}</small></div>
        <div className="cx-bar-track"><div style={{width:(total?100*stage.opportunities/total:0)+"%"}}/></div>
        <span>{stage.opportunities}</span>
       </div>;
      })}
    </div>
   </section>
   <section className="cx-panel">
    <div className="cx-panel-header"><div><h2>Counsellor performance</h2><p>Based on currently assigned opportunities; reassignment changes attribution.</p></div></div>
    <div className="cx-table-wrap"><table className="cx-table"><thead><tr><th>Team member</th><th>Opportunities</th><th>Won</th><th>Open</th><th>Conversion</th><th>Follow-ups completed</th></tr></thead>
     <tbody>{report.staff.map(member=><tr key={member.memberId}>
      <td><strong>{assignees.find(a=>a.id===member.memberId)?.label||member.role+" · "+member.memberId.slice(0,8)}</strong><span className="cx-cell-secondary">{member.role}</span></td>
      <td>{member.opportunities}</td><td>{member.won}</td><td>{member.open}</td><td>{pct(member.conversionRate)}</td><td>{member.tasksCompleted}</td>
     </tr>)}</tbody></table></div>
   </section>
   <section className="cx-panel">
    <div className="cx-panel-header"><div><h2>Lead-source performance</h2><p>First linked enquiry source per admission. Return on spend uses recorded receipts, not expected values.</p></div></div>
    <div className="cx-table-wrap"><table className="cx-table"><thead><tr><th>Source</th><th>Enquiries</th><th>Admissions</th><th>Won</th><th>Conversion</th><th>Spend</th><th>Revenue</th><th>ROI</th></tr></thead>
    <tbody>{report.sources.map(item=><tr key={item.source}><td><strong>{item.source}</strong></td><td>{item.inquiries}</td><td>{item.opportunities}</td><td>{item.won}</td>
      <td>{pct(item.conversionRate)}</td><td>{pipelineId?"—":money(item.spend,currency)}</td>
      <td>{money(item.revenue,currency)}</td><td>{pipelineId?"—":pct(item.roiPercent)}</td></tr>)}</tbody></table></div>
   </section>
   <section className="cx-panel">
    <div className="cx-panel-header"><div><h2>Campaign spend & ROI</h2><p>Campaign-level revenue requires manually linking the admission to a campaign. Missing spend means ROI is unavailable.</p></div></div>
    <div className="cx-table-wrap"><table className="cx-table"><thead><tr><th>Campaign</th><th>Source</th><th>Spend</th><th>Received</th><th>Admissions</th><th>Won</th><th>Cost / won</th><th>ROI</th></tr></thead>
      <tbody>{report.campaigns.map(c=><tr key={c.id}><td><strong>{c.name}</strong></td><td>{c.source||"Unspecified"}</td>
       <td>{pipelineId?"—":money(c.spend,currency)}</td><td>{money(c.revenue,currency)}</td><td>{c.opportunities}</td><td>{c.won}</td>
       <td>{pipelineId?"—":money(c.costPerAcquisition,currency)}</td><td>{pipelineId?"—":pct(c.roiPercent)}</td></tr>)}</tbody></table></div>
   </section>
   <section className="cx-panel">
    <div className="cx-panel-header"><div><h2>Record campaign costs and receipts</h2><p>Manual financial records — no assumption that a won admission has paid.</p></div></div>
    <div className="cx-report-forms">
     <form className="cx-form" onSubmit={createCampaign}><h3>New campaign</h3>
      <label>Campaign name<input required minLength={2} maxLength={150} value={form.campaignName} onChange={e=>setForm(v=>({...v,campaignName:e.target.value}))}/></label>
      <label>Lead source<input required value={form.source} maxLength={80} onChange={e=>setForm(v=>({...v,source:e.target.value}))}/></label>
      <button className="cx-secondary" disabled={busy}>Create campaign</button></form>
     <form className="cx-form" onSubmit={recordSpend}><h3>Record advertising spend</h3>
      <label>Campaign<select required value={form.campaignId} onChange={e=>setForm(v=>({...v,campaignId:e.target.value}))}>
       <option value="">Choose campaign</option>{report.campaigns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Amount ({currency})<input required type="number" min="0.01" step="0.01" value={form.spend} onChange={e=>setForm(v=>({...v,spend:e.target.value}))}/></label>
      <label>Date<input required type="date" value={form.date} onChange={e=>setForm(v=>({...v,date:e.target.value}))}/></label>
      <button className="cx-secondary" disabled={busy}>Record spend</button></form>
     <form className="cx-form" onSubmit={recordRevenue}><h3>Record received payment</h3>
      <label>Admission<select required value={form.opportunityId} onChange={e=>setForm(v=>({...v,opportunityId:e.target.value}))}><option value="">Choose admission (recent 100)</option>
       {opportunities.map(o=><option key={o.id} value={o.id}>{o.title}</option>)}</select></label>
      <label>Amount ({currency})<input required type="number" min="0.01" step="0.01" value={form.revenue} onChange={e=>setForm(v=>({...v,revenue:e.target.value}))}/></label>
      <label>Payment reference (unique)<input value={form.reference} maxLength={180} onChange={e=>setForm(v=>({...v,reference:e.target.value}))}/></label>
      <button className="cx-secondary" disabled={busy}>Record receipt</button></form>
     <form className="cx-form" onSubmit={assignCampaign}><h3>Link admission to campaign</h3>
      <label>Admission<select required value={form.opportunityId} onChange={e=>setForm(v=>({...v,opportunityId:e.target.value}))}><option value="">Choose admission (recent 100)</option>
       {opportunities.map(o=><option key={o.id} value={o.id}>{o.title}</option>)}</select></label>
      <label>Campaign<select required value={form.campaignId} onChange={e=>setForm(v=>({...v,campaignId:e.target.value}))}><option value="">Choose campaign</option>
       {report.campaigns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <button className="cx-secondary" disabled={busy}>Link campaign (single-touch)</button></form>
    </div>
   </section>
   <p className="cx-muted cx-report-footnote">{report.definitions.roi}. No marketing spend or payment data is inferred. Reconciliation with the Learning Portal is not yet automatic.</p>
  </>}
 </div>;
}
