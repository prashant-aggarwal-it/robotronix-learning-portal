"use client";
import {FormEvent,useCallback,useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {connectFetch,crmCommand,crmList,
 type ConnectWorkspace,type ConnectPerson,type ConnectInquiry,type ConnectOpportunity,
 type ConnectPipeline,type ConnectTask,type ConnectAppointment,type ConnectOverview,
 type ConnectActivity,type ConnectProgram,type ConnectMember} from "@/lib/connect-client";
import {ChannelSettings} from "@/components/connect/ChannelSettings";
import {ConnectAutomationSettings} from "@/components/connect/ConnectAutomationSettings";
import {ConnectReminderInbox,ConnectConversationHistory} from "@/components/connect/ConnectCommunications";
import "./connect.css";

type Section="overview"|"enquiries"|"contacts"|"pipeline"|"followups"|"calendar"|"communications"|"settings";
const navigation:Array<{id:Section;label:string;icon:string}>= [
 {id:"overview",label:"Overview",icon:"◫"},{id:"enquiries",label:"Enquiries",icon:"◎"},
 {id:"contacts",label:"Contacts",icon:"♙"},{id:"pipeline",label:"Admissions pipeline",icon:"▥"},
 {id:"followups",label:"Follow-ups",icon:"☑"},{id:"calendar",label:"Calendar",icon:"▦"},
 {id:"communications",label:"Communications",icon:"✉"},
 {id:"settings",label:"Institute settings",icon:"⚙"}
];
const emptyOverview:ConnectOverview={
 newEnquiries:0,totalEnquiries:0,openOpportunities:0,wonOpportunities:0,
 overdueTasks:0,openTasks:0,scheduledAppointments:0
};
function dateLabel(v:string|null|undefined){if(!v)return "Not scheduled";const d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleString("en-IN",{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"});}
function initials(v:string){return v.trim().split(/\s+/).slice(0,2).map(x=>x.charAt(0).toUpperCase()).join("")||"—";}
function shortLabel(v:string){return v.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());}
function ErrorMessage({error}:{error:string}){return error?<div className="cx-alert" role="alert">{error}</div>:null;}
function EmptyState({title,description}:{title:string;description:string}){return <div className="cx-empty"><div className="cx-empty-icon">◎</div><strong>{title}</strong><p>{description}</p></div>;}

export default function ConnectPage(){
 const [signedIn,setSignedIn]=useState<boolean|null>(null);
 const [accountEmail,setAccountEmail]=useState("");
 const [workspaces,setWorkspaces]=useState<ConnectWorkspace[]>([]);
 const [workspacesReady,setWorkspacesReady]=useState(false);
 const [tenantId,setTenantId]=useState("");
 const [section,setSection]=useState<Section>("overview");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(false);
 const requestGeneration=useRef(0);
 const timelineGeneration=useRef(0);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [refreshCount,setRefreshCount]=useState(0);
 const [search,setSearch]=useState("");
 const [showLeadForm,setShowLeadForm]=useState(false);
 const [showContactForm,setShowContactForm]=useState(false);
 const [selectedPerson,setSelectedPerson]=useState<string|null>(null);
 const [selectedOpportunity,setSelectedOpportunity]=useState<string|null>(null);
 const [assignees,setAssignees]=useState<Array<{id:string;label:string;role:string}>>([]);
 const [activityNote,setActivityNote]=useState("");
 const [overview,setOverview]=useState<ConnectOverview>(emptyOverview);
 const [people,setPeople]=useState<ConnectPerson[]>([]);
 const [inquiries,setInquiries]=useState<ConnectInquiry[]>([]);
 const [opportunities,setOpportunities]=useState<ConnectOpportunity[]>([]);
 const [pipelines,setPipelines]=useState<ConnectPipeline[]>([]);
 const [tasks,setTasks]=useState<ConnectTask[]>([]);
 const [appointments,setAppointments]=useState<ConnectAppointment[]>([]);
 const [programs,setPrograms]=useState<ConnectProgram[]>([]);
 const [timeline,setTimeline]=useState<ConnectActivity[]>([]);
 const [members,setMembers]=useState<ConnectMember[]>([]);
 const [showMobileNav,setShowMobileNav]=useState(false);

 useEffect(()=>{
  const client=getSupabaseBrowserClient();
  if(!client){setSignedIn(false);return;}
  let mounted=true;
  void client.auth.getSession().then(({data})=>{
   if(!mounted)return;
   setSignedIn(Boolean(data.session));setAccountEmail(data.session?.user.email||"");
  });
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{
   if(!mounted)return;
   setSignedIn(Boolean(session));setAccountEmail(session?.user.email||"");
  });
  return()=>{mounted=false;subscription.unsubscribe();};
 },[]);

 const loadWorkspaces=useCallback(async()=>{
  const result=await connectFetch<{workspaces:ConnectWorkspace[]}>("/api/connect/workspaces");
  setWorkspaces(result.workspaces||[]);setWorkspacesReady(true);
  setTenantId(previous=>result.workspaces.some(x=>x.tenant_id===previous)?previous:(result.workspaces[0]?.tenant_id||""));
 },[]);
 useEffect(()=>{
  if(!signedIn){setWorkspaces([]);setTenantId("");setWorkspacesReady(false);return;}
  setWorkspacesReady(false);
  void loadWorkspaces().catch(e=>{setError(e instanceof Error?e.message:"Could not load your institutes.");setWorkspacesReady(true);});
 },[signedIn,loadWorkspaces]);

 // Ignore responses from a previous institute, refresh or logged-out session.
 // Clear old data immediately on institute switching so it can never flash on the new screen.
 useEffect(()=>{
  const generation=++requestGeneration.current;
  setOverview(emptyOverview);setInquiries([]);setPeople([]);setOpportunities([]);
  setPipelines([]);setTasks([]);setAppointments([]);setPrograms([]);setMembers([]);
  setTimeline([]);setLoading(Boolean(tenantId&&signedIn));setError("");
  if(!tenantId||!signedIn)return ()=>{requestGeneration.current++;};
  void (async()=>{
   try{
    const r=await Promise.all([
     crmList<ConnectOverview>(tenantId,"overview"),
     crmList<ConnectInquiry>(tenantId,"inquiries",{limit:"100"}),
     crmList<ConnectPerson>(tenantId,"people",{limit:"100"}),
     crmList<ConnectOpportunity>(tenantId,"opportunities",{limit:"100"}),
     crmList<ConnectPipeline>(tenantId,"pipelines",{limit:"100"}),
     crmList<ConnectTask>(tenantId,"tasks",{limit:"100"}),
     crmList<ConnectAppointment>(tenantId,"appointments",{limit:"100"}),
     crmList<ConnectProgram>(tenantId,"programs",{limit:"100"})
    ]);
    if(requestGeneration.current!==generation)return;
    setOverview(r[0].items[0]||emptyOverview);setInquiries(r[1].items);setPeople(r[2].items);
    setOpportunities(r[3].items);setPipelines(r[4].items);setTasks(r[5].items);
    setAppointments(r[6].items);setPrograms(r[7].items);
   }catch(e){
    if(requestGeneration.current===generation)setError(e instanceof Error?e.message:"Unable to load Connect workspace.");
   }finally{
    if(requestGeneration.current===generation)setLoading(false);
   }
  })();
  return ()=>{requestGeneration.current++;};
 },[tenantId,refreshCount,signedIn]);

 useEffect(()=>{
  const generation=++timelineGeneration.current;
  setTimeline([]);
  if(!tenantId||!selectedOpportunity||!signedIn)return ()=>{timelineGeneration.current++;};
  void crmList<ConnectActivity>(tenantId,"timeline",{id:selectedOpportunity,limit:"100"})
   .then(r=>{if(timelineGeneration.current===generation)setTimeline(r.items);})
   .catch(()=>{if(timelineGeneration.current===generation)setTimeline([]);});
  return ()=>{timelineGeneration.current++;};
 },[tenantId,selectedOpportunity,refreshCount,signedIn]);

 const tenant=workspaces.find(x=>x.tenant_id===tenantId);
 const canConfigure=["owner","admin","manager"].includes(tenant?.membership_role||"");
 const canWrite=Boolean(tenant&&tenant.membership_role!=="viewer");
 useEffect(()=>{
  let cancelled=false;
  setAssignees([]);
  if(!tenantId||!selectedOpportunity||!canConfigure)return;
  void connectFetch<{assignees:Array<{id:string;label:string;role:string}>}>(
   "/api/connect/workspaces/"+tenantId+"/assignees"
  ).then(r=>{if(!cancelled)setAssignees(r.assignees||[]);}).catch(()=>{if(!cancelled)setAssignees([]);});
  return ()=>{cancelled=true;};
 },[tenantId,selectedOpportunity,canConfigure]);
 const [loginEmail,setLoginEmail]=useState("");
 const [loginPassword,setLoginPassword]=useState("");
 const [newWorkspace,setNewWorkspace]=useState("");
 const [newSlug,setNewSlug]=useState("");
 const [lead,setLead]=useState({name:"",phone:"",email:"",source:"whatsapp",summary:"",pipelineId:"",personId:""});
 const [newContact,setNewContact]=useState({name:"",email:"",phone:"",role:"contact"});
 const [taskTitle,setTaskTitle]=useState("");
 const [taskDue,setTaskDue]=useState("");
 const [pipelineName,setPipelineName]=useState("");
 const [programName,setProgramName]=useState("");
 const [newAdmissionTitle,setNewAdmissionTitle]=useState("");
 const [newAdmissionPipeline,setNewAdmissionPipeline]=useState("");
 const [appointmentTitle,setAppointmentTitle]=useState("");
 const [appointmentStarts,setAppointmentStarts]=useState("");
 const [appointmentEnds,setAppointmentEnds]=useState("");

 async function run(task:()=>Promise<unknown>,success:string){
  if(busy)return;setBusy(true);setError("");setNotice("");
  try{await task();setNotice(success);setRefreshCount(v=>v+1);}
  catch(e){setError(e instanceof Error?e.message:"Unable to save changes.");}
  finally{setBusy(false);}
 }
 async function signIn(e:FormEvent){
  e.preventDefault();setError("");setBusy(true);
  try{
   const client=getSupabaseBrowserClient();
   if(!client)throw new Error("Authentication is not configured.");
   const {error:authError}=await client.auth.signInWithPassword({email:loginEmail,password:loginPassword});
   if(authError)throw new Error(authError.message);
  }catch(e){setError(e instanceof Error?e.message:"Could not sign in.");}
  finally{setBusy(false);}
 }
 async function createWorkspace(e:FormEvent){
  e.preventDefault();
  await run(async()=>{
   const result=await connectFetch<{workspaceId:string}>("/api/connect/workspaces",{
    method:"POST",body:JSON.stringify({name:newWorkspace,slug:newSlug})
   });
   await loadWorkspaces();setTenantId(result.workspaceId);
  },"Institute workspace created.");
 }
 async function captureLead(e:FormEvent){
  e.preventDefault();
  const pipeline=pipelines.find(x=>x.id===lead.pipelineId);
  const stage=pipeline?.stages.filter(s=>s.outcome==="open").sort((a,b)=>a.order-b.order)[0];
  await run(async()=>{
   await crmCommand(tenantId,"inquiries","capture_lead",{
    name:lead.name,phone:lead.phone,email:lead.email,source:lead.source,
    ...(lead.personId?{personId:lead.personId}:{}),
    summary:lead.summary,...(pipeline&&stage?{pipelineId:pipeline.id,stageId:stage.id}:{})
   });
   setLead({name:"",phone:"",email:"",source:"whatsapp",summary:"",pipelineId:"",personId:""});setShowLeadForm(false);
  },"Enquiry captured successfully.");
 }
 async function startAdmission(e:FormEvent){
  e.preventDefault();
  if(!selectedPerson)return;
  const pipeline=pipelines.find(p=>p.id===newAdmissionPipeline);
  const initial=pipeline?.stages.filter(x=>x.outcome==="open").sort((a,b)=>a.order-b.order)[0];
  if(!pipeline||!initial){setError("Choose a pipeline with an open stage.");return;}
  await run(async()=>{
   const outcome=await crmCommand(tenantId,"opportunities","create_opportunity",{
    title:newAdmissionTitle.trim()||(selectedContact?.full_name||"New")+" — admission",
    contactId:selectedPerson,pipelineId:pipeline.id,stageId:initial.id
   });
   setNewAdmissionTitle("");setNewAdmissionPipeline("");
   if(outcome.id)setSelectedOpportunity(outcome.id);
  },"Admission opportunity created.");
 }
 async function createContact(e:FormEvent){
  e.preventDefault();
  await run(async()=>{
   const result=await crmCommand(tenantId,"people","create_contact",newContact);
   setNewContact({name:"",email:"",phone:"",role:"contact"});setShowContactForm(false);
   if(result.id)setSelectedPerson(result.id);
  },"Contact created.");
 }
 async function saveTask(e:FormEvent){
  e.preventDefault();
  await run(async()=>{
   await crmCommand(tenantId,"tasks","create_task",{
    title:taskTitle,personId:selectedPerson||undefined,opportunityId:selectedOpportunity||undefined,
    dueAt:taskDue?new Date(taskDue).toISOString():undefined
   });
   setTaskTitle("");setTaskDue("");
  },"Follow-up added.");
 }
 async function saveAppointment(e:FormEvent){
  e.preventDefault();
  await run(async()=>{
   await crmCommand(tenantId,"appointments","create_appointment",{
    title:appointmentTitle,personId:selectedPerson||undefined,opportunityId:selectedOpportunity||undefined,
    kind:"counselling",startsAt:new Date(appointmentStarts).toISOString(),
    endsAt:new Date(appointmentEnds).toISOString()
   });
   setAppointmentTitle("");setAppointmentStarts("");setAppointmentEnds("");
  },"Appointment scheduled.");
 }
 async function saveNote(e:FormEvent){
  e.preventDefault();if(!activityNote.trim()||(!selectedOpportunity&&!selectedPerson))return;
  await run(async()=>{
   await crmCommand(tenantId,"activities","log_activity",{
    opportunityId:selectedOpportunity||undefined,personId:selectedPerson||undefined,
    kind:"note",summary:activityNote.trim()
   });
   setActivityNote("");
  },"Activity note saved.");
 }
 async function updateAssignment(opp:ConnectOpportunity,memberId:string){
  if(!memberId||memberId===opp.owner_membership_id)return;
  await run(()=>crmCommand(tenantId,"opportunities","assign_opportunity",{
   opportunityId:opp.id,ownerMemberId:memberId,version:opp.version
  }),"Admission reassigned.");
 }
 async function updateStage(opp:ConnectOpportunity,stageId:string){
  if(opp.stage_id===stageId)return;
  await run(()=>crmCommand(tenantId,"opportunities","move_opportunity",{
   opportunityId:opp.id,stageId,version:opp.version
  }),"Admissions stage updated.");
 }
 const selectedContact=people.find(x=>x.id===selectedPerson);
 const selectedLead=opportunities.find(x=>x.id===selectedOpportunity);
 const matchingInquiries=useMemo(()=>inquiries.filter(x=>
  !search||[x.contact_name,x.summary,x.source,x.stage_name].some(v=>(v||"").toLowerCase().includes(search.toLowerCase()))
 ),[inquiries,search]);
 const matchingPeople=useMemo(()=>people.filter(x=>
  !search||[x.full_name,...x.contact_methods.map(m=>m.value)].some(v=>v.toLowerCase().includes(search.toLowerCase()))
 ),[people,search]);

 if(signedIn===null)return <main className="cx-gate">Checking your Connect session…</main>;
 if(!signedIn)return <main className="cx-gate"><section className="cx-auth">
  <div className="cx-logo"><span className="cx-logo-mark">C</span><span>Robotronix <b>Connect</b></span></div>
  <span className="cx-kicker">ADMISSIONS & RELATIONSHIPS</span>
  <h1>A clearer way to manage admissions.</h1>
  <p>Sign in with your existing Robotronix account. Connect uses the same authentication system as the Learning Portal, with separate institute permissions.</p>
  <ErrorMessage error={error}/>
  <form onSubmit={signIn} className="cx-form"><label>Email<input type="email" required autoComplete="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)}/></label>
  <label>Password<input type="password" required autoComplete="current-password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)}/></label>
  <button className="cx-primary" disabled={busy}>{busy?"Signing in…":"Sign in to Connect"}</button></form>
  <Link href="/login" className="cx-link">Go to Learning Portal sign-in</Link>
 </section></main>;
 if(!workspacesReady)return <main className="cx-gate">Loading your institute workspace…</main>;
 if(!workspaces.length)return <main className="cx-gate"><section className="cx-auth">
  <div className="cx-logo"><span className="cx-logo-mark">C</span><span>Robotronix <b>Connect</b></span></div>
  <span className="cx-kicker">GETTING STARTED</span><h1>Create your institute workspace</h1>
  <p>Every institute manages its own contacts, admissions and staff. You will be the workspace owner.</p>
  <ErrorMessage error={error}/><form onSubmit={createWorkspace} className="cx-form">
   <label>Institute name<input required minLength={2} maxLength={120} placeholder="e.g. Bright Minds Academy" value={newWorkspace}
   onChange={e=>{setNewWorkspace(e.target.value);setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""));}}/></label>
   <label>Workspace identifier<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={newSlug} onChange={e=>setNewSlug(e.target.value)}/></label>
   <button className="cx-primary" disabled={busy}>{busy?"Creating…":"Create institute workspace"}</button>
  </form>
  <button className="cx-text-button" onClick={()=>{setSignedIn(false);void getSupabaseBrowserClient()?.auth.signOut();}}>Sign out</button>
 </section></main>;

 return <main className="cx-app">
  <button className="cx-mobile-menu" onClick={()=>setShowMobileNav(!showMobileNav)} aria-label="Toggle navigation">☰</button>
  <aside className={"cx-sidebar "+(showMobileNav?"cx-mobile-open":"")}>
   <div className="cx-logo"><span className="cx-logo-mark">C</span><span>Robotronix <b>Connect</b></span></div>
   <div className="cx-workspace-picker">
    <span>INSTITUTE WORKSPACE</span>
    <select aria-label="Choose institute" value={tenantId} onChange={e=>{setTenantId(e.target.value);setSelectedPerson(null);setSelectedOpportunity(null);}}>
     {workspaces.map(w=><option key={w.tenant_id} value={w.tenant_id}>{w.workspace_name}</option>)}
    </select>
    <small>{shortLabel(tenant?.membership_role||"member")} access</small>
   </div>
   <nav aria-label="Connect navigation" className="cx-navigation">
    <span className="cx-nav-label">WORKSPACE</span>
    {navigation.map(n=><button key={n.id} className={"cx-nav-item "+(section===n.id?"active":"")} onClick={()=>{
      setSection(n.id);setSearch("");setSelectedPerson(null);setSelectedOpportunity(null);setShowMobileNav(false);
     }}><span aria-hidden="true">{n.icon}</span>{n.label}</button>)}
   </nav>
   <div className="cx-sidebar-footer"><div className="cx-persona">{initials(accountEmail)}</div>
    <div className="cx-sidebar-account"><strong>{accountEmail.split("@")[0]}</strong><small>{accountEmail}</small></div>
    <button title="Sign out" aria-label="Sign out" className="cx-signout" onClick={()=>void getSupabaseBrowserClient()?.auth.signOut()}>↪</button>
   </div>
  </aside>
  <div className="cx-main">
   <header className="cx-topbar">
    <div className="cx-breadcrumb"><span>Connect</span><span aria-hidden="true">/</span><strong>{navigation.find(n=>n.id===section)?.label}</strong></div>
    <div className="cx-top-actions"><span className="cx-sync">{loading?"Refreshing…":"Development workspace"}</span>
     <button className="cx-icon-button" aria-label="Refresh CRM data" title="Refresh data" onClick={()=>setRefreshCount(v=>v+1)}>↻</button>
     <Link href="/" className="cx-portal-link">Learning Portal ↗</Link>
    </div>
   </header>
   <div className="cx-content">
    <ErrorMessage error={error}/>
    {notice&&<div className="cx-success" role="status">{notice}<button onClick={()=>setNotice("")} aria-label="Dismiss notice">×</button></div>}
    <div className="cx-page-heading"><div><span className="cx-kicker">{tenant?.workspace_name}</span>
     <h1>{section==="overview"?"Admissions overview":navigation.find(n=>n.id===section)?.label}</h1>
     <p>{section==="overview"?"Stay on top of every enquiry, follow-up and admission.":
     section==="enquiries"?"Capture, qualify and respond to every incoming enquiry.":
     section==="contacts"?"One place for people, families and their relationships.":
     section==="pipeline"?"Track every admission from first conversation to enrolment.":
     section==="followups"?"Your team's calls, tasks and next actions.":
     section==="calendar"?"Counselling, demo and trial appointments.":
     section==="communications"?"Review verified inbound messages and conversation history.":"Manage institute programmes and access."}</p></div>
     {(section==="overview"||section==="enquiries")&&canWrite&&<button className="cx-primary" onClick={()=>setShowLeadForm(true)}>＋ New enquiry</button>}
     {section==="contacts"&&canWrite&&<button className="cx-primary" onClick={()=>setShowContactForm(true)}>＋ New contact</button>}
    </div>

    {section==="overview"&&<>
     <div className="cx-metrics">
      {[
       {value:overview.newEnquiries,label:"New today",detail:"Incoming enquiries"},
       {value:overview.openOpportunities,label:"Open admissions",detail:"In active pipelines"},
       {value:overview.overdueTasks,label:"Overdue follow-ups",detail:"Need attention",warning:overview.overdueTasks>0},
       {value:overview.wonOpportunities,label:"Admissions won",detail:"Converted opportunities"}
      ].map(m=><article key={m.label} className={"cx-metric "+(m.warning?"cx-metric-warn":"")}><span>{m.label}</span><strong>{m.value}</strong><small>{m.detail}</small></article>)}
     </div>
     <div className="cx-overview-grid">
      <section className="cx-panel"><div className="cx-panel-header"><div><h2>Recent enquiries</h2><p>Latest enquiries across your channels</p></div><button className="cx-link-button" onClick={()=>setSection("enquiries")}>View all →</button></div>
       {inquiries.length===0?<EmptyState title="No enquiries yet" description="Capture the first enquiry to start building your admissions pipeline."/>:
       <div className="cx-record-list">{inquiries.slice(0,6).map(i=><button className="cx-record" key={i.id} onClick={()=>{setSection("enquiries");setSelectedPerson(i.person_id);setSelectedOpportunity(i.opportunity_id);}}>
        <span className="cx-avatar">{initials(i.contact_name||"Lead")}</span><span className="cx-record-main"><strong>{i.contact_name||"New enquiry"}</strong><small>{i.summary||shortLabel(i.source)}</small></span>
        <span className="cx-record-end"><span className="cx-pill">{shortLabel(i.stage_name||i.source)}</span><small>{dateLabel(i.received_at)}</small></span></button>)}</div>}
      </section>
      <section className="cx-panel"><div className="cx-panel-header"><div><h2>Requires attention</h2><p>Follow-ups and upcoming counselling</p></div><button className="cx-link-button" onClick={()=>setSection("followups")}>Open tasks →</button></div>
       <div className="cx-attention"><div><span className="cx-attention-icon">!</span><strong>{overview.overdueTasks} overdue follow-ups</strong><small>Tasks past their scheduled date</small></div>
       <div><span className="cx-attention-icon blue">✓</span><strong>{overview.openTasks} open tasks</strong><small>Still awaiting completion</small></div>
       <div><span className="cx-attention-icon teal">▦</span><strong>{overview.scheduledAppointments} upcoming appointments</strong><small>Counselling, demo and trial sessions</small></div></div>
      </section>
     </div>
    </>}

    {section==="enquiries"&&<section className="cx-panel cx-panel-full">
     <div className="cx-panel-header cx-toolbar"><div><h2>Enquiry inbox</h2><p>{inquiries.length} recent enquiries loaded</p></div>
      <input className="cx-search" type="search" aria-label="Search enquiries" placeholder="Search names, sources or notes…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
     {matchingInquiries.length===0?<EmptyState title="No matching enquiries" description="Try another search or capture a new enquiry."/>:
      <div className="cx-table-wrap"><table className="cx-table"><thead><tr><th>Contact</th><th>Source</th><th>Interested in</th><th>Stage</th><th>Received</th><th></th></tr></thead>
       <tbody>{matchingInquiries.map(i=><tr key={i.id}>
        <td><span className="cx-cell-title">{i.contact_name||"Unknown contact"}</span><span className="cx-cell-secondary">{i.contact_detail||i.summary||"No contact detail"}</span></td>
        <td><span className="cx-pill">{shortLabel(i.source)}</span></td><td>{i.opportunity_title||"Qualification pending"}</td>
        <td><span className={"cx-status "+(i.outcome==="won"?"won":i.outcome==="lost"?"lost":"")}>{i.stage_name||"New enquiry"}</span></td>
        <td>{dateLabel(i.received_at)}</td>
        <td><button className="cx-link-button" onClick={()=>{setSelectedPerson(i.person_id);setSelectedOpportunity(i.opportunity_id);}}>View details →</button></td>
       </tr>)}</tbody></table></div>}
    </section>}

    {section==="contacts"&&<section className="cx-panel cx-panel-full">
     <div className="cx-panel-header cx-toolbar"><div><h2>Contacts</h2><p>{people.length} active contacts loaded</p></div>
      <input className="cx-search" type="search" placeholder="Search by name or contact detail…" aria-label="Search contacts" value={search} onChange={e=>setSearch(e.target.value)}/></div>
     {matchingPeople.length===0?<EmptyState title="No contacts found" description="Contacts are created when you capture enquiries."/>:
     <div className="cx-contact-grid">{matchingPeople.map(p=><button className="cx-contact-card" key={p.id} onClick={()=>setSelectedPerson(p.id)}>
      <span className="cx-avatar">{initials(p.full_name)}</span><span className="cx-contact-detail"><strong>{p.full_name}</strong><small>{p.contact_methods.map(m=>m.value).join(" · ")||"Contact details not added"}</small><span className="cx-tags">{p.roles.map(role=><em key={role}>{shortLabel(role)}</em>)}</span></span><span className="cx-arrow">↗</span>
     </button>)}</div>}
    </section>}

    {section==="pipeline"&&<div className="cx-pipeline-stack">
     {pipelines.length===0?<section className="cx-panel"><EmptyState title="Create your admissions pipeline" description="A pipeline is configured by institute managers. Start with stages such as New, Contacted, Trial, Won and Lost."/></section>:
     pipelines.map(p=><section key={p.id} className="cx-pipeline-section">
      <div className="cx-panel-header"><div><h2>{p.name}</h2><p>{p.stages.length} stages · {opportunities.filter(o=>o.pipeline_id===p.id).length} opportunities</p></div></div>
      <div className="cx-kanban">{[...p.stages].sort((a,b)=>a.order-b.order).map(stage=><div className="cx-kanban-column" key={stage.id}>
       <div className="cx-column-heading"><span className={"cx-stage-dot "+stage.outcome}/><strong>{stage.name}</strong><span>{opportunities.filter(o=>o.stage_id===stage.id).length}</span></div>
       {opportunities.filter(o=>o.stage_id===stage.id).map(o=><button key={o.id} className="cx-deal" onClick={()=>{setSelectedOpportunity(o.id);setSelectedPerson(o.contact_id);}}>
        <strong>{o.title}</strong><small>{people.find(x=>x.id===o.contact_id)?.full_name||"Institutional opportunity"}</small>
        <span className="cx-deal-foot"><span>{o.expected_value==null?"No value specified":o.currency+" "+o.expected_value.toLocaleString("en-IN")}</span><span>View →</span></span></button>)}
       {!opportunities.some(o=>o.stage_id===stage.id)&&<span className="cx-stage-empty">No opportunities</span>}
      </div>)}</div>
     </section>)}
    </div>}

    {section==="followups"&&<><ConnectReminderInbox tenantId={tenantId}/><section className="cx-panel cx-panel-full">
     <div className="cx-panel-header"><div><h2>Team follow-ups</h2><p>Prioritize overdue and open tasks</p></div></div>
     {!tasks.length?<EmptyState title="No follow-ups scheduled" description="Open a contact or opportunity to add a follow-up task."/>:
      <div className="cx-task-list">{[...tasks].sort((a,b)=>Number(a.status==="done")-Number(b.status==="done")).map(t=><div className="cx-task-row" key={t.id}>
       <span className={"cx-task-check "+(t.status==="done"?"checked":"")}>{t.status==="done"?"✓":"○"}</span>
       <div><strong>{t.title}</strong><small>{t.due_at?"Due "+dateLabel(t.due_at):"No due date set"}</small></div>
       <span className={"cx-status "+(t.status==="done"?"won":"")}>{shortLabel(t.status)}</span>
       {canWrite&&t.status==="open"&&<button className="cx-secondary" disabled={busy} onClick={()=>void run(()=>crmCommand(tenantId,"tasks","complete_task",{taskId:t.id}),"Follow-up completed.")}>Mark done</button>}
      </div>)}</div>}
    </section></>}

    {section==="calendar"&&<section className="cx-panel cx-panel-full">
     <div className="cx-panel-header"><div><h2>Counselling & trial appointments</h2><p>Scheduled, completed and cancelled sessions</p></div></div>
     {!appointments.length?<EmptyState title="No appointments yet" description="Open a contact to book counselling or a demo."/>:
      <div className="cx-task-list">{appointments.map(a=><div key={a.id} className="cx-task-row">
       <span className="cx-calendar-date">▦</span><div><strong>{a.title}</strong><small>{shortLabel(a.kind)} · {dateLabel(a.starts_at)} – {dateLabel(a.ends_at)}</small></div>
       <span className={"cx-status "+(a.status==="completed"?"won":"")}>{shortLabel(a.status)}</span>
       {canWrite&&a.status==="scheduled"&&<button className="cx-secondary" disabled={busy} onClick={()=>void run(()=>crmCommand(tenantId,"appointments","finish_appointment",{appointmentId:a.id,status:"completed"}),"Appointment completed.")}>Complete</button>}
      </div>)}</div>}
    </section>}

    {section==="communications"&&<ConnectConversationHistory tenantId={tenantId}/>}

    {section==="settings"&&<>
    <div className="cx-settings-grid">
     <section className="cx-panel"><div className="cx-panel-header"><div><h2>Institute access</h2><p>Who can manage this workspace</p></div></div>
      <dl className="cx-settings-list"><div><dt>Institute</dt><dd>{tenant?.workspace_name}</dd></div><div><dt>Workspace</dt><dd>{tenant?.slug}</dd></div><div><dt>Your role</dt><dd>{shortLabel(tenant?.membership_role||"")}</dd></div></dl>
      {canConfigure&&<button className="cx-secondary" onClick={()=>void connectFetch<{members:ConnectMember[]}>("/api/connect/workspaces/"+tenantId+"/members").then(r=>setMembers(r.members)).catch(e=>setError(e instanceof Error?e.message:"Could not load members."))}>View team members</button>}
      {members.length>0&&<div className="cx-member-list">{members.map(m=><div key={m.member_id}>{m.member_user_id.slice(0,8)}… <span>{shortLabel(m.member_role)} · {m.member_status}</span></div>)}</div>}
     </section>
     <section className="cx-panel"><div className="cx-panel-header"><div><h2>Programmes</h2><p>{programs.length} courses or services configured</p></div></div>
      <div className="cx-chip-row">{programs.map(p=><span className="cx-pill" key={p.id}>{p.name}</span>)}</div>
      {canConfigure&&<form className="cx-inline-form" onSubmit={e=>{e.preventDefault();void run(async()=>{await crmCommand(tenantId,"programs","create_program",{name:programName});setProgramName("");},"Programme created.");}}>
       <input required placeholder="New programme name" aria-label="Programme name" value={programName} onChange={e=>setProgramName(e.target.value)}/>
       <button disabled={busy} className="cx-secondary">Add</button></form>}
     </section>
     <section className="cx-panel"><div className="cx-panel-header"><div><h2>Admissions pipelines</h2><p>{pipelines.length} configured pipelines</p></div></div>
      <div className="cx-chip-row">{pipelines.map(p=><span className="cx-pill" key={p.id}>{p.name}</span>)}</div>
      {canConfigure&&<form className="cx-inline-form" onSubmit={e=>{e.preventDefault();void run(async()=>{
       await crmCommand(tenantId,"pipelines","bootstrap_pipeline",{name:pipelineName});
       setPipelineName("");
      },"Pipeline created with five default stages.");}}>
       <input required placeholder="New pipeline name" aria-label="Pipeline name" value={pipelineName} onChange={e=>setPipelineName(e.target.value)}/>
       <button disabled={busy} className="cx-secondary">Add</button></form>}
     </section>
    </div>
    <ConnectAutomationSettings tenantId={tenantId} canManage={["owner","admin"].includes(tenant?.membership_role||"")}/>
    {canConfigure&&<ChannelSettings tenantId={tenantId} canManage={["owner","admin"].includes(tenant?.membership_role||"")}/>}
    </>}
   </div>
  </div>

  {showContactForm&&<div className="cx-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowContactForm(false);}}><section className="cx-modal" role="dialog" aria-modal="true" aria-labelledby="cx-new-contact-title">
   <div className="cx-modal-header"><div><span className="cx-kicker">CONTACT DIRECTORY</span><h2 id="cx-new-contact-title">New contact</h2><p>Add a person without generating an enquiry.</p></div><button aria-label="Close new contact" onClick={()=>setShowContactForm(false)}>×</button></div>
   <form className="cx-form" onSubmit={createContact}>
    <label>Full name <span>*</span><input required autoFocus maxLength={150} value={newContact.name} onChange={e=>setNewContact(v=>({...v,name:e.target.value}))}/></label>
    <label>Relationship<select value={newContact.role} onChange={e=>setNewContact(v=>({...v,role:e.target.value}))}>
     {["contact","guardian","learner","customer","staff","other"].map(r=><option key={r} value={r}>{shortLabel(r)}</option>)}
    </select></label>
    <div className="cx-form-columns"><label>Phone<input type="tel" maxLength={35} value={newContact.phone} onChange={e=>setNewContact(v=>({...v,phone:e.target.value}))}/></label>
     <label>Email<input type="email" value={newContact.email} onChange={e=>setNewContact(v=>({...v,email:e.target.value}))}/></label></div>
    <div className="cx-form-actions"><button type="button" className="cx-secondary" onClick={()=>setShowContactForm(false)}>Cancel</button><button disabled={busy} className="cx-primary">Save contact</button></div>
   </form></section></div>}
  {showLeadForm&&<div className="cx-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowLeadForm(false);}}><section className="cx-modal" role="dialog" aria-modal="true" aria-labelledby="cx-new-lead-title">
   <div className="cx-modal-header"><div><span className="cx-kicker">QUICK CAPTURE</span><h2 id="cx-new-lead-title">New enquiry</h2><p>Capture the important details now. Qualify the lead later.</p></div><button aria-label="Close new enquiry" onClick={()=>setShowLeadForm(false)}>×</button></div>
   <form onSubmit={captureLead} className="cx-form"><label>Contact name <span>*</span><input required maxLength={150} autoFocus value={lead.name} readOnly={Boolean(lead.personId)}
     onChange={e=>setLead(v=>({...v,name:e.target.value,personId:""}))} placeholder="Parent or contact name"/></label>
    {!lead.personId&&lead.name.trim().length>=2&&people.filter(p=>p.full_name.toLowerCase().includes(lead.name.trim().toLowerCase())).slice(0,5).length>0&&
    <div className="cx-suggestions"><small>Existing contacts — select one to avoid duplicates</small>
     {people.filter(p=>p.full_name.toLowerCase().includes(lead.name.trim().toLowerCase())).slice(0,5).map(p=><button type="button" key={p.id}
      onClick={()=>setLead(v=>({...v,personId:p.id,name:p.full_name,email:p.contact_methods.find(m=>m.kind==="email")?.value||"",phone:p.contact_methods.find(m=>m.kind==="mobile")?.value||""}))}>
      {p.full_name}<span>{p.contact_methods.map(m=>m.value).join(" · ")||"Existing contact"}</span></button>)}
    </div>}
    {lead.personId&&<div className="cx-selected-contact"><span>Using existing contact — no duplicate will be created.</span>
      <button type="button" onClick={()=>setLead(v=>({...v,personId:""}))}>Change</button></div>}
    <div className="cx-form-columns"><label>Phone<input type="tel" maxLength={35} readOnly={Boolean(lead.personId)} value={lead.phone} onChange={e=>setLead(v=>({...v,phone:e.target.value}))} placeholder="+91 …"/></label>
    <label>Email<input type="email" readOnly={Boolean(lead.personId)} value={lead.email} onChange={e=>setLead(v=>({...v,email:e.target.value}))} placeholder="name@example.com"/></label></div>
    <label>Source <span>*</span><select value={lead.source} onChange={e=>setLead(v=>({...v,source:e.target.value}))}>
     {["whatsapp","phone","website","instagram","facebook","walk_in","referral","email","other"].map(x=><option key={x} value={x}>{shortLabel(x)}</option>)}
    </select></label>
    <label>Admissions pipeline <small>(optional)</small><select value={lead.pipelineId} onChange={e=>setLead(v=>({...v,pipelineId:e.target.value}))}>
     <option value="">Capture enquiry only</option>{pipelines.filter(p=>p.stages.some(s=>s.outcome==="open")).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
    </select></label>
    <label>Enquiry details<textarea rows={3} maxLength={2000} value={lead.summary} onChange={e=>setLead(v=>({...v,summary:e.target.value}))} placeholder="What programme are they interested in?"/></label>
    <div className="cx-form-actions"><button type="button" className="cx-secondary" onClick={()=>setShowLeadForm(false)}>Cancel</button><button className="cx-primary" disabled={busy}>{busy?"Saving…":"Save enquiry"}</button></div>
   </form></section></div>}

  {(selectedContact||selectedLead)&&<div className="cx-drawer-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget){setSelectedPerson(null);setSelectedOpportunity(null);}}}>
   <aside className="cx-drawer" role="dialog" aria-modal="true" aria-label="Lead details">
    <div className="cx-drawer-header"><span>360° LEAD WORKSPACE</span><button aria-label="Close details" onClick={()=>{setSelectedPerson(null);setSelectedOpportunity(null);}}>×</button></div>
    <div className="cx-drawer-body">
     {selectedContact&&<div className="cx-person-heading"><span className="cx-avatar large">{initials(selectedContact.full_name)}</span><div><h2>{selectedContact.full_name}</h2><p>{selectedContact.roles.map(shortLabel).join(" · ")||"Contact"}</p></div></div>}
     {selectedContact&&<section className="cx-detail-card"><h3>Contact details</h3>{selectedContact.contact_methods.length?
      selectedContact.contact_methods.map((m,i)=><div className="cx-detail-row" key={i}><span>{shortLabel(m.kind)}</span><strong>{m.value}</strong></div>):
      <p className="cx-muted">No contact methods recorded.</p>}</section>}
     {selectedLead&&<section className="cx-detail-card"><h3>Admission opportunity</h3><strong className="cx-detail-title">{selectedLead.title}</strong>
      <p className="cx-muted">Current stage: {selectedLead.stage_name} · Version {selectedLead.version}</p>
      {canWrite&&<label>Move to stage<select value={selectedLead.stage_id} disabled={busy} onChange={e=>void updateStage(selectedLead,e.target.value)}>
       {pipelines.find(p=>p.id===selectedLead.pipeline_id)?.stages.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
      </select></label>}
      {!canWrite&&<span className="cx-status">{selectedLead.stage_name}</span>}
      {canConfigure&&<label>Assigned counsellor
       <select value={selectedLead.owner_membership_id||""} disabled={busy||!assignees.length}
        onChange={e=>void updateAssignment(selectedLead,e.target.value)}>
        <option value="">Unassigned</option>
        {assignees.map(a=><option key={a.id} value={a.id}>{a.label} · {shortLabel(a.role)}</option>)}
       </select></label>}
     </section>}
     {selectedContact&&<section className="cx-detail-card"><h3>Recent enquiries</h3>
      {inquiries.filter(i=>i.person_id===selectedPerson).length?
       inquiries.filter(i=>i.person_id===selectedPerson).map(i=><div className="cx-detail-row" key={i.id}><span>{shortLabel(i.source)}</span><strong>{dateLabel(i.received_at)}</strong></div>):
       <p className="cx-muted">No linked enquiries loaded.</p>}</section>}
     {selectedContact&&opportunities.filter(o=>o.contact_id===selectedPerson).length>0&&<section className="cx-detail-card"><h3>Admissions</h3>
      {opportunities.filter(o=>o.contact_id===selectedPerson).map(o=><button className="cx-detail-link" key={o.id} onClick={()=>setSelectedOpportunity(o.id)}>{o.title} <span>{o.stage_name} →</span></button>)}</section>}
     {selectedLead&&<section className="cx-detail-card"><h3>Activity timeline</h3>
       {timeline.length?timeline.map(x=><div className="cx-history-item" key={x.id}><span>●</span><div><strong>{shortLabel(x.title||x.kind||x.type||"Activity")}</strong><small>{x.summary||"Stage updated"} · {dateLabel(x.event_time||x.occurred_at)}</small></div></div>):
       <p className="cx-muted">No activities loaded yet.</p>}</section>}
     {canWrite&&(selectedContact||selectedLead)&&<section className="cx-detail-card"><h3>Record a call or counselling note</h3>
      <form className="cx-form" onSubmit={saveNote}><label>Note<textarea required rows={3} maxLength={3000} placeholder="What was discussed and what happens next?"
       value={activityNote} onChange={e=>setActivityNote(e.target.value)}/></label>
       <button className="cx-secondary" disabled={busy||!activityNote.trim()}>Save note</button>
      </form></section>}
     {canWrite&&selectedContact&&pipelines.length>0&&<section className="cx-detail-card"><h3>Start a new admission</h3>
      <form className="cx-form" onSubmit={startAdmission}>
       <label>Admissions pipeline<select required value={newAdmissionPipeline} onChange={e=>setNewAdmissionPipeline(e.target.value)}><option value="">Choose a pipeline</option>
        {pipelines.filter(p=>p.stages.some(st=>st.outcome==="open")).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
       </select></label>
       <label>Admission title<input value={newAdmissionTitle} maxLength={200} onChange={e=>setNewAdmissionTitle(e.target.value)} placeholder="e.g. Python Beginner Course"/></label>
       <button className="cx-secondary" disabled={busy}>Start admission</button>
      </form></section>}
     {selectedContact&&<ConnectConversationHistory tenantId={tenantId} personId={selectedPerson} compact/>}
     {canWrite&&<section className="cx-detail-card"><h3>Schedule a follow-up</h3>
      <form className="cx-form" onSubmit={saveTask}><label>Next action<input required maxLength={250} value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} placeholder="Call to discuss programme"/></label>
       <label>Due at<input type="datetime-local" value={taskDue} onChange={e=>setTaskDue(e.target.value)}/></label><button className="cx-primary" disabled={busy}>Save follow-up</button></form></section>}
     {canWrite&&<section className="cx-detail-card"><h3>Book counselling / demo</h3>
      <form className="cx-form" onSubmit={saveAppointment}><label>Title<input required value={appointmentTitle} onChange={e=>setAppointmentTitle(e.target.value)} placeholder="Introductory counselling"/></label>
       <div className="cx-form-columns"><label>Starts<input required type="datetime-local" value={appointmentStarts} onChange={e=>setAppointmentStarts(e.target.value)}/></label>
       <label>Ends<input required type="datetime-local" value={appointmentEnds} onChange={e=>setAppointmentEnds(e.target.value)}/></label></div>
       <button className="cx-secondary" disabled={busy}>Schedule appointment</button></form></section>}
    </div>
   </aside>
  </div>}
 </main>;
}
