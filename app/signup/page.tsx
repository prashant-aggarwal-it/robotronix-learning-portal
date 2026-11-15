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
 const [showPassword,setShowPassword]=useState(false);
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
 return <main className="signupPremium">
 <style>{`
 .signupPremium{min-height:100dvh;display:grid;place-items:center;padding:16px 24px;background:radial-gradient(ellipse at 14% 17%,#e8dbff 0,transparent 44%),radial-gradient(ellipse at 85% 80%,#ffdded 0,transparent 46%),linear-gradient(135deg,#fffaff,#f6f8ff);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#211b45}
 .signupPremium *{box-sizing:border-box}
 .signupShell{width:min(1080px,100%);max-height:calc(100dvh - 32px);display:grid;grid-template-columns:minmax(0,.88fr) minmax(0,1.12fr);background:#fff;border:1px solid #e7def3;border-radius:28px;overflow:hidden;box-shadow:0 28px 80px #51328b20}
 .signupStory{padding:31px 36px;background:radial-gradient(circle at 90% 7%,#e64fbc5b,transparent 36%),radial-gradient(circle at 6% 96%,#23c6cb65,transparent 36%),linear-gradient(145deg,#352060,#703dc4 66%,#aa3c99);color:#fff;display:flex;flex-direction:column;justify-content:space-between;gap:18px}
 .signupStory h2{font-size:clamp(27px,2.7vw,36px);letter-spacing:-.04em;line-height:1.18;margin:13px 0}
 .signupStory p{line-height:1.58;color:#f2e9ff;font-size:14px}
 .signupStoryLabel{font-size:11px;letter-spacing:.16em;color:#aef2ec;font-weight:850}
 .signupBenefits{display:grid;gap:11px}
 .signupBenefits span{display:flex;align-items:center;gap:12px;font-size:14px;font-weight:650;color:#fff}
 .signupBenefits b{width:29px;height:29px;display:grid;place-items:center;border:1px solid #ffffff5c;border-radius:10px;background:#ffffff1d}
 .signupFormSide{padding:24px clamp(25px,3.5vw,48px)}
 .signupBrand{display:inline-block;margin-bottom:17px}.signupBrand img{display:block;width:245px;max-width:100%;height:auto}
 .signupSteps{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:19px}
 .signupSteps span{border:1px solid #e9e1f2;background:#faf8fd;border-radius:999px;padding:7px 10px;font-size:11px;color:#77728f;font-weight:700}
 .signupSteps span:first-child{border-color:#d7bbf4;color:#6532b6;background:#f1e8ff}
 .signupHeading h1{font-size:clamp(27px,3vw,34px);line-height:1.15;letter-spacing:-.045em;margin:0 0 8px}
 .signupHeading p{line-height:1.52;color:#6d738b;margin:0 0 18px;font-size:13px}
 .signupFields{display:grid;gap:12px}.signupFields label{display:grid;gap:8px;font-size:13px;font-weight:750;color:#303451}
 .signupInput{width:100%;border:1px solid #dcd9ed;border-radius:12px;padding:11px 14px;font-size:15px;color:#252544;background:#fff;outline-offset:3px}
 .signupInput:focus{border-color:#8850d6;outline:2px solid #e9dcfa}
 .signupPasswordWrap{position:relative}.signupPasswordWrap input{padding-right:83px}
 .signupToggle{position:absolute;right:8px;top:5px;padding:9px;border:0;background:#f2edfa;color:#5f34a4;border-radius:8px;font-size:12px;font-weight:750;cursor:pointer}
 .signupHint{font-size:12px;color:#767e93;font-weight:500}
 .signupSubmit{width:100%;border:0;border-radius:12px;padding:12px;background:linear-gradient(100deg,#703bd2,#cd349f);color:#fff;font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 10px 23px #703bd230}
 .signupSubmit:disabled{opacity:.55;cursor:not-allowed}
 .signupDivider{text-align:center;font-size:13px;color:#858aa0;margin:13px 0;display:flex;align-items:center;gap:14px}
 .signupDivider:before,.signupDivider:after{content:"";height:1px;background:#e9e5f0;flex:1}
 .signupGoogle{width:100%;border:1px solid #ded9ec;border-radius:12px;padding:11px;background:#fff;color:#3c3065;font-size:14px;font-weight:750;cursor:pointer}
 .signupGoogle:disabled{opacity:.55;cursor:not-allowed}
 .signupBottom{text-align:center;margin:17px 0 10px;color:#67708a;font-size:13px}.signupBottom a,.signupLegal a{color:#6534ba;font-weight:750;text-decoration:none}
 .signupLegal{text-align:center;color:#8790a0;font-size:11px;margin:0}
 .signupNotice{padding:12px;border:1px solid #d6c4f0;background:#f6efff;border-radius:11px;color:#573097;font-size:13px;margin-top:16px}
 .signupError{padding:12px;border:1px solid #f1c4d2;background:#fff0f3;border-radius:11px;color:#9c2346;font-size:13px;margin-bottom:16px}
 @media(max-width:800px){.signupShell{grid-template-columns:1fr;max-width:570px;max-height:none}.signupStory{padding:25px 30px;gap:8px}.signupStory h2{font-size:25px;margin:9px 0}.signupStory p{margin:0}.signupBenefits{display:none}.signupFormSide{padding:28px}.signupPremium{padding:20px 14px}}
 @media(max-height:760px) and (min-width:801px){.signupPremium{padding:8px 20px}.signupShell{max-height:none}.signupFormSide{padding-top:17px;padding-bottom:17px}.signupBrand{margin-bottom:12px}.signupBrand img{width:210px}.signupSteps{margin-bottom:12px}.signupHeading p{margin-bottom:12px}.signupStory{padding-top:22px;padding-bottom:22px}.signupStory h2{font-size:29px}} 
 @media(max-width:420px){.signupFormSide{padding:22px}.signupSteps span{font-size:10px;padding:6px 8px}}
 `}</style>
 <div className="signupShell">
  <aside className="signupStory"><div><span className="signupStoryLabel">YOUR JOURNEY STARTS HERE</span><h2>Your learning organization.<br/>One connected workspace.</h2><p>Create your digital workspace in a few simple steps, then bring your learning programs, people and operations together.</p></div>
   <div className="signupBenefits"><span><b>01</b> Set up your organization</span><span><b>02</b> Choose your applications</span><span><b>03</b> Start managing your workspace</span></div></aside>
  <section className="signupFormSide" aria-labelledby="signup-title">
   <Link href="/" className="signupBrand" aria-label="Robotronix home"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/></Link>
   <div className="signupSteps" aria-label="Setup journey"><span>1 · Account</span><span>2 · Organization</span><span>3 · Applications</span><span>4 · Workspace</span></div>
   <div className="signupHeading"><h1 id="signup-title">Create your owner account</h1><p>Create your login to begin setting up your organization.</p></div>
   {error&&<div className="signupError" role="alert">{error}</div>}
   {deployment&&!enabled?<div className="signupNotice" role="status">Organization registration is unavailable in this deployment. <Link href="/login">Sign in instead</Link>.</div>:
   <form className="signupFields" onSubmit={submit}>
    <label htmlFor="signup-email">Work email<input id="signup-email" className="signupInput" autoComplete="email" type="email" required value={email} disabled={busy} onChange={e=>setEmail(e.target.value)}/></label>
    <label htmlFor="signup-password">Password<div className="signupPasswordWrap"><input id="signup-password" className="signupInput" autoComplete="new-password" type={showPassword?"text":"password"} required minLength={8} value={password} disabled={busy} onChange={e=>setPassword(e.target.value)}/><button className="signupToggle" type="button" aria-label={showPassword?"Hide password":"Show password"} aria-pressed={showPassword} onClick={()=>setShowPassword(x=>!x)}>{showPassword?"Hide":"Show"}</button></div><span className="signupHint">Use at least 8 characters.</span></label>
    <button className="signupSubmit" type="submit" disabled={!enabled||busy}>{busy?"Creating account…":"Create account"}</button>
   </form>}
   {enabled&&<><div className="signupDivider">or</div><button className="signupGoogle" type="button" disabled={busy} onClick={google}>Continue with Google</button></>}
   {notice&&<div className="signupNotice" role="status">{notice}</div>}
   <p className="signupBottom">Already have an account? <Link href="/login">Sign in</Link></p>
   <p className="signupLegal">By creating an account, you acknowledge our <Link href="/privacy">Privacy Policy</Link> and <Link href="/terms">Terms of Use</Link>.</p>
  </section>
 </div>
 </main>;

}
