"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Org={id:string;slug:string;display_name:string;status:string;created_at:string};
type Overview={organizations:Org[];page:number;total:number;metrics:{organizations:number;trials:number;activeSubscriptions:number}};
export default function PlatformAdminPage(){
 const [overview,setOverview]=useState<Overview|null>(null);
 const [search,setSearch]=useState("");
 const [page,setPage]=useState(1);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
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
 },[page,search]);
 return <main style={{maxWidth:1120,margin:"0 auto",padding:"32px 20px",fontFamily:"system-ui",color:"#24233b"}}>
  <header style={{marginBottom:28}}><p style={{color:"#6546a0",fontWeight:700,letterSpacing:1}}>ROBOTRONIX EDUCATION SUITE</p><h1>Platform Administration</h1><p>Platform-wide customer directory and subscription overview. Academy operations remain inside each tenant.</p></header>
  {loading&&<p role="status">Loading platform overview…</p>}
  {error&&<p role="alert" style={{color:"#9b2346"}}>{error}</p>}
  {overview&&!loading&&<>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14,marginBottom:28}}>
    {([["Organizations",overview.metrics.organizations],["Active subscriptions",overview.metrics.activeSubscriptions],["Trial subscriptions",overview.metrics.trials]] as const).map(([label,value])=><section key={label} style={{border:"1px solid #ddd5eb",borderRadius:16,padding:20}}><p>{label}</p><strong style={{fontSize:32}}>{value}</strong></section>)}
   </div>
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
