"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";

type Status="not_linked"|"invite_sent"|"awaiting_first_login"|"portal_ready"|"disabled";
const labels:Record<Status,string>={not_linked:"Account not linked",invite_sent:"Invite sent",awaiting_first_login:"Awaiting first sign-in",portal_ready:"Portal-ready",disabled:"Disabled"};
export function PortalAccessPanel({type,id,defaultEmail}:{type:"trainer"|"student";id:string;defaultEmail:string}){
 const[email,setEmail]=useState(defaultEmail);const[status,setStatus]=useState<Status>("not_linked");
 const[lastLogin,setLastLogin]=useState<string|null>(null);const[message,setMessage]=useState("");const[busy,setBusy]=useState(false);const[ready,setReady]=useState(false);
 useEffect(()=>setEmail(defaultEmail),[defaultEmail]);
 async function request(method:"GET"|"POST",action?:string){
  const client=getSupabaseBrowserClient();if(!client)throw new Error("Portal invites require live Supabase configuration.");
  const{data:{session}}=await client.auth.getSession();if(!session)throw new Error("Sign in as Admin again.");
  const url=method==="GET"?`/api/admin/portal-access?type=${type}&id=${encodeURIComponent(id)}`:"/api/admin/portal-access";
  const response=await fetch(url,{method,headers:{Authorization:`Bearer ${session.access_token}`,...(method==="POST"?{"Content-Type":"application/json"}:{})},...(method==="POST"?{body:JSON.stringify({type,id,action,email})}:{})});
  const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||"Portal access request failed.");
  return data;
 }
 useEffect(()=>{let active=true;request("GET").then(data=>{if(!active)return;setStatus(data.status);setEmail(data.email||defaultEmail);setLastLogin(data.lastLoginAt);setReady(true)}).catch(e=>{if(!active)return;setMessage(e.message);setReady(true)});return()=>{active=false}},[type,id,defaultEmail]);
 async function act(action:"invite"|"resend"|"link"|"provision"|"disable"|"enable"){
  if(action==="disable"&&!confirm(type==="student"?"Disable this parent's access? This may affect all children linked to the same family account.":"Disable this trainer's login access?"))return;
  setBusy(true);setMessage("");try{const data=await request("POST",action);setStatus(data.status);setLastLogin(data.lastLoginAt);setMessage(action==="provision"?"Access granted. Share the portal login link. The user must verify their email with Google or an email sign-in code.":action==="invite"||action==="resend"?"Invitation request processed. Check Supabase email delivery.":"Access updated.")}catch(e){setMessage(e instanceof Error?e.message:"Action failed.")}finally{setBusy(false)}
 }
 return <section className="panel portalAccessPanel" id={type==="student"?"family-portal-access":"trainer-portal-access"}><div className="panelHeader"><div><h2>{type==="trainer"?"Trainer":"Parent"} portal access</h2><p>{type==="student"?"Self-onboarded parents already have a Google login; only invite families added manually.":"Login access is separate from trainer status."}</p></div><span className={`softBadge ${status==="portal_ready"?"softGreen":status==="disabled"?"softRed":"softAmber"}`}>{ready?(type==="student"&&status==="portal_ready"?"Family account linked":type==="student"&&status==="not_linked"?"Link or invitation required":labels[status]):"Checking…"}</span></div>
 <div className="formGroup"><label>Login email</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} disabled={busy||status==="portal_ready"||status==="disabled"}/><small className="fieldHint">{status==="awaiting_first_login"?"Access is already granted. Share the portal sign-in link with the trainer; no further Admin action is required.":status==="portal_ready"?(type==="student"?"The parent is linked to this learner and has portal access.":"Trainer account is linked and ready."):status==="disabled"?"Access is disabled. Enable it when appropriate.":type==="student"?"If this family signed up themselves, verify and link their existing account. Invite manually added families only after confirming the guardian email.":"Grant access for a new email, then share the portal sign-in URL. Existing linked accounts can be reused."}</small></div>
 {lastLogin&&<div className="cellSub">Last sign-in: {new Date(lastLogin).toLocaleString("en-IN")}</div>}
 <div className="formActions portalAccessActions">
  {status==="not_linked"&&<><button type="button" className="button" disabled={busy||!ready} onClick={()=>act("provision")}>{type==="student"?"Create verified-login account":"Grant portal access"}</button><button type="button" className="button secondary" disabled={busy||!ready} onClick={()=>act("link")}>Link existing account</button></>}
  {status==="invite_sent"&&<><button type="button" className="button secondary" disabled={busy} onClick={()=>act("resend")}>Resend invite</button><button type="button" className="button ghost" disabled={busy} onClick={()=>act("link")}>Link existing account</button></>}
  {(status==="portal_ready"||status==="invite_sent"||status==="awaiting_first_login")&&<button type="button" className="button ghost" disabled={busy} onClick={()=>act("disable")}>Disable access</button>}
  {status==="disabled"&&<button type="button" className="button" disabled={busy} onClick={()=>act("enable")}>Enable access</button>}
 </div>{message&&<p className={message.includes("failed")||message.includes("require")||message.includes("Could")?"errorBanner":"fieldHint"} role="status">{message}</p>}
 </section>
}
