"use client";
import Link from "next/link";
import {useParams} from "next/navigation";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient,setAcademyBrowserOrganizationContext} from "@/lib/supabase/browser";
type Org={id:string;slug:string;role:string;modules:string[]};
type Learner={studentName:string;courseTitle:string;enrollmentStatus:string;sessionsCompleted:number};
type Data={academy:string;slug:string;trainerLinked:boolean;learners:Learner[]};
export default function TrainerAcademy(){
 const {academySlug}=useParams<{academySlug:string}>();
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;(async()=>{try{
  const client=getSupabaseBrowserClient();if(!client)throw Error("Authentication unavailable");
  const {data:{session}}=await client.auth.getSession();if(!session)throw Error("Sign in first");
  const {data:orgs,error:orgError}=await client.rpc("saas_my_workspaces");if(orgError)throw orgError;
  const org=(Array.isArray(orgs)?orgs:[]).find((o:Org)=>o.slug===academySlug&&o.role==="trainer"&&o.modules.includes("academy")) as Org|undefined;
  if(!org)throw Error("Trainer access is not assigned to this academy.");
  const r=await fetch("/api/platform/organizations",{method:"POST",headers:{"content-type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({organizationId:org.id})});
  if(!r.ok)throw Error("Academy selection was rejected");
  setAcademyBrowserOrganizationContext(org.id);
  const {data:result,error:dashboardError}=await client.rpc("saas_my_academy_trainer",{p_organization_id:org.id});
  if(dashboardError)throw dashboardError;
  if(live)setData(result as Data);
 }catch(e){if(live)setError(e instanceof Error?e.message:"Trainer workspace unavailable");}finally{if(live)setLoading(false);}})();return()=>{live=false};},[academySlug]);
 return <main style={{background:"#f5f7fd",minHeight:"100vh",padding:"42px 24px",color:"#182440"}}><div style={{maxWidth:900,margin:"auto"}}>
  <Link href="/workspace">← Suite workspace</Link>
  <h1 style={{margin:"24px 0 12px"}}>{data?.academy||"Trainer workspace"}</h1>
  {loading&&<p role="status">Verifying trainer access…</p>}
  {error&&<p role="alert">{error}</p>}
  {data&&!data.trainerLinked&&<div style={{background:"white",padding:24,borderRadius:14}}><h2>Trainer profile setup pending</h2><p>Your academy membership is active. Ask the academy administrator to link your login with your trainer record to see assigned learners.</p></div>}
  {data?.trainerLinked&&<><h2>Your assigned learners</h2>
   <div style={{display:"grid",gap:14}}>{data.learners.map((l,i)=><article key={l.studentName+"-"+i} style={{background:"white",border:"1px solid #dfe5f1",borderRadius:14,padding:22}}><h3>{l.studentName}</h3><p>{l.courseTitle}</p><p>{l.enrollmentStatus} · {l.sessionsCompleted||0} completed sessions</p></article>)}
   {!data.learners.length&&<p>No learners have been assigned to your trainer record yet.</p>}</div>
  </>}
 </div></main>;
}