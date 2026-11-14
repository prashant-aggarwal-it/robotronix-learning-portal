"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";

type Organization={id:string;displayName:string;role:string;slug:string};
type Discovery={ok:boolean;organizations:Organization[];selectedOrganizationId:string|null;requiresSelection:boolean};
async function authorizedRequest(path:string,init:RequestInit={}){
 const client=getSupabaseBrowserClient();
 if(!client)throw new Error("Authentication unavailable");
 const {data:{session}}=await client.auth.getSession();
 if(!session)throw new Error("Sign in first");
 const response=await fetch(path,{...init,cache:"no-store",headers:{"Authorization":"Bearer "+session.access_token,...(init.body?{"Content-Type":"application/json"}:{}),...init.headers}});
 const data=await response.json().catch(()=>null);
 if(!response.ok||!data?.ok)throw new Error(data?.error||"Organization access unavailable");
 return data;
}
/** Shared org picker; org selection is never authorization. Server rechecks every action. */
export function SuiteOrganizationSwitcher(){
 const router=useRouter();
 const [organizations,setOrganizations]=useState<Organization[]>([]);
 const [selected,setSelected]=useState("");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 useEffect(()=>{
  let active=true;
  authorizedRequest("/api/platform/organizations").then((data:Discovery)=>{
   if(!active)return;
   setOrganizations(data.organizations);
   setSelected(data.selectedOrganizationId||"");
  }).catch(()=>{if(active)setOrganizations([])}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[]);
 async function change(next:string){
  if(busy||next===selected)return;
  setBusy(true);setError("");
  try{
   await authorizedRequest("/api/platform/organizations",next?{method:"POST",body:JSON.stringify({organizationId:next})}:{method:"DELETE"});
   // A hard navigation deliberately clears module-owned browser caches and live state.
   window.location.reload();
  }catch(e){
   setError(e instanceof Error?e.message:"Organization switch failed");setBusy(false);
  }
 }
 if(loading||organizations.length===0)return null;
 return <div className="suiteOrgControl">
  <label htmlFor="suite-active-organization">Organization</label>
  <select id="suite-active-organization" aria-label="Active organization" value={selected} disabled={busy}
   onChange={e=>void change(e.target.value)}>
   {organizations.length>1&&<option value="">Select organization</option>}
   {organizations.map(o=><option value={o.id} key={o.id}>{o.displayName}</option>)}
  </select>
  {error&&<span role="alert" className="suiteOrgError">{error}</span>}
 </div>;
}
