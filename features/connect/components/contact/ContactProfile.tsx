"use client";
import {useEffect,useState,type ReactNode} from "react";
import type {ConnectPerson,ConnectOpportunity,ConnectInquiry,ConnectTask,ConnectAppointment} from "@/features/connect/api/client";
import {dateLabel,initials,shortLabel} from "@/features/connect/model";
import {ContactIntelligence} from "@/features/connect/components/contact/ContactIntelligence";

type ProfileTab="overview"|"insights"|"timeline"|"followups"|"relations"|"details";
type Props={
 person:ConnectPerson|null|undefined;opportunity:ConnectOpportunity|null|undefined;tenantId:string;refreshKey:number;allowAdmissions?:boolean;
 inquiries:ConnectInquiry[];opportunities:ConnectOpportunity[];tasks:ConnectTask[];appointments:ConnectAppointment[];canWrite:boolean;
 overviewContent:ReactNode;enquiriesContent:ReactNode;timelineContent:ReactNode;
 followupsContent:ReactNode;relationsContent:ReactNode;detailsContent:ReactNode;onCreateEnquiry:()=>void;onClose:()=>void;
 onNavigateWorkflow?:(destination:"communications"|"enquiries"|"pipeline"|"followups")=>void;
};
const tabs:Array<{id:ProfileTab;label:string}>= [
 {id:"overview",label:"Overview"},{id:"insights",label:"Insights"},{id:"timeline",label:"Activity"},{id:"followups",label:"Follow-ups"},{id:"relations",label:"Relationships"},{id:"details",label:"Details"}
];
function phoneNumber(value:string){const cleaned=value.replace(/[^+\d]/g,"");return /^\+?\d{7,15}$/.test(cleaned)?cleaned:null;}
export function ContactProfile({person,opportunity,tenantId,refreshKey,allowAdmissions=true,inquiries,opportunities,tasks,appointments,canWrite,overviewContent,enquiriesContent,timelineContent,followupsContent,relationsContent,detailsContent,onCreateEnquiry,onClose,onNavigateWorkflow}:Props){
 const [tab,setTab]=useState<ProfileTab>("overview");
 useEffect(()=>setTab("overview"),[person?.id,opportunity?.id]);
 const contactId=person?.id;
 const relatedInquiries=contactId?inquiries.filter(i=>i.person_id===contactId):[];
 const opportunityIds=new Set(opportunities.filter(o=>contactId?o.contact_id===contactId:o.id===opportunity?.id).map(o=>o.id));
 const relatedTasks=tasks.filter(t=>(Boolean(contactId)&&t.person_id===contactId)||(Boolean(t.opportunity_id)&&opportunityIds.has(t.opportunity_id!)));
 const openTasks=relatedTasks.filter(t=>!["done","completed","cancelled"].includes(t.status.toLowerCase()));
 const relatedAppointments=appointments.filter(a=>(Boolean(contactId)&&a.person_id===contactId)||(Boolean(a.opportunity_id)&&opportunityIds.has(a.opportunity_id!)));
 const phone=person?.contact_methods.find(m=>m.kind.toLowerCase().includes("phone")||m.kind.toLowerCase().includes("mobile"))?.value;
 const email=person?.contact_methods.find(m=>m.kind.toLowerCase().includes("email"))?.value;
 const validPhone=phone?phoneNumber(phone):null;
 return <div className="cx-contact360">
  <header className="cx-contact360-hero">
   <div className="cx-contact360-identity">
    <span className="cx-contact360-avatar" aria-hidden="true">{initials(person?.full_name||opportunity?.title||"Contact")}</span>
    <div><span className="cx-contact360-eyebrow">CONTACT 360°</span><h2>{person?.full_name||opportunity?.title||"Contact profile"}</h2>
    <p>{person?.roles.map(shortLabel).join(" · ")||"Opportunity"}{person?.status?" · "+shortLabel(person.status):""}{opportunity?.stage_name?" · "+opportunity.stage_name:""}</p></div>
   </div>
   <div className="cx-contact360-actions">
    {validPhone&&<a href={"tel:"+validPhone} className="cx-contact360-action" aria-label="Call contact">☎ Call</a>}
    {email&&<a href={"mailto:"+email} className="cx-contact360-action" aria-label="Email contact">✉ Email</a>}
    {person&&canWrite&&<button type="button" className="cx-contact360-action" onClick={onCreateEnquiry}>＋ Enquiry</button>}
    <button type="button" className="cx-contact360-action" onClick={()=>setTab("followups")}>{canWrite?"＋ Follow-up":"Follow-ups"}</button>
    <button type="button" className="cx-contact360-action" onClick={()=>setTab("timeline")}>▤ Activity</button>
    {person&&canWrite&&allowAdmissions&&<button type="button" className="cx-contact360-action" onClick={()=>setTab("details")}>＋ Admission</button>}
   </div>
  </header>
  {onNavigateWorkflow&&(person?.id||opportunity?.contact_id)&&<nav className="cx-contact360-workflow" aria-label="Customer journey">
     <div><strong>Customer journey</strong><small>Open related records without losing the customer</small></div>
     <div className="cx-contact360-workflow-links">
      <button type="button" onClick={()=>onNavigateWorkflow("communications")}>Conversations ↗</button>
      <button type="button" onClick={()=>onNavigateWorkflow("enquiries")}>Enquiries ({relatedInquiries.length}) ↗</button>
      {allowAdmissions&&<button type="button" onClick={()=>onNavigateWorkflow("pipeline")}>Admissions ({opportunityIds.size}) ↗</button>}
      <button type="button" onClick={()=>onNavigateWorkflow("followups")}>Follow-ups ({openTasks.length}) ↗</button>
     </div>
   </nav>}
  <div className="cx-contact360-stats" aria-label="Loaded contact records">
   <button type="button" onClick={()=>setTab("overview")}><span>Enquiries</span><strong>{relatedInquiries.length}</strong><small>Loaded records</small></button>
   <button type="button" onClick={()=>setTab("followups")}><span>Open follow-ups</span><strong>{openTasks.length}</strong><small>Loaded tasks</small></button>
   <button type="button" onClick={()=>setTab("followups")}><span>Appointments</span><strong>{relatedAppointments.length}</strong><small>Loaded schedule</small></button>
  </div>
  <div className="cx-contact360-tabs" role="tablist" aria-label="Contact profile sections" aria-orientation="horizontal">
   {tabs.map(t=><button key={t.id} id={"cx-contact-tab-"+t.id} type="button" role="tab" aria-selected={tab===t.id} aria-controls="cx-contact-tabpanel" tabIndex={tab===t.id?0:-1} className={tab===t.id?"active":""} onClick={()=>setTab(t.id)}
    onKeyDown={e=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(e.key))return;
     e.preventDefault();
     const index=tabs.findIndex(x=>x.id===t.id);
     const next=e.key==="Home"?0:e.key==="End"?tabs.length-1:e.key==="ArrowRight"?(index+1)%tabs.length:(index+tabs.length-1)%tabs.length;
     setTab(tabs[next].id);
     document.getElementById("cx-contact-tab-"+tabs[next].id)?.focus();
    }}>{t.label}</button>)}
  </div>
  <div className="cx-contact360-tabpanel" id="cx-contact-tabpanel" role="tabpanel" aria-labelledby={"cx-contact-tab-"+tab}>
   {tab==="overview"&&<>{overviewContent}{enquiriesContent}</>}
   {tab==="insights"&&(person?.id||opportunity?.contact_id)&&<ContactIntelligence tenantId={tenantId} personId={(person?.id||opportunity?.contact_id)!} refreshKey={refreshKey} onOpenFollowups={()=>setTab("followups")} onOpenRelations={()=>setTab("relations")}/>}
   {tab==="timeline"&&timelineContent}
   {tab==="followups"&&<>
    <section className="cx-detail-card"><h3>Contact follow-ups</h3>
     {relatedTasks.length===0?<p className="cx-muted">No related tasks among the records loaded.</p>:relatedTasks.map(t=><div className="cx-contact360-list-row" key={t.id}><span><strong>{t.title}</strong><small>{dateLabel(t.due_at)}</small></span><span className="cx-pill">{shortLabel(t.status)}</span></div>)}
    </section>
    <section className="cx-detail-card"><h3>Related appointments</h3>
     {relatedAppointments.length===0?<p className="cx-muted">No related appointments among the records loaded.</p>:relatedAppointments.map(a=><div className="cx-contact360-list-row" key={a.id}><span><strong>{a.title}</strong><small>{dateLabel(a.starts_at)} · {shortLabel(a.kind)}</small></span><span className="cx-pill">{shortLabel(a.status)}</span></div>)}
    </section>
    {followupsContent}
   </>}
   {tab==="relations"&&relationsContent}
   {tab==="details"&&detailsContent}
  </div>
  <footer className="cx-contact360-footer"><span>Showing information available in this workspace. Counts reflect loaded records.</span><button type="button" onClick={onClose}>Close profile</button></footer>
 </div>;
}
