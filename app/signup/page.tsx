"use client";
import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {loadAuthDeployment,createProductAccount,googleSignIn,loadSignedInAccess} from "@/lib/platform/auth-client";
import {resolveAuthDestination} from "@/lib/platform/auth-routing";
import type {DeploymentConfig} from "@/lib/platform/deployment";

export default function SignupPage(){
 const router=useRouter();
 const [deployment,setDeployment]=useState<DeploymentConfig|null>(null);
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 useEffect(()=>{let active=true;void loadAuthDeployment().then(value=>{if(active)setDeployment(value);}).catch(()=>{if(active)setError("Configuration unavailable. Please refresh.");});return()=>{active=false};},[]);
 const enabled=deployment?.mode==="combined"&&!deployment.legacyDefault;
 async function submit(e:FormEvent){
  e.preventDefault();if(!enabled||busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const result=await createProductAccount(email,password);
   if(!result.ok){setError(result.error??"Registration failed.");return;}
   if(result.signedIn){
    const access=await loadSignedInAccess(deployment);
    const destination=resolveAuthDestination(deployment,access,null);
    if(destination.denied){setError(destination.denied);return;}
    router.replace(destination.path);return;
   }
   setNotice("Account created. Please confirm your email, then sign in to continue organization setup.");
  }catch{setError("Unable to complete registration. Please try again.");}
  finally{setBusy(false);}
 }
 async function google(){
  if(!enabled||busy)return;
  setBusy(true);setError("");
  const result=await googleSignIn();
  if(!result.ok){setError(result.error??"Unable to start Google sign-in.");setBusy(false);}
 }
 return <main className="authPage"><section className="authCard">
  <Link href="/" className="authBrand"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/></Link>
  <div className="formStepHead"><span>ROBOTRONIX EDUCATION SUITE</span><h1>Create your account</h1><p>Start by creating your owner account. Next, set up your organization's workspace.</p></div>
  {error&&<div className="errorBanner" role="alert">{error}</div>}
  {deployment&&!enabled?<div className="infoBanner" role="status">This deployment does not offer organization self-registration. <Link href="/login">Sign in instead</Link>.</div>:
  <form className="formStack" onSubmit={submit}>
   <label>Work email<input className="input" autoComplete="email" type="email" required value={email} disabled={busy} onChange={e=>setEmail(e.target.value)}/></label>
   <label>Password<input className="input" autoComplete="new-password" type="password" required minLength={8} value={password} disabled={busy} onChange={e=>setPassword(e.target.value)}/></label>
   <button className="button fullButton" disabled={!enabled||busy}>{busy?"Creating account…":"Create account"}</button>
  </form>}
  {enabled&&<><div className="authDivider"><span>or</span></div>
   <button className="button secondary fullButton" disabled={busy} onClick={google}>Continue with Google</button></>}
  {notice&&<p role="status" className="infoBanner">{notice}</p>}
  <p style={{textAlign:"center",marginTop:20}}>Already have an account? <Link href="/login">Sign in</Link></p>
  <p style={{textAlign:"center",fontSize:13,marginTop:16}}><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></p>
 </section></main>;

}
