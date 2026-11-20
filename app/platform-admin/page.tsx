"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {SignOutButton} from "@/components/SignOutButton";
import "./platform-admin.css";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import PlatformCustomerActions from "./PlatformCustomerActions";
import PlatformSubscriptions from "./PlatformSubscriptions";
import PlatformSystemHealth from "./PlatformSystemHealth";
import PlatformTenantBranding from "./PlatformTenantBranding";
import PlatformBrandingEntitlements from "./PlatformBrandingEntitlements";
type Org={id:string;slug:string;display_name:string;status:string;created_at:string};
type Ops={subscriptions:{organization_id:string;organization_name:string|null;plan_code:string;status:string;ends_at:string|null}[];metrics:{expiringTrials:number;expiredTrials:number;pendingInvitations:number;expiredInvitations:number;pastDueSubscriptions:number};alerts:{type:string;organizationId?:string;organizationName?:string;expiresAt:string}[];truncated:boolean};
type Overview={organizations:Org[];page:number;total:number;metrics:{organizations:number;trials:number;activeSubscriptions:number}};
export default function PlatformAdminPage(){
 const [overview,setOverview]=useState<Overview|null>(null);
 const [operations,setOperations]=useState<Ops|null>(null);
 const [operationsError,setOperationsError]=useState("");
 const [search,setSearch]=useState("");
 const [page,setPage]=useState(1);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [refresh,setRefresh]=useState(0);
 const [activeSection,setActiveSection]=useState("overview");
 const [selectedCustomerId,setSelectedCustomerId]=useState("");
 useEffect(()=>{
  const sync=()=>{
   const id=window.location.hash.slice(1);
   setActiveSection(["overview","customers","subscriptions","branding","onboarding","directory","system-health"].includes(id)?id:"overview");
   window.scrollTo({top:0,behavior:"instant"});
  };
  sync();window.addEventListener("hashchange",sync);window.addEventListener("popstate",sync);
  return()=>{window.removeEventListener("hashchange",sync);window.removeEventListener("popstate",sync)};
 },[]);
 function openFollowUp(organizationId:string|undefined,kind:string){
  if(kind==="invitation_expired"){navigate("onboarding");return;}
  if(!organizationId)return;
  setSelectedCustomerId(organizationId);
  navigate("subscriptions");
 }
 function navigate(section:string){
  setActiveSection(section);
  window.history.pushState(null,"","#"+section);
  window.scrollTo({top:0,behavior:"instant"});
 }
 const [assisted,setAssisted]=useState({name:"",slug:"",kind:"academy",ownerEmail:"",ownerName:"",modules:["academy"] as string[]});
 const [invitationUrl,setInvitationUrl]=useState("");
 const [showRecovery,setShowRecovery]=useState(false);
 const [deliveryStatus,setDeliveryStatus]=useState<Record<string,string>>({});
 const [pendingCustomers,setPendingCustomers]=useState<{id:string;owner_email:string;organization_name:string;organization_slug:string;status:string;expires_at:string}[]>([]);
 const [assistedMessage,setAssistedMessage]=useState("");const [assistedBusy,setAssistedBusy]=useState(false);
 const [pendingLoading,setPendingLoading]=useState(false);
 const [pendingError,setPendingError]=useState("");
 const [invitationActionId,setInvitationActionId]=useState("");
 const [latestDelivery,setLatestDelivery]=useState("");
 const deliveryLabel=(status:string)=>({
  provider_accepted:"Accepted by email provider (not confirmed delivered)",
  sent:"Accepted by email provider (not confirmed delivered)",
  queued:"Queued for email dispatch",
  sending:"Sending",
  failed:"Delivery failed — resend available",
  not_configured:"Email service not configured",
  cancelled:"Delivery cancelled"
 } as Record<string,string>)[status]||"No email delivery recorded";
 const invitationLabel=(status:string,expires:string)=>{
  if(status==="accepted"||status==="activated")return "Owner activated";
  if(status==="revoked")return "Revoked";
  if(status==="pending"&&Date.parse(expires)<Date.now())return "Expired";
  if(status==="pending")return "Awaiting owner activation";
  return status;
 };
 useEffect(()=>{if(activeSection==="onboarding")void loadPendingCustomers();},[activeSection]);
 useEffect(()=>{
  let active=true;setLoading(true);setError("");
  async function load(){
   const client=getSupabaseBrowserClient();
   if(!client)throw new Error("Authentication unavailable");
   const {data:{session}}=await client.auth.getSession();
   if(!session)throw new Error("Sign in to access platform administration");
   const res=await fetch("/api/platform-admin/overview?"+new URLSearchParams({page:String(page),search}),{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   const body=await res.json();
   if(!res.ok||!body.ok)throw new Error(body.error||"Unable to load overview");
   return body as Overview;
  }
  void load().then(x=>{if(active)setOverview(x)}).catch(e=>{if(active){setOverview(null);setError(e instanceof Error?e.message:"Access unavailable")}}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[page,search,refresh]);
 useEffect(()=>{let active=true;(async()=>{try{
  const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
  if(!session)throw Error("Sign in first");
  const res=await fetch("/api/platform-admin/operations-summary",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
  const body=await res.json();if(!res.ok||!body.ok)throw Error(body.error||"Unable to load operational summary");
  if(active){setOperations(body);setOperationsError("");}
 }catch(e){if(active)setOperationsError(e instanceof Error?e.message:"Operational summary unavailable")}})();
 return()=>{active=false};},[refresh]);
 async function loadPendingCustomers(){
  setPendingLoading(true);setPendingError("");
  try{
   const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
   if(!session)throw Error("Sign in first");
   const response=await fetch("/api/platform-admin/customer-invitations",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   const data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||"Unable to load invitations");
   setPendingCustomers(data.invitations);
   const byId:Record<string,string>={};for(const d of data.deliveries||[]){if(!byId[d.invitation_id])byId[d.invitation_id]=d.status;}setDeliveryStatus(byId);
  }catch(e){setPendingError(e instanceof Error?e.message:"Unable to load invitations")}
  finally{setPendingLoading(false)}
 }
 async function rotatePending(id:string){
  if(invitationActionId)return;setInvitationActionId(id);
  try{
   const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
   if(!session)throw Error("Sign in first");
   const response=await fetch("/api/platform-admin/customer-invitations",{method:"POST",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({action:"rotate",id})});
   const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error||"Unable to rotate invitation");
   setInvitationUrl(body.invitationUrl||"");setShowRecovery(false);setLatestDelivery(body.delivery||"");setAssistedMessage(body.message||"Invitation resend requested.");
   await loadPendingCustomers();
  }catch(e){setAssistedMessage(e instanceof Error?e.message:"Unable to rotate invitation")}
  finally{setInvitationActionId("")}
 }
 async function revokePending(id:string){
  if(invitationActionId||!window.confirm("Revoke this invitation? The link will stop working."))return;
  setInvitationActionId(id);
  try{
   const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
   if(!session)throw Error("Sign in first");
   const response=await fetch("/api/platform-admin/customer-invitations",{method:"DELETE",
     headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({id})});
   const data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||"Revoke failed");
   await loadPendingCustomers();
  }catch(e){setAssistedMessage(e instanceof Error?e.message:"Revoke failed")}
  finally{setInvitationActionId("")}
 }
 async function createAssisted(){
  if(assistedBusy)return;setAssistedBusy(true);setAssistedMessage("");setInvitationUrl("");
  try{
   const client=getSupabaseBrowserClient();if(!client)throw Error("Sign in first");
   const {data:{session}}=await client.auth.getSession();if(!session)throw Error("Sign in first");
   const response=await fetch("/api/platform-admin/customer-invitations",{method:"POST",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify(assisted)});
   const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error||"Creation failed");
   setLatestDelivery(body.delivery||"");
   setAssistedMessage(body.message||"Customer invitation created.");
   setInvitationUrl(body.invitationUrl||"");setShowRecovery(false);
   await loadPendingCustomers();
  }catch(e){setAssistedMessage(e instanceof Error?e.message:"Creation failed")}finally{setAssistedBusy(false)}
 }
 return <main className="platformConsole">
  <div className="platformLayout">
   <aside className="platformSidebar" aria-label="Platform navigation">
    <Link href="/platform-admin#overview" className="platformBrand" aria-label="Platform Administration home" onClick={e=>{e.preventDefault();navigate("overview")}}><img src="/brand/robotronix-horizontal.png" alt="Robotronix" /></Link>
    <span className="platformWorkspaceLabel">EDUCATION SUITE</span>
    <div className="platformWorkspaceName"><span className="platformWorkspaceIcon">✦</span><span>Control Centre<small>Platform administration</small></span></div>
    <nav className="platformNav">
     <a href="#overview" onClick={e=>{e.preventDefault();navigate("overview")}} className={activeSection==="overview"?"platformNavActive":undefined} aria-current={activeSection==="overview"?"location":undefined}>◫ <span>Overview</span></a>
     <a href="#customers" onClick={e=>{e.preventDefault();navigate("customers")}} className={activeSection==="customers"?"platformNavActive":undefined} aria-current={activeSection==="customers"?"location":undefined}>♧ <span>Customers & access</span></a>
     <a href="#subscriptions" onClick={e=>{e.preventDefault();navigate("subscriptions")}} className={activeSection==="subscriptions"?"platformNavActive":undefined} aria-current={activeSection==="subscriptions"?"location":undefined}>▤ <span>Subscriptions</span></a>
     <a href="#branding" onClick={e=>{e.preventDefault();navigate("branding")}} className={activeSection==="branding"?"platformNavActive":undefined} aria-current={activeSection==="branding"?"location":undefined}>◈ <span>Tenant branding</span></a>
     <a href="#onboarding" onClick={e=>{e.preventDefault();navigate("onboarding")}} className={activeSection==="onboarding"?"platformNavActive":undefined} aria-current={activeSection==="onboarding"?"location":undefined}>✚ <span>New customer</span></a>
     <a href="#directory" onClick={e=>{e.preventDefault();navigate("directory")}} className={activeSection==="directory"?"platformNavActive":undefined} aria-current={activeSection==="directory"?"location":undefined}>▦ <span>Directory</span></a>
     <span className="platformNavGroupTitle">PLATFORM OPERATIONS</span>
     <a href="#system-health" onClick={e=>{e.preventDefault();navigate("system-health")}} className={activeSection==="system-health"?"platformNavActive":undefined} aria-current={activeSection==="system-health"?"location":undefined}>◉ <span>System Health &amp; Monitoring</span></a>
    </nav>
    <div className="platformSidebarFoot"><strong>Secure platform console</strong><span>Organization data remains separated by tenant and role.</span><Link href="/suite">Return to Suite</Link><SignOutButton className="platformSignout" label="Sign out"/></div>
   </aside>
   <div className="platformMain">
    <header className="platformTopbar"><div><span className="platformEyebrow">PLATFORM / ADMINISTRATION</span><h1>{activeSection==="overview"?"Control Centre":({customers:"Customers & access",subscriptions:"Subscriptions",branding:"Tenant branding",onboarding:"New customer",directory:"Customer directory","system-health":"System Health & Monitoring"} as Record<string,string>)[activeSection]}</h1><p>{activeSection==="system-health"?"Monitor platform operations, email delivery and privileged access.":activeSection==="branding"?"Configure customer identity, logos and theme colors.":activeSection==="customers"?"Manage access, invitations and commercial branding entitlements.":"Manage your customers, access and subscriptions in one place."}</p></div><span className="platformRolePill"><span aria-hidden="true">●</span> Super Admin</span></header>
    <div className="platformContent">
     {loading&&<div className="platformFeedback" role="status">Loading platform overview…</div>}
     {error&&<div className="platformFeedback platformError" role="alert">{error}</div>}
     {overview&&!loading&&<>
      <section id="overview" hidden={activeSection!=="overview"} className="platformOverview" aria-label="Platform overview">
       <div className="platformSectionIntro"><div><span className="platformEyebrow">YOUR PLATFORM AT A GLANCE</span><h2>Overview</h2></div><span className="platformReadOnlyHint">Platform data · live</span></div>
       <div className="platformMetricGrid">
        {([{label:"Customer organizations",value:overview.metrics.organizations,icon:"▣",note:"Registered workspaces"},{label:"Active subscriptions",value:overview.metrics.activeSubscriptions,icon:"◉",note:"Current paid plans"},{label:"Trial subscriptions",value:overview.metrics.trials,icon:"◷",note:"Evaluation workspaces"}] as const).map(metric=><article className="platformMetric" key={metric.label}><div className="platformMetricTop"><span>{metric.label}</span><span className="platformMetricIcon" aria-hidden="true">{metric.icon}</span></div><strong>{metric.value}</strong><small>{metric.note}</small></article>)}
       </div>
      </section>
      {activeSection==="overview"&&<div className="platformOverviewBody">
       {operationsError&&<p role="alert">Operations summary: {operationsError}</p>}
       {operations&&<section className="platformPanel" aria-label="Action required" style={{padding:20,marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><h2>Action required</h2><button onClick={()=>setRefresh(v=>v+1)}>Refresh</button></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
         {([{label:"Trials expiring in 7 days",value:operations.metrics.expiringTrials},{label:"Expired trials",value:operations.metrics.expiredTrials},{label:"Pending owner activations",value:operations.metrics.pendingInvitations},{label:"Expired invitations",value:operations.metrics.expiredInvitations},{label:"Past-due subscriptions",value:operations.metrics.pastDueSubscriptions}]).map(x=><div key={x.label} style={{padding:12,border:"1px solid #e5def1",borderRadius:10}}><strong style={{display:"block",fontSize:24}}>{x.value}</strong><span>{x.label}</span></div>)}
        </div>
        {operations.alerts.length>0&&<div style={{marginTop:16}}>
         <h3 style={{marginBottom:12}}>Priority follow-ups</h3>
         <div style={{display:"grid",gap:8}}>
          {operations.alerts.slice(0,8).map((a,i)=>{
           const isInvitation=a.type==="invitation_expired";
           const label=a.type==="trial_expired"?"Trial expired":a.type==="trial_expiring"?"Trial expiring soon":isInvitation?"Owner invitation expired":a.type.replaceAll("_"," ");
           const customer=a.organizationName||operations.subscriptions.find(x=>x.organization_id===a.organizationId)?.organization_name||"Unknown customer";
           const date=new Date(a.expiresAt);
           return <div key={a.organizationId+"-"+a.type+"-"+i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",padding:"12px 14px",border:"1px solid #e5def1",borderRadius:10}}>
            <div style={{minWidth:0}}><strong style={{display:"block"}}>{customer}</strong><span style={{fontSize:13,color:"#625a72"}}>{label} · {isInvitation?"Invitation expired":a.type==="trial_expired"?"Trial ended":"Trial ends"}: {Number.isFinite(date.getTime())?date.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"Date unavailable"}</span></div>
            <button type="button" disabled={!isInvitation&&!a.organizationId} onClick={()=>openFollowUp(a.organizationId,a.type)}>{isInvitation?"Review invitation":"Manage subscription"}</button>
           </div>;
          })}
         </div>
         {operations.alerts.length>8&&<p style={{marginTop:10}}>Showing 8 of {operations.alerts.length} follow-ups.</p>}
        </div>}
        {operations.truncated&&<p role="status">Summary is limited to the first records; use filtered customer lookup for a complete audit.</p>}
       </section>}
       <div className="platformWelcomeCard">
        <div><span className="platformEyebrow">QUICK START</span><h2>What would you like to manage?</h2><p>Jump straight to the action you need. All customer changes remain permission-checked and audited.</p></div>
        <a href="#onboarding" onClick={e=>{e.preventDefault();navigate("onboarding")}} className="platformPrimaryLink">+ Add customer</a>
       </div>
       <div className="platformQuickGrid">
        <a href="#customers" onClick={e=>{e.preventDefault();navigate("customers")}}><span className="platformQuickIcon">♧</span><strong>Customer access</strong><small>Owner invitations, customer status and administrators</small><span aria-hidden="true">↗</span></a>
        <a href="#subscriptions" onClick={e=>{e.preventDefault();navigate("subscriptions")}}><span className="platformQuickIcon">◉</span><strong>Subscriptions & modules</strong><small>Plans, expiry dates and enabled applications</small><span aria-hidden="true">↗</span></a>
        <a href="#branding" onClick={e=>{e.preventDefault();navigate("branding")}}><span className="platformQuickIcon">◈</span><strong>Academy branding</strong><small>Identity, colors and logo settings</small><span aria-hidden="true">↗</span></a>
       </div>
       <div className="platformRecentCard"><div><span className="platformEyebrow">CUSTOMER DIRECTORY</span><h2>Recently created organizations</h2><p>Showing available records from the current directory page, not platform-wide activity.</p></div><a href="#directory" onClick={e=>{e.preventDefault();navigate("directory")}}>View directory →</a></div>
       <div className="platformCompactList">{overview.organizations.slice(0,4).map(o=><div key={o.id}><span className="platformOrgAvatar" aria-hidden="true">{o.display_name.slice(0,1).toUpperCase()}</span><span><strong>{o.display_name}</strong><small>{o.slug}</small></span><span className={"platformStatus "+(o.status==="active"?"platformStatusActive":"")}>{o.status}</span></div>)}{overview.organizations.length===0&&<p>No customer records on this page.</p>}</div>
      </div>}
      {activeSection==="system-health"&&<PlatformSystemHealth/>}
      <div className="platformColumns platformTabSections">
       <div id="customers" hidden={activeSection!=="customers"} className="platformPanel"><PlatformCustomerActions key={selectedCustomerId||"unselected"} initialOrganizationId={selectedCustomerId} organizations={overview.organizations} onChanged={()=>setRefresh(x=>x+1)}/><PlatformBrandingEntitlements organizations={overview.organizations}/></div>
       <div id="subscriptions" hidden={activeSection!=="subscriptions"} className="platformPanel">
        {operations&&<section style={{padding:20,marginBottom:20,border:"1px solid #ddd5eb",borderRadius:16}}>
         <h2>Customer subscription overview</h2>
         <p>Select a customer from the table to manage its plan and module entitlements.</p>
         <div className="platformTableScroll"><table><thead><tr><th>Customer</th><th>Plan</th><th>Status</th><th>End date</th><th>Action</th></tr></thead><tbody>
          {operations.subscriptions.map(x=><tr key={x.organization_id}>
           <td>{x.organization_name||overview.organizations.find(o=>o.id===x.organization_id)?.display_name||"Unknown customer"}</td><td>{x.plan_code}</td><td>{x.status}</td><td>{x.ends_at?new Date(x.ends_at).toLocaleDateString():"Not set"}</td>
           <td><button type="button" onClick={()=>{setSelectedCustomerId(x.organization_id);document.getElementById("subscription-management")?.scrollIntoView({behavior:"smooth",block:"start"});}}>Manage plan</button></td>
          </tr>)}
         </tbody></table></div>
         <p>Showing available platform subscription records. Records may be truncated when the monitoring limit is reached.</p>
        </section>}
        <div id="subscription-management" style={{scrollMarginTop:24}}><PlatformSubscriptions key={selectedCustomerId||"unselected"} initialOrganizationId={selectedCustomerId} organizations={[...overview.organizations,...(operations?.subscriptions||[]).filter(x=>!overview.organizations.some(o=>o.id===x.organization_id)).map(x=>({id:x.organization_id,display_name:x.organization_name||"Unknown customer"}))]} onChanged={()=>setRefresh(x=>x+1)}/></div></div>
      </div>
      <div className="platformColumns platformTabSections">
       <div id="branding" hidden={activeSection!=="branding"} className="platformPanel"><PlatformTenantBranding organizations={overview.organizations.filter(o=>o.status==="active")}/></div>
       <section id="onboarding" hidden={activeSection!=="onboarding"} className="platformPanel platformOnboarding">
        <span className="platformEyebrow">NEW WORKSPACE</span><h2>Assisted onboarding</h2><p>Enter the customer details and Owner email. The system will send a secure activation email when delivery is configured.</p>
        <form onSubmit={e=>{e.preventDefault();void createAssisted()}} className="platformForm">
         <label>Owner email<input required type="email" value={assisted.ownerEmail} onChange={e=>setAssisted(v=>({...v,ownerEmail:e.target.value}))} placeholder="owner@example.com"/></label>
         <label>Owner name (optional)<input value={assisted.ownerName} onChange={e=>setAssisted(v=>({...v,ownerName:e.target.value}))} placeholder="Owner name"/></label>
         <label>Organization name<input required value={assisted.name} onChange={e=>setAssisted(s=>({...s,name:e.target.value,slug:s.slug||e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}))} placeholder="e.g. ABC Learning Academy"/></label>
         <label>URL slug<input required value={assisted.slug} onChange={e=>setAssisted(s=>({...s,slug:e.target.value}))} placeholder="abc-learning-academy"/></label>
         <label>Organization type<select value={assisted.kind} onChange={e=>setAssisted(s=>({...s,kind:e.target.value}))}><option value="academy">Academy</option><option value="institute">Institute</option><option value="tutor">Tutor</option></select></label>
         <fieldset className="platformModuleFieldset"><legend>Enabled trial modules</legend><p className="platformModuleHint">Choose which applications the customer can try.</p><div className="platformModuleChoices">{(["academy","crm","tasks"] as const).map(m=><label key={m} className="platformModuleOption"><input type="checkbox" checked={assisted.modules.includes(m)} onChange={e=>setAssisted(s=>({...s,modules:e.target.checked?[...s.modules,m]:s.modules.filter(x=>x!==m)}))}/><span className="platformModuleCopy"><strong>{m==="academy"?"Academy":m==="crm"?"Connect CRM":"My Tasks"}</strong><small>{m==="academy"?"Students, trainers, classes and fees":m==="crm"?"Enquiries, admissions and follow-ups":"Daily tasks and team coordination"}</small></span></label>)}</div></fieldset>
         <button className="platformCreateInvitation" type="submit" disabled={assistedBusy||!assisted.ownerEmail||!assisted.name||!assisted.slug||assisted.modules.length===0}>{assistedBusy?"Creating…":"Create academy & attempt invitation delivery"}</button>
         {invitationUrl&&<div><button type="button" onClick={()=>setShowRecovery(x=>!x)}>{showRecovery?"Hide recovery link":"Advanced · Manual invitation recovery"}</button>{showRecovery&&<div role="status"><p>Use only when automatic delivery is unavailable. This link grants access to the invitation process; share privately.</p><input value={invitationUrl} readOnly aria-label="Owner invitation link"/><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(invitationUrl);setAssistedMessage("Secure invitation link copied. Share it privately only.");}catch{setAssistedMessage("Copy failed. Select and copy the link manually from the field above.");}}}>Copy secure link</button></div>}</div>}
         {assistedMessage&&<p role="status" className="platformInlineMessage">{assistedMessage}</p>}{latestDelivery&&<p role="status">Email result: <strong>{deliveryLabel(latestDelivery)}</strong></p>}
         <div><button type="button" disabled={pendingLoading} onClick={()=>void loadPendingCustomers()}>{pendingLoading?"Refreshing…":"Refresh customer invitations"}</button>
          {pendingError&&<p role="alert">{pendingError}</p>}
          {!pendingLoading&&!pendingError&&pendingCustomers.length===0?<p>No customer invitations found.</p>:<div className="platformTableScroll"><table><thead><tr><th>Academy</th><th>Owner email</th><th>Invitation</th><th>Email delivery</th><th>Expires</th><th>Actions</th></tr></thead><tbody>{pendingCustomers.map(inv=><tr key={inv.id}><td><strong>{inv.organization_name}</strong><small style={{display:"block"}}>{inv.organization_slug}</small></td><td>{inv.owner_email}</td><td>{invitationLabel(inv.status,inv.expires_at)}</td><td aria-label={"Delivery status: "+deliveryLabel(deliveryStatus[inv.id]||"")}>{deliveryLabel(deliveryStatus[inv.id]||"")}</td><td>{new Date(inv.expires_at).toLocaleDateString()}</td><td>{inv.status==="pending"&&<><button type="button" disabled={assistedBusy||!!invitationActionId} onClick={()=>void rotatePending(inv.id)}>Resend invitation</button> <button type="button" disabled={assistedBusy||!!invitationActionId} onClick={()=>void revokePending(inv.id)}>Revoke</button></>}</td></tr>)}</tbody></table></div>}
         </div>
        </form>
       </section>
      </div>
      <section id="directory" hidden={activeSection!=="directory"} className="platformDirectory platformPanel">
       <div className="platformDirectoryHead"><div><span className="platformEyebrow">CUSTOMER WORKSPACES</span><h2>Organization directory</h2><p>Find and review registered organizations.</p></div><label htmlFor="org-search">Search organizations<input id="org-search" value={search} onChange={e=>{setPage(1);setSearch(e.target.value)}} placeholder="Search by name"/></label></div>
       {overview.organizations.length===0?<p className="platformEmpty">No matching organizations found.</p>:<div className="platformTableScroll"><table><thead><tr><th>Organization</th><th>Workspace slug</th><th>Status</th><th>Created</th><th>Manage</th></tr></thead><tbody>{overview.organizations.map(o=><tr key={o.id}><td><strong>{o.display_name}</strong></td><td><code>{o.slug}</code></td><td><span className={"platformStatus "+(o.status==="active"?"platformStatusActive":"")}>{o.status}</span></td><td>{new Date(o.created_at).toLocaleDateString()}</td><td><button type="button" onClick={()=>setSelectedCustomerId(current=>current===o.id?"":o.id)} aria-expanded={selectedCustomerId===o.id}>{selectedCustomerId===o.id?"Close":"View customer"}</button></td></tr>)}</tbody></table></div>}
       {selectedCustomerId&&overview.organizations.some(o=>o.id===selectedCustomerId)&&<section className="platformPanel" aria-label="Selected customer actions" style={{marginTop:20,padding:22}}>
        <span className="platformEyebrow">CUSTOMER WORKSPACE</span>
        <h3>{overview.organizations.find(o=>o.id===selectedCustomerId)?.display_name}</h3>
        <p>Customer details and actions. Select an operation to work with this organization.</p>
        <dl style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
         <div><dt>Organization ID</dt><dd style={{overflowWrap:"anywhere"}}>{selectedCustomerId}</dd></div>
         <div><dt>Workspace slug</dt><dd>{overview.organizations.find(o=>o.id===selectedCustomerId)?.slug}</dd></div>
         <div><dt>Status</dt><dd>{overview.organizations.find(o=>o.id===selectedCustomerId)?.status}</dd></div>
        </dl>
        <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
         <button type="button" onClick={()=>navigate("customers")}>Manage access and status</button>
         <button type="button" onClick={()=>navigate("subscriptions")}>Manage subscription</button>
         <button type="button" onClick={()=>navigate("branding")}>Manage branding</button>
        </div>
       </section>}
       <div className="platformPagination"><span>{overview.total} matching organizations · Page {page}</span><div><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>Previous</button><button disabled={page*20>=overview.total} onClick={()=>setPage(p=>p+1)}>Next</button></div></div>
      </section>
     </>}
    </div>
   </div>
  </div>
 </main>;
}
