"use client";
import {Suspense,useEffect,useState} from "react";
import Link from "next/link";
import {useRouter,useSearchParams} from "next/navigation";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {preserveInvitation,clearInvitation} from "@/lib/platform/pending-invitation";
function Invite(){
 const query=useSearchParams(),router=useRouter(),token=query.get("token")||"";
 const [signedIn,setSignedIn]=useState(false),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState("Confirm you are signed in with the invited email address.");
 useEffect(()=>{if(/^[a-f0-9]{64}$/.test(token))preserveInvitation("/customer-invite?token="+token);},[token]);
 useEffect(()=>{void getSupabaseBrowserClient()?.auth.getSession().then(({data})=>setSignedIn(Boolean(data.session)));},[]);
 async function accept(){
  if(busy)return;setBusy(true);setMessage("");
  try{
   const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
   if(!session){setMessage("Sign in with the invited email address first.");return}
   const response=await fetch("/api/platform-admin/customer-invitations/accept",{
    method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
    body:JSON.stringify({token})
   });
   const result=await response.json();
   if(!response.ok||!result.ok)throw Error(result.error||"Invitation cannot be accepted");
   clearInvitation();setMessage("Your academy trial is ready. Opening your workspace.");
   router.replace("/workspace");
  }catch(e){setMessage(e instanceof Error?e.message:"Unable to accept invitation");}
  finally{setBusy(false)}
 }
 return <main className="authPage"><section className="authCard">
  <img src="/brand/robotronix-horizontal.png" alt="Robotronix" style={{maxWidth:240,height:"auto"}}/>
  <h1>Join your academy</h1>
  <p>Use the email address your academy invitation was sent to. For a new account, register first and verify your email.</p>
  {message&&<p role="status">{message}</p>}
  {!signedIn?<div style={{display:"flex",gap:15,flexWrap:"wrap"}}><Link className="button" href="/login">Sign in</Link><Link href="/signup">Create your account</Link></div>:
   <button className="button" disabled={busy||!/^[a-f0-9]{64}$/.test(token)} onClick={()=>void accept()}>
    {busy?"Activating…":"Accept invitation and start trial"}
   </button>}
 </section></main>
}
export default function CustomerInvitePage(){return <Suspense fallback={<p>Loading invitation…</p>}><Invite/></Suspense>}
