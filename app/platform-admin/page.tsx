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
type Ops={subscriptions:{organization_id:string;organization_name:string|null;plan_code:string;status:string;ends_at:string|null}[];metrics:{expiringTrials:number;expiredTrials:number;pendingInvitations:number;expiredInvitations:number;pastDueSubscriptions:number};alerts:{type:string;organizationId?:string;organizationName?:string;invitationId?:string;expiresAt:string}[];truncated:boolean};
type Overview={organizations:Org[];page:number;total:number;metrics:{organizations:number;trials:number;activeSubscriptions:number}};
export default function PlatformAdminPage(){
 const [overview,setOverview]=useState<Overview|null>(null);
 const [operations,setOperations]=useState<Ops|null>(null);
 const [operationsError,setOperationsError]=useState("");
 const [customerPreview,setCustomerPreview]=useState<Org[]>([]);
 const [customerPreviewLoading,setCustomerPreviewLoading]=useState(true);
 const [customerPreviewError,setCustomerPreviewError]=useState("");
 const [search,setSearch]=useState("");
 const [page,setPage]=useState(1);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [refresh,setRefresh]=useState(0);
 const [activeSection,setActiveSection]=useState("overview");
 const [selectedCustomerId,setSelectedCustomerId]=useState("");
 const [subscriptionFilter,setSubscriptionFilter]=useState<"all"|"active"|"active_trials"|"expiring_trials"|"expired_trials"|"past_due">("all");
 useEffect(()=>{
  const sync=()=>{
   const id=window.location.hash.slice(1);
   setActiveSection(["overview","customers","subscriptions","branding","onboarding","directory","system-health"].includes(id)?id:"overview");
   window.scrollTo({top:0,behavior:"instant"});
  };
  sync();window.addEventListener("hashchange",sync);window.addEventListener("popstate",sync);
  return()=>{window.removeEventListener("hashchange",sync);window.removeEventListener("popstate",sync)};
 },[]);
 function openCustomer(organizationId:string,organizationName:string){
  setSelectedCustomerId(organizationId);setSearch(organizationName);setPage(1);navigate("directory");
 }
 function openCustomerManagement(section:"customers"|"subscriptions"|"branding",organizationId:string){
  setSelectedCustomerId(organizationId);navigate(section);
 }
 function openFollowUp(organizationId:string|undefined,kind:string){
  if(kind==="invitation_expired"||kind==="owner_activation_pending"){navigate("onboarding");return;}
  if(!organizationId)return;
  openCustomerManagement("subscriptions",organizationId);
 }
 function openSubscriptionList(filter:typeof subscriptionFilter){
  setSelectedCustomerId("");setSubscriptionFilter(filter);navigate("subscriptions");
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
 useEffect(()=>{let active=true;setCustomerPreviewLoading(true);(async()=>{try{
  const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
  if(!session)throw Error("Sign in first");
  const response=await fetch("/api/platform-admin/customer-preview",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
  const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error||"Preview unavailable");
  if(active){setCustomerPreview(body.organizations||[]);setCustomerPreviewError("");}
 }catch(e){if(active){setCustomerPreview([]);setCustomerPreviewError(e instanceof Error?e.message:"Preview unavailable");}}
 finally{if(active)setCustomerPreviewLoading(false)}})();return()=>{active=false};},[refresh]);
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
     <a href="#directory" onClick={e=>{e.preventDefault();setSelectedCustomerId("");setSearch("");setPage(1);navigate("directory")}} className={activeSection==="directory"?"platformNavActive":undefined} aria-current={activeSection==="directory"?"location":undefined}>♧ <span>Customers</span></a>
     <a href="#subscriptions" onClick={e=>{e.preventDefault();openSubscriptionList("all")}} className={activeSection==="subscriptions"?"platformNavActive":undefined} aria-current={activeSection==="subscriptions"?"location":undefined}>▤ <span>Subscriptions</span></a>
     <a href="#onboarding" onClick={e=>{e.preventDefault();navigate("onboarding")}} className={activeSection==="onboarding"?"platformNavActive":undefined} aria-current={activeSection==="onboarding"?"location":undefined}>✚ <span>New customer</span></a>
     <span className="platformNavGroupTitle">PLATFORM OPERATIONS</span>
     <a href="#system-health" onClick={e=>{e.preventDefault();navigate("system-health")}} className={activeSection==="system-health"?"platformNavActive":undefined} aria-current={activeSection==="system-health"?"location":undefined}>◉ <span>System Health &amp; Monitoring</span></a>
    </nav>
    <div className="platformSidebarFoot"><strong>Secure platform console</strong><span>Organization data remains separated by tenant and role.</span><Link href="/suite">Return to Suite</Link><SignOutButton className="platformSignout" label="Sign out"/></div>
   </aside>
   <div className="platformMain">
    <header className="platformTopbar"><div><span className="platformEyebrow">PLATFORM / ADMINISTRATION</span><h1>{activeSection==="overview"?"Control Centre":({customers:"Customers & access",subscriptions:"Subscriptions",branding:"Tenant branding",onboarding:"New customer",directory:"Customers","system-health":"System Health & Monitoring"} as Record<string,string>)[activeSection]}</h1><p>{activeSection==="system-health"?"Monitor platform operations, email delivery and privileged access.":activeSection==="branding"?"Configure customer identity, logos and theme colors.":activeSection==="customers"?"Manage access, invitations and commercial branding entitlements.":"Manage your customers, access and subscriptions in one place."}</p></div><span className="platformRolePill"><span aria-hidden="true">●</span> Super Admin</span></header>
    <div className="platformContent">
     {loading&&<div className="platformFeedback" role="status">Loading platform overview…</div>}
     {error&&<div className="platformFeedback platformError" role="alert">{error}</div>}
     {overview&&!loading&&<>
      <section id="overview" hidden={activeSection!=="overview"} className="platformOverview" aria-label="Platform overview">
       <div className="platformSectionIntro platformOverviewHeading">
        <div><span className="platformEyebrow">YOUR PLATFORM AT A GLANCE</span><h2>Overview</h2><small className="platformReadOnlyHint">Live platform records · Refresh to update</small></div>
        <a href="#onboarding" className="platformOverviewAddCustomer" onClick={e=>{e.preventDefault();navigate("onboarding")}}>＋ Add customer</a>
       </div>
       <div className="platformKpiGrid" aria-label="Platform key metrics">
        {([
         {label:"Customer organizations",value:overview.metrics.organizations,icon:"▣",note:"Registered workspaces",action:()=>navigate("directory")},
         {label:"Active subscriptions",value:overview.metrics.activeSubscriptions,icon:"◉",note:"Current paid subscriptions",action:()=>openSubscriptionList("active")},
         {label:"Active trials",value:overview.metrics.trials,icon:"◷",note:"Trials not yet expired",action:()=>openSubscriptionList("active_trials")}
        ]).map(metric=><button className="platformKpiWidget" type="button" onClick={metric.action} key={metric.label} aria-label={metric.label+": "+metric.value+". View details"}>
          <span className="platformKpiWidgetTop"><span>{metric.label}</span><span className="platformKpiWidgetIcon" aria-hidden="true">{metric.icon}</span></span>
          <strong>{metric.value}</strong><span className="platformKpiWidgetBottom"><small>{metric.note}</small><span aria-hidden="true">↗</span></span>
         </button>)}
       </div>
      </section>
      {activeSection==="overview"&&<div className="platformOverviewBody">
       {operationsError&&<p role="alert">Operations summary: {operationsError}</p>}
       {operations&&<section className="platformPanel" aria-label="Action required" style={{padding:20,marginBottom:0}}>
        <div className="platformActionHeading"><div><h2>Action required</h2><p>Outstanding customer and subscription follow-ups</p></div><button type="button" onClick={()=>setRefresh(v=>v+1)}>Refresh</button></div>
        <div className="platformActionWidgetGrid">
         {([
          {label:"Trials expiring in 7 days",value:operations.metrics.expiringTrials,filter:"expiring_trials" as const,kind:"subscription" as const,cta:"Review trials"},
          {label:"Expired trials",value:operations.metrics.expiredTrials,filter:"expired_trials" as const,kind:"subscription" as const,cta:"Review trials"},
          {label:"Pending owner activations",value:operations.metrics.pendingInvitations,filter:null,kind:"invitation" as const,cta:"Review invitations"},
          {label:"Expired invitations",value:operations.metrics.expiredInvitations,filter:null,kind:"invitation" as const,cta:"Review invitations"},
          {label:"Past-due subscriptions",value:operations.metrics.pastDueSubscriptions,filter:"past_due" as const,kind:"subscription" as const,cta:"Review plans"}
         ]).map(metric=><button type="button" key={metric.label} className={"platformActionWidget "+(metric.value>0?"platformActionWidgetNeedsAttention":"")} onClick={()=>metric.kind==="invitation"?navigate("onboarding"):openSubscriptionList(metric.filter||"all")} aria-label={metric.label+": "+metric.value+". "+metric.cta}>
          <span className="platformActionWidgetLabel">{metric.label}</span><strong>{metric.value}</strong><span className="platformActionWidgetFooter"><span>{metric.value>0?"Needs review":"No action pending"}</span><span aria-hidden="true">↗</span></span>
         </button>)}
        </div>
        {operations.alerts.length>0&&<div style={{marginTop:16}}>
         <h3 style={{marginBottom:12}}>Priority follow-ups</h3>
         <div style={{display:"grid",gap:8}}>
          {operations.alerts.slice(0,8).map((a,i)=>{
           const isInvitation=a.type==="invitation_expired"||a.type==="owner_activation_pending";
           const customer=a.organizationName||operations.subscriptions.find(x=>x.organization_id===a.organizationId)?.organization_name||"Unknown customer";
           const date=new Date(a.expiresAt);
           const formattedDate=Number.isFinite(date.getTime())?date.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"Date unavailable";
           const detail=a.type==="trial_expired"?"Trial expired on "+formattedDate
            :a.type==="trial_expiring"?"Trial ends on "+formattedDate
            :a.type==="owner_activation_pending"?"Owner activation pending · Invitation expires "+formattedDate
            :a.type==="invitation_expired"?"Owner invitation expired on "+formattedDate
            :a.type.replaceAll("_"," ")+" · "+formattedDate;
           return <div key={a.invitationId||a.organizationId||i+"-"+a.type} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",padding:"12px 14px",border:"1px solid #e5def1",borderRadius:10}}>
            <div style={{minWidth:0}}><strong style={{display:"block"}}>{customer}</strong><span style={{fontSize:13,color:"#625a72"}}>{detail}</span></div>
            <button type="button" disabled={!isInvitation&&!a.organizationId} onClick={()=>openFollowUp(a.organizationId,a.type)}>{isInvitation?"Review invitation":"Manage subscription"}</button>
           </div>;
          })}
         </div>
         {operations.alerts.length>8&&<p style={{marginTop:10}}>Showing 8 of {operations.alerts.length} follow-ups.</p>}
        </div>}
        {operations.truncated&&<p role="status">Summary is limited to the first records; use filtered customer lookup for a complete audit.</p>}
       </section>}
       <div className="platformRecentCard">
        <div><span className="platformEyebrow">CUSTOMER DIRECTORY</span><h2>Customer preview</h2><p>Three most recently created active organizations first, across the platform.</p></div>
        <a href="#directory" onClick={e=>{e.preventDefault();setSearch("");setPage(1);navigate("directory")}}>View directory →</a>
       </div>
       <div className="platformCompactList" aria-label="Customer preview">
        {customerPreviewLoading&&<p role="status">Loading recent customer records…</p>}
        {!customerPreviewLoading&&customerPreviewError&&<p role="alert">Customer preview unavailable: {customerPreviewError}</p>}
        {!customerPreviewLoading&&!customerPreviewError&&customerPreview.map(o=><button type="button" className="platformRecentCustomer" key={o.id} onClick={()=>openCustomer(o.id,o.display_name)} aria-label={"View customer "+o.display_name}>
         <span className="platformOrgAvatar" aria-hidden="true">{o.display_name.slice(0,1).toUpperCase()}</span>
         <span className="platformRecentCustomerInfo"><strong>{o.display_name}</strong><small>Created {new Date(o.created_at).toLocaleDateString("en-GB")}</small></span>
         <span className={"platformStatus "+(o.status==="active"?"platformStatusActive":"")}>{o.status}</span>
         <span className="platformRecentCustomerAction">View customer <span aria-hidden="true">↗</span></span>
        </button>)}
        {!customerPreviewLoading&&!customerPreviewError&&customerPreview.length===0&&<p>No organizations available.</p>}
       </div>
      </div>}
      {activeSection==="system-health"&&<PlatformSystemHealth/>}
      <div className="platformColumns platformTabSections">
       <div id="customers" hidden={activeSection!=="customers"} className="platformPanel"><div className="platformBackLine"><button type="button" onClick={()=>navigate("directory")}>← Back to customers</button></div><PlatformCustomerActions key={selectedCustomerId||"unselected"} initialOrganizationId={selectedCustomerId} organizations={overview.organizations} onChanged={()=>setRefresh(x=>x+1)}/></div>
       <div id="subscriptions" hidden={activeSection!=="subscriptions"} className="platformPanel">
        {selectedCustomerId?<>
         <section className="platformSubscriptionSelection" aria-label="Selected customer subscription" style={{padding:"22px 24px 4px"}}>
          <button type="button" className="platformSubscriptionBack" onClick={()=>{setSelectedCustomerId("");window.scrollTo({top:0,behavior:"smooth"});}}>← Back to all subscriptions</button>
          <h2 style={{margin:"16px 0 4px"}}>{operations?.subscriptions.find(x=>x.organization_id===selectedCustomerId)?.organization_name||overview.organizations.find(o=>o.id===selectedCustomerId)?.display_name||"Customer subscription"}</h2>
          <p>Manage this customer’s plan and enabled modules.</p>
         </section>
         <div id="subscription-management" style={{scrollMarginTop:24}}>
          <PlatformSubscriptions key={selectedCustomerId} initialOrganizationId={selectedCustomerId} organizations={[...overview.organizations,...(operations?.subscriptions||[]).filter(x=>!overview.organizations.some(o=>o.id===x.organization_id)).map(x=>({id:x.organization_id,display_name:x.organization_name||"Unknown customer"}))]} onChanged={()=>setRefresh(x=>x+1)}/>
         </div>
        </>:<>
         {operations&&<section style={{padding:20,marginBottom:20,border:"1px solid #ddd5eb",borderRadius:16}}>
          <h2>Customer subscription overview</h2>
          <p>Select a customer to manage their subscription and module entitlements.</p>
          {subscriptionFilter!=="all"&&<div className="platformFilterNotice"><span>Showing: {({active:"Active paid subscriptions",active_trials:"Active trials",expiring_trials:"Trials expiring in 7 days",expired_trials:"Expired trials",past_due:"Past-due subscriptions"} as Record<string,string>)[subscriptionFilter]}</span><button type="button" onClick={()=>setSubscriptionFilter("all")}>Clear filter</button></div>}
          <div className="platformTableScroll"><table><thead><tr><th>Customer</th><th>Plan</th><th>Status</th><th>End date</th><th>Action</th></tr></thead><tbody>
           {operations.subscriptions.filter(x=>{
            const deadline=x.ends_at?Date.parse(x.ends_at):NaN;
            const now=Date.now();
            if(subscriptionFilter==="active")return x.status==="active";
            if(subscriptionFilter==="active_trials")return x.status==="trial"&&deadline>now;
            if(subscriptionFilter==="expiring_trials")return x.status==="trial"&&deadline>=now&&deadline<=now+7*86400000;
            if(subscriptionFilter==="expired_trials")return x.status==="trial"&&deadline<now;
            if(subscriptionFilter==="past_due")return x.status==="past_due";
            return true;
           }).map(x=>{
            const expiredTrial=x.status==="trial"&&!!x.ends_at&&Date.parse(x.ends_at)<Date.now();
            const planLabel=x.plan_code.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
            return <tr key={x.organization_id}>
             <td>{x.organization_name||overview.organizations.find(o=>o.id===x.organization_id)?.display_name||"Unknown customer"}</td>
             <td>{planLabel}</td><td><span className={expiredTrial?"platformStatus":"platformStatus platformStatusActive"}>{expiredTrial?"Expired trial":x.status.replaceAll("_"," ")}</span></td><td>{x.ends_at?new Date(x.ends_at).toLocaleDateString("en-GB"):"Not set"}</td>
             <td><button type="button" onClick={()=>{setSelectedCustomerId(x.organization_id);window.scrollTo({top:0,behavior:"smooth"});}}>Manage plan</button></td>
            </tr>;
           })}
          </tbody></table></div>
          {operations.truncated&&<p role="status">Some records are omitted by the monitoring limit. Use the Customer directory for additional records.</p>}
         </section>}
         {!operations&&<p role="status">Subscription records are unavailable. {operationsError||"Check again shortly."}</p>}
        </>}
       </div>
      </div>
      <div className="platformColumns platformTabSections">
       <div id="branding" hidden={activeSection!=="branding"} className="platformPanel"><div className="platformBackLine"><button type="button" onClick={()=>navigate("directory")}>← Back to customers</button></div><PlatformBrandingEntitlements key={"entitlement-"+selectedCustomerId} organizations={overview.organizations} initialOrganizationId={selectedCustomerId}/><PlatformTenantBranding key={"studio-"+selectedCustomerId} initialOrganizationId={selectedCustomerId} organizations={overview.organizations.filter(o=>o.status==="active")}/></div>
       <section id="onboarding" hidden={activeSection!=="onboarding"} className="platformPanel platformOnboarding">
        <span className="platformEyebrow">NEW WORKSPACE</span><h2>Assisted onboarding</h2><p>Create a customer workspace and invite its owner. Email delivery is attempted only when configured; failed delivery can be retried securely.</p>
        <form onSubmit={e=>{e.preventDefault();void createAssisted()}} className="platformForm">
         <div className="platformOnboardingFields">
         <label>Owner email<input required type="email" value={assisted.ownerEmail} onChange={e=>setAssisted(v=>({...v,ownerEmail:e.target.value}))} placeholder="owner@example.com"/></label>
         <label>Owner name (optional)<input value={assisted.ownerName} onChange={e=>setAssisted(v=>({...v,ownerName:e.target.value}))} placeholder="Owner name"/></label>
         <label>Organization name<input required value={assisted.name} onChange={e=>setAssisted(s=>({...s,name:e.target.value,slug:s.slug||e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}))} placeholder="e.g. ABC Learning Academy"/></label>
         </div>
         <details className="platformOnboardingAdvanced"><summary>Advanced workspace URL settings</summary><p>The workspace address is generated from the organization name. Change it only when needed.</p><label>Workspace URL name<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" title="Use lowercase letters, numbers and hyphens" value={assisted.slug} onChange={e=>setAssisted(s=>({...s,slug:e.target.value.toLowerCase().trim()}))} placeholder="abc-learning-academy"/></label></details>
         <label className="platformOnboardingType">Organization type<select value={assisted.kind) onChange={e=>setAssisted(s=>({...s,kind:e.target.value}))}><option value="academy">Academy</option><option value="institute">Institute</option><option value="tutor">Tutor</option></select></label>
         <fieldset className="platformModuleFieldset"><legend>Trial applications</legend><p className="platformModuleHint">Choose which applications the customer can try.</p><div className="platformModuleChoices">{(["academy","crm","tasks"] as const).map(m=><label key={m} className="platformModuleOption"><input type="checkbox" checked={assisted.modules.includes(m)} onChange={e=>setAssisted(s=>({...s,modules:e.target.checked?[...s.modules,m]:s.modules.filter(x=>x!==m)}))}/><span className="platformModuleCopy"><strong>{m==="academy"?"Academy":m==="crm"?"Connect CRM":"My Tasks"}</strong><small>{m==="academy"?"Students, trainers, classes and fees":m==="crm"?"Enquiries, admissions and follow-ups":"Daily tasks and team coordination"}</small></span></label>)}</div></fieldset>
         <button className="platformCreateInvitation" type="submit" disabled={assistedBusy||!assisted.ownerEmail||!assisted.name||!assisted.slug||assisted.modules.length===0}>{assistedBusy?"Creating…":"Create customer & attempt activation email"}</button>
         {invitationUrl&&<div><button type="button" onClick={()=>setShowRecovery(x=>!x)}>{showRecovery?"Hide recovery link":"Advanced · Manual invitation recovery"}</button>{showRecovery&&<div role="status"><p>Use only when automatic delivery is unavailable. This link grants access to the invitation process; share privately.</p><input value={invitationUrl} readOnly aria-label="Owner invitation link"/><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(invitationUrl);setAssistedMessage("Secure invitation link copied. Share it privately only.");}catch{setAssistedMessage("Copy failed. Select and copy the link manually from the field above.");}}}>Copy secure link</button></div>}</div>}
         {assistedMessage&&<p role="status" className="platformInlineMessage">{assistedMessage}</p>}{latestDelivery&&<p role="status">Email result: <strong>{deliveryLabel(latestDelivery)}</strong></p>}
         <div className="platformInvitationList"><div className="platformInvitationHeading"><div><h3>Customer activation invitations</h3><p>Pending accounts that have not yet accepted an owner invitation. Existing customer owner access is managed from Customers.</p></div><button type="button" disabled={pendingLoading} onClick={()=>void loadPendingCustomers()}>{pendingLoading?"Refreshing…":"Refresh invitations"}</button></div>
          {pendingError&&<p role="alert">{pendingError}</p>}
          {!pendingLoading&&!pendingError&&pendingCustomers.length===0?<p>No customer invitations found.</p>:<div className="platformTableScroll"><table><thead><tr><th>Academy</th><th>Owner email</th><th>Invitation</th><th>Email delivery</th><th>Expires</th><th>Actions</th></tr></thead><tbody>{pendingCustomers.map(inv=><tr key={inv.id}><td><strong>{inv.organization_name}</strong></td><td>{inv.owner_email}</td><td>{invitationLabel(inv.status,inv.expires_at)}</td><td aria-label={"Delivery status: "+deliveryLabel(deliveryStatus[inv.id]||"")}>{deliveryLabel(deliveryStatus[inv.id]||"")}</td><td>{new Date(inv.expires_at).toLocaleDateString()}</td><td>{inv.status==="pending"&&<><button type="button" disabled={assistedBusy||!!invitationActionId} onClick={()=>void rotatePending(inv.id)}>Resend invitation</button> <button type="button" disabled={assistedBusy||!!invitationActionId} onClick={()=>void revokePending(inv.id)}>Revoke</button></>}</td></tr>)}</tbody></table></div>}
         </div>
        </form>
       </section>
      </div>
      <section id="directory" hidden={activeSection!=="directory"} className="platformDirectory platformPanel">
       <div className="platformDirectoryHead"><div><span className="platformEyebrow">CUSTOMER WORKSPACES</span><h2>Customers</h2><p>Find a customer and open one workspace to manage access, subscriptions and branding.</p></div><label htmlFor="org-search">Search organizations<input id="org-search" value={search} onChange={e=>{setPage(1);setSearch(e.target.value)}} placeholder="Search by name"/></label></div>
       {overview.organizations.length===0?<p className="platformEmpty">No matching organizations found.</p>:<div className="platformTableScroll"><table><thead><tr><th>Customer</th><th>Status</th><th>Created</th><th>Action</th></tr></thead><tbody>{overview.organizations.map(o=><tr key={o.id}><td><strong>{o.display_name}</strong></td><td><span className={"platformStatus "+(o.status==="active"?"platformStatusActive":"")}>{o.status}</span></td><td>{new Date(o.created_at).toLocaleDateString()}</td><td><button type="button" onClick={()=>setSelectedCustomerId(current=>current===o.id?"":o.id)} aria-expanded={selectedCustomerId===o.id}>{selectedCustomerId===o.id?"Close":"View customer"}</button></td></tr>)}</tbody></table></div>}
       {selectedCustomerId&&overview.organizations.some(o=>o.id===selectedCustomerId)&&(()=>{
        const org=overview.organizations.find(o=>o.id===selectedCustomerId)!;
        return <section className="platformPanel platformCustomerDetail" aria-label="Selected customer actions">
         <div className="platformCustomerDetailHeading"><div><span className="platformEyebrow">CUSTOMER WORKSPACE</span><h3>{org.display_name}</h3><p>Manage this customer without searching for them again.</p></div><span className={"platformStatus "+(org.status==="active"?"platformStatusActive":"")}>{org.status}</span></div>
         <div className="platformCustomerFacts"><div><small>Created</small><strong>{new Date(org.created_at).toLocaleDateString("en-GB")}</strong></div><div><small>Workspace status</small><strong>{org.status.charAt(0).toUpperCase()+org.status.slice(1)}</strong></div></div>
         <div className="platformCustomerActions">
          <button type="button" onClick={()=>openCustomerManagement("customers",org.id)}>Access & owner</button>
          <button type="button" onClick={()=>openCustomerManagement("subscriptions",org.id)}>Subscription & modules</button>
          <button type="button" disabled={org.status==="archived"} onClick={()=>openCustomerManagement("branding",org.id)}>Branding</button>
         </div>
         <details className="platformTechnicalDetails"><summary>Technical details</summary><dl>
          <div><dt>Organization ID</dt><dd><code>{org.id}</code> <button type="button" onClick={()=>void navigator.clipboard.writeText(org.id)}>Copy</button></dd></div>
          <div><dt>Workspace slug</dt><dd><code>{org.slug}</code> <button type="button" onClick={()=>void navigator.clipboard.writeText(org.slug)}>Copy</button></dd></div>
         </dl></details>
        </section>;
       })()}
       <div className="platformPagination"><span>{overview.total} matching organizations · Page {page}</span><div><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>Previous</button><button disabled={page*20>=overview.total} onClick={()=>setPage(p=>p+1)}>Next</button></div></div>
      </section>
     </>}
    </div>
   </div>
  </div>
 </main>;
}
