"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import "./platform-admin.css";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import PlatformCustomerActions from "./PlatformCustomerActions";
import PlatformSubscriptions from "./PlatformSubscriptions";
import PlatformTenantBranding from "./PlatformTenantBranding";
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
 useEffect(()=>{const sync=()=>{const id=window.location.hash.slice(1);setActiveSection(["overview","customers","subscriptions","branding","onboarding","directory"].includes(id)?id:"overview");};sync();window.addEventListener("hashchange",sync);return()=>window.removeEventListener("hashchange",sync);},[]);
 const [assisted,setAssisted]=useState({name:"",slug:"",kind:"academy",ownerId:""});
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
 async function createAssisted(){
  if(assistedBusy)return;setAssistedBusy(true);setAssistedMessage("");
  try{
   const client=getSupabaseBrowserClient();if(!client)throw Error("Sign in first");
   const {data:{session}}=await client.auth.getSession();if(!session)throw Error("Sign in first");
   const response=await fetch("/api/platform/onboard",{method:"POST",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({...assisted,assisted:true,modules:["academy"],requestKey:crypto.randomUUID()})});
   const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error||"Creation failed");
   setAssistedMessage("Created "+body.slug+". Refresh the organization directory to see the new tenant.");
  }catch(e){setAssistedMessage(e instanceof Error?e.message:"Creation failed")}finally{setAssistedBusy(false)}
 }
 return <main className="platformConsole">
  <div className="platformLayout">
   <aside className="platformSidebar" aria-label="Platform navigation">
    <Link href="/" className="platformBrand"><img src="/brand/robotronix-horizontal.png" alt="Robotronix" /></Link>
    <span className="platformWorkspaceLabel">EDUCATION SUITE</span>
    <div className="platformWorkspaceName"><span className="platformWorkspaceIcon">✦</span><span>Control Centre<small>Platform administration</small></span></div>
    <nav className="platformNav">
     <a href="#overview" className={activeSection==="overview"?"platformNavActive":undefined} aria-current={activeSection==="overview"?"location":undefined}>◫ <span>Overview</span></a>
     <a href="#customers" className={activeSection==="customers"?"platformNavActive":undefined} aria-current={activeSection==="customers"?"location":undefined}>♧ <span>Customers & access</span></a>
     <a href="#subscriptions" className={activeSection==="subscriptions"?"platformNavActive":undefined} aria-current={activeSection==="subscriptions"?"location":undefined}>▤ <span>Subscriptions</span></a>
     <a href="#branding" className={activeSection==="branding"?"platformNavActive":undefined} aria-current={activeSection==="branding"?"location":undefined}>◈ <span>Tenant branding</span></a>
     <a href="#onboarding" className={activeSection==="onboarding"?"platformNavActive":undefined} aria-current={activeSection==="onboarding"?"location":undefined}>✚ <span>New customer</span></a>
     <a href="#directory" className={activeSection==="directory"?"platformNavActive":undefined} aria-current={activeSection==="directory"?"location":undefined}>▦ <span>Directory</span></a>
    </nav>
    <div className="platformSidebarFoot"><strong>Secure platform console</strong><span>Organization data remains separated by tenant and role.</span><Link href="/suite">Return to Suite</Link></div>
   </aside>
   <div className="platformMain">
    <header className="platformTopbar"><div><span className="platformEyebrow">PLATFORM / ADMINISTRATION</span><h1>Control Centre</h1><p>Manage your customers, access and subscriptions in one place.</p></div><span className="platformRolePill"><span aria-hidden="true">●</span> Super Admin</span></header>
    <div className="platformContent">
     {loading&&<div className="platformFeedback" role="status">Loading platform overview…</div>}
     {error&&<div className="platformFeedback platformError" role="alert">{error}</div>}
     {overview&&!loading&&<>
      <section id="overview" className="platformOverview" aria-label="Platform overview">
       <div className="platformSectionIntro"><div><span className="platformEyebrow">YOUR PLATFORM AT A GLANCE</span><h2>Overview</h2></div><span className="platformReadOnlyHint">Live DEV workspace</span></div>
       <div className="platformMetricGrid">
        {([{label:"Customer organizations",value:overview.metrics.organizations,icon:"▣",note:"Registered workspaces"},{label:"Active subscriptions",value:overview.metrics.activeSubscriptions,icon:"◉",note:"Current paid plans"},{label:"Trial subscriptions",value:overview.metrics.trials,icon:"◷",note:"Evaluation workspaces"}] as const).map(metric=><article className="platformMetric" key={metric.label}><div className="platformMetricTop"><span>{metric.label}</span><span className="platformMetricIcon" aria-hidden="true">{metric.icon}</span></div><strong>{metric.value}</strong><small>{metric.note}</small></article>)}
       </div>
      </section>
      <div className="platformColumns">
       <div id="customers" className="platformPanel"><PlatformCustomerActions organizations={overview.organizations} onChanged={()=>setRefresh(x=>x+1)}/></div>
       <div id="subscriptions" className="platformPanel"><PlatformSubscriptions organizations={overview.organizations} onChanged={()=>setRefresh(x=>x+1)}/></div>
      </div>
      <div className="platformColumns">
       <div id="branding" className="platformPanel"><PlatformTenantBranding organizations={overview.organizations}/></div>
       <section id="onboarding" className="platformPanel platformOnboarding">
        <span className="platformEyebrow">NEW WORKSPACE</span><h2>Assisted onboarding</h2><p>Create a trial for an existing, verified customer account. No email invitation is sent automatically.</p>
        <form onSubmit={e=>{e.preventDefault();void createAssisted()}} className="platformForm">
         <label>Owner Auth UUID<input required value={assisted.ownerId} onChange={e=>setAssisted(s=>({...s,ownerId:e.target.value}))} placeholder="Verified customer's user ID"/></label>
         <label>Organization name<input required value={assisted.name} onChange={e=>setAssisted(s=>({...s,name:e.target.value}))} placeholder="e.g. ABC Learning Academy"/></label>
         <label>URL slug<input required value={assisted.slug} onChange={e=>setAssisted(s=>({...s,slug:e.target.value}))} placeholder="abc-learning-academy"/></label>
         <label>Organization type<select value={assisted.kind} onChange={e=>setAssisted(s=>({...s,kind:e.target.value}))}><option value="academy">Academy</option><option value="institute">Institute</option><option value="tutor">Tutor</option></select></label>
         <button type="submit" disabled={assistedBusy||!assisted.ownerId||!assisted.name||!assisted.slug}>{assistedBusy?"Creating…":"Create trial workspace"}</button>
         {assistedMessage&&<p role="status" className="platformInlineMessage">{assistedMessage}</p>}
        </form>
       </section>
      </div>
      <section id="directory" className="platformDirectory platformPanel">
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
