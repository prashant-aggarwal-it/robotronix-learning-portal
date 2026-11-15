"use client";
import Link from "next/link";
import {Suspense,useEffect,useState} from "react";
import {useRouter,useSearchParams} from "next/navigation";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
function AcceptFamilyInvitation(){
 const router=useRouter(),query=useSearchParams(),token=query.get("token")||"";
 const [signedIn,setSignedIn]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{const c=getSupabaseBrowserClient();void c?.auth.getSession().then(({data})=>setSignedIn(Boolean(data.session)));},[]);
 async function accept(){
  if(!/^[a-f0-9]{64}$/.test(token)||busy)return;setBusy(true);setMessage("");
  try{
   const client=getSupabaseBrowserClient();if(!client)throw Error("Authentication unavailable");
   const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
   const hash=Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,"0")).join("");
   const {data,error}=await client.rpc("saas_accept_academy_family_invite",{p_token_sha256:hash});
   if(error)throw Error("Invitation invalid or expired, or email does not match the invited account.");
   const family=await client.rpc("saas_my_academy_family");
   const row=(Array.isArray(family.data)?family.data:[]).find((x:{organizationId?:string})=>x.organizationId===data.organizationId);
   setMessage("Invitation accepted. Opening your academy's family portal.");
   router.replace(row?.slug?"/"+row.slug+"/family":"/workspace");
  }catch(e){setMessage(e instanceof Error?e.message:"Unable to accept invitation");}
  finally{setBusy(false);}
 }
 return <main className="authPage"><section className="authCard">
  <h1>Join your academy family portal</h1>
  <p>The invitation can only be accepted from its intended verified email account.</p>
  {signedIn?<button className="button" disabled={busy||!/^[a-f0-9]{64}$/.test(token)} onClick={accept}>{busy?"Checking invitation…":"Accept family invitation"}</button>:
  <><p>Sign in, then reopen this invitation link to accept it.</p><Link className="button" href="/login">Sign in</Link></>}
  {message&&<p role="status">{message}</p>}
 </section></main>;
}
export default function FamilyInvitePage(){return <Suspense fallback={<p>Loading invitation…</p>}><AcceptFamilyInvitation/></Suspense>}