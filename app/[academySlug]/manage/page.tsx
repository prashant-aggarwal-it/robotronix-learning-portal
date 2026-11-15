"use client";
import Link from "next/link";
import {useParams} from "next/navigation";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient,setAcademyBrowserOrganizationContext} from "@/lib/supabase/browser";
type Overview={organizationId:string;name:string;slug:string;students:number;trainers:number;courses:number;enrollments:number};
type Org={id:string;slug:string;role:string;modules:string[]};
export default function AcademyManagement(){
 const {academySlug}=useParams<{academySlug:string}>();
 const [info,setInfo]=useState<Overview|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(true);
 useEffect(()=>{let live=true;(async()=>{try{
  const client=getSupabaseBrowserClient();if(!client)throw Error("Authentication unavailable");
  const {data:{session}}=await client.auth.getSession();if(!session)throw Error("Sign in first");
  const {data:rows,error:memberError}=await client.rpc("saas_my_workspaces");if(memberError)throw memberError;
  const org=(Array.isArray(rows)?rows:[]).find((x:Org)=>x.slug===academySlug&&x.modules.includes("academy")&&["owner","admin"].includes(x.role)) as Org|undefined;
  if(!org)throw Error("Academy administrator access is not assigned to this account");
  const response=await fetch("/api/platform/organizations",{method:"POST",headers:{"content-type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({organizationId:org.id})});
  if(!response.ok)throw Error("Unable to select academy");
  setAcademyBrowserOrganizationContext(org.id);
  const {data,error}=await client.rpc("saas_admin_academy_overview",{p_organization_id:org.id});
  if(error)throw error;
  if(live)setInfo(data as Overview);
 }catch(e){if(live)setError(e instanceof Error?e.message:"Unable to open Academy");}
 finally{if(live)setBusy(false);}})();return()=>{live=false};},[academySlug]);
 return <main style={{minHeight:"100vh",padding:"42px 24px",background:"#f5f7fd",color:"#192541"}}>
 <div style={{maxWidth:980,margin:"auto"}}>
  <Link href="/workspace">← Suite workspace</Link>
  <h1 style={{fontSize:"clamp(30px,4vw,44px)",margin:"22px 0 10px"}}>{info?.name||"Academy workspace"}</h1>
  <p>Organization-scoped Academy administration</p>
  {busy&&<p role="status">Verifying academy access…</p>}
  {error&&<section role="alert" style={{padding:20,border:"1px solid #e9c5c5",borderRadius:12}}>{error}</section>}
  {info&&<>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14,marginTop:30}}>
    {([{label:"Students",value:info.students},{label:"Trainers",value:info.trainers},{label:"Courses",value:info.courses},{label:"Enrollments",value:info.enrollments}]).map(row=>
     <section key={row.label} style={{background:"#fff",padding:22,borderRadius:14,border:"1px solid #dfe5f2"}}>
      <div style={{fontSize:34,fontWeight:700}}>{row.value}</div><p>{row.label}</p>
     </section>)}
   </div>
   <section style={{background:"#fff",padding:26,borderRadius:14,marginTop:25}}>
    <h2>Manage your academy</h2>
    <ul style={{lineHeight:2.5}}>
     <li><Link href="/workspace/invitations">Invite staff and trainers</Link></li>
     <li><Link href="/workspace/families">Invite parents and students</Link></li>
     <li><Link href="/onboarding/branding">Academy branding and entry URL</Link></li>
     <li><Link href={"/"+academySlug}>Academy login page</Link></li>
    </ul>
    <p style={{color:"#596780",fontSize:13}}>Detailed legacy Academy pages remain protected by their existing role and tenant policies until cross-tenant regression tests are complete.</p>
   </section>
  </>}
 </div>
 </main>;
}