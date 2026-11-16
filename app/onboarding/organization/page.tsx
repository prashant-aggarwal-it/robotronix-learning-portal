"use client";
import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {loadAuthDeployment,loadSignedInAccess} from "@/lib/platform/auth-client";
import {resolveAuthDestination} from "@/lib/platform/auth-routing";

export default function OrganizationOnboarding(){
 const router=useRouter();
 const [status,setStatus]=useState<"checking"|"ready"|"done"|"owned"|"error">("checking");
 const [message,setMessage]=useState("");
 const [name,setName]=useState("");
 const [slug,setSlug]=useState("");
 const [changedSlug,setChangedSlug]=useState(false);
 const [busy,setBusy]=useState(false);
 const [created,setCreated]=useState("");
 const [provisionedModules,setProvisionedModules]=useState<string[]>([]);
 const [kind,setKind]=useState("academy");
 const [modules,setModules]=useState<string[]>(["academy","crm","tasks"]);
 const [requestKey]=useState(()=>crypto.randomUUID());
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
    const existing=await client.rpc("saas_my_owned_organization");
    if(existing.error)throw existing.error;
    const owned=existing.data as {slug?:string}|null;
    if(owned?.slug){setCreated(owned.slug);setStatus("owned");return;}
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
   const {data:{session}}=await client.auth.getSession();
   if(!session)throw Error("Sign in first");
   const response=await fetch("/api/platform/onboard",{method:"POST",headers:{"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({name:name.trim(),slug:slug.trim().toLowerCase(),kind,modules,requestKey})});
   const result=await response.json() as {ok?:boolean;slug?:string;error?:string};
   if(!response.ok||!result.ok){setMessage(result.error||"Unable to create organization");return;}
   setCreated(result?.slug??slug);
   setProvisionedModules(modules);
   setStatus("done");
  }catch{setMessage("Could not create the organization. Please try again.");}
  finally{setBusy(false);}
 }
 const reservedSlugs=new Set(["admin","api","auth","app","apps","connect","login","signup","tasks","portal","student","parent","trainer","onboarding","workspace","www","support","settings","robotronix","platform-admin"]);
 const slugReserved=reservedSlugs.has(slug.trim().toLowerCase());
 const normalize=(value:string)=>value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,63);
 return <main className="orgSetupPage">
 <style>{`
 .orgSetupPage{min-height:100dvh;display:grid;place-items:center;padding:20px 24px;background:radial-gradient(ellipse at 12% 17%,#eadfff,transparent 45%),radial-gradient(ellipse at 90% 88%,#ffe0ef,transparent 46%),linear-gradient(135deg,#fffaff,#f7f8ff);color:#211b45;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
 .orgSetupPage *{box-sizing:border-box}
 .orgSetupShell{width:min(1060px,100%);display:grid;grid-template-columns:minmax(0,.84fr) minmax(0,1.16fr);border:1px solid #e7def3;background:white;border-radius:28px;overflow:hidden;box-shadow:0 28px 80px #51328b20}
 .orgSetupAside{padding:38px;background:radial-gradient(circle at 90% 5%,#e84fb85e,transparent 37%),radial-gradient(circle at 6% 96%,#23c6cb65,transparent 36%),linear-gradient(145deg,#352060,#703dc4 65%,#aa3c99);color:white;display:flex;flex-direction:column;justify-content:space-between;gap:26px}
 .orgSetupAside small{color:#aef2ec;font-size:11px;letter-spacing:.16em;font-weight:850}
 .orgSetupAside h2{font-size:clamp(28px,3vw,39px);letter-spacing:-.04em;line-height:1.17;margin:18px 0}
 .orgSetupAside p{font-size:14px;color:#f2e9ff;line-height:1.65}
 .orgSetupPoints{display:grid;gap:12px}.orgSetupPoints span{display:flex;gap:11px;align-items:center;font-size:13px;font-weight:700}
 .orgSetupPoints b{display:grid;place-items:center;width:32px;height:32px;border:1px solid #ffffff60;border-radius:10px;background:#ffffff1d}
 .orgSetupForm{padding:34px clamp(26px,4vw,51px);min-width:0}
 .orgSetupBrand{display:inline-block;margin-bottom:24px}.orgSetupBrand img{display:block;width:245px;max-width:100%;height:auto}
 .orgSetupSteps{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:25px}.orgSetupSteps span{font-size:11px;font-weight:750;color:#77728f;background:#faf8fd;border:1px solid #e9e1f2;padding:7px 10px;border-radius:999px}.orgSetupSteps span:nth-child(2){color:#6532b6;background:#f1e8ff;border-color:#d7bbf4}
 .orgSetupForm h1{font-size:clamp(29px,3vw,36px);letter-spacing:-.045em;line-height:1.15;margin:0 0 10px}
 .orgSetupIntro{font-size:14px;line-height:1.6;color:#6d738b;margin:0 0 25px}
 .orgSetupFields{display:grid;gap:19px}.orgSetupFields label{display:grid;gap:8px;font-size:13px;color:#303451;font-weight:750}
 .orgSetupFields input{width:100%;border:1px solid #dcd9ed;border-radius:12px;padding:13px 15px;background:white;color:#252544;font-size:15px;outline-offset:3px}
 .orgSetupFields input:focus{border-color:#8850d6;outline:2px solid #e9dcfa}
 .orgSetupHint{font-size:12px;line-height:1.55;color:#78809a;margin:-7px 0 0}.orgSetupHint strong{color:#5d36ab}
 .orgSetupSubmit,.orgSetupContinue{display:inline-flex;justify-content:center;align-items:center;border:0;border-radius:12px;padding:15px 21px;background:linear-gradient(100deg,#703bd2,#cd349f);color:white;font-size:14px;font-weight:800;text-decoration:none;box-shadow:0 10px 23px #703bd230}
 .orgSetupContinue,.orgSetupContinue:link,.orgSetupContinue:visited{color:#fff!important;-webkit-text-fill-color:#fff!important;font-weight:800;text-decoration:none}.orgSetupContinue:hover,.orgSetupContinue:focus-visible{color:#fff!important;-webkit-text-fill-color:#fff!important;filter:brightness(1.07);box-shadow:0 12px 26px #703bd244}.orgSetupContinue:focus-visible{outline:3px solid #4935a8;outline-offset:3px}.orgSetupSubmit{width:100%;cursor:pointer}.orgSetupSubmit:disabled{opacity:.55;cursor:not-allowed}
 .orgSetupMessage{background:#f6efff;border:1px solid #d6c4f0;color:#573097;padding:18px;border-radius:14px;font-size:14px;line-height:1.6}.orgSetupMessage p{margin:10px 0}.orgSetupMessage a{color:#5b2dac;font-weight:750}
 .orgSetupError{background:#fff0f3;border:1px solid #f1c4d2;color:#9c2346;padding:14px;border-radius:12px;margin:12px 0}
 .orgSetupBottom{font-size:13px;text-align:center;margin:22px 0 0}.orgSetupBottom a{color:#6534ba;text-decoration:none;font-weight:700}
 @media(max-width:790px){.orgSetupShell{grid-template-columns:1fr;max-width:590px}.orgSetupAside{padding:26px 30px;gap:8px}.orgSetupAside h2{font-size:26px;margin:8px 0}.orgSetupPoints{display:none}.orgSetupForm{padding:27px}.orgSetupPage{padding:16px}}
 @media(max-width:420px){.orgSetupForm{padding:23px}.orgSetupSteps span{font-size:10px;padding:6px 8px}}
 `}</style>
 <div className="orgSetupShell">
  <aside className="orgSetupAside"><div><small>STEP 2 · YOUR ORGANIZATION</small><h2>Give your learning space its identity.</h2><p>Whether you run an academy, school, training center or upskilling program, start with the name your learners know.</p></div><div className="orgSetupPoints"><span><b>01</b> Choose your organization name</span><span><b>02</b> Create a unique URL identifier</span><span><b>03</b> Choose the tools you need next</span></div></aside>
  <section className="orgSetupForm">
   <Link href="/" className="orgSetupBrand" aria-label="Robotronix home"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/></Link>
   <div className="orgSetupSteps" aria-label="Setup journey"><span>1 · Account</span><span>2 · Organization</span><span>3 · Workspace</span><span>4 · Branding</span></div>
   <h1>Set up your organization</h1><p className="orgSetupIntro">Add your organization's name and choose its unique link. You'll be its first owner and can configure your applications next.</p>
   {status==="checking"&&<p role="status">Checking your account access…</p>}
   {status==="error"&&<div className="orgSetupError" role="alert">{message}</div>}
   {status==="ready"&&<form className="orgSetupFields" onSubmit={create}>
    <label htmlFor="org-name">Organization name<input id="org-name" required minLength={2} maxLength={160} value={name} disabled={busy} placeholder="e.g. Bright Minds Learning" onChange={e=>{setName(e.target.value);if(!changedSlug)setSlug(normalize(e.target.value));}}/></label>
    <label htmlFor="org-slug">Unique URL identifier<input id="org-slug" required minLength={3} maxLength={63} pattern="[a-z0-9]+(-[a-z0-9]+)*" title="Use lowercase letters, digits and single hyphens" value={slug} disabled={busy} placeholder="bright-minds-learning" onChange={e=>{setChangedSlug(true);setSlug(e.target.value.toLowerCase());}}/></label>
    <label htmlFor="org-kind">Organization type<select id="org-kind" value={kind} onChange={e=>setKind(e.target.value)}><option value="academy">Academy</option><option value="institute">Institute</option><option value="tutor">Individual tutor</option></select></label>
    <fieldset><legend>Applications</legend>{(["academy","crm","tasks"] as const).map(m=><label key={m} style={{display:"flex",gap:8,alignItems:"center"}}><input type="checkbox" style={{width:"auto"}} checked={modules.includes(m)} onChange={e=>setModules(old=>e.target.checked?[...old,m]:old.filter(x=>x!==m))}/>{m==="academy"?"Academy":m==="crm"?"Connect CRM":"My Tasks"}</label>)}</fieldset>
    {slugReserved&&<div className="orgSetupError" role="alert">This URL identifier is reserved. Try <strong>robotronix-academy</strong> or another unique identifier.</div>}
    <p className="orgSetupHint">Your identifier: <strong>{slug||"your-organization"}</strong>. This forms part of your organization-specific URL and can be branded after setup.</p>
    {message&&<div className="orgSetupError" role="alert">{message}</div>}
    <button className="orgSetupSubmit" disabled={busy||name.trim().length<2||slug.length<3||slugReserved||modules.length===0}>{busy?"Creating organization…":"Create organization & continue →"}</button>
   </form>}
   {(status==="owned"||status==="done")&&<div className="orgSetupMessage" role="status"><strong>{status==="owned"?"Your organization already exists.":"Organization created successfully!"}</strong><p>Identifier: <strong>{created}</strong>. {status==="done"?"Your owner membership and selected application workspaces were created together." :"Continue to your organization workspace."}</p>{status==="done"&&<p>Selected applications: <strong>{provisionedModules.join(", ")}</strong>. Your organization starts with a standard trial; any complimentary internal subscription is assigned separately through Platform Administration.</p>}<Link className="orgSetupContinue" href="/workspace">Open workspace →</Link></div>}
   <p className="orgSetupBottom"><Link href="/">Back to homepage</Link></p>
  </section>
 </div>
 </main>;
}
