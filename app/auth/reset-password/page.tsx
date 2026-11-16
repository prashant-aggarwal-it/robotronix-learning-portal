"use client";
import {FormEvent,useEffect,useState} from "react";
import Link from "next/link";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";

export default function ResetPasswordPage(){
 const [ready,setReady]=useState(false);
 const [password,setPassword]=useState("");
 const [confirm,setConfirm]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 useEffect(()=>{
  const client=getSupabaseBrowserClient();
  if(!client){setMessage("Authentication unavailable.");return;}
  let active=true;
  void client.auth.getSession().then(({data})=>{if(active)setReady(Boolean(data.session));});
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{if(active)setReady(Boolean(session));});
  return()=>{active=false;subscription.unsubscribe();};
 },[]);
 async function submit(e:FormEvent){
  e.preventDefault();
  if(password.length<12){setMessage("Use at least 12 characters.");return;}
  if(password!==confirm){setMessage("Passwords do not match.");return;}
  const client=getSupabaseBrowserClient();if(!client)return;
  setBusy(true);setMessage("");
  try{
   const {data:{session}}=await client.auth.getSession();
   if(!session){setMessage("Reset link expired. Request a new one from the sign-in page.");return;}
   const {error}=await client.auth.updateUser({password});
   if(error){setMessage("Unable to update password. Request a new reset link.");return;}
   await client.auth.signOut();
   setMessage("Password updated. Sign in using your new password.");
   setReady(false);setPassword("");setConfirm("");
  }finally{setBusy(false);}
 }
 return <main className="authPage"><section className="authCard">
  <h1>Reset password</h1>
  {ready?<form className="formStack" onSubmit={submit}>
   <label>New password<input className="input" type="password" minLength={12} autoComplete="new-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
   <label>Confirm password<input className="input" type="password" minLength={12} autoComplete="new-password" required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
   <button className="button fullButton" disabled={busy}>{busy?"Updating…":"Update password"}</button>
  </form>:<p>Open a valid password-reset link from your email to continue.</p>}
  {message&&<p role="status">{message}</p>}
  <Link href="/login">Return to sign in</Link>
 </section></main>;
}
