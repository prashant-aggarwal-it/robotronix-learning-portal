"use client";
import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";
import {useRouter,useSearchParams} from "next/navigation";
import {Suspense} from "react";
import {loadAuthDeployment,loadSignedInAccess,passwordSignIn as passwordAuthSignIn,requestPasswordReset,googleSignIn,emailSignInCode,verifySignInCode,createProductAccount,academyScopedDestination} from "@/lib/platform/auth-client";
import {resolveAuthDestination,safeAuthNext} from "@/lib/platform/auth-routing";
import type {DeploymentConfig} from "@/lib/platform/deployment";
import {consumeInvitation} from "@/lib/platform/pending-invitation";
import {generatePalette} from "@/lib/theme/logo-palette";
import {themeToCssVariables} from "@/lib/theme/tokens";
import type {CSSProperties} from "react";

export default function Login(){return <Suspense fallback={<main className="authPage"><section className="authCard">Loading sign in…</section></main>}><LoginContent/></Suspense>}
function LoginContent(){
 const router=useRouter();
 const query=useSearchParams();
 const requested=query.get("next");
 const academySlug=query.get("academy");
 const [academyName,setAcademyName]=useState("");
 const [academyLogo,setAcademyLogo]=useState("");
 const [academyAccent,setAcademyAccent]=useState("");
 const [deployment,setDeployment]=useState<DeploymentConfig|null>(null);
 useEffect(()=>{let alive=true;if(!academySlug||!/^[a-z0-9][a-z0-9-]{2,62}$/.test(academySlug))return;
   void import("@/lib/supabase/browser").then(async m=>{const client=m.getSupabaseBrowserClient();if(!client)return;
    const {data,error}=await client.rpc("saas_public_academy_brand",{p_slug:academySlug});
    if(alive&&!error&&data?.name){setAcademyName(data.name);setAcademyLogo(typeof data.logoUrl==="string"&&/^https:\/\//.test(data.logoUrl)?data.logoUrl:"");setAcademyAccent(typeof data.accentColor==="string"?data.accentColor:"");}
   }).catch(()=>{});return()=>{alive=false};},[academySlug]);
 useEffect(()=>{let active=true;void loadAuthDeployment().then(config=>{if(active)setDeployment(config);}).catch(()=>{if(active)setError("Application configuration is unavailable.");});return()=>{active=false};},[]);
 const next=deployment?safeAuthNext(requested,deployment):null;
 const productName=deployment?.mode==="crm"?"Connect CRM":deployment?.mode==="tasks"?"My Tasks":deployment?.mode==="combined"&&!deployment.legacyDefault?"Education Suite":deployment?"Learning Portal":"Robotronix";
 const hasPortal=deployment?.products.includes("portal")??false;
 const isSuite=Boolean(deployment?.mode==="combined"&&!deployment.legacyDefault);
 const canRegister=Boolean(deployment&&!deployment.legacyDefault&&!isSuite&&(deployment.products.includes("tasks")||deployment.products.includes("crm")));
 const[email,setEmail]=useState(""),[password,setPassword]=useState(""),[code,setCode]=useState("");
 const[codeSent,setCodeSent]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[loading,setLoading]=useState(false);
 async function finish(){
  try{
   const config=deployment??await loadAuthDeployment();
   const pending=consumeInvitation();if(pending){router.replace(pending);return;}
   const access=await loadSignedInAccess(config);
   if(academySlug && !(await academyScopedDestination(academySlug))){setError("This account is not linked to the selected academy. Ask your academy administrator for an invitation.");return;}
   if(academySlug){const scoped=await academyScopedDestination(academySlug);if(scoped){router.replace(scoped);return;}}
   const destination=resolveAuthDestination(config,access,requested);
   if(destination.denied){setError(destination.denied);return;}
   router.replace(destination.path);
  }catch{
   setError("Unable to verify your account access. Try signing in again.");
  }
 }
 async function passwordSignIn(e:FormEvent){
  e.preventDefault();setLoading(true);setError("");
  try{const r=await passwordAuthSignIn(email,password);if(!r.ok)setError(r.error??"Unable to sign in");else await finish();}
  finally{setLoading(false);}
 }
 async function forgotPassword(){
  if(loading)return;
  setError("");setNotice("");
  if(!email.trim()){setError("Enter your email above before requesting a reset.");return;}
  setLoading(true);
  try{
   const result=await requestPasswordReset(email);
   if(!result.ok){setError(result.error??"Unable to request reset.");return;}
   setNotice("If the account exists, a password reset email will arrive shortly.");
  }finally{setLoading(false);}
 }
 async function register(){
  if(!canRegister||loading)return;
  setLoading(true);setError("");setNotice("");
  try{
   const result=await createProductAccount(email,password);
   if(!result.ok){setError(result.error??"Unable to register.");return;}
   if(result.signedIn){await finish();return;}
   setNotice("Registration received. Check your email for confirmation, then sign in.");
  }catch{setError("Registration is unavailable. Please try again.");}
  finally{setLoading(false);}
 }
 async function google(){
  if(next&&typeof window!=="undefined")sessionStorage.setItem("robotronix:post-auth-next",next);
  if(academySlug&&typeof window!=="undefined")sessionStorage.setItem("robotronix:post-auth-academy",academySlug);
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
 
 // Deployment mode is resolved asynchronously. Never render the legacy login
 // while determining whether this is the two-panel Education Suite screen.
 // Showing the legacy form first causes a full layout flash on every cold load.
 if(!deployment)return <main className="authPage" aria-busy={!error}>
  <section className="authCard" role="status" aria-live="polite" style={{maxWidth:440,margin:"auto",textAlign:"center"}}>
   <img src="/brand/robotronix-horizontal.png" alt="Robotronix" style={{width:220,maxWidth:"100%",height:"auto",objectFit:"contain"}}/>
   <p style={{marginTop:22}}>{error||"Preparing your secure sign-in…"}</p>
   {error&&<button type="button" className="button secondary" onClick={()=>window.location.reload()}>Retry</button>}
  </section>
 </main>;
 
 const suiteTheme=<style>{`
 .loginSuite{min-height:100dvh;display:grid;place-items:center;padding:22px 24px;background:radial-gradient(ellipse at 12% 12%,#eadfff 0%,transparent 43%),radial-gradient(ellipse at 88% 85%,#ffdfef 0%,transparent 47%),linear-gradient(135deg,#fffaff,#f7f8ff);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#211b45}
 .loginSuite *{box-sizing:border-box}
 .loginSuiteShell{width:min(1050px,100%);display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);background:#fff;border:1px solid #e7def3;border-radius:28px;overflow:hidden;box-shadow:0 28px 80px #51328b20}
 .loginSuiteStory{padding:38px 37px;background:radial-gradient(circle at 90% 7%,#e64fbc5b,transparent 36%),radial-gradient(circle at 6% 96%,#23c6cb65,transparent 36%),linear-gradient(145deg,#352060,#703dc4 66%,#aa3c99);color:#fff;display:flex;flex-direction:column;justify-content:space-between;gap:30px}
 .loginSuiteStoryLabel{font-size:11px;letter-spacing:.16em;color:#aef2ec;font-weight:850}
 .loginSuiteStory h2{font-size:clamp(28px,3vw,40px);letter-spacing:-.045em;line-height:1.18;margin:18px 0 15px}
 .loginSuiteStory p{line-height:1.65;color:#f2e9ff;font-size:14px;margin:0}
 .loginSuiteBenefits{display:grid;gap:14px}
 .loginSuiteBenefits span{display:flex;gap:12px;align-items:center;color:#fff;font-size:14px;font-weight:650}
 .loginSuiteBenefits b{width:30px;height:30px;display:grid;place-items:center;border-radius:10px;border:1px solid #ffffff59;background:#ffffff1b}
 .loginSuiteForm{padding:30px clamp(25px,3.5vw,48px);min-width:0}
 .loginSuiteForm .authBrand{display:inline-block;margin-bottom:17px}.loginSuiteForm .authBrand img{width:245px;max-width:100%;height:auto}
 .loginSuiteForm .formStepHead{margin-bottom:16px}.loginSuiteForm .formStepHead span{font-size:11px;letter-spacing:.14em;color:#7743c9}
 .loginSuiteForm .formStepHead h1{font-size:clamp(27px,3vw,35px);letter-spacing:-.045em;line-height:1.14;margin:13px 0 9px}
 .loginSuiteForm .formStepHead p{font-size:13px;line-height:1.58;margin:0;color:#6d738b}
 .loginSuiteForm .formStack{gap:11px}.loginSuiteForm .formStack label{font-size:13px;font-weight:750;color:#303451}
 .loginSuiteForm .input{border:1px solid #dcd9ed;border-radius:12px;background:#fff;padding:11px 14px;min-height:44px}
 .loginSuiteForm .input:focus{border-color:#8850d6;outline:2px solid #e9dcfa}
 .loginSuiteForm .button.fullButton:not(.secondary){background:linear-gradient(100deg,#703bd2,#cd349f);color:#fff;border:0;border-radius:12px;box-shadow:0 10px 23px #703bd230}
 .loginSuiteForm .button.secondary.fullButton{background:#fff;border:1px solid #ded9ec;border-radius:12px;color:#4d3395}
 .loginSuiteForm .button.fullButton{min-height:45px}
 .loginSuiteForm .authDivider{margin:13px 0}
 .loginSuiteForm a{color:#6635bb}.loginSuiteForm details{border-top:1px solid #eee7f5;padding-top:14px;margin-top:17px}
 .loginSuiteForm details summary{color:#5735aa;font-weight:700;cursor:pointer;font-size:13px}
 .loginSuiteNew{font-size:13px;text-align:center;margin:13px 0!important;color:#6d738b}
 .loginSuiteForm .entityBoundaryNote{display:none}
 @media(max-width:810px){.loginSuiteShell{grid-template-columns:1fr;max-width:580px}.loginSuiteStory{padding:24px 30px;gap:8px}.loginSuiteStory h2{font-size:26px;margin:10px 0}.loginSuiteBenefits{display:none}.loginSuiteForm{padding:28px}.loginSuite{padding:18px 14px}}
 @media(max-width:420px){.loginSuiteForm{padding:22px}.loginSuiteStory{padding:20px 23px}}
 `}</style>;
return <main className={isSuite?"loginSuite":"authPage"} style={academyName?themeToCssVariables(generatePalette(academyAccent||"#6d3cc9")) as CSSProperties:undefined}>{isSuite&&suiteTheme}<div className={isSuite?"loginSuiteShell":undefined}>{isSuite&&<aside className="loginSuiteStory"><div><span className="loginSuiteStoryLabel">WELCOME BACK</span><h2>Pick up where your team left off.</h2><p>One secure account connects you to the learning organizations and applications you can access.</p></div><div className="loginSuiteBenefits"><span><b>✓</b> Your organizations</span><span><b>✓</b> Your learning workspace</span><span><b>✓</b> Your assigned tools</span></div></aside>}<section className={isSuite?"loginSuiteForm":"authCard"}>
  <Link href="/" className="authBrand"><img src={academyLogo||"/brand/robotronix-horizontal.png"} alt={academyName||"Robotronix"} style={{objectFit:"contain"}} onError={e=>{e.currentTarget.src="/brand/robotronix-horizontal.png"}}/></Link>
  <div className="formStepHead"><span>{productName.toUpperCase()}</span><h1>{academyName?`Sign in to ${academyName}`:"Sign in to Robotronix"}</h1><p>Use your email and password, Google, or a one-time code to open your workspace.</p></div>
  {academyName&&<p className="infoBanner">Academy: <strong>{academyName}</strong>. Access is verified using your account membership and permissions.</p>}
  {error&&<div role="alert" className="errorBanner">{error}</div>}
  <form className="formStack" onSubmit={passwordSignIn}>
   <label>Email<input className="input" type="email" value={email} onChange={e=>{setEmail(e.target.value);setCodeSent(false);setCode("");}} disabled={loading} autoComplete="email" required/></label>
   <label>Password<input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} disabled={loading} autoComplete="current-password" required/></label>
   <div style={{display:"flex",justifyContent:"flex-end",marginTop:-4}}>
    <button type="button" disabled={loading} onClick={()=>void forgotPassword()} style={{background:"transparent",border:0,boxShadow:"none",padding:"4px 0",fontSize:13,fontWeight:650,color:"var(--brand-primary, #6d3cc9)",textDecoration:"underline",textUnderlineOffset:3,cursor:loading?"not-allowed":"pointer",opacity:loading?.55:1}}>Forgot password?</button>
   </div>
   <button className="button fullButton" disabled={loading||!deployment}>{loading?"Signing in…":"Sign in with password"}</button>
   {canRegister&&<button type="button" className="button secondary fullButton" disabled={loading||!email||password.length<8} onClick={register}>Create a new account</button>}
   {notice&&<p role="status" className="infoBanner">{notice}</p>}
  </form>
  {isSuite&&<p style={{textAlign:"center",margin:"14px 0"}}>New organization? <Link href="/signup">Create an owner account</Link></p>}
  <div className="authDivider"><span>or</span></div>
  <button className="button secondary fullButton" disabled={loading||!deployment} onClick={google}>Continue with Google</button>
  <details className="topGap"><summary>Sign in with a one-time email code</summary>
  <p className="fieldHint">An email code requires access to the account inbox. Password sign-in above does not.</p>
  <form className="formStack" onSubmit={codeSent?verifyCode:sendCode}>
   <label>Email<input className="input" type="email" value={email} onChange={e=>{setEmail(e.target.value);setCodeSent(false);setCode("");}} disabled={loading} autoComplete="email" required/></label>
   {codeSent&&<label>Email code<input className="input" type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)} placeholder="Enter the code from your email" required/></label>}
   {notice&&<p role="status" className="infoBanner">{notice}</p>}
   <button className="button fullButton" disabled={loading||!deployment}>{loading?"Please wait…":codeSent?"Verify code & sign in":"Email me a sign-in code"}</button>
   {codeSent&&<button type="button" className="button ghost" disabled={loading} onClick={()=>{setCodeSent(false);setCode("");setNotice("");}}>Request another code</button>}
  </form>
  </details>
  {!isSuite&&hasPortal&&<div className="entityBoundaryNote"><b>New family?</b><span>Start family onboarding to link your child. Trainers and existing students receive access from Admin.</span><Link href="/onboarding" className="tableAction">Start family onboarding →</Link></div>}
  <p style={{textAlign:"center",margin:"18px 0 0",fontSize:13,color:"#66738c"}}><Link href="/privacy" style={{color:"#4537a5",textDecoration:"underline"}}>Privacy Policy</Link> · <Link href="/terms" style={{color:"#4537a5",textDecoration:"underline"}}>Terms of Use</Link> · <Link href="/support" style={{color:"#4537a5",textDecoration:"underline"}}>Support</Link>{hasPortal&&<> · <Link href="/zoom-guide" style={{color:"#4537a5",textDecoration:"underline"}}>Zoom Guide</Link></>}</p>
 </section></div></main>;
}
