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
 const actions=[
  {label:"Students, trainers, courses & enrollments",detail:"Create and manage your Academy records",href:"/"+academySlug+"/manage/records",icon:"📚"},
  {label:"Invite team members",detail:"Give staff and trainers access",href:"/workspace/invitations",icon:"👥"},
  {label:"Invite families",detail:"Connect parents and learners",href:"/workspace/families",icon:"✉️"},
  {label:"Link trainers",detail:"Connect trainer accounts to their records",href:"/workspace/trainers",icon:"🔗"},
  {label:"Academy email",detail:"Review your academy-owned email connections",href:"/"+academySlug+"/manage/email",icon:"✉️"},
  {label:"Academy branding",detail:"Customize the Academy identity",href:"/onboarding/branding",icon:"🎨"},
  {label:"Academy entry page",detail:"Preview the learner-facing entry point",href:"/"+academySlug,icon:"🌐"}
 ];
 return <main className="academyOwnerPage">
 <style>{`
 .academyOwnerPage{min-height:100vh;background:#f4f7fd;color:#192541;padding:32px 24px 80px;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
 .academyOwnerPage *{box-sizing:border-box}
 .academyOwnerWrap{max-width:1140px;margin:auto}
 .academyOwnerTop{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:30px}
 .academyOwnerTop a{color:#5633a5;text-decoration:none;font-weight:700}
 .academyOwnerBrand{width:180px;max-width:100%;height:auto}
 .academyOwnerHero{padding:32px;border-radius:24px;background:linear-gradient(120deg,#34215f,#7037b7 65%,#b338a5);color:white}
 .academyOwnerHero p{color:#efe4ff;margin:10px 0 0}
 .academyOwnerHero h1{font-size:clamp(30px,4vw,44px);margin:10px 0;letter-spacing:-.04em}
 .academyOwnerEyebrow{font-size:12px;font-weight:800;letter-spacing:.14em;color:#b9fff7!important}
 .academyOwnerStats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px;margin:22px 0 32px}
 .academyOwnerStat{background:#fff;border:1px solid #e1e6f2;border-radius:18px;padding:24px}
 .academyOwnerStat strong{font-size:36px;display:block;color:#281e51}
 .academyOwnerStat span{color:#5e6c86;font-size:14px;font-weight:650}
 .academyOwnerActions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}
 .academyOwnerAction{display:flex;align-items:center;gap:16px;padding:22px;background:#fff;border:1px solid #e1e6f2;border-radius:18px;color:#25264b;text-decoration:none;transition:transform .15s,box-shadow .15s}
 .academyOwnerAction:hover{transform:translateY(-2px);box-shadow:0 12px 28px #44368b15}
 .academyOwnerAction:focus-visible{outline:3px solid #7440cb;outline-offset:3px}
 .academyOwnerActionIcon{font-size:26px;display:grid;place-items:center;width:52px;height:52px;background:#f2edfc;border-radius:14px;flex-shrink:0}
 .academyOwnerActionText{flex:1;min-width:0}.academyOwnerActionText strong{display:block;margin-bottom:5px}.academyOwnerActionText small{color:#66738c;line-height:1.5}
 .academyOwnerSectionTitle{font-size:23px;margin:0 0 16px}
 @media(max-width:750px){.academyOwnerStats{grid-template-columns:repeat(2,minmax(0,1fr))}.academyOwnerActions{grid-template-columns:1fr}.academyOwnerPage{padding:20px 14px 50px}.academyOwnerHero{padding:25px}}
 `}</style>
 <div className="academyOwnerWrap">
  <header className="academyOwnerTop"><Link href="/workspace">← Education Suite workspace</Link><Link href="/workspace" aria-label="Back to suite"><img className="academyOwnerBrand" src="/brand/robotronix-horizontal.png" alt="Robotronix"/></Link></header>
  {busy&&<p role="status">Verifying Academy access…</p>}
  {error&&<section role="alert" style={{padding:20,background:"#fff1f3",color:"#a32347",borderRadius:12}}>{error}</section>}
  {info&&<>
   <section className="academyOwnerHero"><p className="academyOwnerEyebrow">ACADEMY · OWNER / ADMIN</p><h1>{info.name}</h1><p>Manage your learners, team and courses in one place.</p></section>
   <section className="academyOwnerStats" aria-label="Academy at a glance">
    {([{label:"Students",value:info.students},{label:"Trainers",value:info.trainers},{label:"Courses",value:info.courses},{label:"Enrollments",value:info.enrollments}]).map(item=><div className="academyOwnerStat" key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}
   </section>
   <h2 className="academyOwnerSectionTitle">Manage your academy</h2>
   <nav className="academyOwnerActions" aria-label="Academy management">
    {actions.map(action=><Link className="academyOwnerAction" key={action.href} href={action.href}><span className="academyOwnerActionIcon" aria-hidden="true">{action.icon}</span><span className="academyOwnerActionText"><strong>{action.label}</strong><small>{action.detail}</small></span><span aria-hidden="true">→</span></Link>)}
   </nav>
  </>}
 </div>
 </main>;
}
