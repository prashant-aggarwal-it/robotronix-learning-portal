"use client";
import {useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
export default function AcceptOrganizationInvitation(){
 const [token,setToken]=useState("");
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const [busy,setBusy]=useState(false);
 async function accept(){
  if(busy||!token.trim())return;
  setBusy(true);setError("");setSuccess("");
  try{
   const client=getSupabaseBrowserClient();
   if(!client)throw new Error("Authentication unavailable");
   const {data:{session}}=await client.auth.getSession();
   if(!session)throw new Error("Sign in and verify your email first");
   const response=await fetch("/api/platform/invitations/accept",{method:"POST",cache:"no-store",
    headers:{"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"},
    body:JSON.stringify({token:token.trim()})});
   const data=await response.json().catch(()=>null);
   if(!response.ok||!data?.ok)throw new Error(data?.error||"Invitation unavailable");
   setToken("");setSuccess("Invitation accepted. You can now select the organization from your organization switcher.");
  }catch(e){setError(e instanceof Error?e.message:"Invitation unavailable")}finally{setBusy(false)}
 }
 return <main style={{maxWidth:640,margin:"2rem auto",padding:"1rem"}}>
  <h1>Join an organization</h1>
  <p>Sign in with the email address that received the invitation and verify your email before accepting.</p>
  <label>One-time invitation code <input value={token} onChange={e=>setToken(e.target.value)} autoComplete="off"/></label>{" "}
  <button type="button" disabled={busy||!token.trim()} onClick={()=>void accept()}>Accept invitation</button>
  {error&&<p role="alert">{error}</p>}{success&&<p role="status">{success}</p>}
 </main>;
}
