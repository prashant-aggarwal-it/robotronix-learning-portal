"use client";
import type {FormEvent} from "react";
import Link from "next/link";
import {ErrorMessage} from "@/features/connect/EmptyStates";

function ConnectGateBrand(){
 return <div className="cx-logo"><span className="cx-logo-mark">C</span><span>Robotronix <b>Connect</b></span></div>;
}

export function ConnectSignInGate({error,busy,email,password,onEmailChange,onPasswordChange,onSubmit}:{
 error:string;busy:boolean;email:string;password:string;
 onEmailChange:(value:string)=>void;onPasswordChange:(value:string)=>void;onSubmit:(event:FormEvent)=>void;
}){
 return <main className="cx-gate"><section className="cx-auth">
  <ConnectGateBrand/>
  <span className="cx-kicker">ADMISSIONS & RELATIONSHIPS</span>
  <h1>A clearer way to manage admissions.</h1>
  <p>Sign in with your existing Robotronix account. Connect uses the same authentication system as the Learning Portal, with separate institute permissions.</p>
  <ErrorMessage error={error}/>
  <form onSubmit={onSubmit} className="cx-form"><label>Email<input type="email" required autoComplete="email" value={email} onChange={e=>onEmailChange(e.target.value)}/></label>
  <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={e=>onPasswordChange(e.target.value)}/></label>
  <button className="cx-primary" disabled={busy}>{busy?"Signing in…":"Sign in to Connect"}</button></form>
  <Link href="/login" className="cx-link">Go to Learning Portal sign-in</Link>
 </section></main>;
}

export function ConnectWorkspaceSetupGate({error,busy,name,slug,onNameChange,onSlugChange,onSubmit,onSignOut}:{
 error:string;busy:boolean;name:string;slug:string;
 onNameChange:(value:string)=>void;onSlugChange:(value:string)=>void;
 onSubmit:(event:FormEvent)=>void;onSignOut:()=>void;
}){
 return <main className="cx-gate"><section className="cx-auth">
  <ConnectGateBrand/>
  <span className="cx-kicker">GETTING STARTED</span><h1>Create your institute workspace</h1>
  <p>Every institute manages its own contacts, admissions and staff. You will be the workspace owner.</p>
  <ErrorMessage error={error}/><form onSubmit={onSubmit} className="cx-form">
   <label>Institute name<input required minLength={2} maxLength={120} placeholder="e.g. Bright Minds Academy" value={name}
   onChange={e=>onNameChange(e.target.value)}/></label>
   <label>Workspace identifier<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={e=>onSlugChange(e.target.value)}/></label>
   <button className="cx-primary" disabled={busy}>{busy?"Creating…":"Create institute workspace"}</button>
  </form>
  <button className="cx-text-button" onClick={onSignOut}>Sign out</button>
 </section></main>;
}
