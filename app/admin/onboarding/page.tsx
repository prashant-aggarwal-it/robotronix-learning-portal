"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {AdminPageHeader} from "@/components/admin/AdminPageHeader";
import {KpiCard} from "@/components/admin/KpiCard";
import {Pagination} from "@/components/admin/Pagination";
import {SortableTh} from "@/components/admin/SortableTh";
import {StatusDonut} from "@/components/admin/StatusDonut";
import {MiniBars} from "@/components/admin/MiniBars";
import {listOnboardingSubmissions} from "@/lib/repository";
import {shortTimeZoneLabel} from "@/lib/timezones";
import type {OnboardingSubmission} from "@/lib/types";
import {guardiansFromRecord,relationshipLabel} from "@/lib/guardians";

const labels:Record<OnboardingSubmission["status"],string>={draft:"Draft",new:"New",setup_pending:"Setup pending",active:"Active"};
const statusOrder:Record<OnboardingSubmission["status"],number>={new:0,draft:1,setup_pending:2,active:3};
type SortKey="child"|"grade"|"guardian"|"mobile"|"location"|"status"|"submitted";
function gradeNumber(value:string){const match=String(value).match(/\d+/);return match?Number(match[0]):999;}
function textCompare(a:string,b:string){return String(a||"").localeCompare(String(b||""),undefined,{sensitivity:"base",numeric:true});}

