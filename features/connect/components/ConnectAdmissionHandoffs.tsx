"use client";
import {useEffect,useState} from "react";
import {connectFetch,type ConnectOpportunity,type ConnectPerson} from "@/features/connect/api/client";

type Handoff={id:string;opportunity_id:string;learner_person_id:string;status:string;offer_snapshot:{fee:number;currency:string;sessions:number;terms:string};created_at:string;onboarding_submission_id:string|null;portal_enrollment_id:string|null;verified_at:string|null};
type Props={tenantId:string;opportunities:ConnectOpportunity[];people:ConnectPerson[];canWrite:boolean;canManage:boolean;onChanged:()=>void};
const label=(s:string)=>s.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());

export function ConnectAdmissionHandoffs({tenantId,opportunities,people,canWrite,canManage,onChanged}:Props){
 const [items,setItems]=useState<Handoff[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[invite,setInvite]=useState("");
 const [open,setOpen]=useState(false),[evidenceId,setEvidenceId]=useState(""),[evidenceNote,setEvidenceNote]=useState("");
 const [form,setForm]=useState({opportunityId:opportunities[0]?.id||"",learnerPersonId:opportunities[0]?.contact_id||"",fee:opportunities[0]?.expected_value||0,currency:opportunities[0]?.currency||"INR",sessions:8,terms:"Programme fee and sessions agreed with parent.",consentAttested:false});
 const api="/api/connect/workspaces/"+encodeURIComponent(tenantId)+"/admissions";
 async function reload(){const result=await connectFetch<{items:Handoff[]}>(api);setItems(result.items||[]);}
 useEffect(()=>{let active=true;void connectFetch<{items:Handoff[]}>(api).then(r=>{if(active)setItems(r.items||[]);}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Admissions unavailable.");});return()=>{active=false;};},[api]);
 async function submit(event:React.FormEvent){event.preventDefault();if(busy)return;setBusy(true);setError("");setInvite("");
  try{const response=await connectFetch<{id:string;status:string;inviteUrl:string|null}>(api,{method:"POST",body:JSON.stringify({action:"accept",requestId:crypto.randomUUID(),opportunityId:form.opportunityId,learnerPersonId:form.learnerPersonId,consentAttested:form.consentAttested,offer:{fee:form.fee,currency:form.currency,sessions:form.sessions,terms:form.terms}})});
   await reload();setInvite(response.inviteUrl||"");setNotice("Accepted offer recorded. Share the secure onboarding invitation with the parent.");setOpen(false);
  }catch(e){setError(e instanceof Error?e.message:"Could not prepare admission.");}finally{setBusy(false);}
 }
 async function action(kind:"reconcile"|"verify"|"revoke",handoffId:string){setBusy(true);setError("");setNotice("");
  try{const response=await connectFetch<{status:string}>(api,{method:"POST",body:JSON.stringify({action:kind,handoffId,evidenceNote})});
   await reload();onChanged();setEvidenceId("");setEvidenceNote("");setNotice(kind==="reconcile"?response.status==="enrollment_confirmed"?"Enrollment confirmed; CRM admission moved to Won.":"Parent onboarding is not active yet.":kind==="verify"?"Guardian identity reviewed. Await Portal activation.":"Invitation revoked.");
  }catch(e){setError(e instanceof Error?e.message:"Admission update failed.");}finally{setBusy(false);}
 }
 return <section className="cx-panel" aria-label="Admissions and onboarding handoffs" style={{marginBottom:18}}>
  <div className="cx-panel-header"><div><h2>Admission → Learning Portal</h2><p>Record an accepted offer, invite the family, and confirm enrolment only after Portal activation.</p></div>{canWrite&&<button className="cx-primary" type="button" onClick={()=>setOpen(v=>!v)}>{open?"Close":"＋ Prepare admission"}</button>}</div>
  {error&&<p role="alert" style={{color:"#b42318"}}>{error}</p>}{notice&&<p role="status" style={{color:"#087f68"}}>{notice}</p>}
  {invite&&<div style={{padding:12,background:"#eefaf7",borderRadius:10}}><strong>Secure onboarding invitation</strong><p><a href={invite} target="_blank" rel="noopener noreferrer">Open invitation</a> <button className="cx-secondary" type="button" onClick={()=>void navigator.clipboard.writeText(invite)}>Copy invitation</button></p><small>Share directly with the guardian. This one-time secret is not displayed again.</small></div>}
  {open&&<form onSubmit={e=>void submit(e)} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginBottom:20}}>
   <label>Admission *<select required value={form.opportunityId} onChange={e=>{const o=opportunities.find(x=>x.id===e.target.value);setForm(f=>({...f,opportunityId:e.target.value,learnerPersonId:o?.contact_id||"",fee:o?.expected_value||0,currency:o?.currency||"INR"}));}}>{opportunities.filter(o=>o.outcome==="open").map(o=><option key={o.id} value={o.id}>{o.title}</option>)}</select></label>
   <label>Learner *<select required value={form.learnerPersonId} onChange={e=>setForm(f=>({...f,learnerPersonId:e.target.value}))}>{people.map(p=><option value={p.id} key={p.id}>{p.full_name}</option>)}</select></label>
   <label>Fee *<input type="number" min={0} step="0.01" required value={form.fee} onChange={e=>setForm(f=>({...f,fee:Number(e.target.value)}))}/></label>
   <label>Currency *<input maxLength={3} required value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value.toUpperCase()}))}/></label>
   <label>Sessions *<input type="number" min={1} required value={form.sessions} onChange={e=>setForm(f=>({...f,sessions:Number(e.target.value)}))}/></label>
   <label style={{gridColumn:"1 / -1"}}>Accepted terms *<textarea maxLength={2000} required rows={2} value={form.terms} onChange={e=>setForm(f=>({...f,terms:e.target.value}))}/></label>
   <label style={{gridColumn:"1 / -1"}}><input type="checkbox" checked={form.consentAttested} required onChange={e=>setForm(f=>({...f,consentAttested:e.target.checked}))}/> I confirm the parent/guardian has accepted these commercial terms.</label>
   <button type="submit" className="cx-primary" disabled={busy}>Save accepted offer and create invitation</button>
  </form>}
  {items.length?<div style={{display:"grid",gap:10}}>{items.map(item=><div key={item.id} style={{border:"1px solid #dce8ef",padding:12,borderRadius:12}}>
   <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8}}><div><strong>{opportunities.find(o=>o.id===item.opportunity_id)?.title||"Admission"}</strong><small style={{display:"block"}}>{people.find(p=>p.id===item.learner_person_id)?.full_name||"Learner"} · {item.offer_snapshot.currency} {item.offer_snapshot.fee} · {item.offer_snapshot.sessions} sessions</small></div><strong>{label(item.status)}</strong></div>
   {item.status==="review_required"&&canManage&&<div style={{marginTop:9}}>{evidenceId===item.id?<form onSubmit={e=>{e.preventDefault();void action("verify",item.id);}}><label>Guardian verification evidence<textarea required minLength={12} maxLength={500} value={evidenceNote} onChange={e=>setEvidenceNote(e.target.value)} placeholder="Record how you verified the guardian relationship"/></label><button className="cx-primary" disabled={busy}>Confirm identity review</button><button type="button" className="cx-secondary" onClick={()=>setEvidenceId("")}>Close</button></form>:<button className="cx-secondary" onClick={()=>setEvidenceId(item.id)}>Review guardian identity</button>}</div>}
   <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>{item.status==="onboarding_pending"&&canManage&&<button type="button" className="cx-primary" disabled={busy} onClick={()=>void action("reconcile",item.id)}>Check Portal enrolment</button>}{item.status!=="enrollment_confirmed"&&item.status!=="revoked"&&canManage&&<button type="button" className="cx-secondary" disabled={busy} onClick={()=>window.confirm("Revoke this onboarding invitation?")&&void action("revoke",item.id)}>Revoke invitation</button>}{item.portal_enrollment_id&&<span>Portal enrolment: {item.portal_enrollment_id.slice(0,8)}…</span>}</div>
  </div>)}</div>:<p>No connected admission handoffs yet. The CRM pipeline continues to work independently.</p>}
 </section>;
}
