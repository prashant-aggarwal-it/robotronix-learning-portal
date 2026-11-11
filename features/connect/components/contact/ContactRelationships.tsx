"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import {connectFetch,crmCommand} from "@/features/connect/api/client";

type PersonLink={personId:string;name:string;relationship:string;direction:"incoming"|"outgoing"};
type OrgLink={organizationId:string;name:string;category:string;position:string|null};
type Choice={id:string;name:string};
type Member={id:string;label:string;role:string};
type RelationData={
 people:PersonLink[];organizations:OrgLink[];owner:{memberId:string;role:string}|null;
 members:Member[];organizationOptions:Array<Choice&{category:string}>;peopleOptions:Choice[];
};
const relationshipChoices=[
 {value:"parent_of",label:"Parent of"},{value:"guardian_of",label:"Guardian of"},
 {value:"student_of",label:"Student of"},{value:"sibling_of",label:"Sibling of"},
 {value:"colleague_of",label:"Colleague of"},{value:"refers_to",label:"Refers to"},
 {value:"custom",label:"Custom relationship"}
];
function friendly(value:string){return value.replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase());}
export function ContactRelationships({tenantId,personId,canWrite,canManage}:{
 tenantId:string;personId:string;canWrite:boolean;canManage:boolean;
}){
 const [info,setInfo]=useState<RelationData|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [other,setOther]=useState(""),[relation,setRelation]=useState("parent_of"),[customRelation,setCustomRelation]=useState("");
 const [org,setOrg]=useState(""),[position,setPosition]=useState("");
 const [newOrgName,setNewOrgName]=useState(""),[newOrgCategory,setNewOrgCategory]=useState("school");
 const generation=useRef(0);
 const path="/api/connect/workspaces/"+encodeURIComponent(tenantId)+"/contacts/"+encodeURIComponent(personId)+"/relations";
 const load=useCallback(async()=>{
  const id=++generation.current;
  setLoading(true);setError("");
  try{
   const r=await connectFetch<RelationData>(path);
   if(generation.current===id)setInfo(r);
  }catch(e){if(generation.current===id)setError(e instanceof Error?e.message:"Unable to load relationships.");}
  finally{if(generation.current===id)setLoading(false);}
 },[path]);
 useEffect(()=>{setInfo(null);setOther("");setOrg("");setNotice("");void load();return()=>{generation.current++;};},[load]);
 async function action(type:string,data:Record<string,unknown>){
  if(busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   await connectFetch(path,{method:"POST",body:JSON.stringify({action:type,data})});
   await load();setNotice("Saved successfully.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to save relationship.");}
  finally{setBusy(false);}
 }
 async function makeOrganization(e:FormEvent){
  e.preventDefault();if(!canWrite||!newOrgName.trim()||busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   await crmCommand(tenantId,"organizations","create_organization",{name:newOrgName.trim(),category:newOrgCategory});
   setNewOrgName("");await load();setNotice("Organization created. Select it below to link this contact.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to create organization.");}
  finally{setBusy(false);}
 }
 const owner=info?.members.find(m=>m.id===info.owner?.memberId);
 return <div className="cx-contact-relations">
  <div className="cx-contact-relations-heading"><div><h3>Relationships & ownership</h3><p>Connect people, organizations and the team member responsible for this contact.</p></div>
   <button className="cx-secondary" type="button" disabled={busy||loading} onClick={()=>void load()}>Refresh</button></div>
  {error&&<div className="cx-alert" role="alert">{error}</div>}
  {notice&&<p className="cx-contact-relations-notice" role="status">{notice}</p>}
  {loading?<p className="cx-muted" role="status">Loading relationships…</p>:!info?<p className="cx-muted">Relationships are unavailable.</p>:<>
   <section className="cx-detail-card">
    <h3>Contact owner</h3>
    <div className="cx-relations-owner"><span className="cx-relations-owner-icon" aria-hidden="true">♙</span>
     <div><strong>{owner?.label||"Unassigned"}</strong><small>{owner?friendly(owner.role):"No team member assigned yet"}</small></div></div>
    {canManage&&<label className="cx-relations-field">Assign to
     <select value={info.owner?.memberId||""} disabled={busy} onChange={e=>void action("assign_owner",{memberId:e.target.value})}>
      <option value="">Unassigned</option>{info.members.map(m=><option key={m.id} value={m.id}>{m.label} · {friendly(m.role)}</option>)}
     </select></label>}
   </section>
   <section className="cx-detail-card">
    <h3>People connected to this contact</h3>
    {info.people.length===0?<p className="cx-muted">No related people yet.</p>:
     info.people.map((p,i)=><div className="cx-contact360-list-row" key={p.direction+":"+p.personId+":"+p.relationship+":"+i}>
      <span><strong>{p.name}</strong><small>{p.direction==="incoming"?"Related to this contact as":"This contact is"} · {friendly(p.relationship)}</small></span>
      {canWrite&&<button type="button" className="cx-relations-remove" disabled={busy} onClick={()=>void action("unlink_person",{relatedPersonId:p.personId,relationship:p.relationship,direction:p.direction})}>Remove</button>}
     </div>)}
    {canWrite&&<form className="cx-relations-form" onSubmit={e=>{e.preventDefault();if(other&&(relation!=="custom"||customRelation.trim()))void action("link_person",{relatedPersonId:other,relationship:relation==="custom"?customRelation.trim():relation});}}>
     <label>Related contact<select required value={other} onChange={e=>setOther(e.target.value)} disabled={busy}><option value="">Choose an existing contact</option>
      {info.peopleOptions.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
     <label>Relationship<select value={relation} onChange={e=>setRelation(e.target.value)} disabled={busy}>
      {relationshipChoices.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
     {relation==="custom"&&<label>Custom relationship<input required maxLength={60} value={customRelation} onChange={e=>setCustomRelation(e.target.value)} disabled={busy} placeholder="e.g. Mentor of"/></label>}
     <button type="submit" className="cx-secondary" disabled={!other||busy||(relation==="custom"&&!customRelation.trim())}>Link person</button>
    </form>}
   </section>
   <section className="cx-detail-card">
    <h3>Organizations</h3>
    {info.organizations.length===0?<p className="cx-muted">No organizations linked.</p>:
     info.organizations.map(o=><div className="cx-contact360-list-row" key={o.organizationId}>
      <span><strong>{o.name}</strong><small>{friendly(o.category)}{o.position?" · "+o.position:""}</small></span>
      {canWrite&&<button type="button" className="cx-relations-remove" disabled={busy} onClick={()=>void action("unlink_organization",{organizationId:o.organizationId})}>Remove</button>}
     </div>)}
    {canWrite&&<>
     <form className="cx-relations-form" onSubmit={e=>{e.preventDefault();if(org)void action("link_organization",{organizationId:org,position:position.trim()});}}>
      <label>Organization<select required value={org} onChange={e=>setOrg(e.target.value)} disabled={busy}>
       <option value="">Choose an organization</option>{info.organizationOptions.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
      </select></label>
      <label>Position / role<input maxLength={100} value={position} onChange={e=>setPosition(e.target.value)} placeholder="e.g. School coordinator" disabled={busy}/></label>
      <button className="cx-secondary" disabled={!org||busy}>Link organization</button>
     </form>
     <details className="cx-relations-create"><summary>Create a new organization</summary>
      <form className="cx-relations-form" onSubmit={makeOrganization}>
       <label>Name<input value={newOrgName} onChange={e=>setNewOrgName(e.target.value)} maxLength={180} required placeholder="School or organization name" disabled={busy}/></label>
       <label>Type<select value={newOrgCategory} onChange={e=>setNewOrgCategory(e.target.value)} disabled={busy}>
        {["school","business","ngo","institute","other"].map(c=><option key={c} value={c}>{friendly(c)}</option>)}
       </select></label>
       <button className="cx-secondary" disabled={busy||!newOrgName.trim()}>Create organization</button>
      </form>
     </details>
    </>}
   </section>
  </>}
 </div>;
}
