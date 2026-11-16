"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import PlatformCustomerActions from "./PlatformCustomerActions";
import PlatformSubscriptions from "./PlatformSubscriptions";
type Org={id:string;slug:string;display_name:string;status:string;created_at:string};
type Overview={organizations:Org[];page:number;total:number;metrics:{organizations:number;trials:number;activeSubscriptions:number}};
export default function PlatformAdminPage(){
 const [overview,setOverview]=useState<Overview|null>(null);
 const [search,setSearch]=useState("");
 const [page,setPage]=useState(1);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [refresh,setRefresh]=useState(0);
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
 return <main style={{maxWidth:1120,margin:"0 auto",padding:"32px 20px",fontFamily:"system-ui",color:"#24233b"}}>
  <header style={{marginBottom:28}}><p style={{color:"#6546a0",fontWeight:700,letterSpacing:1}}>ROBOTRONIX EDUCATION SUITE</p><h1>Platform Administration</h1><p>Platform-wide customer directory and subscription overview. Academy operations remain inside each tenant.</p></header>
  {loading&&<p role="status">Loading platform overview…</p>}
  {error&&<p role="alert" style={{color:"#9b2346"}}>{error}</p>}
  {overview&&!loading&&<>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14,marginBottom:28}}>
    {([["Organizations",overview.metrics.organizations],["Active subscriptions",overview.metrics.activeSubscriptions],["Trial subscriptions",overview.metrics.trials]] as const).map(([label,value])=><section key={label} style={{border:"1px solid #ddd5eb",borderRadius:16,padding:20}}><p>{label}</p><strong style={{fontSize:32}}>{value}</strong></section>)}
   </div>
   <PlatformCustomerActions organizations={overview.organizations} onChanged={()=>setRefresh(x=>x+1)}/>
   <PlatformSubscriptions organizations={overview.organizations} onChanged={()=>setRefresh(x=>x+1)}/>
   <section style={{border:"1px solid #ddd5eb",borderRadius:16,padding:20,marginBottom:24}}><h2>Assisted onboarding</h2><p>Create a trial for an existing, verified customer Auth user. This does not send an email invitation.</p><div style={{display:"grid",gap:12,maxWidth:520}}><label>Owner Auth UUID<input value={assisted.ownerId} onChange={e=>setAssisted(s=>({...s,ownerId:e.target.value}))} style={{display:"block",width:"100%"}}/></label><label>Organization name<input value={assisted.name} onChange={e=>setAssisted(s=>({...s,name:e.target.value}))} style={{display:"block",width:"100%"}}/></label><label>URL slug<input value={assisted.slug} onChange={e=>setAssisted(s=>({...s,slug:e.target.value}))} style={{display:"block",width:"100%"}}/></label><label>Type<select value={assisted.kind} onChange={e=>setAssisted(s=>({...s,kind:e.target.value}))}><option value="academy">Academy</option><option value="institute">Institute</option><option value="tutor">Tutor</option></select></label><button disabled={assistedBusy||!assisted.ownerId||!assisted.name||!assisted.slug} onClick={()=>void createAssisted()}>Create assisted trial</button>{assistedMessage&&<p role="status">{assistedMessage}</p>}</div></section>
   <section style={{border:"1px solid #ddd5eb",borderRadius:16,padding:20}}>
    <h2>Customer organizations</h2>
    <label htmlFor="org-search">Search organizations</label>{" "}
    <input id="org-search" value={search} onChange={e=>{setPage(1);setSearch(e.target.value)}} placeholder="Organization name" style={{padding:9,borderRadius:8,border:"1px solid #aaa"}}/>
    {overview.organizations.length===0?<p>No matching organizations.</p>:<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",marginTop:20,textAlign:"left"}}>
     <thead><tr><th>Organization</th><th>Slug</th><th>Status</th><th>Created</th></tr></thead>
     <tbody>{overview.organizations.map(o=><tr key={o.id}><td style={{padding:"12px 0"}}>{o.display_name}</td><td>{o.slug}</td><td>{o.status}</td><td>{new Date(o.created_at).toLocaleDateString()}</td></tr>)}</tbody>
    </table></div>}
    <div style={{display:"flex",gap:12,alignItems:"center",marginTop:20}}><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page} · {overview.total} matching</span><button disabled={page*20>=overview.total} onClick={()=>setPage(p=>p+1)}>Next</button></div>
   </section>
  </>}
 </main>;
}
