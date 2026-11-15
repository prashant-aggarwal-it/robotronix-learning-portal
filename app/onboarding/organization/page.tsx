"use client";
import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {loadAuthDeployment,loadSignedInAccess} from "@/lib/platform/auth-client";
import {resolveAuthDestination} from "@/lib/platform/auth-routing";

export default function OrganizationOnboarding(){
 const router=useRouter();
 const [status,setStatus]=useState<"checking"|"ready"|"done"|"error">("checking");
 const [message,setMessage]=useState("");
 const [name,setName]=useState("");
 const [slug,setSlug]=useState("");
 const [changedSlug,setChangedSlug]=useState(false);
 const [busy,setBusy]=useState(false);
 const [created,setCreated]=useState("");
 useEffect(()=>{
  let active=true;
  async function check(){
   try{
    const client=getSupabaseBrowserClient();
    if(!client)throw Error("Authentication is unavailable.");
    const {data:{session}}=await client.auth.getSession();
    if(!active)return;
    if(!session){router.replace("/login");return;}
    const config=await loadAuthDeployment();
    if(config.mode!=="combined"||config.legacyDefault){router.replace("/");return;}
    const access=await loadSignedInAccess(config);
    const next=resolveAuthDestination(config,access,null);
    if(!active)return;
    if(next.denied){setMessage(next.denied);setStatus("error");return;}
    if(next.path!=="/onboarding/organization"){router.replace(next.path);return;}
    setStatus("ready");
   }catch{if(active){setMessage("Unable to verify your account. Please sign in again.");setStatus("error");}}
  }
  void check();return()=>{active=false};
 },[router]);
 async function create(e:FormEvent){
  e.preventDefault();
  if(busy||status!=="ready")return;
  setBusy(true);setMessage("");
  try{
   const client=getSupabaseBrowserClient();
   if(!client)throw Error("Authentication unavailable.");
   const {data,error}=await client.rpc("saas_create_owned_organization",{p_name:name.trim(),p_slug:slug.trim().toLowerCase()});
   if(error){setMessage(error.message);return;}
   const result=data as {slug?:string;name?:string}|null;
   setCreated(result?.slug??slug);
   setStatus("done");
  }catch{setMessage("Could not create the organization. Please try again.");}
  finally{setBusy(false);}
 }
 const normalize=(value:string)=>value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,63);
 return <main className="authPage"><section className="authCard">
  <Link href="/" className="authBrand"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/></Link>
  <div className="formStepHead"><span>ORGANIZATION SETUP</span><h1>Set up your academy</h1><p>Choose your academy name and a unique URL identifier. Your account will be its first owner.</p></div>
  {status==="checking"&&<p role="status">Checking your account access…</p>}
  {status==="error"&&<div className="errorBanner" role="alert">{message}</div>}
  {status==="ready"&&<form className="formStack" onSubmit={create}>
   <label>Academy or organization name<input className="input" required minLength={2} maxLength={160} value={name} disabled={busy} placeholder="Bright Minds Academy" onChange={e=>{setName(e.target.value);if(!changedSlug)setSlug(normalize(e.target.value));}}/></label>
   <label>Academy URL identifier<input className="input" required minLength={3} maxLength={63} pattern="[a-z0-9]+(-[a-z0-9]+)*" title="Use lowercase letters, digits and single hyphens" value={slug} disabled={busy} placeholder="bright-minds" onChange={e=>{setChangedSlug(true);setSlug(e.target.value.toLowerCase());}}/></label>
   <p className="fieldHint">Your academy identifier: <strong>{slug||"your-academy"}</strong>. Academy-specific public URLs and branding will be enabled in a later phase.</p>
   {message&&<div className="errorBanner" role="alert">{message}</div>}
   <button className="button fullButton" disabled={busy||name.trim().length<2||slug.length<3}>{busy?"Creating your academy…":"Create organization"}</button>
  </form>}
  {status==="done"&&<div className="infoBanner" role="status">
   <strong>Organization created successfully.</strong>
   <p>Academy identifier: <strong>{created}</strong>. Your owner membership is active. Product selection and workspace provisioning are next in Milestone A, Phase 4.</p>
   <p>No CRM, Academy or Tasks workspace has been created as part of this step.</p>
  </div>}
  <p style={{marginTop:22}}><Link href="/">Return to homepage</Link></p>
 </section></main>;
}