export default function OnboardingAdmin(){
 const[rows,setRows]=useState<OnboardingSubmission[]>([]);
 const[q,setQ]=useState("");const[status,setStatus]=useState("all");const[source,setSource]=useState("all");
 const[sortKey,setSortKey]=useState<SortKey>("submitted");const[sortDir,setSortDir]=useState<"asc"|"desc">("desc");
 const[page,setPage]=useState(1);const[pageSize,setPageSize]=useState(25);
 useEffect(()=>{listOnboardingSubmissions().then(setRows)},[]);
 const sources=useMemo(()=>Array.from(new Set(rows.map(r=>r.source).filter(Boolean))).sort(),[rows]);
 function sort(column:string){const key=column as SortKey;if(sortKey===key)setSortDir(d=>d==="asc"?"desc":"asc");else{setSortKey(key);setSortDir(key==="submitted"?"desc":"asc")}}
 const filtered=useMemo(()=>{
  let x=rows.filter(r=>{const g=guardiansFromRecord(r);return `${r.childName} ${g.primary.name} ${g.secondary?.name??""} ${r.school} ${r.city} ${r.primaryWhatsApp}`.toLowerCase().includes(q.toLowerCase())});
  if(status!=="all")x=x.filter(r=>r.status===status);
  if(source!=="all")x=x.filter(r=>r.source===source);
  const key=(r:OnboardingSubmission)=>{const g=guardiansFromRecord(r);switch(sortKey){case "child":return r.childName;case "grade":return gradeNumber(r.grade);case "guardian":return g.primary.name;case "mobile":return (r.primaryWhatsApp||g.primary.mobile).replace(/\D/g,"");case "location":return `${r.city} ${r.country}`;case "status":return statusOrder[r.status];default:return r.submittedAt||"";}};
  const sign=sortDir==="asc"?1:-1;
  return [...x].sort((a,b)=>{const av=key(a),bv=key(b);const value=typeof av==="number"&&typeof bv==="number"?av-bv:textCompare(String(av),String(bv));return value*sign||textCompare(a.id,b.id)});
 },[rows,q,status,source,sortKey,sortDir]);
 useEffect(()=>setPage(1),[q,status,source,sortKey,sortDir]);
 const paged=filtered.slice((page-1)*pageSize,page*pageSize);
 const month=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit"}).format(new Date());
 const activeMonth=rows.filter(x=>x.status==="active"&&(x.activatedAt??"").startsWith(month)).length;
 const segments=[{label:"Draft",value:rows.filter(x=>x.status==="draft").length,color:"#8a91a6"},{label:"New",value:rows.filter(x=>x.status==="new").length,color:"#7650d7"},{label:"Setup pending",value:rows.filter(x=>x.status==="setup_pending").length,color:"#f0a33b"},{label:"Active",value:rows.filter(x=>x.status==="active").length,color:"#218e62"}];const statusTotal=segments.reduce((n,s)=>n+s.value,0);
 const sourceItems=useMemo(()=>sources.map(s=>({label:s,value:rows.filter(r=>r.source===s).length})).sort((a,b)=>b.value-a.value).slice(0,6),[rows,sources]);
 const th=(label:string,column:SortKey)=><SortableTh label={label} column={column} sortKey={sortKey} direction={sortDir} onSort={sort}/>;
 return <RoleGuard allow={["admin"]}><AppShell role="admin">
  <AdminPageHeader eyebrow="LEARNER INTAKE" title="Onboarding" description="Review new family submissions, complete learning setup and activate learners when course, trainer and delivery details are ready." actions={<Link href="/onboarding" className="button ghost">Open parent onboarding</Link>}/>
  <section className="dashboardKpis"><KpiCard label="New" value={rows.filter(x=>x.status==="new").length} detail="Needs setup" tone="purple"/><KpiCard label="Draft" value={rows.filter(x=>x.status==="draft").length} detail="Started but not submitted / saved by Admin" tone="slate"/><KpiCard label="Setup pending" value={rows.filter(x=>x.status==="setup_pending").length} detail="Assignment saved, not yet active" tone="amber"/><KpiCard label="Active" value={rows.filter(x=>x.status==="active").length} detail="Learners activated" tone="teal"/><KpiCard label="Activated this month" value={activeMonth} detail="Time-based conversion metric" tone="slate"/></section>
  <section className="dashboardGrid dashboardGridTwo compactCharts"><div className="panel"><div className="panelHeader"><div><div className="eyebrow">ONBOARDING PIPELINE</div><h2>Current status distribution</h2></div></div><StatusDonut segments={segments} centerLabel="families" centerValue={statusTotal}/></div><div className="panel"><div className="panelHeader"><div><div className="eyebrow">ACQUISITION · ALL SUBMISSIONS</div><h2>How families found Robotronix™</h2></div></div><MiniBars items={sourceItems.length?sourceItems:[{label:"No source data",value:0}]}/></div></section>
  <section className="dataSection"><div className="dataToolbar"><div className="toolbarSearch"><input className="input" placeholder="Search learner, parent, school, city or mobile…" value={q} onChange={e=>setQ(e.target.value)}/></div><select className="input compactInput" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option><option value="new">New</option><option value="draft">Draft</option><option value="setup_pending">Setup pending</option><option value="active">Active</option></select><select className="input compactInput" value={source} onChange={e=>setSource(e.target.value)}><option value="all">All sources</option>{sources.map(s=><option value={s} key={s}>{s}</option>)}</select></div>
   <div className="tableWrap professionalTable onboardingIntakeTable"><table><thead><tr>{th("Learner","child")}{th("Class / Grade","grade")}{th("Primary contact","guardian")}{th("Main mobile / WhatsApp","mobile")}{th("City / Country","location")}{th("Status","status")}{th("Submitted","submitted")}<th>Next action</th></tr></thead><tbody>{paged.length?paged.map(r=>{const g=guardiansFromRecord(r);return <tr key={r.id}><td><b>{r.childName}</b><div className="cellSub">{shortTimeZoneLabel(r.timezone)} timezone</div></td><td><b>{r.grade||"—"}</b><div className="cellSub">{r.school||"School not provided"}</div></td><td><b>{g.primary.name||"Parent / guardian"}</b><div className="cellSub">{relationshipLabel(g.primary.relationship)}</div></td><td><b className="contactNumber">{r.primaryWhatsApp||g.primary.mobile||"—"}</b>{r.primaryWhatsApp&&<div className="cellSub">WhatsApp</div>}</td><td><b>{[r.city,r.country].filter(Boolean).join(", ")||"—"}</b><div className="cellSub">{shortTimeZoneLabel(r.timezone)}</div></td><td><span className={`statusBadge status-${r.status}`}>{labels[r.status]}</span></td><td>{r.submittedAt?new Date(r.submittedAt).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}):"—"}</td><td><Link href={`/admin/onboarding/${r.id}`} className="tableAction">{r.status==="active"?"View setup":"Complete setup"} →</Link></td></tr>}):<tr><td colSpan={8}><div className="emptyState compact">No onboarding records match the selected filters.</div></td></tr>}</tbody></table></div><Pagination page={page} total={filtered.length} pageSize={pageSize} onPage={setPage} onPageSizeChange={setPageSize}/></section>
 </AppShell></RoleGuard>;
}
