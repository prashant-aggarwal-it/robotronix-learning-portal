"use client";
import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {loadAuthDeployment} from "@/lib/platform/auth-client";

type Setup={name:string;slug:string;configured:boolean;modules:string[]};
const options=[
 {id:"academy",label:"Academy",description:"Students, classes, trainers and parents"},
 {id:"crm",label:"Connect CRM",description:"Enquiries, admissions and customer relationships"},
 {id:"tasks",label:"My Tasks",description:"Personal priorities and collaborative work"}
];
export default function ProductSetup(){
 const router=useRouter();
 const [setup,setSetup]=useState<Setup|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [selected,setSelected]=useState<string[]>(["academy","crm","tasks"]);
 const [error,setError]=useState("");
 const [done,setDone]=useState(false);
 useEffect(()=>{let active=true;(async()=>{
  try{
   const client=getSupabaseBrowserClient();
   if(!client)throw Error("Authentication is unavailable");
   const {data:{session}}=await client.auth.getSession();
   if(!session){router.replace("/login");return;}
   const deployment=await loadAuthDeployment();
   if(deployment.mode!=="combined"||deployment.legacyDefault){router.replace("/");return;}
   const result=await client.rpc("saas_my_module_setup");
   if(result.error)throw result.error;
   if(!result.data){router.replace("/onboarding/organization");return;}
   if(active){setSetup(result.data as Setup);setSelected((result.data as Setup).configured?(result.data as Setup).modules:["academy","crm","tasks"]);}
  }catch{if(active)setError("Unable to load organization setup. Sign in again or refresh.");}
  finally{if(active)setLoading(false);}
 })();return()=>{active=false};},[router]);
 async function save(e:FormEvent){
  e.preventDefault();if(busy||selected.length===0||!setup||setup.configured)return;
  setBusy(true);setError("");
  try{
   const client=getSupabaseBrowserClient();if(!client)throw Error("Authentication unavailable");
   const result=await client.rpc("saas_provision_owned_modules",{p_modules:selected});
   if(result.error){setError(result.error.message);return;}
   setDone(true);
   setSetup({...setup,configured:true,modules:selected});
  }catch{setError("Unable to provision modules. Refresh and check your organization before retrying.");}
  finally{setBusy(false);}
 }
 return <main className="authPage"><section className="authCard">
  <Link href="/" className="authBrand"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/></Link>
  <div className="formStepHead"><span>ORGANIZATION SETUP — STEP 2</span><h1>Choose your applications</h1><p>Enable the tools your organization needs. This creates the required workspaces with your account as the owner.</p></div>
  {loading&&<p role="status">Loading organization setup…</p>}
  {setup&&<p className="infoBanner"><strong>{setup.name}</strong> · {setup.slug}</p>}
  {setup&&!setup.configured&&<form className="formStack" onSubmit={save}>
   <fieldset disabled={busy} style={{border:0,padding:0,margin:0}}>
    <legend style={{fontWeight:700,marginBottom:10}}>Applications</legend>
    {options.map(item=><label key={item.id} style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:16}}>
     <input type="checkbox" checked={selected.includes(item.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,item.id]:old.filter(x=>x!==item.id))}/>
     <span><strong>{item.label}</strong><br/><small>{item.description}</small></span>
    </label>)}
   </fieldset>
   <p className="fieldHint">Organization provisioning is a one-time setup. Changes to enabled products will require an administrator workflow in a later phase.</p>
   <button className="button fullButton" disabled={busy||!selected.length}>{busy?"Setting up applications…":"Enable selected applications"}</button>
  </form>}
  {setup?.configured&&<div className="infoBanner" role="status">
   <strong>{done?"Applications enabled successfully.":"Applications are already configured."}</strong>
   <p>Enabled: {setup.modules.join(", ")||"none"}.</p>
   <p>Your organization record and supported CRM/Tasks workspaces are linked. Academy role activation and the unified app launcher are part of subsequent work; this does not grant unrelated global permissions.</p>
  </div>}
  {error&&<div role="alert" className="errorBanner">{error}</div>}
  <p style={{marginTop:20}}><Link href="/">Return to homepage</Link></p>
 </section></main>;
}
