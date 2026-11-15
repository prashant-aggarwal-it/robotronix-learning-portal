"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {loadAuthDeployment,loadSignedInAccess} from "@/lib/platform/auth-client";
type Workspace={id:string;slug:string;name:string;role:string;modules:string[];crmAccess:boolean;tasksAccess:boolean};
export default function WorkspacePage(){
 const router=useRouter();
 const [workspaces,setWorkspaces]=useState<Workspace[]>([]);
 const [current,setCurrent]=useState("");
 const [academyRole,setAcademyRole]=useState("");
 const [status,setStatus]=useState<"loading"|"ready"|"error">("loading");
 const [message,setMessage]=useState("");
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
  const access=await loadSignedInAccess(config);
  if(live){setWorkspaces(rows);setCurrent(rows[0].id);setAcademyRole(access.portal?.state==="active"?(access.portal.role||""):"");setStatus("ready");}
 }catch{if(live){setMessage("Your workspace could not be loaded. Please refresh or sign in again.");setStatus("error");}}})();
 return()=>{live=false};},[router]);
 const org=workspaces.find(x=>x.id===current);
 const singleOrganization=workspaces.length===1;
 const cards=[
  {id:"academy",name:"Academy",description:"Classes, students, trainers and family learning.",href:singleOrganization&&academyRole?"/"+academyRole:null,icon:"🎓",detail:academyRole?"Open "+academyRole+" dashboard":"Academy role setup is pending"},
  {id:"crm",name:"Connect CRM",description:"Enquiries, admissions and communications.",href:singleOrganization&&org?.crmAccess?"/connect":null,icon:"◈",detail:"Open Connect CRM"},
  {id:"tasks",name:"My Tasks",description:"Workspaces, priorities and team tasks.",href:singleOrganization&&org?.tasksAccess?"/tasks":null,icon:"✓",detail:"Open My Tasks"}
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
   {org&&<><label htmlFor="saas-org-switch" style={{display:"block",margin:"24px 0 8px",fontWeight:700}}>Organization</label>
   <select id="saas-org-switch" value={current} onChange={e=>setCurrent(e.target.value)} style={{padding:13,borderRadius:10,border:"1px solid #cdd5e6",maxWidth:420,width:"100%"}}>
    {workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
   </select>
   <p style={{color:"#586581",marginTop:10}}>You are a {org.role} of {org.name}. Only enabled products and verified workspace access are shown.</p>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,260px),1fr))",gap:18,marginTop:30}}>
    {cards.map(card=><article key={card.id} style={{background:"#fff",border:"1px solid #dce3f1",borderRadius:18,padding:26}}>
     <span aria-hidden="true" style={{fontSize:34}}>{card.icon}</span><h2 style={{margin:"16px 0 8px"}}>{card.name}</h2><p style={{minHeight:65,color:"#5d6a83"}}>{card.description}</p>
     {card.href?<Link href={card.href} style={{fontWeight:700,color:"#4537a5"}}>{card.detail} →</Link>:<p style={{color:"#7a6070"}}>{card.detail}</p>}
    </article>)}
   </div>
   {org.role==="owner"&&<p style={{marginTop:32}}><Link href="/workspace/invitations">Invite team members</Link> · <Link href="/onboarding/products">Product configuration</Link>{org.modules.includes("academy")&&<> · <Link href="/onboarding/branding">Academy branding</Link> · <Link href={"/"+org.slug}>Academy entry page</Link></>}</p>}
   <p style={{fontSize:13,color:"#66738c",marginTop:18}}>Choosing an organization here filters this launcher; linked application routes must enforce tenant membership independently. For accounts in multiple organizations, module links are disabled until each application can receive and verify the selected organization.</p>
   </>}
  </section>
 </main>;
}