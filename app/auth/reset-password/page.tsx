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
 const [showPassword,setShowPassword]=useState(false);
 const [showConfirm,setShowConfirm]=useState(false);
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
 return <main className="authPage resetPage">
  <style>{`
   .resetPage{padding:20px 16px;background:#f7f7fb}
   .resetPage .resetCard{width:min(440px,100%);max-width:440px;gap:0;padding:clamp(24px,4vw,34px);border:1px solid #e7def3;border-radius:24px;box-shadow:0 16px 48px rgba(55,38,100,.07)}
   .resetPage .resetHeading{margin:0 0 8px;font-size:clamp(26px,4vw,32px);line-height:1.18;letter-spacing:-.04em;color:#211b45}
   .resetPage .resetIntro{font-size:14px;line-height:1.55;color:#6d738b;margin:0}
   .resetPage .resetForm{display:grid;gap:15px;margin-top:23px}
   .resetPage .resetField{display:grid;gap:7px;min-width:0}
   .resetPage .resetField label{font-size:13px;font-weight:700;color:#303451}
   .resetPage .resetInputWrap{position:relative}
   .resetPage .resetInput{width:100%;min-height:46px;border:1px solid #dcd9ed;border-radius:12px;background:#fff;padding:11px 65px 11px 13px;font-size:15px;color:#211b45}
   .resetPage .resetInput:focus{border-color:#8850d6;outline:2px solid #e9dcfa;box-shadow:none}
   .resetPage .resetInput[aria-invalid="true"]{border-color:#d77b7b}
   .resetPage .resetReveal{position:absolute;right:10px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:#6635bb;font-size:12px;font-weight:700;cursor:pointer;padding:7px}
   .resetPage .resetReveal:focus-visible,.resetPage .resetBack:focus-visible{outline:2px solid #8850d6;outline-offset:3px;border-radius:4px}
   .resetPage .resetHint{font-size:12px;line-height:1.4;color:#6d738b;margin:-5px 0 0}
   .resetPage .resetError{margin:0;padding:10px 12px;border:1px solid #f0d5a3;border-radius:10px;background:#fff8e8;color:#805a14;font-size:13px;line-height:1.45}
   .resetPage .resetPrimary{display:flex;align-items:center;justify-content:center;width:100%;min-height:46px;padding:11px 16px;border:0;border-radius:12px;background:linear-gradient(100deg,#703bd2,#cd349f);color:#fff;font-size:15px;font-weight:750;text-decoration:none;box-shadow:0 10px 23px rgba(112,59,210,.18);cursor:pointer}
   .resetPage .resetPrimary:disabled{opacity:.65;cursor:wait}
   .resetPage .resetPrimary:focus-visible{outline:3px solid #b79bea;outline-offset:3px}
   .resetPage .resetBack{display:inline-block;margin-top:16px;font-size:13px;font-weight:650;color:#6635bb;text-decoration:underline;text-underline-offset:3px}
   @media(max-width:480px){.resetPage .resetCard{padding:24px 20px}.resetPage .resetHeading{font-size:27px}}
  `}</style>
  <section className="authCard resetCard">
   <h1 className="resetHeading">{state==="success"?"Password updated":state==="invalid"?"Reset link unavailable":"Reset your password"}</h1>
   <p className="resetIntro">{state==="success"?"Your password has been changed successfully. Sign in with your new password.":state==="invalid"?"This link is invalid or has expired. Request a new password-reset email from the sign-in page.":state==="checking"?"Checking your secure reset link…":"Choose a new password for your account."}</p>
   {state==="ready"&&<form className="resetForm" onSubmit={submit}>
    <div className="resetField">
     <label htmlFor="reset-new-password">New password</label>
     <div className="resetInputWrap">
      <input id="reset-new-password" className="resetInput" type={showPassword?"text":"password"} minLength={12} autoComplete="new-password" required value={password} onChange={e=>{setPassword(e.target.value);setError("");}}/>
      <button type="button" className="resetReveal" aria-label={showPassword?"Hide new password":"Show new password"} aria-pressed={showPassword} onClick={()=>setShowPassword(v=>!v)}>{showPassword?"Hide":"Show"}</button>
     </div>
    </div>
    <div className="resetField">
     <label htmlFor="reset-confirm-password">Confirm new password</label>
     <div className="resetInputWrap">
      <input id="reset-confirm-password" className="resetInput" type={showConfirm?"text":"password"} minLength={12} autoComplete="new-password" required aria-invalid={error==="Passwords do not match."} value={confirm} onChange={e=>{setConfirm(e.target.value);setError("");}}/>
      <button type="button" className="resetReveal" aria-label={showConfirm?"Hide confirmation password":"Show confirmation password"} aria-pressed={showConfirm} onClick={()=>setShowConfirm(v=>!v)}>{showConfirm?"Hide":"Show"}</button>
     </div>
    </div>
    <p className="resetHint">Use at least 12 characters.</p>
    {error&&<p role="alert" className="resetError">{error}</p>}
    <button type="submit" className="resetPrimary" disabled={busy}>{busy?"Updating password…":"Update Password"}</button>
   </form>}
   {state!=="ready"&&error&&<p role="alert" className="resetError" style={{marginTop:16}}>{error}</p>}
   {state==="invalid"&&<Link href="/login" className="resetPrimary" style={{marginTop:22}}>Return to Sign In</Link>}
   {state==="success"&&<Link href="/login" className="resetPrimary" style={{marginTop:22}}>Sign In</Link>}
   {state==="ready"&&<div style={{textAlign:"center"}}><Link href="/login" className="resetBack">Back to Sign In</Link></div>}
  </section>
 </main>;
}
