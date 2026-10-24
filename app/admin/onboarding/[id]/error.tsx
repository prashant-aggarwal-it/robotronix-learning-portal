"use client";
import {useEffect} from "react";
export default function OnboardingDetailError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 useEffect(()=>{console.error("Onboarding detail failed:",error)},[error]);
 return <main style={{maxWidth:700,margin:"40px auto",padding:24}} role="alert">
  <h1>Unable to open onboarding record</h1>
  <p>Something prevented this record from loading. No changes were saved by this failed page load.</p>
  <p style={{overflowWrap:"anywhere"}}>{error.message||"An unexpected error occurred."}</p>
  {error.digest&&<small>Reference: {error.digest}</small>}
  <div style={{display:"flex",gap:12,marginTop:20}}>
   <button type="button" className="button" onClick={reset}>Try again</button>
   <a className="button ghost" href="/admin/onboarding">Back to onboarding</a>
  </div>
 </main>;
}
