"use client";
import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";
import {useRouter,useSearchParams} from "next/navigation";
import {Suspense} from "react";
import {loadAuthDeployment,loadSignedInAccess,passwordSignIn,googleSignIn,emailSignInCode,verifySignInCode} from "@/lib/platform/auth-client";
import {resolveAuthDestination,safeAuthNext} from "@/lib/platform/auth-routing";
import type {DeploymentConfig} from "@/lib/platform/deployment";

export default function Login(){return <Suspense fallback={<main className="authPage"><section className="authCard">Loading sign in…</section></main>}><LoginContent/></Suspense>}
function LoginContent(){
 const router=useRouter();
 const query=useSearchParams();
 const requested=query.get("next");
 const [deployment,setDeployment]=useState<DeploymentConfig|null>(null);
 useEffect(()=>{let active=true;void loadAuthDeployment().then(config=>{if(active)setDeployment(config);}).catch(()=>{if(active)setError("Application configuration is unavailable.");});return()=>{active=false};},[]);
 const next=deployment?safeAuthNext(requested,deployment):null;
 const productName=deployment?.mode==="crm"?"Connect CRM":deployment?.mode==="tasks"?"My Tasks":"Learning Portal";
 const hasPortal=deployment?.products.includes("portal")??true;
 const[email,setEmail]=useState(""),[password,setPassword]=useState(""),[code,setCode]=useState("");
 const[codeSent,setCodeSent]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[loading,setLoading]=useState(false);
 async function finish(){
  try{
   const config=deployment??await loadAuthDeployment();
   const access=await loadSignedInAccess(config);
   const destination=resolveAuthDestination(config,access,requested);
   if(destination.denied){setError(destination.denied);return;}
   router.replace(destination.path);
  }catch{
   setError("Unable to verify your account access. Try signing in again.");
  }
 }
 async function passwordSignIn(e:FormEvent){
  e.preventDefault();setLoading(true);setError("");
  try{const r=await passwordSignIn(email,password);if(!r.ok)setError(r.error??"Unable to sign in");else await finish();}
  finally{setLoading(false);}
 }
 async function google(){
  if(next&&typeof window!=="undefined")sessionStorage.setItem("robotronix:post-auth-next",next);
  setLoading(true);setError("");const r=await googleSignIn();
  if(!r.ok){setError(r.error??"Unable to start Google sign-in");setLoading(false);}
 }
 async function sendCode(e:FormEvent){
  e.preventDefault();if(loading)return;setLoading(true);setError("");setNotice("");
  try{const r=await emailSignInCode(email);
   if(!r.ok){setError(r.error??"Unable to send email code.");return;}
   setCodeSent(true);setNotice("If this email has an existing account, a sign-in email has been sent. Check your inbox and spam folder.");
  }finally{setLoading(false);}
 }
 async function verifyCode(e:FormEvent){
  e.preventDefault();if(loading)return;setLoading(true);setError("");
  try{const r=await verifySignInCode(email,code);
   if(!r.ok){setError(r.error??"Unable to verify code.");return;}
   await finish();
  }finally{setLoading(false);}
 }
 return <main className="authPage"><section className="authCard">
  <Link href="/" className="authBrand"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/></Link>
  <div className="formStepHead"><span>{productName.toUpperCase()}</span><h1>Sign in to Robotronix</h1><p>Sign in with your existing email and password, Google, or a one-time email code. Access is determined by your enabled products and account permissions.</p></div>
  {error&&<div role="alert" className="errorBanner">{error}</div>}
  <form className="formStack" onSubmit={passwordSignIn}>
   <label>Email<input className="input" type="email" value={email} onChange={e=>{setEmail(e.target.value);setCodeSent(false);setCode("");}} disabled={loading} autoComplete="email" required/></label>
   <label>Password<input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} disabled={loading} autoComplete="current-password" required/></label>
   <button className="button fullButton" disabled={loading}>{loading?"Signing in…":"Sign in with password"}</button>
  </form>
  <div className="authDivider"><span>or</span></div>
  <button className="button secondary fullButton" disabled={loading} onClick={google}>Continue with Google</button>
  <details className="topGap"><summary>Sign in with a one-time email code</summary>
  <p className="fieldHint">An email code requires access to the account inbox. Password sign-in above does not.</p>
  <form className="formStack" onSubmit={codeSent?verifyCode:sendCode}>
   <label>Email<input className="input" type="email" value={email} onChange={e=>{setEmail(e.target.value);setCodeSent(false);setCode("");}} disabled={loading} autoComplete="email" required/></label>
   {codeSent&&<label>Email code<input className="input" type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)} placeholder="Enter the code from your email" required/></label>}
   {notice&&<p role="status" className="infoBanner">{notice}</p>}
   <button className="button fullButton" disabled={loading}>{loading?"Please wait…":codeSent?"Verify code & sign in":"Email me a sign-in code"}</button>
   {codeSent&&<button type="button" className="button ghost" disabled={loading} onClick={()=>{setCodeSent(false);setCode("");setNotice("");}}>Request another code</button>}
  </form>
  </details>
  {hasPortal&&<div className="entityBoundaryNote"><b>New family?</b><span>Start family onboarding to link your child. Trainers and existing students receive access from Admin.</span><Link href="/onboarding" className="tableAction">Start family onboarding →</Link></div>}
  <p style={{textAlign:"center",margin:"18px 0 0",fontSize:13,color:"#66738c"}}><Link href="/privacy" style={{color:"#4537a5",textDecoration:"underline"}}>Privacy Policy</Link> · <Link href="/terms" style={{color:"#4537a5",textDecoration:"underline"}}>Terms of Use</Link> · <Link href="/support" style={{color:"#4537a5",textDecoration:"underline"}}>Support</Link>{hasPortal&&<> · <Link href="/zoom-guide" style={{color:"#4537a5",textDecoration:"underline"}}>Zoom Guide</Link></>}</p>
 </section></main>;
}
