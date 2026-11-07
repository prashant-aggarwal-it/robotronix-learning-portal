"use client";
import {FormEvent,useCallback,useEffect,useMemo,useRef,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {getCurrentProfile} from "@/lib/repository";
import {connectFetch,crmCommand,crmList,
 type ConnectWorkspace,type ConnectPerson,type ConnectInquiry,type ConnectOpportunity,
 type ConnectPipeline,type ConnectTask,type ConnectAppointment,type ConnectOverview,
 type ConnectProgram,type ConnectMember} from "@/features/connect/api/client";
import {ChannelSettings} from "@/features/connect/components/ChannelSettings";
import {ConnectAutomationSettings} from "@/features/connect/components/ConnectAutomationSettings";
import {ConnectReminderInbox} from "@/features/connect/components/ConnectCommunications";
import {ConnectFollowupsBoard} from "@/features/connect/components/ConnectFollowupsBoard";
import {ConnectUnifiedInbox} from "@/features/connect/components/ConnectUnifiedInbox";
import {ConnectReports} from "@/features/connect/components/ConnectReports";
import {ConnectOverviewWidgets} from "@/features/connect/components/ConnectOverviewWidgets";
import {ContactProfile} from "@/features/connect/components/contact/ContactProfile";
import {ContactTimeline} from "@/features/connect/components/contact/ContactTimeline";
import {ContactRelationships} from "@/features/connect/components/contact/ContactRelationships";
import {WorkspaceIntelligence} from "@/features/connect/components/contact/ContactIntelligence";
import {EnquirySettings,readEnquiryPreferences} from "@/features/connect/components/EnquirySettings";
import type {EnquiryPreferences} from "@/features/connect/types/enquiries";
import {navigation,emptyOverview,dateLabel,initials,shortLabel,suggestEnquiryCategory,type Section} from "@/features/connect/model";
import {ErrorMessage,EmptyState} from "@/features/connect/EmptyStates";
import {ConnectSidebar} from "@/features/connect/ConnectSidebar";
import {ConnectTopbar} from "@/features/connect/ConnectTopbar";
import {ConnectSignInGate,ConnectNoWorkspaceGate} from "@/features/connect/ConnectAuthGates";

export default function ConnectPage(){
 const [signedIn,setSignedIn]=useState<boolean|null>(null);
 const [canOpenPortal,setCanOpenPortal]=useState(false);
 const [accountEmail,setAccountEmail]=useState("");
 const [workspaces,setWorkspaces]=useState<ConnectWorkspace[]>([]);
 const [workspacesReady,setWorkspacesReady]=useState(false);
 const [tenantId,setTenantId]=useState("");
 const [section,setSection]=useState<Section>("overview");
 const [enquiryPrefs,setEnquiryPrefs]=useState<EnquiryPreferences|null>(null);
 const [categoryFilter,setCategoryFilter]=useState("");
 const [enquirySourceFilter,setEnquirySourceFilter]=useState("all");
 const [enquiryView,setEnquiryView]=useState<"all"|"unclassified"|"linked">("all");
 const [enquirySort,setEnquirySort]=useState<"latest"|"oldest">("latest");
 const [leadCategory,setLeadCategory]=useState("");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(false);
 const requestGeneration=useRef(0);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [refreshCount,setRefreshCount]=useState(0);
 const [search,setSearch]=useState("");
 const [contactView,setContactView]=useState<"all"|"with_details"|"missing_details">("all");
 const [contactRole,setContactRole]=useState("all");
 const [contactSort,setContactSort]=useState<"name"|"newest">("name");
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

 useEffect(()=>{
  if(!signedIn){setCanOpenPortal(false);return;}
  let active=true;
  void getCurrentProfile().then(profile=>{if(active)setCanOpenPortal(profile?.role==="admin");}).catch(()=>{if(active)setCanOpenPortal(false);});
  return()=>{active=false;};
 },[signedIn]);

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
  setLoading(Boolean(tenantId&&signedIn));setError("");
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

 const tenant=workspaces.find(x=>x.tenant_id===tenantId);
 const canConfigure=["owner","admin","manager"].includes(tenant?.membership_role||"");
 const canWrite=Boolean(tenant&&tenant.membership_role!=="viewer");
 const advanced=enquiryPrefs?.mode==="advanced";
 const visibleNavigation=navigation.filter(n=>advanced||["overview","enquiries","contacts","followups","communications","settings"].includes(n.id));
 useEffect(()=>{let live=true;setEnquiryPrefs(null);setCategoryFilter("");setLeadCategory("");if(tenantId)void readEnquiryPreferences(tenantId).then(p=>{if(live)setEnquiryPrefs(p);}).catch(e=>{if(live)setError(e instanceof Error?e.message:"Unable to load enquiry preferences");});return()=>{live=false;};},[tenantId]);
 useEffect(()=>{if(!advanced&&!["overview","enquiries","contacts","followups","communications","settings"].includes(section))setSection("overview");},[advanced,section]);
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
 async function captureLead(e:FormEvent){
  e.preventDefault();
  const pipeline=pipelines.find(x=>x.id===lead.pipelineId);
  const stage=pipeline?.stages.filter(s=>s.outcome==="open").sort((a,b)=>a.order-b.order)[0];
  await run(async()=>{
   await crmCommand(tenantId,"inquiries","capture_lead",{
    name:lead.name,phone:lead.phone,email:lead.email,source:lead.source,
    ...(lead.personId?{personId:lead.personId}:{}),
    summary:lead.summary,...(leadCategory?{categoryId:leadCategory}:{}),...(pipeline&&stage?{pipelineId:pipeline.id,stageId:stage.id}:{})
   });
   setLead({name:"",phone:"",email:"",source:"whatsapp",summary:"",pipelineId:"",personId:""});setLeadCategory("");setShowLeadForm(false);
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
 const matchingInquiries=useMemo(()=>inquiries.filter(i=>{
  if(categoryFilter&&i.category_id!==categoryFilter)return false;
  if(enquirySourceFilter!=="all"&&i.source.toLowerCase()!==enquirySourceFilter)return false;
  if(enquiryView==="unclassified"&&i.category_id)return false;
  if(enquiryView==="linked"&&!i.opportunity_id)return false;
  const q=search.trim().toLowerCase();
  return !q||[i.contact_name,i.summary,i.source,i.stage_name,i.category_label,i.contact_detail].some(v=>(v||"").toLowerCase().includes(q));
 }).sort((a,b)=>enquirySort==="latest"?Date.parse(b.received_at)-Date.parse(a.received_at):Date.parse(a.received_at)-Date.parse(b.received_at)),
 [inquiries,search,categoryFilter,enquirySourceFilter,enquiryView,enquirySort]);
 const unclassifiedCount=inquiries.filter(i=>!i.category_id).length;
 const linkedCount=inquiries.filter(i=>Boolean(i.opportunity_id)).length;
 const enquirySources=[...new Set(inquiries.map(i=>i.source.toLowerCase()))].sort();

 const enquiryByPerson=useMemo(()=>{
  const result=new Map<string,{count:number;summary:string;source:string;date:string}>();
  for(const item of [...inquiries].sort((a,b)=>Date.parse(b.received_at)-Date.parse(a.received_at))){
   if(!item.person_id)continue;
   const old=result.get(item.person_id);
   if(old){old.count+=1;}else{
    result.set(item.person_id,{count:1,summary:item.summary||"Enquiry received",source:item.source,date:item.received_at});
   }
  }
  return result;
 },[inquiries]);
 const contactsWithDetails=people.filter(p=>p.contact_methods.some(m=>m.value.trim())).length;
 const contactsMissingDetails=people.length-contactsWithDetails;
 const contactRoles=[...new Set(people.flatMap(p=>p.roles))].sort();
 const matchingPeople=useMemo(()=>people.filter(p=>{
  const hasDetails=p.contact_methods.some(m=>m.value.trim());
  if(contactView==="with_details"&&!hasDetails)return false;
  if(contactView==="missing_details"&&hasDetails)return false;
  if(contactRole!=="all"&&!p.roles.includes(contactRole))return false;
  const q=search.trim().toLowerCase();
  const lastEnquiry=enquiryByPerson.get(p.id);
  return !q||[p.full_name,...p.contact_methods.map(m=>m.value),...p.roles,lastEnquiry?.summary,lastEnquiry?.source].some(v=>(v||"").toLowerCase().includes(q));
 }).sort((a,b)=>contactSort==="newest"?Date.parse(b.created_at)-Date.parse(a.created_at)||a.full_name.localeCompare(b.full_name):a.full_name.localeCompare(b.full_name)),
 [people,search,contactView,contactRole,contactSort,enquiryByPerson]);

 if(signedIn===null)return <main className="cx-gate">Checking your Connect session…</main>;
 if(!signedIn)return <ConnectSignInGate error={error} busy={busy} email={loginEmail} password={loginPassword} onEmailChange={setLoginEmail} onPasswordChange={setLoginPassword} onSubmit={signIn}/>;
 if(!workspacesReady)return <main className="cx-gate">Loading your Connect workspace…</main>;
 if(!workspaces.length)return <ConnectNoWorkspaceGate error={error} onRetry={()=>{setWorkspacesReady(false);void loadWorkspaces().catch(e=>{setError(e instanceof Error?e.message:"Unable to check workspace access.");setWorkspacesReady(true);});}} onSignOut={()=>{setSignedIn(false);void getSupabaseBrowserClient()?.auth.signOut();}}/>;
 
  return <main className="cx-app">
  <ConnectSidebar showMobileNav={showMobileNav} onToggleMobile={()=>setShowMobileNav(v=>!v)} canOpenPortal={canOpenPortal} tenantId={tenantId} tenantRole={tenant?.membership_role||"member"} workspaces={workspaces} accountEmail={accountEmail} section={section} visibleNavigation={visibleNavigation} onWorkspaceChange={value=>{setTenantId(value);setSelectedPerson(null);setSelectedOpportunity(null);}} onSectionChange={value=>{setSection(value);setSearch("");setSelectedPerson(null);setSelectedOpportunity(null);setShowMobileNav(false);}}/>
  <div className="cx-main">
   <ConnectTopbar section={section} loading={loading} canOpenPortal={canOpenPortal} onRefresh={()=>setRefreshCount(v=>v+1)}/>
   <div className="cx-content">
    <ErrorMessage error={error}/>
    {notice&&<div className="cx-success" role="status">{notice}<button onClick={()=>setNotice("")} aria-label="Dismiss notice">×</button></div>}
    {section!=="communications"&&<div className="cx-page-heading"><div><span className="cx-kicker">{tenant?.workspace_name}</span>
     <h1>{section==="overview"?"Business overview":navigation.find(n=>n.id===section)?.label}</h1>
     <p>{section==="overview"?"Stay on top of every enquiry, follow-up and admission.":
     section==="enquiries"?"Capture, qualify and respond to every incoming enquiry.":
     section==="contacts"?"One place for people, families and their relationships.":
     section==="pipeline"?"Track every admission from first conversation to enrolment.":
     section==="followups"?"Your team's calls, tasks and next actions.":
     section==="calendar"?"Counselling, demo and trial appointments.":
     section==="reports"?"Track conversion, counsellor performance and real recorded marketing ROI.":"Manage institute programmes and access."}</p></div>
     {(section==="overview"||section==="enquiries")&&canWrite&&<button className="cx-primary" onClick={()=>setShowLeadForm(true)}>＋ New enquiry</button>}
     {section==="contacts"&&canWrite&&<button className="cx-primary" onClick={()=>setShowContactForm(true)}>＋ New contact</button>}
    </div>}

    {section==="overview"&&<>
     <ConnectOverviewWidgets overview={overview} inquiries={inquiries} opportunities={opportunities} tasks={tasks} advanced={advanced} onNavigate={setSection}
      onSelectSource={source=>{setEnquirySourceFilter(source.toLowerCase());setCategoryFilter("");setEnquiryView("all");setSearch("");setSection("enquiries");}}/>
     <WorkspaceIntelligence tenantId={tenantId} refreshKey={refreshCount} onViewAll={()=>{setSearch("");setSection("contacts");}} onOpenContact={personId=>{const generation=requestGeneration.current;void (async()=>{
      try{
       if(!people.some(contact=>contact.id===personId)){
        const response=await crmList<ConnectPerson>(tenantId,"people",{id:personId,limit:"1"});
        if(requestGeneration.current!==generation)return;
        if(!response.items.length){setError("Contact is not available in this workspace.");return;}
        setPeople(current=>current.some(contact=>contact.id===personId)?current:[...current,response.items[0]]);
       }
       if(requestGeneration.current!==generation)return;
       setSection("contacts");setSelectedPerson(personId);setSelectedOpportunity(null);
      }catch(e){if(requestGeneration.current===generation)setError(e instanceof Error?e.message:"Unable to open contact.");}
     })();}}/>
    </>}

    {section==="enquiries"&&<section className="cx-panel cx-panel-full cx-enquiry-workspace">
     <div className="cx-enquiry-heading">
      <div><h2>Enquiry inbox</h2><p>{inquiries.length} recent enquiries loaded · Classify and move qualified leads forward</p></div>
      <div className="cx-enquiry-summary">
       <span><strong>{inquiries.length}</strong> Total</span>
       <button type="button" className={enquiryView==="unclassified"?"is-active":""} onClick={()=>setEnquiryView(enquiryView==="unclassified"?"all":"unclassified")}><strong>{unclassifiedCount}</strong> Unclassified</button>
       <button type="button" className={enquiryView==="linked"?"is-active":""} onClick={()=>setEnquiryView(enquiryView==="linked"?"all":"linked")}><strong>{linkedCount}</strong> Linked to admissions</button>
      </div>
     </div>
     <div className="cx-enquiry-toolbar">
      <label className="cx-enquiry-search"><span className="cx-sr-only">Search enquiries</span>
       <input type="search" aria-label="Search enquiries" placeholder="Search name, message or source…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
      <label><span className="cx-sr-only">Filter enquiry source</span><select aria-label="Filter enquiry source" value={enquirySourceFilter} onChange={e=>setEnquirySourceFilter(e.target.value)}>
       <option value="all">All channels</option>{enquirySources.map(source=><option key={source} value={source}>{shortLabel(source)}</option>)}
      </select></label>
      <label><span className="cx-sr-only">Filter enquiry category</span><select aria-label="Filter enquiry category" value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}>
       <option value="">All categories</option>{enquiryPrefs?.categories.filter(c=>c.active||c.id===categoryFilter).map(c=><option value={c.id} key={c.id}>{c.label}</option>)}
      </select></label>
      <label><span className="cx-sr-only">Sort enquiries</span><select aria-label="Sort enquiries" value={enquirySort} onChange={e=>setEnquirySort(e.target.value==="oldest"?"oldest":"latest")}>
       <option value="latest">Newest first</option><option value="oldest">Oldest first</option>
      </select></label>
      {(search||categoryFilter||enquirySourceFilter!=="all"||enquiryView!=="all"||enquirySort!=="latest")&&<button type="button" className="cx-enquiry-clear" onClick={()=>{setSearch("");setCategoryFilter("");setEnquirySourceFilter("all");setEnquiryView("all");setEnquirySort("latest");}}>Clear filters</button>}
     </div>
     <div className="cx-enquiry-result-count" role="status">{matchingInquiries.length} of {inquiries.length} enquiries shown{enquiryView==="unclassified"?" · Unclassified only":enquiryView==="linked"?" · Linked to admissions":""}</div>
     {matchingInquiries.length===0?<EmptyState title="No matching enquiries" description="Try changing the search or filters, or capture a new enquiry."/>:
      <div className="cx-table-wrap cx-enquiry-table-scroll"><table className="cx-table cx-enquiry-table">
       <thead><tr><th scope="col">Customer &amp; enquiry</th><th scope="col">Channel</th><th scope="col">Classification</th><th scope="col">Progress</th><th scope="col">Received</th><th scope="col"><span className="cx-sr-only">Actions</span></th></tr></thead>
       <tbody>{matchingInquiries.map(i=>{
        const suggestion=!i.category_id&&canWrite?suggestEnquiryCategory(i.summary||"",enquiryPrefs?.categories||[]):null;
        return <tr key={i.id}>
         <td><div className="cx-enquiry-person"><span className="cx-avatar" aria-hidden="true">{initials(i.contact_name||"Lead")}</span><span><strong className="cx-cell-title">{i.contact_name||"New enquiry"}</strong><small className="cx-cell-secondary">{i.summary||i.contact_detail||"No enquiry description"}</small></span></div></td>
         <td><span className="cx-pill">{shortLabel(i.source)}</span></td>
         <td><div className="cx-enquiry-category">
          {suggestion&&<button type="button" className="cx-category-suggestion" disabled={busy} title={"Apply suggested category: "+suggestion.label} onClick={()=>void run(()=>connectFetch("/api/connect/workspaces/"+tenantId+"/enquiry-preferences",{method:"PATCH",body:JSON.stringify({action:"classify_inquiry",data:{inquiryId:i.id,categoryId:suggestion.id}})}),"Suggested category applied.")}>Suggested: {suggestion.label} · Apply</button>}
          <select aria-label={"Category for "+(i.contact_name||"enquiry")} disabled={!canWrite||busy} value={i.category_id||""} onChange={e=>{const categoryId=e.target.value;if(!categoryId)return;void run(()=>connectFetch("/api/connect/workspaces/"+tenantId+"/enquiry-preferences",{method:"PATCH",body:JSON.stringify({action:"classify_inquiry",data:{inquiryId:i.id,categoryId}})}),"Enquiry categorized.");}}>
           <option value="">Unclassified</option>{enquiryPrefs?.categories.filter(c=>c.active||c.id===i.category_id).map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
          </select></div></td>
         <td><div className="cx-enquiry-progress"><span className={"cx-status "+(i.outcome==="won"?"won":i.outcome==="lost"?"lost":"")}>{i.stage_name||"New enquiry"}</span>{i.opportunity_title&&<small title={i.opportunity_title}>{i.opportunity_title}</small>}</div></td>
         <td><time className="cx-enquiry-date" dateTime={i.received_at}>{dateLabel(i.received_at)}</time></td>
         <td><button type="button" className="cx-link-button cx-enquiry-view" aria-label={"View details for "+(i.contact_name||"enquiry")} onClick={()=>{setSelectedPerson(i.person_id);setSelectedOpportunity(i.opportunity_id);}}>View details →</button></td>
        </tr>;
       })}</tbody>
      </table></div>}
    </section>}

    {section==="contacts"&&<section className="cx-panel cx-contacts-directory">
     <header className="cx-contacts-directory-head">
      <div><h2>Contact directory</h2><p>Search customers, review enquiry history and open Contact 360</p></div>
      <div className="cx-contacts-totals" aria-label="Contact summary">
       <span><strong>{people.length}</strong> Loaded</span>
       <button type="button" className={contactView==="with_details"?"active":""} aria-pressed={contactView==="with_details"} onClick={()=>setContactView(contactView==="with_details"?"all":"with_details")}><strong>{contactsWithDetails}</strong> With details</button>
       <button type="button" className={contactView==="missing_details"?"active":""} aria-pressed={contactView==="missing_details"} onClick={()=>setContactView(contactView==="missing_details"?"all":"missing_details")}><strong>{contactsMissingDetails}</strong> Missing details</button>
      </div>
     </header>
     <div className="cx-contacts-directory-controls">
      <label className="cx-contacts-search"><span className="cx-sr-only">Search contacts</span><input type="search" aria-label="Search contacts" placeholder="Search name, contact info or enquiry…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
      <label><span className="cx-sr-only">Contact role</span><select aria-label="Filter contact role" value={contactRole} onChange={e=>setContactRole(e.target.value)}><option value="all">All roles</option>{contactRoles.map(role=><option key={role} value={role}>{shortLabel(role)}</option>)}</select></label>
      <label><span className="cx-sr-only">Sort contacts</span><select aria-label="Sort contacts" value={contactSort} onChange={e=>setContactSort(e.target.value==="newest"?"newest":"name")}><option value="name">Name A–Z</option><option value="newest">Recently added</option></select></label>
      {(search||contactRole!=="all"||contactSort!=="name"||contactView!=="all")&&<button type="button" className="cx-contacts-clear" onClick={()=>{setSearch("");setContactRole("all");setContactView("all");setContactSort("name");}}>Clear filters</button>}
     </div>
     <div className="cx-contacts-directory-count" role="status">{matchingPeople.length} of {people.length} loaded contacts shown</div>
     {matchingPeople.length===0?<EmptyState title="No matching contacts" description={people.length?"Try changing the search or filters.":"New contacts will appear here when they are created or linked to an enquiry."}/>:
      <div className="cx-contacts-directory-list">
       <div className="cx-contacts-directory-columns" aria-hidden="true"><span>Contact</span><span>Latest enquiry</span><span>Contact information</span><span> </span></div>
       {matchingPeople.map(p=>{
        const latest=enquiryByPerson.get(p.id);
        const primary=p.contact_methods.find(m=>m.primary&&m.value.trim())||p.contact_methods.find(m=>m.value.trim());
        return <button type="button" className="cx-contacts-directory-row" key={p.id} onClick={()=>{setSelectedOpportunity(null);setSelectedPerson(p.id);}} aria-label={"Open contact profile for "+p.full_name}>
         <span className="cx-contacts-person"><span className="cx-avatar" aria-hidden="true">{initials(p.full_name)}</span><span className="cx-contacts-person-details"><strong>{p.full_name}</strong><small>{p.roles.length?p.roles.map(shortLabel).join(" · "):"Contact"}</small></span></span>
         <span className="cx-contacts-enquiry">{latest?<><span title={latest.summary}>{latest.summary}</span><small>{shortLabel(latest.source)} · {latest.count} {latest.count===1?"enquiry":"enquiries"} in loaded records</small></>:<small>No enquiries in loaded records</small>}</span>
         <span className="cx-contacts-method">{primary?<><span title={primary.value}>{primary.value}</span><small>{shortLabel(primary.kind)}</small></>:<span className="cx-contacts-missing">Contact details needed</span>}</span>
         <span className="cx-contacts-open" aria-hidden="true">View ↗</span>
        </button>;
       })}
      </div>}
    </section>}

    {section==="pipeline"&&<div className="cx-pipeline-stack">
     {pipelines.length===0?<section className="cx-panel">
      <EmptyState title="Set up your first admissions pipeline" description="Track every opportunity from initial enquiry to enrolment. Start with a ready-made five-stage pipeline."/>
      {canConfigure?<form className="cx-inline-form" aria-label="Create admissions pipeline" style={{maxWidth:520,margin:"0 auto 22px",display:"flex",flexWrap:"wrap",justifyContent:"center",gap:10}} onSubmit={e=>{e.preventDefault();const name=pipelineName.trim()||"Student Admissions";void run(async()=>{
       await crmCommand(tenantId,"pipelines","bootstrap_pipeline",{name});
       setPipelineName("");
      },"Admissions pipeline created. You can now add and track opportunities.");}}>
       <label htmlFor="cx-pipeline-quick-name" style={{width:"100%",textAlign:"center",fontWeight:600,fontSize:13}}>Pipeline name</label>
       <input id="cx-pipeline-quick-name" style={{flex:"1 1 230px",minWidth:0}} value={pipelineName} maxLength={100} onChange={e=>setPipelineName(e.target.value)} placeholder="Student Admissions"/>
       <button type="submit" className="cx-primary" disabled={busy}>{busy?"Creating…":"Create pipeline"}</button>
       <small style={{flexBasis:"100%",textAlign:"center",color:"#657e92"}}>Default stages: New → Contacted → Trial → Won / Lost. You can manage additional pipelines in Institute settings.</small>
      </form>:<p style={{textAlign:"center",margin:"0 0 24px",color:"#657e92",fontSize:13}}>Ask your workspace owner, admin or manager to create the first pipeline.</p>}
     </section>:
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

    {section==="followups"&&<div className="cx-followups-workspace">
     <ConnectFollowupsBoard tasks={tasks} people={people} opportunities={opportunities} canWrite={canWrite} busy={busy}
      onComplete={taskId=>void run(()=>crmCommand(tenantId,"tasks","complete_task",{taskId}),"Follow-up completed.")}
      onOpenContact={personId=>{setSelectedOpportunity(null);setSelectedPerson(personId);}}
      onOpenOpportunity={(personId,opportunityId)=>{setSelectedPerson(personId);setSelectedOpportunity(opportunityId);}}/>
     <details className="cx-followups-reminders">
      <summary>My reminder notifications <span>Alerts from the reminder scheduler</span></summary>
      <ConnectReminderInbox key={tenantId} tenantId={tenantId}/>
     </details>
    </div>}

    {section==="calendar"&&<section className="cx-panel cx-panel-full">
     <div className="cx-panel-header"><div><h2>Counselling & trial appointments</h2><p>Scheduled, completed and cancelled sessions</p></div></div>
     {!appointments.length?<EmptyState title="No appointments yet" description="Open a contact to book counselling or a demo."/>:
      <div className="cx-task-list">{appointments.map(a=><div key={a.id} className="cx-task-row">
       <span className="cx-calendar-date">▦</span><div><strong>{a.title}</strong><small>{shortLabel(a.kind)} · {dateLabel(a.starts_at)} – {dateLabel(a.ends_at)}</small></div>
       <span className={"cx-status "+(a.status==="completed"?"won":"")}>{shortLabel(a.status)}</span>
       {canWrite&&a.status==="scheduled"&&<button className="cx-secondary" disabled={busy} onClick={()=>void run(()=>crmCommand(tenantId,"appointments","finish_appointment",{appointmentId:a.id,status:"completed"}),"Appointment completed.")}>Complete</button>}
      </div>)}</div>}
    </section>}

    {section==="communications"&&<ConnectUnifiedInbox key={tenantId} tenantId={tenantId} canWrite={canWrite} onOpenContact={personId=>{void (async()=>{try{if(!people.some(person=>person.id===personId)){const result=await crmList<ConnectPerson>(tenantId,"people",{id:personId,limit:"1"});if(!result.items.length){setError("Contact is no longer available.");return;}setPeople(current=>current.some(person=>person.id===personId)?current:[...current,result.items[0]]);}setSection("contacts");setSelectedOpportunity(null);setSelectedPerson(personId);}catch(e){setError(e instanceof Error?e.message:"Could not open linked CRM contact.");}})();}}/>}

    {section==="reports"&&(canConfigure?<ConnectReports key={tenantId} tenantId={tenantId}/>:
     <section className="cx-panel"><div className="cx-empty"><strong>Reporting access restricted</strong><p>Ask your institute manager for access.</p></div></section>)}

    {section==="settings"&&<>
    <EnquirySettings key={tenantId} tenantId={tenantId} canManage={["owner","admin"].includes(tenant?.membership_role||"")} onSaved={setEnquiryPrefs}/>
    {advanced&&<div className="cx-settings-grid">
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
    </div>}
    {advanced&&<ConnectAutomationSettings key={tenantId} tenantId={tenantId} canManage={["owner","admin"].includes(tenant?.membership_role||"")}/>}
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
    <label>Enquiry category<select value={leadCategory} onChange={e=>setLeadCategory(e.target.value)}><option value="">Unclassified — decide later</option>{enquiryPrefs?.categories.filter(c=>c.active).map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
    <label>Admissions pipeline <small>(optional)</small><select value={lead.pipelineId} onChange={e=>setLead(v=>({...v,pipelineId:e.target.value}))}>
     <option value="">Capture enquiry only</option>{pipelines.filter(p=>p.stages.some(s=>s.outcome==="open")).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
    </select></label>
    <label>Enquiry details<textarea rows={3} maxLength={2000} value={lead.summary} onChange={e=>setLead(v=>({...v,summary:e.target.value}))} placeholder="What programme are they interested in?"/></label>
    <div className="cx-form-actions"><button type="button" className="cx-secondary" onClick={()=>setShowLeadForm(false)}>Cancel</button><button className="cx-primary" disabled={busy}>{busy?"Saving…":"Save enquiry"}</button></div>
   </form></section></div>}

  {(selectedContact||selectedLead)&&<div className="cx-drawer-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget){setSelectedPerson(null);setSelectedOpportunity(null);}}}>
   <aside className="cx-drawer" role="dialog" aria-modal="true" aria-label="Contact 360 profile">
    <div className="cx-drawer-header"><span>CONTACT WORKSPACE</span><button aria-label="Close details" onClick={()=>{setSelectedPerson(null);setSelectedOpportunity(null);}}>×</button></div>
    <div className="cx-drawer-body">
     <ContactProfile person={selectedContact} opportunity={selectedLead} tenantId={tenantId} refreshKey={refreshCount} inquiries={inquiries} opportunities={opportunities} tasks={tasks} appointments={appointments} canWrite={canWrite} onCreateEnquiry={()=>{if(!selectedContact)return;setLead({name:selectedContact.full_name,phone:selectedContact.contact_methods.find(m=>["phone","mobile"].includes(m.kind.toLowerCase()))?.value||"",email:selectedContact.contact_methods.find(m=>m.kind.toLowerCase()==="email")?.value||"",source:"phone",summary:"",pipelineId:"",personId:selectedContact.id});setSelectedPerson(null);setSelectedOpportunity(null);setShowLeadForm(true);}} onClose={()=>{setSelectedPerson(null);setSelectedOpportunity(null);}}
      overviewContent={<>{selectedLead&&<section className="cx-detail-card"><h3>Admission opportunity</h3><strong className="cx-detail-title">{selectedLead.title}</strong>
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
{selectedContact&&opportunities.filter(o=>o.contact_id===selectedPerson).length>0&&<section className="cx-detail-card"><h3>Admissions</h3>
      {opportunities.filter(o=>o.contact_id===selectedPerson).map(o=><button className="cx-detail-link" key={o.id} onClick={()=>setSelectedOpportunity(o.id)}>{o.title} <span>{o.stage_name} →</span></button>)}</section>}</>}
      enquiriesContent={<>{selectedContact&&<section className="cx-detail-card"><h3>Recent enquiries</h3>
      {inquiries.filter(i=>i.person_id===selectedPerson).length?
       inquiries.filter(i=>i.person_id===selectedPerson).map(i=><div className="cx-detail-row" key={i.id}><span>{shortLabel(i.source)}</span><strong>{dateLabel(i.received_at)}</strong></div>):
       <p className="cx-muted">No linked enquiries loaded.</p>}</section>}</>}
      timelineContent={<>{(selectedContact?.id||selectedLead?.contact_id)&&<ContactTimeline key={tenantId+"-"+(selectedContact?.id||selectedLead?.contact_id)} tenantId={tenantId} personId={(selectedContact?.id||selectedLead?.contact_id)!} refreshKey={refreshCount}/>}
{canWrite&&(selectedContact||selectedLead)&&<section className="cx-detail-card"><h3>Record a call or counselling note</h3>
      <form className="cx-form" onSubmit={saveNote}><label>Note<textarea required rows={3} maxLength={3000} placeholder="What was discussed and what happens next?"
       value={activityNote} onChange={e=>setActivityNote(e.target.value)}/></label>
       <button className="cx-secondary" disabled={busy||!activityNote.trim()}>Save note</button>
      </form></section>}
</>}
      followupsContent={<>{canWrite&&<section className="cx-detail-card"><h3>Schedule a follow-up</h3>
      <form className="cx-form" onSubmit={saveTask}><label>Next action<input required maxLength={250} value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} placeholder="Call to discuss programme"/></label>
       <label>Due at<input type="datetime-local" value={taskDue} onChange={e=>setTaskDue(e.target.value)}/></label><button className="cx-primary" disabled={busy}>Save follow-up</button></form></section>}
{canWrite&&<section className="cx-detail-card"><h3>Book counselling / demo</h3>
      <form className="cx-form" onSubmit={saveAppointment}><label>Title<input required value={appointmentTitle} onChange={e=>setAppointmentTitle(e.target.value)} placeholder="Introductory counselling"/></label>
       <div className="cx-form-columns"><label>Starts<input required type="datetime-local" value={appointmentStarts} onChange={e=>setAppointmentStarts(e.target.value)}/></label>
       <label>Ends<input required type="datetime-local" value={appointmentEnds} onChange={e=>setAppointmentEnds(e.target.value)}/></label></div>
       <button className="cx-secondary" disabled={busy}>Schedule appointment</button></form></section>}</>}
      relationsContent={<>{selectedContact&&<ContactRelationships key={tenantId+"-"+selectedContact.id} tenantId={tenantId} personId={selectedContact.id} canWrite={canWrite} canManage={["owner","admin","manager"].includes(tenant?.membership_role||"")}/>}</>}
      detailsContent={<>{selectedContact&&<section className="cx-detail-card"><h3>Contact details</h3>{selectedContact.contact_methods.length?
      selectedContact.contact_methods.map((m,i)=><div className="cx-detail-row" key={i}><span>{shortLabel(m.kind)}</span><strong>{m.value}</strong></div>):
      <p className="cx-muted">No contact methods recorded.</p>}</section>}
{canWrite&&selectedContact&&pipelines.length>0&&<section className="cx-detail-card"><h3>Start a new admission</h3>
      <form className="cx-form" onSubmit={startAdmission}>
       <label>Admissions pipeline<select required value={newAdmissionPipeline} onChange={e=>setNewAdmissionPipeline(e.target.value)}><option value="">Choose a pipeline</option>
        {pipelines.filter(p=>p.stages.some(st=>st.outcome==="open")).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
       </select></label>
       <label>Admission title<input value={newAdmissionTitle} maxLength={200} onChange={e=>setNewAdmissionTitle(e.target.value)} placeholder="e.g. Python Beginner Course"/></label>
       <button className="cx-secondary" disabled={busy}>Start admission</button>
      </form></section>}</>}
     />
    </div>
   </aside>
  </div>}
 </main>;
}
