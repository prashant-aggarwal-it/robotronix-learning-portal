"use client";
import type {FormEvent} from "react";
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

export function ConnectNoWorkspaceGate({error,onRetry,onSignOut}:{
 error:string;onRetry:()=>void;onSignOut:()=>void;
}){
 return <main className="cx-gate"><section className="cx-auth">
  <ConnectBrand/>
  <span className="cx-kicker">WORKSPACE ACCESS</span>
  <h1>No Connect workspace assigned</h1>
  <p>Your account is signed in, but it does not currently have access to a Connect workspace. Ask your administrator to add you to Robotronix Connect.</p>
  <ErrorMessage error={error}/>
  <button className="cx-primary" type="button" onClick={onRetry}>Check access again</button>
  <button className="cx-text-button" type="button" onClick={onSignOut}>Sign out</button>
 </section></main>;
}
