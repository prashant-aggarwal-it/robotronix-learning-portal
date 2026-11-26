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
  // Supabase may exchange the recovery URL and clear its fragment before
  // this page checks the address. A verified session is therefore the
  // reliable fallback when PASSWORD_RECOVERY was emitted before subscription.
  const query=new URLSearchParams(window.location.search);
  const fragment=new URLSearchParams(window.location.hash.slice(1));
  const linkError=query.get("error_code")||query.get("error")||fragment.get("error_code")||fragment.get("error");
  const client=getSupabaseBrowserClient();
  if(!client){setError("Authentication is currently unavailable.");setState("invalid");return;}
  if(linkError){setState("invalid");return;}
  let active=true;
  let recoveryConfirmed=false;
  const {data:{subscription}}=client.auth.onAuthStateChange((event,session)=>{
   if(!active)return;
   if(event==="PASSWORD_RECOVERY"&&session){
    recoveryConfirmed=true;
    setState("ready");
    setError("");
   }
  });
  void (async()=>{
   // getSession waits for the browser client's initial URL processing.
   // Verify the recovered user with the Auth server, not just local storage.
   for(let attempt=0;attempt<8;attempt++){
    const {data,error:sessionError}=await client.auth.getSession();
    if(!active||recoveryConfirmed)return;
    if(!sessionError&&data.session){
     const {data:userData,error:userError}=await client.auth.getUser();
     if(!active||recoveryConfirmed)return;
     if(!userError&&userData.user){setState("ready");setError("");return;}
    }
    if(attempt<7)await new Promise(resolve=>setTimeout(resolve,400));
   }
   if(active&&!recoveryConfirmed)setState("invalid");
  })().catch(()=>{if(active&&!recoveryConfirmed)setState("invalid");});
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
