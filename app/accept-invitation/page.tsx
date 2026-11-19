"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
export default function AcceptInvitation(){
 const params=useSearchParams(),token=params.get("token")||"";
 const [message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{if(!/^[a-zA-Z0-9_-]{40,64}$/.test(token))setMessage("Invalid invitation link");},[token]);
 async function accept(){
  const client=getSupabaseBrowserClient();if(!client){setMessage("Authentication unavailable");return;}
  const {data:{session}}=await client.auth.getSession();if(!session){setMessage("Please sign in with the invited email address first.");return;}
  setBusy(true);setMessage("");
  try{
   const response=await fetch("/api/platform/invitations/accept",{method:"POST",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({token}),cache:"no-store"});
   const body=await response.json();if(!response.ok)throw Error(body.error||"Unable to accept invitation");
   setMessage("Invitation accepted. You can now open your workspace.");
  }catch(e){setMessage(e instanceof Error?e.message:"Unable to accept invitation");}finally{setBusy(false);}
 }
 return <main style={{fontFamily:"system-ui",maxWidth:520,margin:"64px auto",padding:24}}><h1>Accept academy invitation</h1><p>Sign in with the email address that received this invitation, then accept.</p><p><Link href="/workspace">Sign in / open workspace</Link></p><button disabled={busy||!/^[a-zA-Z0-9_-]{40,64}$/.test(token)} onClick={accept}>{busy?"Accepting…":"Accept invitation"}</button>{message&&<p role="status">{message}</p>}</main>;
}
