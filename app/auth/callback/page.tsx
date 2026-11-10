"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {getCurrentAccountAccess} from "@/lib/repository";
import {taskAccountIsActive} from "@/lib/tasks/account-client";

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
    if(!session?.user){setMessage("Google sign-in completed, but the portal session could not be restored. Please try again.");await sleep(1400);router.replace("/");return;}
    const access=await getCurrentAccountAccess();if(cancelled)return;
    if(access.state==="disabled"){setMessage("Your Robotronix™ portal access is disabled. Please contact Robotronix Admin.");return;}
    const next=sessionStorage.getItem("robotronix:post-auth-next")||"";sessionStorage.removeItem("robotronix:post-auth-next");
    if(next==="/tasks"||next==="/tasks/welcome"){
     router.replace(access.state==="unlinked"?await taskAccountIsActive()?"/tasks":"/tasks/welcome":next);return;
    }
    if(access.state==="unlinked"){
     router.replace(await taskAccountIsActive()?"/tasks":next.startsWith("/onboarding")?next:"/onboarding");return;
    }
    if(access.role==="parent"&&next.startsWith("/onboarding")){router.replace(next);return;}
    if(access.role==="admin"&&next==="/zoom/connect"){router.replace(next);return;}
    router.replace(({admin:"/admin",trainer:"/trainer",parent:"/parent",student:"/student"} as const)[access.role!]||"/");
   }catch(error){console.error("Unable to complete OAuth role routing",error);if(!cancelled)setMessage("We could not finish signing you in. Please return to the login page and try again.");}
  }
  void finish();return()=>{cancelled=true};
 },[router]);
 return <main className="loginShell"><div className="card authCallbackCard">{message}</div></main>;
}
