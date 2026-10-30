"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {getCurrentAccountAccess} from "@/lib/repository";
export default function ZoomConnectLanding(){
 const[state,setState]=useState<"checking"|"guest"|"admin"|"restricted">("checking");
 const[confirmed,setConfirmed]=useState(false);
 useEffect(()=>{let active=true;getCurrentAccountAccess().then(a=>{if(active)setState(a.state==="active"?(a.role==="admin"?"admin":"restricted"):"guest")}).catch(()=>{if(active)setState("guest")});return()=>{active=false}},[]);
 return <main className="authPage"><section className="authCard" style={{maxWidth:620}}>
 <Link className="authBrand" href="/"><img src="/brand/robotronix-horizontal.png" alt="Robotronix"/></Link>
 <div className="formStepHead"><span>ZOOM INTEGRATION</span><h1>Connect Robotronix Classroom</h1><p>Zoom authorization is limited to approved adult Robotronix administrators managing classroom host accounts. Parents, students and learners do not authorize this integration.</p></div>
 {state==="checking"?<p role="status">Checking your portal access…</p>:state==="guest"?<><p>Sign in to your authorized administrator account. After signing in, return to this connection page.</p><Link className="button fullButton" href="/login?next=%2Fzoom%2Fconnect">Sign in to continue →</Link></>:state==="restricted"?<div className="errorBanner" role="alert">This account cannot authorize Zoom Classroom. Contact your Robotronix administrator if you believe you need host management access.</div>:<><p>Only an authorized adult account holder may connect Zoom. Ensure you have permission to authorize the Zoom account and understand the access requested.</p><label style={{display:"flex",alignItems:"flex-start",gap:10,margin:"16px 0"}}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>I confirm that I am at least 18 years old and am authorized to connect this Zoom host account.</span></label><Link href={confirmed?"/admin/zoom":"/zoom/connect"} aria-disabled={!confirmed} onClick={e=>{if(!confirmed)e.preventDefault()}} className="button fullButton">Continue to Zoom host management →</Link><p style={{fontSize:13,marginTop:14}}>In Zoom host management, select Connect host account to review permissions on Zoom's authorization screen.</p></>}
 <p style={{marginTop:22,fontSize:13}}><Link href="/zoom-guide">Read the Zoom Classroom guide</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/support">Support</Link></p>
 </section></main>
}