"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {loadAuthDeployment,loadSignedInAccess,academyScopedDestination} from "@/lib/platform/auth-client";
import {resolveAuthDestination} from "@/lib/platform/auth-routing";
import {consumeInvitation} from "@/lib/platform/pending-invitation";

const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
export default function AuthCallbackPage(){
 const router=useRouter(),[message,setMessage]=useState("Finishing your secure sign-in…");
 const [result,setResult]=useState<"loading"|"verified"|"already-verified"|"expired"|"error">("loading");
 useEffect(()=>{
  let cancelled=false;
  async function finish(){
   try{
    const supabase=getSupabaseBrowserClient();if(!supabase)throw new Error("Supabase is not configured.");
    const params=new URLSearchParams(window.location.search);
    const fragment=new URLSearchParams(window.location.hash.slice(1));
    const code=params.get("code");
    const signupConfirmation=fragment.get("type")==="signup"||params.get("type")==="signup";
    const authError=params.get("error_code")||params.get("error")||fragment.get("error_code")||fragment.get("error");
    if(authError){
     const expired=authError==="otp_expired"||/expired|invalid/i.test(params.get("error_description")||fragment.get("error_description")||"");
     const {data:{user}}=await supabase.auth.getUser();
     if(cancelled)return;
     if(user?.email_confirmed_at){setResult("already-verified");setMessage("Your email is already verified. You can sign in to continue.");}
     else {setResult(expired?"expired":"error");setMessage(expired?"This confirmation link is expired or has already been used. If you have confirmed your email, try signing in; otherwise request a new confirmation email.":"We could not verify this email link. Please sign in or request a new verification link.");}
     window.history.replaceState(null,"",window.location.pathname);
     return;
    }
    if(code){setMessage("Securing your Google session…");const {error}=await supabase.auth.exchangeCodeForSession(code);if(error&&!/code verifier/i.test(error.message))throw error;}
    let session=(await supabase.auth.getSession()).data.session;
    for(let i=0;!session&&i<12;i++){await sleep(250);session=(await supabase.auth.getSession()).data.session;}
    if(cancelled)return;
    if(!session?.user){setResult("error");setMessage("Your sign-in session could not be restored. Please sign in again.");return;}
    if(signupConfirmation){
     const {data:{user},error:verificationError}=await supabase.auth.getUser();
     if(cancelled)return;
     if(verificationError||!user?.email_confirmed_at){setResult("error");setMessage("We could not verify your email confirmation. Please try signing in or request a new confirmation link.");return;}
     sessionStorage.removeItem("robotronix:post-auth-next");
     sessionStorage.removeItem("robotronix:post-auth-academy");
     window.history.replaceState(null,"",window.location.pathname);
     await supabase.auth.signOut();
     if(cancelled)return;
     setResult("verified");setMessage("Email verified successfully! Your account is ready. Please sign in to continue.");
     return;
    }
    if(cancelled)return;
    const invitation=consumeInvitation();
    if(invitation){sessionStorage.removeItem("robotronix:post-auth-next");sessionStorage.removeItem("robotronix:post-auth-academy");router.replace(invitation);return;}
    const deployment=await loadAuthDeployment();
    const access=await loadSignedInAccess(deployment);
    if(cancelled)return;
    const next=sessionStorage.getItem("robotronix:post-auth-next")||"";
    sessionStorage.removeItem("robotronix:post-auth-next");
    const academySlug=sessionStorage.getItem("robotronix:post-auth-academy")||"";
    sessionStorage.removeItem("robotronix:post-auth-academy");
    if(academySlug && !(await academyScopedDestination(academySlug))){setMessage("This account is not linked to the selected academy. Contact your academy administrator for an invitation.");return;}
    if(academySlug){const scoped=await academyScopedDestination(academySlug);if(scoped){router.replace(scoped);return;}}
    const destination=resolveAuthDestination(deployment,access,next,"callback");
    if(destination.denied){setMessage(destination.denied);return;}
    router.replace(destination.path);
   }catch(error){console.error("Unable to complete authentication callback",error);if(!cancelled){setResult("error");setMessage("We could not finish verifying your account. Please sign in or request a new link.");}}
  }
  void finish();return()=>{cancelled=true};
 },[router]);
 return <main className="loginShell"><div className="card authCallbackCard" role="status" aria-live="polite"><p>{message}</p>{result!=="loading"&&<p style={{marginTop:16}}><Link href="/login">Go to sign in</Link>{result==="expired"&&<> · <Link href="/signup">Return to registration</Link></>}</p>}</div></main>;
}
