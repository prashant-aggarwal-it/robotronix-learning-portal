"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {SignOutButton} from "@/components/SignOutButton";
import "./platform-admin.css";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import PlatformCustomerActions from "./PlatformCustomerActions";
import PlatformSubscriptions from "./PlatformSubscriptions";
import PlatformTenantBranding from "./PlatformTenantBranding";
import PlatformBrandingEntitlements from "./PlatformBrandingEntitlements";
type Org={id:string;slug:string;display_name:string;status:string;created_at:string};
type Overview={organizations:Org[];page:number;total:number;metrics:{organizations:number;trials:number;activeSubscriptions:number}};
export default function PlatformAdminPage(){
 const [overview,setOverview]=useState<Overview|null>(null);
 const [search,setSearch]=useState("");
 const [page,setPage]=useState(1);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [refresh,setRefresh]=useState(0);
 const [activeSection,setActiveSection]=useState("overview");
 useEffect(()=>{
  const sync=()=>{
   const id=window.location.hash.slice(1);
   setActiveSection(["overview","customers","subscriptions","branding","onboarding","directory"].includes(id)?id:"overview");
   window.scrollTo({top:0,behavior:"instant"});
  };
  sync();window.addEventListener("hashchange",sync);window.addEventListener("popstate",sync);
  return()=>{window.removeEventListener("hashchange",sync);window.removeEventListener("popstate",sync)};
 },[]);
 function navigate(section:string){
  setActiveSection(section);
  window.history.pushState(null,"","#"+section);
  window.scrollTo({top:0,behavior:"instant"});
 }
 const [assisted,setAssisted]=useState({name:"",slug:"",kind:"academy",ownerEmail:"",ownerName:"",modules:["academy"] as string[]});
 const [invitationUrl,setInvitationUrl]=useState("");
 const [pendingCustomers,setPendingCustomers]=useState<{id:string;owner_email:string;organization_name:string;organization_slug:string;status:string;expires_at:string}[]>([]);
 const [assistedMessage,setAssistedMessage]=useState("");const [assistedBusy,setAssistedBusy]=useState(false);
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
 async function loadPendingCustomers(){
  try{
   const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
   if(!session)throw Error("Sign in first");
   const response=await fetch("/api/platform-admin/customer-invitations",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   const data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||"Unable to load invitations");
   setPendingCustomers(data.invitations);
  }catch(e){setAssistedMessage(e instanceof Error?e.message:"Unable to load invitations")}
 }
 async function rotatePending(id:string){
  try{
   const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
   if(!session)throw Error("Sign in first");
   const response=await fetch("/api/platform-admin/customer-invitations",{method:"POST",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({action:"rotate",id})});
   const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error||"Unable to rotate invitation");
   setInvitationUrl(body.invitationUrl);setAssistedMessage("A replacement link was issued. The previous link is invalid. Share this one securely.");
   await loadPendingCustomers();
  }catch(e){setAssistedMessage(e instanceof Error?e.message:"Unable to rotate invitation")}
 }
 async function revokePending(id:string){
  if(!window.confirm("Revoke this invitation? The link will stop working."))return;
  try{
   const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
   if(!session)throw Error("Sign in first");
   const response=await fetch("/api/platform-admin/customer-invitations",{method:"DELETE",
     headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({id})});
   const data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||"Revoke failed");
   await loadPendingCustomers();
  }catch(e){setAssistedMessage(e instanceof Error?e.message:"Revoke failed")}
 }
 async function createAssisted(){
  if(assistedBusy)return;setAssistedBusy(true);setAssistedMessage("");setInvitationUrl("");
  try{
   const client=getSupabaseBrowserClient();if(!client)throw Error("Sign in first");
   const {data:{session}}=await client.auth.getSession();if(!session)throw Error("Sign in first");
   const response=await fetch("/api/platform-admin/customer-invitations",{method:"POST",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify(assisted)});
   const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error||"Creation failed");
   setAssistedMessage("Invitation pending. The customer will be activated only after the invited Owner verifies their email and accepts.");
   setInvitationUrl(body.invitationUrl||"");
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
    </nav>
    <div className="platformSidebarFoot"><strong>Secure platform console</strong><span>Organization data remains separated by tenant and role.</span><Link href="/suite">Return to Suite</Link><SignOutButton className="platformSignout" label="Sign out"/></div>
   </aside>
   <div className="platformMain">
    <header className="platformTopbar"><div><span className="platformEyebrow">PLATFORM / ADMINISTRATION</span><h1>{activeSection==="overview"?"Control Centre":({customers:"Customers & access",subscriptions:"Subscriptions",branding:"Tenant branding",onboarding:"New customer",directory:"Customer directory"} as Record<string,string>)[activeSection]}</h1><p>{activeSection==="branding"?"Configure customer identity, logos and theme colors.":activeSection==="customers"?"Manage access, invitations and commercial branding entitlements.":"Manage your customers, access and subscriptions in one place."}</p></div><span className="platformRolePill"><span aria-hidden="true">●</span> Super Admin</span></header>
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
      <div className="platformColumns platformTabSections">
       <div id="customers" hidden={activeSection!=="customers"} className="platformPanel"><PlatformCustomerActions organizations={overview.organizations} onChanged={()=>setRefresh(x=>x+1)}/><PlatformBrandingEntitlements organizations={overview.organizations}/></div>
       <div id="subscriptions" hidden={activeSection!=="subscriptions"} className="platformPanel"><PlatformSubscriptions organizations={overview.organizations} onChanged={()=>setRefresh(x=>x+1)}/></div>
      </div>
      <div className="platformColumns platformTabSections">
       <div id="branding" hidden={activeSection!=="branding"} className="platformPanel"><PlatformTenantBranding organizations={overview.organizations}/></div>
       <section id="onboarding" hidden={activeSection!=="onboarding"} className="platformPanel platformOnboarding">
        <span className="platformEyebrow">NEW WORKSPACE</span><h2>Assisted onboarding</h2><p>Enter the customer details and Owner email. A secure invitation link will be created for manual delivery; no email is sent automatically.</p>
        <form onSubmit={e=>{e.preventDefault();void createAssisted()}} className="platformForm">
         <label>Owner email<input required type="email" value={assisted.ownerEmail} onChange={e=>setAssisted(v=>({...v,ownerEmail:e.target.value}))} placeholder="owner@example.com"/></label>
         <label>Owner name (optional)<input value={assisted.ownerName} onChange={e=>setAssisted(v=>({...v,ownerName:e.target.value}))} placeholder="Owner name"/></label>
         <label>Organization name<input required value={assisted.name} onChange={e=>setAssisted(s=>({...s,name:e.target.value,slug:s.slug||e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}))} placeholder="e.g. ABC Learning Academy"/></label>
         <label>URL slug<input required value={assisted.slug} onChange={e=>setAssisted(s=>({...s,slug:e.target.value}))} placeholder="abc-learning-academy"/></label>
         <label>Organization type<select value={assisted.kind} onChange={e=>setAssisted(s=>({...s,kind:e.target.value}))}><option value="academy">Academy</option><option value="institute">Institute</option><option value="tutor">Tutor</option></select></label>
         <fieldset><legend>Enabled trial modules</legend>{(["academy","crm","tasks"] as const).map(m=><label key={m} style={{display:"flex",gap:10,alignItems:"center"}}><input type="checkbox" style={{width:"auto"}} checked={assisted.modules.includes(m)} onChange={e=>setAssisted(s=>({...s,modules:e.target.checked?[...s.modules,m]:s.modules.filter(x=>x!==m)}))}/>{m==="academy"?"Academy":m==="crm"?"Connect CRM":"My Tasks"}</label>)}</fieldset>
         <button type="submit" disabled={assistedBusy||!assisted.ownerEmail||!assisted.name||!assisted.slug||assisted.modules.length===0}>{assistedBusy?"Creating…":"Create customer invitation"}</button>
         {invitationUrl&&<div role="status"><p>Secure invitation link (manual delivery; share only with intended Owner):</p><input value={invitationUrl} readOnly aria-label="Owner invitation link"/><button type="button" onClick={()=>void navigator.clipboard.writeText(invitationUrl)}>Copy invitation link</button></div>}
         {assistedMessage&&<p role="status" className="platformInlineMessage">{assistedMessage}</p>}
         <div><button type="button" onClick={()=>void loadPendingCustomers()}>Refresh pending invitations</button>
          {pendingCustomers.map(inv=><p key={inv.id}>{inv.organization_name} ({inv.organization_slug}) — {inv.owner_email} — {inv.status} — expires {new Date(inv.expires_at).toLocaleDateString()} {inv.status==="pending"&&<><button type="button" onClick={()=>void rotatePending(inv.id)}>Replace link</button><button type="button" onClick={()=>void revokePending(inv.id)}>Revoke</button></>}</p>)}
         </div>
        </form>
       </section>
      </div>
      <section id="directory" hidden={activeSection!=="directory"} className="platformDirectory platformPanel">
       <div className="platformDirectoryHead"><div><span className="platformEyebrow">CUSTOMER WORKSPACES</span><h2>Organization directory</h2><p>Find and review registered organizations.</p></div><label htmlFor="org-search">Search organizations<input id="org-search" value={search} onChange={e=>{setPage(1);setSearch(e.target.value)}} placeholder="Search by name"/></label></div>
       {overview.organizations.length===0?<p className="platformEmpty">No matching organizations found.</p>:<div className="platformTableScroll"><table><thead><tr><th>Organization</th><th>Workspace slug</th><th>Status</th><th>Created</th></tr></thead><tbody>{overview.organizations.map(o=><tr key={o.id}><td><strong>{o.display_name}</strong></td><td><code>{o.slug}</code></td><td><span className={"platformStatus "+(o.status==="active"?"platformStatusActive":"")}>{o.status}</span></td><td>{new Date(o.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>}
       <div className="platformPagination"><span>{overview.total} matching organizations · Page {page}</span><div><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>Previous</button><button disabled={page*20>=overview.total} onClick={()=>setPage(p=>p+1)}>Next</button></div></div>
      </section>
     </>}
    </div>
   </div>
  </div>
 </main>;
}
