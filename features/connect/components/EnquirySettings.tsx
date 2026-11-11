"use client";
import {FormEvent,useCallback,useEffect,useRef,useState} from "react";
import {connectFetch} from "@/features/connect/api/client";
import type {EnquiryPreferences} from "@/features/connect/types/enquiries";
export async function readEnquiryPreferences(tenantId:string){
 const r=await connectFetch<{preferences:EnquiryPreferences}>(`/api/connect/workspaces/${tenantId}/enquiry-preferences`);
 return r.preferences;
}
export function EnquirySettings({tenantId,canManage,onSaved}:{tenantId:string;canManage:boolean;onSaved:(p:EnquiryPreferences)=>void}){
 const [prefs,setPrefs]=useState<EnquiryPreferences|null>(null),[label,setLabel]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [editingId,setEditingId]=useState<string|null>(null),[renameValue,setRenameValue]=useState("");
 const request=useRef(0);
 const load=useCallback(async()=>{const id=++request.current;try{const p=await readEnquiryPreferences(tenantId);if(request.current===id){setPrefs(p);onSaved(p);}}catch(e){if(request.current===id)setError(e instanceof Error?e.message:"Unable to load settings");}},[tenantId,onSaved]);
 useEffect(()=>{setPrefs(null);void load();return()=>{request.current++;};},[load]);
 async function save(action:string,data:Record<string,unknown>){
  if(busy||!canManage)return;setBusy(true);setError("");
  try{const r=await connectFetch<{preferences:EnquiryPreferences}>(`/api/connect/workspaces/${tenantId}/enquiry-preferences`,{method:"PATCH",body:JSON.stringify({action,data})});
   setPrefs(r.preferences);onSaved(r.preferences);setLabel("");
  }catch(e){setError(e instanceof Error?e.message:"Unable to save settings");}finally{setBusy(false);}
 }
 return <section className="cx-panel cx-settings-enquiry-panel">
  <div className="cx-panel-header"><div><h2>Workspace preferences</h2><p>Choose the workspace experience and manage enquiry categories.</p></div></div>
  <div className="cx-enquiry-config">
   {error&&<p role="alert" className="cx-alert">{error}</p>}
   <div className="cx-settings-mode-row"><label>Workspace mode <select value={prefs?.mode||"simple"} disabled={!canManage||!prefs||busy}
    onChange={e=>void save("set_mode",{mode:e.target.value})}>
    <option value="simple">Simple — everyday enquiries and follow-ups</option>
    <option value="advanced">Advanced — analytics, pipelines and team tools</option>
   </select></label>
   <p className="cx-muted">This only changes visible navigation; it does not delete records or change permissions.</p></div>
   <details className="cx-settings-category-details">
    <summary><span><strong>Enquiry categories</strong><small>{prefs?.categories.filter(c=>c.active).length||0} active of {prefs?.categories.length||0} categories · Expand to manage</small></span><span className="cx-settings-category-count">Manage categories</span></summary>
    <div className="cx-settings-category-inner">
     <div className="cx-category-config-list">{(prefs?.categories||[]).map(c=><div key={c.id} className="cx-category-config-row">
      {editingId===c.id?<form className="cx-settings-rename-form" onSubmit={e=>{e.preventDefault();const name=renameValue.trim();if(name&&name!==c.label)void save("rename_category",{id:c.id,label:name});setEditingId(null);}}>
       <input aria-label={"New name for "+c.label} required minLength={2} maxLength={80} value={renameValue} onChange={e=>setRenameValue(e.target.value)}/>
       <button type="submit" className="cx-secondary" disabled={busy||renameValue.trim().length<2}>Save</button>
       <button type="button" className="cx-secondary" onClick={()=>setEditingId(null)}>Cancel</button>
      </form>:<strong>{c.label}</strong>}
      <label className="cx-settings-active-toggle"><input type="checkbox" checked={c.active} disabled={!canManage||busy}
       onChange={e=>void save("set_category_active",{id:c.id,active:e.target.checked})}/><span>{c.active?"Active":"Inactive"}</span></label>
      {canManage&&editingId!==c.id&&<button type="button" className="cx-secondary" disabled={busy} onClick={()=>{setEditingId(c.id);setRenameValue(c.label);}}>Rename</button>}
     </div>)}</div>
     {canManage&&<form className="cx-inline-form cx-settings-add-category" onSubmit={(e:FormEvent)=>{e.preventDefault();void save("add_category",{label:label.trim()});}}>
      <input aria-label="New enquiry category" maxLength={80} minLength={2} required placeholder="New enquiry category" value={label} onChange={e=>setLabel(e.target.value)}/>
      <button className="cx-secondary" disabled={busy||label.trim().length<2}>Add category</button>
     </form>}
    </div>
   </details>
  </div>
 </section>;
}
