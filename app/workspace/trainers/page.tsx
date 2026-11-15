"use client";
import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Org={id:string;name:string;role:string;modules:string[]};
type Trainer={trainerId:string;name:string;linkedUserId:string|null};
type Member={id:string;user_id:string;email:string|null;role_key:string;status:string};
export default function TrainerAssignments(){
 const [orgs,setOrgs]=useState<Org[]>([]),[orgId,setOrgId]=useState("");
 const [trainers,setTrainers]=useState<Trainer[]>([]),[members,setMembers]=useState<Member[]>([]);
 const [trainerId,setTrainerId]=useState(""),[userId,setUserId]=useState("");
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{let live=true;(async()=>{try{
  const client=getSupabaseBrowserClient();if(!client)throw Error("Authentication unavailable");
  const {data,error}=await client.rpc("saas_my_workspaces");if(error)throw error;
  const rows=(Array.isArray(data)?data:[]).filter((o:Org)=>(o.role==="owner"||o.role==="admin")&&o.modules.includes("academy")) as Org[];
  if(live){setOrgs(rows);setOrgId(rows[0]?.id||"");}
 }catch(e){if(live)setMessage(e instanceof Error?e.message:"Unable to load academies");}})();return()=>{live=false};},[]);
 async function load(id:string){if(!id)return;
  const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;if(!session)return;
  const [t,m]=await Promise.all([
   client!.rpc("saas_admin_academy_trainers",{p_organization_id:id}),
   fetch("/api/platform/memberships?organizationId="+encodeURIComponent(id),{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"}).then(r=>r.json())
  ]);
  if(!t.error&&Array.isArray(t.data)){setTrainers(t.data);setTrainerId(t.data[0]?.trainerId||"");}
  const eligible=(m.members||[]).filter((x:Member)=>x.role_key==="trainer"&&x.status==="active");
  setMembers(eligible);setUserId(eligible[0]?.user_id||"");
 }
 useEffect(()=>{void load(orgId);},[orgId]);
 async function save(e:FormEvent){e.preventDefault();if(!orgId||!trainerId||!userId||busy)return;setBusy(true);setMessage("");
  try{
   const client=getSupabaseBrowserClient();if(!client)throw Error("Authentication unavailable");
   const {error}=await client.rpc("saas_assign_trainer_account",{p_organization_id:orgId,p_trainer_id:trainerId,p_user_id:userId});
   if(error)throw error;setMessage("Trainer login linked to the selected Academy trainer record.");await load(orgId);
  }catch(e){setMessage(e instanceof Error?e.message:"Unable to link trainer");}
  finally{setBusy(false);}
 }
 return <main className="authPage"><section className="authCard">
  <Link href="/workspace">← Suite workspace</Link><div className="formStepHead"><span>ACADEMY TEAM</span><h1>Link trainer accounts</h1><p>Associate invited trainers with existing Academy trainer records. This does not assign a global profile role.</p></div>
  <form className="formStack" onSubmit={save}>
   <label>Academy<select className="input" value={orgId} onChange={e=>setOrgId(e.target.value)}>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
   <label>Academy trainer record<select className="input" value={trainerId} onChange={e=>setTrainerId(e.target.value)}>{trainers.map(t=><option key={t.trainerId} value={t.trainerId}>{t.name}</option>)}</select></label>
   <label>Invited trainer account<select className="input" value={userId} onChange={e=>setUserId(e.target.value)}>{members.map(m=><option key={m.id} value={m.user_id}>{m.email||m.user_id}</option>)}</select></label>
   <button className="button" disabled={!trainerId||!userId||busy}>{busy?"Linking…":"Link trainer login"}</button>
  </form>
  {!trainers.length&&<p>No Academy trainer records are available for this organization yet.</p>}
  {!members.length&&<p>No active invited trainer accounts are available. Invite a trainer first.</p>}
  {message&&<p role="status">{message}</p>}
 </section></main>;
}