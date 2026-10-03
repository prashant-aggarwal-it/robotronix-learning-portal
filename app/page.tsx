"use client";
import Link from "next/link";
import {FormEvent,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {appMode} from "@/lib/config";
import {getCurrentProfile,signIn,signInWithGoogle,signOut} from "@/lib/repository";

export default function HomePage(){
 const router=useRouter();const[email,setEmail]=useState("");const[password,setPassword]=useState("");const[error,setError]=useState("");const[loading,setLoading]=useState(false);const[existing,setExisting]=useState<string|null>(null);
 useEffect(()=>{if(appMode==="live")getCurrentProfile().then(p=>setExisting(p?.role??null))},[]);
 async function submit(e:FormEvent){e.preventDefault();setError("");setLoading(true);const result=await signIn(email,password);if(!result.ok){setError(result.error??"Unable to sign in");setLoading(false);return;}const profile=await getCurrentProfile();setLoading(false);if(!profile){setError("Your account is signed in but has not been activated yet. Parents can complete onboarding first.");return;}router.push(`/${profile.role}`)}
 async function google(){setError("");const r=await signInWithGoogle();if(!r.ok)setError(r.error??"Unable to start Google sign-in")}
 return <main className="portalLanding portalLandingV14 portalLandingFinal">
  <header className="landingNav"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/><span className="landingProduct">Learning Portal</span><div className="landingNavRight"><span>Parents</span><span>Students</span><span>Trainers</span><span>Admin</span></div></header>

  <section className="landingHero globalLandingHero finalLandingHero">
   <div className="landingCopy">
    <div className="heroSparkLabel"><span>●</span> LEARN · BUILD · CREATE</div>
    <h1>See the learning.<br/><em>Feel the progress.</em></h1>
    <p>Projects, delivered-hour progress, mentor insight and the next class — together in one learning space.</p>
    <div className="landingHeroActions">{appMode==="live"?<><button className="button heroPrimary" onClick={google}>Continue with Google</button><Link className="button ghost heroGhost" href="/onboarding">New family onboarding</Link></>:<><a className="button heroPrimary" href="#portal-access">Explore the portal</a><Link className="button ghost heroGhost" href="/onboarding">Try onboarding</Link></>}</div>
    <div className="heroProofGrid"><div><b>8-session</b><span>milestone visibility</span></div><div><b>Worldwide</b><span>timezone scheduling</span></div><div><b>Private</b><span>family communication</span></div></div>
   </div>

   <div className="landingStemVisual premiumStemStage">
    <div className="stemGlow glowOne"/><div className="stemGlow glowTwo"/>
    <div className="stemPhotoFrame"><img src="/experience/online-robotics-ai-hero.png" alt="Two young learners building a robotics project with an online mentor and AI learning tools"/></div>
    <div className="heroFloatCard floatProject"><span>JUST BUILT</span><b>Smart Water Controller</b><small>Variables · Sensors · Logic</small></div>
    <div className="heroFloatCard floatMilestone"><span>SESSION MOMENTUM</span><b>7 / 8 attended</b><small>1 class to next milestone</small></div>
    <div className="heroFloatCard floatGlobal"><span>GLOBAL SCHEDULE</span><b>Tue 6:00 PM ET</b><small>Converted automatically for Robotronix™</small></div>
   </div>
  </section>

  <div className="buildRibbon" aria-label="Robotronix learning cycle"><span>BUILD</span><i>•</i><span>CODE</span><i>•</i><span>CREATE</span><i>•</i><span>TEST</span><i>•</i><span>IMPROVE</span><i>•</i><span>INNOVATE</span></div>

  <section className="learningMomentStrip"><article><div className="momentIcon">⚙</div><div><span>PROJECT-LED</span><b>Real builds make progress visible.</b></div></article><article><div className="momentIcon">↗</div><div><span>PROGRESS THAT MAKES SENSE</span><b>Course journey + every 8-session milestone.</b></div></article><article><div className="momentIcon">◌</div><div><span>GLOBAL BY DESIGN</span><b>Learner time locally. Operations in IST.</b></div></article></section>

  <section className="landingAccess premiumAccess" id="portal-access"><div className="accessCopy"><div className="eyebrow">ROBOTRONIX™ PORTAL</div><h2>{appMode==="live"?"Welcome back":"Step into the experience"}</h2><p>{appMode==="live"?"Secure access for your learning role.":"Open any workspace and explore the complete demo journey."}</p><div className="accessMiniStory"><span className="storyDot projectDot"/><b>Build</b><span>→</span><span className="storyDot progressDot"/><b>Track</b><span>→</span><span className="storyDot feedbackDot"/><b>Grow</b></div></div>
   <div className="accessPanel">{appMode==="live"?<>{existing&&<div className="notice live">Active {existing} session <button className="button secondary smallButton" onClick={()=>router.push(`/${existing}`)}>Continue</button></div>}<button className="button googleButton" onClick={google}><span className="googleG">G</span> Continue with Google</button><div className="divider">or sign in with email</div><form className="stack" onSubmit={submit}><div className="formGroup"><label>Email</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></div><div className="formGroup"><label>Password</label><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></div>{error&&<div className="errorBanner">{error}</div>}<button className="button" disabled={loading}>{loading?"Signing in…":"Sign in"}</button>{existing&&<button type="button" className="button ghost" onClick={async()=>{await signOut();setExisting(null)}}>Sign out current account</button>}</form><Link href="/onboarding" className="textLink centeredLink">New family? Start onboarding →</Link></>:<><div className="previewRoleGrid premiumRoleGrid"><Link href="/parent"><span className="roleIcon">♡</span><b>Parent</b><small>Progress · projects · mentor insight</small></Link><Link href="/student"><span className="roleIcon">✦</span><b>Student</b><small>Journey · projects · next class</small></Link><Link href="/trainer"><span className="roleIcon">↗</span><b>Trainer</b><small>Classes · learners · follow-ups</small></Link><Link href="/admin"><span className="roleIcon">⌘</span><b>Admin</b><small>Operations · schedules · insights</small></Link></div></>}</div>
  </section>
  <footer className="landingFooter">© 2026 Robotronix™ Future Ready Skills · Learning Portal</footer>
 </main>;
}
