"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Org={id:string;displayName:string;role:string};
type Member={id:string;user_id:string;role_key:string;status:string};
const roles=["owner","admin","staff","trainer","member"];
const statuses=["active","suspended","removed"];
async function request(path:string,init:RequestInit={}) {
 const client=getSupabaseBrowserClient();
 if(!client)throw new Error("Authentication unavailable");
 const {data:{session}}=await client.auth.getSession();
 if(!session)throw new Error("Sign in first");
 const response=await fetch(path,{...init,cache:"no-store",headers:{"Authorization":"Bearer "+session.access_token,...(init.body?{"Content-Type":"application/json"}:{}),...init.headers}});
 const json=await response.json().catch(()=>null);
 if(!response.ok||!json?.ok)throw new Error(json?.error||"Access unavailable");
 return json;
}
export default function MembersPage(){
 const [orgs,setOrgs]=useState<Org[]>([]);
 const [organizationId,setOrganizationId]=useState("");
 const [members,setMembers]=useState<Member[]>([]);
 const [drafts,setDrafts]=useState<Record<string,{role:string;status:string}>>({});
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;request("/api/platform/organizations").then(x=>{
  if(!active)return;
  setOrgs((x.organizations as Org[]).filter(o=>o.role==="owner"));
  const selected=(x.organizations as Org[]).find(o=>o.id===x.selectedOrganizationId&&o.role==="owner");
  if(selected)setOrganizationId(selected.id);
 }).catch(e=>{if(active)setError(String(e))});return()=>{active=false}},[]);
 useEffect(()=>{let active=true;setMembers([]);setDrafts({});
  if(organizationId)request("/api/platform/organizations/"+organizationId+"/members").then(x=>{
   if(!active)return;const rows=x.members as Member[];setMembers(rows);
   setDrafts(Object.fromEntries(rows.map(m=>[m.id,{role:m.role_key,status:m.status}])));
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:"Members unavailable")});
  return()=>{active=false};
 },[organizationId]);
 async function save(m:Member){
  const draft=drafts[m.id];if(!draft||busy)return;
  setBusy(true);setError("");
  try{
   await request("/api/platform/organizations/"+organizationId+"/members/"+m.id,
    {method:"PATCH",body:JSON.stringify({role:draft.role,status:draft.status})});
   const next=await request("/api/platform/organizations/"+organizationId+"/members");
   setMembers(next.members as Member[]);
  }catch(e){setError(e instanceof Error?e.message:"Update failed")}finally{setBusy(false)}
 }
 return <main style={{maxWidth:880,margin:"2rem auto",padding:"1rem"}}>
  <h1>Organization members</h1>
  <p>Owners can review members and change roles. Changes are audited. The last active owner cannot be removed.</p>
  {orgs.length===0?<p>No organization owner access is available.</p>:<>
   <label htmlFor="org-select">Organization</label>{" "}
   <select id="org-select" value={organizationId} onChange={e=>setOrganizationId(e.target.value)}>
    <option value="">Select organization</option>
    {orgs.map(o=><option key={o.id} value={o.id}>{o.displayName}</option>)}
   </select>
   {members.map(m=><section key={m.id} style={{border:"1px solid #aaa",borderRadius:8,padding:12,marginTop:12}}>
    <p>Member: {m.user_id}</p>
    <label>Role <select aria-label={"Role for "+m.user_id} value={drafts[m.id]?.role??m.role_key}
      onChange={e=>setDrafts(d=>({...d,[m.id]:{...(d[m.id]??{role:m.role_key,status:m.status}),role:e.target.value}}))}>
      {roles.map(role=><option key={role}>{role}</option>)}
    </select></label>{" "}
    <label>Status <select aria-label={"Status for "+m.user_id} value={drafts[m.id]?.status??m.status}
      onChange={e=>setDrafts(d=>({...d,[m.id]:{...(d[m.id]??{role:m.role_key,status:m.status}),status:e.target.value}}))}>
      {statuses.map(status=><option key={status}>{status}</option>)}
    </select></label>{" "}
    <button type="button" disabled={busy||!drafts[m.id]||
      (drafts[m.id].role===m.role_key&&drafts[m.id].status===m.status)} onClick={()=>void save(m)}>Save</button>
   </section>)}
  </>}
  {error&&<p role="alert">{error}</p>}
 </main>;
}
