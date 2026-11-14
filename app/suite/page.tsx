"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {suiteModuleById,type SuiteModuleId} from "@/lib/platform/suite-modules";
import {SuiteOrganizationSwitcher} from "@/components/SuiteOrganizationSwitcher";
import {SignOutButton} from "@/components/SignOutButton";
import {ThemeSwitcher} from "@/components/ThemeSwitcher";

type Product={id:SuiteModuleId;label:string;href:string};
type OrgResponse={ok:boolean;organizations:{id:string;displayName:string;role:string}[];selectedOrganizationId:string|null;requiresSelection:boolean};
type ModulesResponse={ok:boolean;modules:Record<string,boolean>};
async function request(path:string){
 const client=getSupabaseBrowserClient();
 if(!client)throw new Error("Authentication unavailable");
 const {data:{session}}=await client.auth.getSession();
 if(!session)throw new Error("Please sign in");
 const res=await fetch(path,{cache:"no-store",headers:{Authorization:"Bearer "+session.access_token}});
 const body=await res.json().catch(()=>null);
 if(!res.ok||!body?.ok)throw new Error(body?.error||"Unable to verify access");
 return body;
}
/** Landing page for verified module discovery. Never treats links as authorization. */
export default function SuiteHome(){
 const [products,setProducts]=useState<Product[]>([]);
 const [modules,setModules]=useState<Record<string,boolean>|null>(null);
 const [organizationName,setOrganizationName]=useState("");
 const [hasOrganizations,setHasOrganizations]=useState(false);
 const [organizationUnavailable,setOrganizationUnavailable]=useState(false);
 const [standalone,setStandalone]=useState(false);
 const [needsSelection,setNeedsSelection]=useState(false);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
  let active=true;
  (async()=>{
   const [p,capabilities]=await Promise.all([request("/api/platform/my-products"),request("/api/platform/capabilities")]);
   const singleModule=capabilities.legacyDefault!==true&&capabilities.products?.length===1;
   if(active)setStandalone(singleModule);
   if(!active)return;
   const verified=(p.products||[]).filter((x:Product)=>["portal","crm","tasks"].includes(x.id));
   setProducts(verified);
   // Legacy standalone CRM/Tasks deployments may intentionally not install SaaS.
   // When SaaS discovery is unavailable, existing product authorization still applies.
   try{
    const org=await request("/api/platform/organizations") as OrgResponse;
    if(!active)return;
    setHasOrganizations(org.organizations.length>0);
    setNeedsSelection(org.requiresSelection);
    const selected=org.organizations.find(x=>x.id===org.selectedOrganizationId);
    if(selected){
     setOrganizationName(selected.displayName);
     const access=await request("/api/platform/organization-modules?organizationId="+encodeURIComponent(selected.id)) as ModulesResponse;
     if(active)setModules(access.modules);
    }
   }catch{if(active){setHasOrganizations(false);setModules(null);setOrganizationUnavailable(!singleModule)}}
  })().catch(e=>{if(active)setError(e instanceof Error?e.message:"Unable to load your applications")})
  .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[]);
 const visible=products.filter(p=>!organizationUnavailable&&(standalone&&!hasOrganizations||!hasOrganizations||(!needsSelection&&modules?.[suiteModuleById(p.id).entitlement]===true)));
 return <main className="suiteHome">
  <header className="suiteHomeHeader">
   <div><span className="suiteEyebrow">Robotronix</span><h1>Education Suite</h1><p>Choose a workspace you are authorized to use.</p></div>
   <div className="suiteHomeControls"><SuiteOrganizationSwitcher/><ThemeSwitcher/><SignOutButton/></div>
  </header>
  {loading&&<p role="status">Checking your workspace access…</p>}
  {error&&<p role="alert" className="suiteOrgError">{error}</p>}
  {!loading&&!error&&organizationUnavailable&&<p role="alert">Organization permissions could not be verified. Use your existing application entry point until this service is configured.</p>}
  {!loading&&!error&&needsSelection&&<p role="status">Select an organization to view its enabled modules.</p>}
  {!loading&&!error&&hasOrganizations&&!needsSelection&&!modules&&<p role="alert">Module permissions could not be verified. Access is unavailable.</p>}
  {!loading&&!error&&organizationName&&<p>Active organization: <strong>{organizationName}</strong></p>}
  {!loading&&!error&&visible.length===0&&!needsSelection&&<p>No enabled modules are available for this account.</p>}
  <div className="suiteHomeGrid" aria-label="Your enabled applications">
   {!loading&&!error&&visible.map(p=>{
    const module=suiteModuleById(p.id);
    return <Link className="suiteHomeCard" href={p.href} key={p.id}>
     <span className="suiteHomeIcon" aria-hidden="true">{module.icon}</span>
     <strong>{module.label}</strong><span>{module.description}</span><small>Open module →</small>
    </Link>;
   })}
  </div>
  <p className="suiteHomeNote">Navigation visibility is informational. Each module enforces access independently. Legacy Academy pages are not yet certified for multi-organization data isolation.</p>
 </main>;
}
