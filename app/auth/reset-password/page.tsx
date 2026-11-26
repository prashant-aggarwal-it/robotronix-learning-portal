"use client";
import {FormEvent,useEffect,useState} from "react";
import Link from "next/link";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";

type ResetState="checking"|"ready"|"invalid"|"success";
export default function ResetPasswordPage(){
 const [state,setState]=useState<ResetState>("checking");
 const [password,setPassword]=useState("");
 const [confirm,setConfirm]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 useEffect(()=>{
  const client=getSupabaseBrowserClient();
  if(!client){setError("Authentication is currently unavailable.");setState("invalid");return;}
  let active=true;
  let recoveryConfirmed=false;
  const {data:{subscription}}=client.auth.onAuthStateChange((event,session)=>{
   if(!active)return;
   if(event==="PASSWORD_RECOVERY"){recoveryConfirmed=true;setState("ready");setError("");}
   if(event==="SIGNED_OUT"&&!recoveryConfirmed)setState("invalid");
  });
  // Recovery links may arrive with a code or token fragment that Supabase
  // exchanges asynchronously. Allow that exchange to complete before showing an error.
  const url=new URL(window.location.href);
  const hasRecoveryLink=url.searchParams.has("code")||url.searchParams.get("type")==="recovery"||url.hash.includes("type=recovery");
  void client.auth.getSession().then(({data,error:sessionError})=>{
   if(!active||recoveryConfirmed)return;
   if(sessionError){setState("invalid");return;}
   if(hasRecoveryLink&&data.session){setState("ready");return;}
   if(!hasRecoveryLink)setState("invalid");
   else setTimeout(()=>{if(active&&!recoveryConfirmed)setState("invalid");},2500);
  }).catch(()=>{if(active)setState("invalid");});
  return()=>{active=false;subscription.unsubscribe();};
 },[]);
 async function submit(e:FormEvent){
  e.preventDefault();setError("");
  if(password.length<12){setError("Use at least 12 characters.");return;}
  if(password!==confirm){setError("Passwords do not match.");return;}
  const client=getSupabaseBrowserClient();
  if(!client){setError("Authentication is currently unavailable.");return;}
  setBusy(true);
  try{
   const {data:{session}}=await client.auth.getSession();
   if(!session){setError("This reset link has expired. Request a new one.");setState("invalid");return;}
   const {error:updateError}=await client.auth.updateUser({password});
   if(updateError){setError("Unable to update your password. Please request a new reset link.");return;}
   setState("success");setPassword("");setConfirm("");
   await client.auth.signOut();
  }catch{setError("Something went wrong. Please try again.");}
  finally{setBusy(false);}
 }
 return <main className="authPage"><section className="authCard" style={{maxWidth:480,width:"100%",margin:"auto",padding:"clamp(24px,5vw,40px)"}}>
  <div style={{display:"grid",gap:10,marginBottom:24}}>
   <h1 style={{margin:0,fontSize:"clamp(26px,4vw,34px)"}}>{state==="success"?"Password updated":state==="invalid"?"Reset link unavailable":"Reset your password"}</h1>
   <p className="muted" style={{margin:0,lineHeight:1.6}}>{state==="success"?"Your password has been changed successfully. Sign in with your new password.":state==="invalid"?"This link is invalid or has expired. Request a new password-reset email to continue.":state==="checking"?"Checking your secure reset link…":"Choose a new password for your account."}</p>
  </div>
  {state==="ready"&&<form className="formStack" onSubmit={submit} style={{display:"grid",gap:16}}>
   <div className="formGroup"><label htmlFor="reset-new-password">New password</label><input id="reset-new-password" className="input" type="password" minLength={12} autoComplete="new-password" required value={password} onChange={e=>setPassword(e.target.value)}/></div>
   <div className="formGroup"><label htmlFor="reset-confirm-password">Confirm new password</label><input id="reset-confirm-password" className="input" type="password" minLength={12} autoComplete="new-password" required value={confirm} onChange={e=>setConfirm(e.target.value)}/></div>
   <p className="muted" style={{fontSize:13,margin:0}}>Use at least 12 characters.</p>
   <button type="submit" className="button fullButton" style={{width:"100%",minHeight:46}} disabled={busy}>{busy?"Updating password…":"Update Password"}</button>
  </form>}
  {error&&<p role="alert" className="notice" style={{marginTop:16}}>{error}</p>}
  {state==="invalid"&&<Link href="/login" className="button fullButton" style={{width:"100%",minHeight:46}}>Return to Sign In</Link>}
  {state==="success"&&<Link href="/login" className="button fullButton" style={{width:"100%",minHeight:46}}>Sign In</Link>}
  {state==="ready"&&<Link href="/login" className="button secondary fullButton" style={{width:"100%",minHeight:46,marginTop:12}}>Back to Sign In</Link>}
 </section></main>;
}
