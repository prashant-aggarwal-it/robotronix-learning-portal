"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {loadAuthDeployment,loadSignedInAccess} from "@/lib/platform/auth-client";
import {resolveAuthDestination} from "@/lib/platform/auth-routing";

const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
export default function AuthCallbackPage(){
 const router=useRouter(),[message,setMessage]=useState("Finishing your secure sign-in…");
 useEffect(()=>{
  let cancelled=false;
  async function finish(){
   try{
    const supabase=getSupabaseBrowserClient();if(!supabase)throw new Error("Supabase is not configured.");
    const params=new URLSearchParams(window.location.search),code=params.get("code");
    if(code){setMessage("Securing your Google session…");const {error}=await supabase.auth.exchangeCodeForSession(code);if(error&&!/code verifier/i.test(error.message))throw error;}
    let session=(await supabase.auth.getSession()).data.session;
    for(let i=0;!session&&i<12;i++){await sleep(250);session=(await supabase.auth.getSession()).data.session;}
    if(cancelled)return;
    if(!session?.user){setMessage("Google sign-in completed, but your session could not be restored. Please try again.");await sleep(1400);router.replace("/");return;}
    const deployment=await loadAuthDeployment();
    const access=await loadSignedInAccess(deployment);
    if(cancelled)return;
    const next=sessionStorage.getItem("robotronix:post-auth-next")||"";
    sessionStorage.removeItem("robotronix:post-auth-next");
    const destination=resolveAuthDestination(deployment,access,next,"callback");
    if(destination.denied){setMessage(destination.denied);return;}
    router.replace(destination.path);
   }catch(error){console.error("Unable to complete OAuth role routing",error);if(!cancelled)setMessage("We could not finish signing you in. Please return to the login page and try again.");}
  }
  void finish();return()=>{cancelled=true};
 },[router]);
 return <main className="loginShell"><div className="card authCallbackCard">{message}</div></main>;
}
