"use client";
import {useEffect,useState,type ReactNode} from "react";
import type {ConnectPerson,ConnectOpportunity,ConnectInquiry,ConnectTask,ConnectAppointment} from "@/features/connect/api/client";
import {initials,shortLabel} from "@/features/connect/model";

type ProfileTab="overview"|"timeline"|"followups"|"details";
type Props={
 person:ConnectPerson|null|undefined;opportunity:ConnectOpportunity|null|undefined;
 inquiries:ConnectInquiry[];tasks:ConnectTask[];appointments:ConnectAppointment[];
 overviewContent:ReactNode;enquiriesContent:ReactNode;timelineContent:ReactNode;
 followupsContent:ReactNode;detailsContent:ReactNode;onClose:()=>void;
};
const tabs:Array<{id:ProfileTab;label:string}>= [
 {id:"overview",label:"Overview"},{id:"timeline",label:"Activity"},{id:"followups",label:"Follow-ups"},{id:"details",label:"Details"}
];
function phoneNumber(value:string){const cleaned=value.replace(/[^+\d]/g,"");return /^\+?\d{7,15}$/.test(cleaned)?cleaned:null;}
export function ContactProfile({person,opportunity,inquiries,tasks,appointments,overviewContent,enquiriesContent,timelineContent,followupsContent,detailsContent,onClose}:Props){
 const [tab,setTab]=useState<ProfileTab>("overview");
 useEffect(()=>setTab("overview"),[person?.id,opportunity?.id]);
 const contactId=person?.id;
 const relatedInquiries=contactId?inquiries.filter(i=>i.person_id===contactId):[];
 const relatedTasks=tasks.filter(t=>contactId?t.person_id===contactId:(opportunity&&t.opportunity_id===opportunity.id));
 const openTasks=relatedTasks.filter(t=>!["done","completed","cancelled"].includes(t.status.toLowerCase()));
 const relatedAppointments=appointments.filter(a=>contactId?a.person_id===contactId:(opportunity&&a.opportunity_id===opportunity.id));
 const phone=person?.contact_methods.find(m=>m.kind.toLowerCase().includes("phone")||m.kind.toLowerCase().includes("mobile"))?.value;
 const email=person?.contact_methods.find(m=>m.kind.toLowerCase().includes("email"))?.value;
 const validPhone=phone?phoneNumber(phone):null;
 return <div className="cx-contact360">
  <header className="cx-contact360-hero">
   <div className="cx-contact360-identity">
    <span className="cx-contact360-avatar" aria-hidden="true">{initials(person?.full_name||opportunity?.title||"Contact")}</span>
    <div><span className="cx-contact360-eyebrow">CONTACT 360°</span><h2>{person?.full_name||opportunity?.title||"Contact profile"}</h2>
    <p>{person?.roles.map(shortLabel).join(" · ")||"Opportunity"}{opportunity?.stage_name?" · "+opportunity.stage_name:""}</p></div>
   </div>
   <div className="cx-contact360-actions">
    {validPhone&&<a href={"tel:"+validPhone} className="cx-contact360-action" aria-label="Call contact">☎ Call</a>}
    {email&&<a href={"mailto:"+email} className="cx-contact360-action" aria-label="Email contact">✉ Email</a>}
    <button type="button" className="cx-contact360-action" onClick={()=>setTab("followups")}>＋ Follow-up</button>
    <button type="button" className="cx-contact360-action" onClick={()=>setTab("timeline")}>▤ Activity</button>
   </div>
  </header>
  <div className="cx-contact360-stats" aria-label="Loaded contact records">
   <button type="button" onClick={()=>setTab("overview")}><span>Enquiries</span><strong>{relatedInquiries.length}</strong><small>Loaded records</small></button>
   <button type="button" onClick={()=>setTab("followups")}><span>Open follow-ups</span><strong>{openTasks.length}</strong><small>Loaded tasks</small></button>
   <button type="button" onClick={()=>setTab("followups")}><span>Appointments</span><strong>{relatedAppointments.length}</strong><small>Loaded schedule</small></button>
  </div>
  <div className="cx-contact360-tabs" role="tablist" aria-label="Contact profile sections">
   {tabs.map(t=><button key={t.id} id={"cx-contact-tab-"+t.id} type="button" role="tab" aria-selected={tab===t.id} aria-controls="cx-contact-tabpanel" tabIndex={tab===t.id?0:-1} className={tab===t.id?"active":""} onClick={()=>setTab(t.id)}>{t.label}</button>)}
  </div>
  <div className="cx-contact360-tabpanel" id="cx-contact-tabpanel" role="tabpanel" aria-labelledby={"cx-contact-tab-"+tab}>
   {tab==="overview"&&<>{overviewContent}{enquiriesContent}</>}
   {tab==="timeline"&&timelineContent}
   {tab==="followups"&&followupsContent}
   {tab==="details"&&detailsContent}
  </div>
  <footer className="cx-contact360-footer"><span>Showing information available in this workspace. Counts reflect loaded records.</span><button type="button" onClick={onClose}>Close profile</button></footer>
 </div>;
}
