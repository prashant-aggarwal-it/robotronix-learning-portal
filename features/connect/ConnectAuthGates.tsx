"use client";
import {useState,type FormEvent} from "react";
import Link from "next/link";
import {ErrorMessage} from "@/features/connect/EmptyStates";
import {ConnectBrand} from "@/features/connect/ConnectBrand";

export function ConnectSignInGate({error,busy,email,password,onEmailChange,onPasswordChange,onSubmit}:{
 error:string;busy:boolean;email:string;password:string;
 onEmailChange:(value:string)=>void;onPasswordChange:(value:string)=>void;onSubmit:(event:FormEvent)=>void;
}){
 return <main className="cx-gate"><section className="cx-auth">
  <ConnectBrand/>
  <span className="cx-kicker">ADMISSIONS & RELATIONSHIPS</span>
  <h1>A clearer way to manage admissions.</h1>
  <p>Sign in with your account to access your CRM workspace. Your organisation controls membership and permissions.</p>
  <ErrorMessage error={error}/>
  <form onSubmit={onSubmit} className="cx-form"><label>Email<input type="email" required autoComplete="email" value={email} onChange={e=>onEmailChange(e.target.value)}/></label>
  <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={e=>onPasswordChange(e.target.value)}/></label>
  <button className="cx-primary" disabled={busy}>{busy?"Signing in…":"Sign in to Connect"}</button></form>
  <Link href="/login?next=/connect" className="cx-link">Sign in with Google or an email code</Link>
 </section></main>;
}

export function ConnectNoWorkspaceGate({error,onRetry,onSignOut,onCreateWorkspace,onAcceptInvitation}:{
 error:string;onRetry:()=>void;onSignOut:()=>void;
 onCreateWorkspace?:(name:string,slug:string)=>Promise<void>;
 onAcceptInvitation?:(token:string)=>Promise<void>;
}){
 const [name,setName]=useState(""),[slug,setSlug]=useState("");
 const [creating,setCreating]=useState(false),[createError,setCreateError]=useState("");
 const [invitation,setInvitation]=useState(""),[accepting,setAccepting]=useState(false);
 const submit=async(event:FormEvent)=>{
  event.preventDefault();if(creating||!onCreateWorkspace)return;
  setCreating(true);setCreateError("");
  try{await onCreateWorkspace(name.trim(),slug.trim().toLowerCase());}
  catch{setCreateError("Could not create your workspace. Check the name or URL identifier and try again.");}
  finally{setCreating(false);}
 };
 const accept=async(event:FormEvent)=>{
  event.preventDefault();if(accepting||!onAcceptInvitation)return;
  setAccepting(true);setCreateError("");
  try{await onAcceptInvitation(invitation.trim());}
  catch{setCreateError("This invitation could not be accepted. Verify the code and your account email.");}
  finally{setAccepting(false);}
 };
 return <main className="cx-gate"><section className="cx-auth">
  <ConnectBrand/>
  <span className="cx-kicker">WORKSPACE ACCESS</span>
  <h1>No Connect workspace assigned</h1>
  <p>You are signed in, but this account is not yet a member of a Connect workspace.</p>
  <ErrorMessage error={error||createError}/>
  {onCreateWorkspace&&<form className="cx-form" onSubmit={submit}>
   <h2>Create your organisation workspace</h2>
   <label>Workspace name<input required minLength={2} maxLength={120} value={name}
    onChange={e=>{const value=e.target.value;setName(value);setSlug(value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80));}}/></label>
   <label>Workspace URL identifier<input required maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*"
    value={slug} onChange={e=>setSlug(e.target.value.toLowerCase())}/></label>
   <button className="cx-primary" type="submit" disabled={creating||name.trim().length<2||!slug}>
    {creating?"Creating workspace…":"Create workspace"}
   </button>
  </form>}
  {onAcceptInvitation&&<form className="cx-form" onSubmit={accept}>
   <h2>Have an invitation?</h2>
   <label>Secure invitation code<input required minLength={40} maxLength={64} pattern="[A-Za-z0-9_-]{40,64}" autoComplete="off"
    value={invitation} onChange={e=>setInvitation(e.target.value)} placeholder="Paste your invitation code"/></label>
   <button className="cx-primary" type="submit" disabled={accepting||invitation.trim().length<40}>
    {accepting?"Joining workspace…":"Join workspace"}
   </button>
  </form>}
  <button className="cx-primary" type="button" onClick={onRetry}>Check access again</button>
  <button className="cx-text-button" type="button" onClick={onSignOut}>Sign out</button>
 </section></main>;
}
