"use client";
import {Suspense,useState} from "react";
import {useSearchParams} from "next/navigation";
import Link from "next/link";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
function Invite(){
 const params=useSearchParams();const token=params.get("token")||"";
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const [result,setResult]=useState<{slug:string}|null>(null);
 async function accept(){
  setBusy(true);setError("");
  try{
   const client=getSupabaseBrowserClient();if(!client)throw Error("Sign in first");
   const {data:{session}}=await client.auth.getSession();if(!session)throw Error("Sign in with the email that received this invitation");
   const response=await fetch("/api/platform-owner-invite/accept",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({token})});
   const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error||"Unable to accept invitation");
   setResult({slug:body.slug});
   window.history.replaceState(null,"","/platform-owner-invite");
  }catch(e){setError(e instanceof Error?e.message:"Invitation unavailable")}finally{setBusy(false)}
 }
 return <main style={{maxWidth:560,margin:"64px auto",padding:24,fontFamily:"system-ui"}}><h1>Accept organization ownership</h1><p>Sign in with the verified email address to which the invitation was issued. This invitation expires after seven days and can be used only once.</p>
 {result?<div role="status"><p>Owner access activated for <strong>{result.slug}</strong>.</p><Link href="/workspace">Open workspace</Link></div>:<><button disabled={busy||!/^[a-f0-9]{64}$/.test(token)} onClick={()=>void accept()} style={{padding:12}}>{busy?"Accepting…":"Accept invitation"}</button><p><Link href="/login">Sign in</Link></p></>}
 {error&&<p role="alert" style={{color:"#a12c47"}}>{error}</p>}</main>;
}
export default function PlatformOwnerInvitePage(){return <Suspense fallback={<p>Loading invitation…</p>}><Invite/></Suspense>}
