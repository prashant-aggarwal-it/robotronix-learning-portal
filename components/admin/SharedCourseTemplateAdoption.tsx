"use client";
import {useEffect,useMemo,useState} from "react";
import {adminApi} from "@/lib/admin-api-client";

type Organization={id:string;slug:string};
type Template={id:string;title:string;slug:string;code:string;category:string;gradeFrom:number;gradeTo:number;totalSessions:number};
const cleanSlug=(text:string)=>text.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,100).replace(/-+$/,"");
const cleanCode=(text:string)=>text.toUpperCase().replace(/[^A-Z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80).replace(/-+$/,"");
export function SharedCourseTemplateAdoption({onImported}:{onImported:()=>void}){
 const [org,setOrg]=useState<Organization|null>(null);
 const [templates,setTemplates]=useState<Template[]>([]);
 const [selected,setSelected]=useState("");
 const [slug,setSlug]=useState("");
 const [code,setCode]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 useEffect(()=>{
  let active=true;
  (async()=>{
   const o=await adminApi("/api/platform/organizations");
   const authorized=(o.organizations||[]).find((x:Organization)=>x.id===o.selectedOrganizationId);
   if(!active||!authorized)return;
   const result=await adminApi("/api/platform/academy/course-templates?organizationId="+encodeURIComponent(authorized.id));
   if(!active)return;
   setOrg(authorized);setTemplates(result.templates||[]);
  })().catch(()=>{}); // Standalone Academy deployments intentionally have no SaaS template catalog.
  return()=>{active=false};
 },[]);
 const current=useMemo(()=>templates.find(t=>t.id===selected),[templates,selected]);
 function choose(id:string){
  setSelected(id);setError("");setNotice("");
  const t=templates.find(row=>row.id===id);
  setSlug(t&&org?cleanSlug(org.slug+"-"+t.slug):"");
  setCode(t&&org?cleanCode(org.slug+"-"+t.code):"");
 }
 async function adopt(event:React.FormEvent){
  event.preventDefault();
  if(!org||!current||!slug||!code||busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   await adminApi("/api/platform/academy/course-templates/adopt",{
    method:"POST",body:JSON.stringify({organizationId:org.id,templateId:current.id,slug,code})
   });
   setNotice(current.title+" added as an independent draft course for this organization.");
   setSelected("");setSlug("");setCode("");
   onImported();
  }catch(e){setError(e instanceof Error?e.message:"Unable to adopt course template");}
  finally{setBusy(false)}
 }
 if(!org||templates.length===0)return null;
 return <section className="dataSection" aria-label="Shared course templates" style={{marginBottom:16}}>
  <details><summary style={{cursor:"pointer",fontWeight:650,padding:12}}>Add course from shared template catalog</summary>
  <form onSubmit={e=>void adopt(e)} style={{padding:12,display:"grid",gap:12,maxWidth:660}}>
   <p>Choose a reusable starting point. Each school receives its own editable course; existing catalog templates remain unchanged.</p>
   <label>Shared template
    <select aria-label="Shared course template" value={selected} onChange={e=>choose(e.target.value)} required>
     <option value="">Select a course</option>
     {templates.map(t=><option key={t.id} value={t.id}>{t.title} · Grades {t.gradeFrom}–{t.gradeTo}</option>)}
    </select>
   </label>
   {current&&<><label>Organization-specific slug<input aria-label="Organization-specific course slug" required maxLength={100} value={slug} onChange={e=>setSlug(cleanSlug(e.target.value))}/></label>
    <label>Organization-specific course code<input aria-label="Organization-specific course code" required maxLength={80} value={code} onChange={e=>setCode(cleanCode(e.target.value))}/></label>
   </>}
   {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
   <button type="submit" className="button" disabled={!current||!slug||!code||busy}>{busy?"Adding…":"Add to this organization"}</button>
  </form></details>
 </section>;
}
