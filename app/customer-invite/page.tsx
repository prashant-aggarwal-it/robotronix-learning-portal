"use client";
import {Suspense,useEffect,useState} from "react";
import Link from "next/link";
import {useRouter,useSearchParams} from "next/navigation";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {preserveInvitation,clearInvitation} from "@/lib/platform/pending-invitation";
import "./customer-invite.css";

function InvitationContent(){
 const query=useSearchParams(),router=useRouter(),token=query.get("token")||"";
 const validToken=/^[a-f0-9]{64}$/.test(token);
 const [signedIn,setSignedIn]=useState(false),[checking,setChecking]=useState(true),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 useEffect(()=>{if(validToken)preserveInvitation("/customer-invite?token="+token);},[token,validToken]);
 useEffect(()=>{
  let active=true;
  void getSupabaseBrowserClient()?.auth.getSession()
   .then(({data})=>{if(active)setSignedIn(Boolean(data.session));})
   .catch(()=>{if(active)setMessage("We could not check your session. Please refresh this page.");})
   .finally(()=>{if(active)setChecking(false);});
  if(!getSupabaseBrowserClient())setChecking(false);
  return()=>{active=false};
 },[]);
 async function accept(){
  if(busy||!validToken)return;
  setBusy(true);setMessage("");
  try{
   const client=getSupabaseBrowserClient(),session=(await client?.auth.getSession())?.data.session;
   if(!session){setSignedIn(false);setMessage("Your session expired. Please sign in with the invited email.");return;}
   const response=await fetch("/api/platform-admin/customer-invitations/accept",{
    method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
    body:JSON.stringify({token})
   });
   const result=await response.json();
   if(!response.ok||!result.ok)throw Error(result.error||"Invitation cannot be accepted");
   clearInvitation();
   setMessage("Invitation accepted. Opening your academy workspace.");
   router.replace("/workspace");
  }catch(e){setMessage(e instanceof Error?e.message:"Unable to accept invitation");}
  finally{setBusy(false);}
 }
 return <main className="customerInvite">
  <div className="customerInviteShell">
   <aside className="customerInviteAside">
    <div className="customerInviteAsideTop"><span className="customerInviteEyebrow">ROBOTRONIX EDUCATION SUITE</span><h2>Your academy.<br/>One connected workspace.</h2><p>Bring students, classes and day-to-day operations together in one place.</p></div>
    <div className="customerInviteFeatures">
     <span><i aria-hidden="true">✓</i> Manage courses and classes</span>
     <span><i aria-hidden="true">✓</i> Keep track of admissions</span>
     <span><i aria-hidden="true">✓</i> Stay organized as you grow</span>
    </div>
    <div className="customerInviteAsideBottom">A workspace designed for education founders.</div>
   </aside>
   <section className="customerInvitePanel" aria-labelledby="customer-invite-title">
    <Link href="/" className="customerInviteLogo" aria-label="Robotronix home"><img src="/brand/robotronix-horizontal.png" alt="Robotronix" /></Link>
    <div className="customerInviteStep"><span aria-hidden="true">✉</span> OWNER INVITATION</div>
    <h1 id="customer-invite-title">Welcome to your academy</h1>
    <p className="customerInviteIntro">You've been invited to set up an academy workspace. Continue using the <strong>email address the invitation was created for</strong>.</p>
    <div className="customerInviteGuide">
     <div><span className="customerInviteNumber">1</span><span><strong>Sign in or create an account</strong><small>Use your invited email address</small></span></div>
     <div><span className="customerInviteNumber">2</span><span><strong>Accept your invitation</strong><small>Your academy trial will then be activated</small></span></div>
    </div>
    {!validToken&&<div className="customerInviteNotice customerInviteError" role="alert">This invitation link is invalid. Please ask the platform administrator for a new link.</div>}
    {message&&<div className="customerInviteNotice" role="status">{message}</div>}
    {checking?<p className="customerInviteChecking" role="status">Checking your sign-in status…</p>:
      !signedIn?<div className="customerInviteActions">
       <Link className="customerInvitePrimary" href="/login">Sign in to continue <span aria-hidden="true">→</span></Link>
       <Link className="customerInviteSecondary" href="/signup">New here? Create an account</Link>
      </div>:
      <div className="customerInviteActions">
       <div className="customerInviteSignedIn"><span aria-hidden="true">✓</span> You're signed in. Confirm to activate your workspace.</div>
       <button className="customerInvitePrimary" disabled={busy||!validToken} onClick={()=>void accept()}>{busy?"Activating your academy…":"Accept invitation & start trial"} <span aria-hidden="true">→</span></button>
      </div>}
    <p className="customerInviteFoot">This invitation is intended only for the verified email address of the invited academy Owner.</p>
   </section>
  </div>
 </main>;
}
export default function CustomerInvitePage(){return <Suspense fallback={<main className="customerInvite">Loading invitation…</main>}><InvitationContent/></Suspense>}
