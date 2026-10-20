"use client";
import Link from "next/link";
import {FormEvent,useState} from "react";
import {useRouter} from "next/navigation";
import {getCurrentAccountAccess,requestEmailSignInCode,verifyEmailSignInCode,signIn,signInWithGoogle} from "@/lib/repository";

export default function Login(){
 const router=useRouter();
 const[email,setEmail]=useState(""),[password,setPassword]=useState(""),[code,setCode]=useState("");
 const[codeSent,setCodeSent]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[loading,setLoading]=useState(false);
 async function finish(){
  const access=await getCurrentAccountAccess();
  if(access.state==="disabled"){setError("Your Robotronix portal access is disabled. Please contact Robotronix Admin.");return;}
  if(access.state==="unlinked"){setError("Your email is not linked to an active portal profile yet. Contact Admin, or start family onboarding.");return;}
  router.replace(`/${access.role}`);
 }
 async function passwordSignIn(e:FormEvent){
  e.preventDefault();setLoading(true);setError("");
  try{const r=await signIn(email,password);if(!r.ok)setError(r.error??"Unable to sign in");else await finish();}
  finally{setLoading(false);}
 }
 async function google(){
  setLoading(true);setError("");const r=await signInWithGoogle();
  if(!r.ok){setError(r.error??"Unable to start Google sign-in");setLoading(false);}
 }
 async function sendCode(e:FormEvent){
  e.preventDefault();if(loading)return;setLoading(true);setError("");setNotice("");
  try{const r=await requestEmailSignInCode(email);
   if(!r.ok){setError(r.error??"Unable to send email code.");return;}
   setCodeSent(true);setNotice("If this email already has a provisioned portal account, a sign-in email has been sent. Check your inbox and spam folder.");
  }finally{setLoading(false);}
 }
 async function verifyCode(e:FormEvent){
  e.preventDefault();if(loading)return;setLoading(true);setError("");
  try{const r=await verifyEmailSignInCode(email,code);
   if(!r.ok){setError(r.error??"Unable to verify code.");return;}
   await finish();
  }finally{setLoading(false);}
 }
 return <main className="authPage"><section className="authCard">
  <Link href="/" className="authBrand"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/></Link>
  <div className="formStepHead"><span>LEARNING PORTAL</span><h1>Sign in to Robotronix</h1><p>Use Google or an email sign-in code. Your existing account determines your portal role automatically.</p></div>
  <button className="button fullButton" disabled={loading} onClick={google}>Continue with Google</button>
  <div className="authDivider"><span>or use your email address</span></div>
  <form className="formStack" onSubmit={codeSent?verifyCode:sendCode}>
   <label>Email<input className="input" type="email" value={email} onChange={e=>{setEmail(e.target.value);setCodeSent(false);setCode("");}} disabled={loading} autoComplete="email" required/></label>
   {codeSent&&<label>Email code<input className="input" type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)} placeholder="Enter the code from your email" required/></label>}
   {notice&&<p role="status" className="infoBanner">{notice}</p>}
   {error&&<div role="alert" className="errorBanner">{error}</div>}
   <button className="button fullButton" disabled={loading}>{loading?"Please wait…":codeSent?"Verify code & sign in":"Email me a sign-in code"}</button>
   {codeSent&&<button type="button" className="button ghost" disabled={loading} onClick={()=>{setCodeSent(false);setCode("");setNotice("");}}>Request another code</button>}
  </form>
  <details className="topGap"><summary>Have an existing password?</summary>
   <form className="formStack topGap" onSubmit={passwordSignIn}><label>Password<input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label><button className="button secondary fullButton" disabled={loading}>Sign in with password</button></form>
  </details>
  <div className="entityBoundaryNote"><b>New family?</b><span>Start family onboarding to link your child. Trainers and existing students receive access from Admin.</span><Link href="/onboarding" className="tableAction">Start family onboarding →</Link></div>
 </section></main>;
}
