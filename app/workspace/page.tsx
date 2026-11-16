"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {getSupabaseBrowserClient,setAcademyBrowserOrganizationContext} from "@/lib/supabase/browser";
import {loadAuthDeployment,loadSignedInAccess} from "@/lib/platform/auth-client";
type Workspace={id:string;slug:string;name:string;role:string;modules:string[];crmAccess:boolean;tasksAccess:boolean};
export default function WorkspacePage(){
 const router=useRouter();
 const [workspaces,setWorkspaces]=useState<Workspace[]>([]);
 const [current,setCurrent]=useState("");
 const [academyRole,setAcademyRole]=useState("");
 const [familyOrgs,setFamilyOrgs]=useState<string[]>([]);
 const [status,setStatus]=useState<"loading"|"ready"|"error">("loading");
 const [message,setMessage]=useState("");
 const [switching,setSwitching]=useState(false);
 async function persistSelection(id:string,token:string){
  const response=await fetch("/api/platform/organizations",{method:"POST",headers:{"content-type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({organizationId:id}),cache:"no-store"});
  if(!response.ok)throw Error("Organization selection was rejected.");
  setAcademyBrowserOrganizationContext(id);
 }
 async function selectOrganization(id:string){
  if(!id)return;setSwitching(true);setMessage("");
  try{const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
   if(!session)throw Error("Sign in first.");
   await persistSelection(id,session.access_token);setCurrent(id);
  }catch(e){setMessage(e instanceof Error?e.message:"Unable to select organization.");}
  finally{setSwitching(false);}
 }
 useEffect(()=>{let live=true;(async()=>{try{
  const client=getSupabaseBrowserClient();if(!client)throw Error("Authentication unavailable.");
  const {data:{session}}=await client.auth.getSession();
  if(!session){router.replace("/login");return;}
  const config=await loadAuthDeployment();
  if(config.mode!=="combined"||config.legacyDefault){router.replace("/");return;}
  const {data,error}=await client.rpc("saas_my_workspaces");
  if(error)throw error;
  const rows=Array.isArray(data)?data as Workspace[]:[];
  if(!rows.length){router.replace("/onboarding/organization");return;}
  const response=await fetch("/api/platform/organizations",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
  // A stale selected-organization cookie must not lock a valid user out.
  // The server independently checks membership before accepting the new selection.
  if(response.status===403){
   const reset=await fetch("/api/platform/organizations",{method:"DELETE",headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   if(!reset.ok)throw Error("Unable to clear an unavailable organization selection.");
  }else if(!response.ok)throw Error("Organization selection unavailable.");
  const selection=response.ok?await response.json():{selectedOrganizationId:null};
  const suggested=rows.find(x=>x.id===selection.selectedOrganizationId)?.id|| (rows.length===1?rows[0].id:"");
  if(suggested)await persistSelection(suggested,session.access_token);
  else setAcademyBrowserOrganizationContext(null);
  const access=await loadSignedInAccess(config);
  const family=await client.rpc("saas_my_academy_family");
  if(family.error)throw family.error;
  const permittedFamilyOrgIds=Array.isArray(family.data)?family.data.map((x:{organizationId?:string})=>x.organizationId).filter(Boolean) as string[]:[];
  if(live){setWorkspaces(rows);setCurrent(suggested);setAcademyRole(access.portal?.state==="active"?(access.portal.role||""):"");setFamilyOrgs(permittedFamilyOrgIds);setStatus("ready");}
 }catch{if(live){setMessage("Your workspace could not be loaded. Please refresh or sign in again.");setStatus("error");}}})();
 return()=>{live=false};},[router]);
 const org=workspaces.find(x=>x.id===current);
 const singleOrganization=workspaces.length===1;
 const hasFamilyAccess=Boolean(org&&familyOrgs.includes(org.id));
 const academyDestination=org&&["owner","admin"].includes(org.role)?"/"+org.slug+"/manage":org?.role==="trainer"?"/"+org.slug+"/trainer":hasFamilyAccess?"/"+org?.slug+"/family":null;
 const cards=[
  {id:"academy",name:"Academy",description:"Classes, students, trainers and family learning.",href:academyDestination,icon:"🎓",detail:org&&["owner","admin"].includes(org.role)?"Open Academy management":org?.role==="trainer"?"Open trainer workspace":hasFamilyAccess?"Open family portal":"Academy access setup pending"},
  {id:"crm",name:"Connect CRM",description:"Enquiries, admissions and communications.",href:singleOrganization&&org?.crmAccess?"/connect":null,icon:"📈",detail:"Open Connect CRM"},
  {id:"tasks",name:"My Tasks",description:"Workspaces, priorities and team tasks.",href:singleOrganization&&org?.tasksAccess?"/tasks":null,icon:"✅",detail:"Open My Tasks"}
 ].filter(card=>org?.modules.includes(card.id));
 return <main style={{minHeight:"100vh",background:"#f5f7fd",color:"#182440"}}>
  <header style={{maxWidth:1120,margin:"auto",padding:"28px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
   <Link href="/"><img src="/brand/robotronix-horizontal.png" alt="Robotronix" style={{width:185}}/></Link>
   <Link href="/login">Account</Link>
  </header>
  <section style={{maxWidth:1120,margin:"auto",padding:"36px 24px 80px"}}>
   <p style={{fontWeight:700,color:"#4a3fa1"}}>ROBOTRONIX EDUCATION SUITE</p>
   <h1 style={{fontSize:"clamp(30px,4vw,44px)",margin:"12px 0"}}>Your workspace</h1>
   {status==="loading"&&<p role="status">Loading authorized organizations…</p>}
   {status==="error"&&<p role="alert">{message}</p>}
   {workspaces.length>0&&<><label htmlFor="saas-org-switch" style={{display:"block",margin:"24px 0 8px",fontWeight:700}}>Organization</label>
   <select id="saas-org-switch" value={current} disabled={switching} onChange={e=>void selectOrganization(e.target.value)} style={{padding:13,borderRadius:10,border:"1px solid #cdd5e6",maxWidth:420,width:"100%"}}>
    <option value="">Choose an organization</option>
    {workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
   </select>
   {message&&<p role="alert">{message}</p>}
   {!org&&<p>Select an organization to continue.</p>}
   </>}
   {org&&<>
   <p style={{color:"#586581",marginTop:10}}>Welcome to {org.name}. <strong style={{textTransform:"capitalize"}}>{org.role}</strong> access · Choose an application to get started.</p>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,260px),1fr))",gap:18,marginTop:30}}>
    {cards.map(card=><article key={card.id} style={{background:"#fff",border:"1px solid #dce3f1",borderRadius:18,padding:26,boxShadow:"0 8px 28px #283b6c0b"}}>
     <span aria-hidden="true" style={{fontSize:34}}>{card.icon}</span><h2 style={{margin:"16px 0 8px"}}>{card.name}</h2><p style={{minHeight:65,color:"#5d6a83"}}>{card.description}</p>
     {card.href?<Link href={card.href} style={{fontWeight:700,color:"#4537a5"}}>{card.detail} →</Link>:<p style={{color:"#7a6070"}}>{card.detail}</p>}
    </article>)}
   </div>
   {org.role==="owner"&&<section style={{marginTop:36,background:"#fff",padding:24,border:"1px solid #dce3f1",borderRadius:18}}><h2 style={{margin:"0 0 14px",fontSize:21}}>Organization settings</h2><nav aria-label="Organization settings" style={{display:"flex",gap:14,flexWrap:"wrap",lineHeight:1.9}}><Link href="/workspace/invitations">Invite team members</Link> · <Link href="/workspace/families">Invite families</Link> · <Link href="/workspace/trainers">Link trainers</Link> · <Link href="/onboarding/products">Product configuration</Link>{org.modules.includes("academy")&&<> · <Link href="/onboarding/branding">Academy branding</Link> · <Link href={"/"+org.slug}>Academy entry page</Link></>}</nav></section>}

   </>}
  </section>
 </main>;
}