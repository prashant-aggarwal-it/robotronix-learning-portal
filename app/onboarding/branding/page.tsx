"use client";
import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Owner={slug:string;name:string;configured:boolean;modules:string[]};
type Brand={tagline:string;logoUrl:string;accentColor:string};
export default function AcademyBranding(){
 const [owner,setOwner]=useState<Owner|null>(null);
 const [tagline,setTagline]=useState("");
 const [logoUrl,setLogoUrl]=useState("");
 const [accentColor,setAccentColor]=useState("#4537a5");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;(async()=>{try{
  const client=getSupabaseBrowserClient();if(!client)throw Error("Authentication unavailable.");
  const {data:{session}}=await client.auth.getSession();if(!session)throw Error("Sign in to configure branding.");
  const {data,error:setupError}=await client.rpc("saas_my_module_setup");
  if(setupError||!data||!data.modules?.includes("academy"))throw Error("An enabled Academy organization is required.");
  const setup=data as Owner;
  const brand=await client.rpc("saas_public_academy_brand",{p_slug:setup.slug});
  if(brand.error)throw brand.error;
  if(active){setOwner(setup);const b=brand.data as Brand|null;if(b){setTagline(b.tagline||"");setLogoUrl(b.logoUrl||"");setAccentColor(b.accentColor||"#4537a5");}}
 }catch(e){if(active)setError(e instanceof Error?e.message:"Unable to load academy branding.");}
 finally{if(active)setLoading(false);}
 })();return()=>{active=false};},[]);
 async function save(e:FormEvent){e.preventDefault();if(busy||!owner)return;setBusy(true);setError("");setNotice("");
  try{const client=getSupabaseBrowserClient();if(!client)throw Error("Authentication unavailable.");
   const {error:err}=await client.rpc("saas_save_academy_brand",{p_tagline:tagline,p_logo_url:logoUrl,p_accent_color:accentColor});
   if(err)throw err;setNotice("Academy branding saved.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to save branding.");}
  finally{setBusy(false);}
 }
 return <main className="authPage"><section className="authCard">
  <Link href="/" className="authBrand"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/></Link>
  <div className="formStepHead"><span>ORGANIZATION SETUP — STEP 3</span><h1>Customize your academy</h1><p>These public branding details appear on your academy-specific entry page.</p></div>
  {loading&&<p role="status">Loading academy…</p>}
  {owner&&<><p className="infoBanner">Your academy URL: <Link href={"/"+owner.slug}>/{owner.slug}</Link></p>
   <form className="formStack" onSubmit={save}>
    <label>Tagline<input className="input" maxLength={180} value={tagline} onChange={e=>setTagline(e.target.value)} disabled={busy} placeholder="Learn. Build. Create."/></label>
    <label>Logo image HTTPS URL<input className="input" type="url" value={logoUrl} onChange={e=>setLogoUrl(e.target.value)} disabled={busy} placeholder="https://example.com/logo.png"/></label>
    <p className="fieldHint">Image hosting and direct logo uploads will be added separately. Do not use private image links.</p>
    <label>Brand accent color<input className="input" type="color" value={accentColor} disabled={busy} onChange={e=>setAccentColor(e.target.value)}/></label>
    <button className="button fullButton" disabled={busy}>{busy?"Saving…":"Save academy branding"}</button>
   </form>
   <p style={{marginTop:16}}><Link href={"/"+owner.slug}>View academy entry page →</Link></p></>}
  {error&&<p className="errorBanner" role="alert">{error}</p>}
  {notice&&<p className="infoBanner" role="status">{notice}</p>}
 </section></main>;
}