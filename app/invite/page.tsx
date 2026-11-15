"use client";
import Link from "next/link";
import {Suspense,useEffect,useState} from "react";
import {useRouter,useSearchParams} from "next/navigation";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {preserveInvitation,clearInvitation} from "@/lib/platform/pending-invitation";
function InvitationContent(){
 const query=useSearchParams(),router=useRouter();
 const token=query.get("token")||"";
 useEffect(()=>{if(/^[a-f0-9]{64}$/.test(token))preserveInvitation("/invite?token="+token);},[token]);
 const [status,setStatus]=useState("Verify your email and sign in to accept this invitation.");
 const [busy,setBusy]=useState(false);
 const [signedIn,setSignedIn]=useState(false);
 useEffect(()=>{const c=getSupabaseBrowserClient();void c?.auth.getSession().then(({data})=>setSignedIn(Boolean(data.session)));},[]);
 async function accept(){
  if(busy)return;setBusy(true);setStatus("");
  try{
   const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
   if(!session){setStatus("Sign in to continue with this invitation.");return;}
   const r=await fetch("/api/platform/invitations/accept",{method:"POST",headers:{"content-type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({token})});
   const data=await r.json();if(!r.ok)throw Error(data.error||"Invitation rejected");
   setStatus("Invitation accepted. Opening your organization workspace.");
   clearInvitation();router.replace("/workspace");
  }catch(e){setStatus(e instanceof Error?e.message:"Unable to accept this invitation.");}
  finally{setBusy(false);}
 }
 return <main className="authPage"><section className="authCard"><h1>Join your academy</h1>
 <p>This invitation is bound to your verified email address.</p>
 {status&&<p role="status">{status}</p>}
 {!signedIn?<><p>After sign-in, reopen this invitation link.</p><Link className="button" href="/login">Sign in</Link></>:<button className="button" disabled={busy||!/^[a-zA-Z0-9_-]{40,64}$/.test(token)} onClick={accept}>{busy?"Checking…":"Accept invitation"}</button>}
 </section></main>;
}
export default function InvitePage(){return <Suspense fallback={<p>Loading invitation…</p>}><InvitationContent/></Suspense>}