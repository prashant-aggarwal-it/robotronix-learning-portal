"use client";
import {FormEvent,useCallback,useEffect,useRef,useState} from "react";
import {connectFetch} from "@/features/connect/api/client";
export type EnquiryCategory={id:string;label:string;active:boolean;sortOrder:number};
export type EnquiryPreferences={mode:"simple"|"advanced";categories:EnquiryCategory[]};
export async function readEnquiryPreferences(tenantId:string){
 const r=await connectFetch<{preferences:EnquiryPreferences}>(`/api/connect/workspaces/${tenantId}/enquiry-preferences`);
 return r.preferences;
}
export function EnquirySettings({tenantId,canManage,onSaved}:{tenantId:string;canManage:boolean;onSaved:(p:EnquiryPreferences)=>void}){
 const [prefs,setPrefs]=useState<EnquiryPreferences|null>(null),[label,setLabel]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const request=useRef(0);
 const load=useCallback(async()=>{const id=++request.current;try{const p=await readEnquiryPreferences(tenantId);if(request.current===id){setPrefs(p);onSaved(p);}}catch(e){if(request.current===id)setError(e instanceof Error?e.message:"Unable to load settings");}},[tenantId,onSaved]);
 useEffect(()=>{setPrefs(null);void load();return()=>{request.current++;};},[load]);
 async function save(action:string,data:Record<string,unknown>){
  if(busy||!canManage)return;setBusy(true);setError("");
  try{const r=await connectFetch<{preferences:EnquiryPreferences}>(`/api/connect/workspaces/${tenantId}/enquiry-preferences`,{method:"PATCH",body:JSON.stringify({action,data})});
   setPrefs(r.preferences);onSaved(r.preferences);setLabel("");
  }catch(e){setError(e instanceof Error?e.message:"Unable to save settings");}finally{setBusy(false);}
 }
 return <section className="cx-panel cx-panel-full">
  <div className="cx-panel-header"><div><h2>Workspace experience & enquiry types</h2><p>Simple by default. Advanced tools remain available when needed.</p></div></div>
  <div className="cx-enquiry-config">
   {error&&<p role="alert" className="cx-alert">{error}</p>}
   <label>Workspace mode <select value={prefs?.mode||"simple"} disabled={!canManage||!prefs||busy}
    onChange={e=>void save("set_mode",{mode:e.target.value})}>
    <option value="simple">Simple — everyday enquiries and follow-ups</option>
    <option value="advanced">Advanced — analytics, pipelines and team tools</option>
   </select></label>
   <p className="cx-muted">Changing the mode only changes visible navigation. It never deletes records or changes staff permissions.</p>
   <h3>Enquiry categories</h3>
   <div className="cx-category-config-list">{(prefs?.categories||[]).map(c=><div key={c.id} className="cx-category-config-row">
    <span>{c.label}</span><label><input type="checkbox" checked={c.active} disabled={!canManage||busy}
     onChange={e=>void save("set_category_active",{id:c.id,active:e.target.checked})}/> Active</label>
    {canManage&&<button type="button" className="cx-secondary" disabled={busy} onClick={()=>{
     const name=window.prompt("Rename enquiry category",c.label);if(name?.trim()&&name.trim()!==c.label)void save("rename_category",{id:c.id,label:name.trim()});
    }}>Rename</button>}
   </div>)}</div>
   {canManage&&<form className="cx-inline-form" onSubmit={(e:FormEvent)=>{e.preventDefault();void save("add_category",{label:label.trim()});}}>
    <input aria-label="New enquiry category" maxLength={80} minLength={2} required placeholder="New enquiry type" value={label} onChange={e=>setLabel(e.target.value)}/>
    <button className="cx-secondary" disabled={busy||label.trim().length<2}>Add category</button>
   </form>}
  </div>
 </section>;
}
