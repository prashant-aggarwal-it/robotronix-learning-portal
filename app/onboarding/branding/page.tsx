"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {BrandingStudio,type BrandingOrganization} from "@/features/branding/BrandingStudio";
export default function AcademyBranding(){
 const [organizations,setOrganizations]=useState<BrandingOrganization[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 useEffect(()=>{let active=true;(async()=>{try{
  const client=getSupabaseBrowserClient();if(!client)throw Error("Authentication unavailable");
  const {data:{session}}=await client.auth.getSession();if(!session)throw Error("Sign in first");
  const response=await fetch("/api/branding-studio/owner",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
  const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error||"Unable to load academy");
  if(active)setOrganizations(body.organizations as BrandingOrganization[]);
 }catch(e){if(active)setError(e instanceof Error?e.message:"Branding unavailable")}
 finally{if(active)setLoading(false)}})();return()=>{active=false};},[]);
 return <main className="authPage" style={{alignItems:"start"}}>
  <section className="authCard" style={{width:"min(1160px,100%)",maxWidth:"unset"}}>
   <Link href="/suite">← Return to Suite</Link>
   <div className="formStepHead"><span>ORGANIZATION SETUP — BRANDING</span>
    <h1>Customize your academy</h1><p>Create and preview a color palette that matches your logo.</p></div>
   {loading&&<p role="status">Loading accessible academies…</p>}
   {error&&<p className="errorBanner" role="alert">{error}</p>}
   {!loading&&!error&&organizations.length===0&&<p className="infoBanner">An active Academy Owner membership is required.</p>}
   {!loading&&!error&&organizations.length>0&&<BrandingStudio organizations={organizations} ownerMode/>}
  </section>
 </main>;
}
