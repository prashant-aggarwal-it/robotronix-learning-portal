"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {connectFetch} from "@/features/connect/api/client";

type Consent="unknown"|"opted_in"|"opted_out";
type Filters={search:string;city:string;tag:string;source:string;consent:"all"|Consent};
type Contact={id:string;full_name:string;phone:string|null;email:string|null;company:string|null;city:string|null;notes:string|null;tags:string[];source:string|null;consent_status:Consent;created_at:string};
type Segment={id:string;name:string;filters:Filters;created_at:string};
type Duplicate={first_id:string;second_id:string;first_name:string;second_name:string;matching_value:string;kind:string};
type List={ok:boolean;items:Contact[];total:number};
type Rows<T>={ok:boolean;items:T[]};
const blank:Filters={search:"",city:"",tag:"",source:"",consent:"all"};
const csvCell=(v:unknown)=>'"'+String(v??"").replace(/"/g,'""')+'"';
const getMessage=(e:unknown)=>e instanceof Error?e.message:"The contact operation failed.";
const url=(id:string)=>"/api/connect/workspaces/"+encodeURIComponent(id)+"/contacts/manage";

export function ContactManagementWorkspace({tenantId,onChanged,onClose,initialPersonId}:{
 tenantId:string;onChanged:()=>void;onClose:()=>void;initialPersonId?:string|null;
}){
 const [filters,setFilters]=useState<Filters>(blank),[draft,setDraft]=useState<Filters>(blank);
 const [contacts,setContacts]=useState<Contact[]>([]),[total,setTotal]=useState(0);
 const [segments,setSegments]=useState<Segment[]>([]),[duplicates,setDuplicates]=useState<Duplicate[]>([]);
 const [active,setActive]=useState<"directory"|"duplicates">("directory");
 const [page,setPage]=useState(0),[selected,setSelected]=useState<string[]>([]);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const [editor,setEditor]=useState<Contact|null>(null),[edit,setEdit]=useState({name:"",phone:"",email:"",company:"",city:"",notes:"",tags:""});
 const [consent,setConsent]=useState<Consent>("unknown"),[evidence,setEvidence]=useState("");
 const [bulk,setBulk]=useState<"add_tag"|"remove_tag"|"set_city"|"opt_out">("add_tag"),[bulkValue,setBulkValue]=useState("");
 const [segmentName,setSegmentName]=useState("");
 const [refresh,setRefresh]=useState(0);
 const endpoint=url(tenantId);
 const loadSegments=useCallback(async()=>{
  const r=await connectFetch<Rows<Segment>>(endpoint+"?action=segments");setSegments(r.items||[]);
 },[endpoint]);
 const loadDuplicates=useCallback(async()=>{
  const r=await connectFetch<Rows<Duplicate>>(endpoint+"?action=duplicates");setDuplicates(r.items||[]);
 },[endpoint]);
 useEffect(()=>{let alive=true;
  const params=new URLSearchParams({action:"list",filters:JSON.stringify(filters),offset:String(page*50),limit:"50"});
  setLoading(true);
  void connectFetch<List>(endpoint+"?"+params).then(r=>{
   if(alive){setContacts(r.items||[]);setTotal(r.total||0);}
  }).catch(e=>{if(alive)setError(getMessage(e));}).finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;};
 },[endpoint,filters,page,refresh]);
 useEffect(()=>{void loadSegments().catch(()=>{});},[loadSegments,refresh]);
 useEffect(()=>{if(active==="duplicates")void loadDuplicates().catch(e=>setError(getMessage(e)));},[active,loadDuplicates,refresh]);
 useEffect(()=>{if(!initialPersonId)return;
  let alive=true;
  void connectFetch<{item:Contact}>(endpoint+"?action=get&id="+encodeURIComponent(initialPersonId)).then(r=>{
   if(alive&&r.item)openEditor(r.item);
  }).catch(e=>{if(alive)setError(getMessage(e));});
  return()=>{alive=false;};
 },[endpoint,initialPersonId]);
 const allVisible=contacts.length>0&&contacts.every(x=>selected.includes(x.id));
 const selectedCount=selected.length;
 const changeFilter=<K extends keyof Filters>(key:K,value:Filters[K])=>setDraft(p=>({...p,[key]:value}));
 const applyFilters=(next:Filters)=>{setFilters({...next});setDraft({...next});setPage(0);setSelected([]);setError("");};
 function openEditor(c:Contact){
  setEditor(c);setEdit({name:c.full_name,phone:c.phone||"",email:c.email||"",company:c.company||"",city:c.city||"",notes:c.notes||"",tags:c.tags.join(", ")});
  setConsent(c.consent_status);setEvidence("");setError("");
 }
 const action=async(data:Record<string,unknown>,success:string)=>{
  setBusy(true);setError("");setMessage("");
  try{
   await connectFetch(endpoint,{method:"POST",body:JSON.stringify(data)});
   setMessage(success);setRefresh(n=>n+1);onChanged();return true;
  }catch(e){setError(getMessage(e));return false;}
  finally{setBusy(false);}
 };
 const editTags=edit.tags.split(",").map(s=>s.trim()).filter(Boolean).slice(0,20);
 const requestEditorClose=()=>{
  if(busy||!editor)return;
  const changed=edit.name!==editor.full_name||edit.phone!==(editor.phone||"")||edit.email!==(editor.email||"")||
   edit.company!==(editor.company||"")||edit.city!==(editor.city||"")||edit.notes!==(editor.notes||"")||
   edit.tags!==editor.tags.join(", ")||consent!==editor.consent_status||Boolean(evidence.trim());
  if(changed&&!window.confirm("Discard unsaved contact changes?"))return;
  setEditor(null);
 };
 async function saveDetails(){
  if(!editor||!edit.name.trim())return;
  const ok=await action({action:"edit",id:editor.id,...edit,tags:editTags},"Contact details saved.");
  if(ok)setEditor(null);
 }
 async function saveConsent(){
  if(!editor)return;
  if(consent==="opted_in"&&(evidence.trim().length<12||!window.confirm("Confirm you independently verified this person's WhatsApp marketing opt-in and recorded evidence.")))return;
  if(consent==="opted_out"&&!window.confirm("Record this contact as opted out of WhatsApp marketing?"))return;
  const ok=await action({action:"consent",id:editor.id,status:consent,evidence:evidence.trim()},"WhatsApp permission recorded.");
  if(ok)setEditor(null);
 }
 async function bulkApply(){
  if(!selected.length)return;
  if(bulk!=="opt_out"&&!bulkValue.trim()){setError("Enter a value for the selected bulk action.");return;}
  if(!window.confirm("Apply "+(bulk==="opt_out"?"WhatsApp opt-out":bulk.replace("_"," "))+" to "+selected.length+" selected contacts?"))return;
  const ok=await action({action:"bulk",ids:selected,operation:bulk,value:bulkValue},"Updated "+selected.length+" contacts.");
  if(ok){setSelected([]);setBulkValue("");}
 }
 async function saveSegment(){
  if(segmentName.trim().length<2){setError("Enter a segment name with at least two characters.");return;}
  const ok=await action({action:"save_segment",name:segmentName.trim(),filters},"Segment saved.");
  if(ok)setSegmentName("");
 }
 async function removeSegment(s:Segment){
  if(window.confirm("Delete saved segment \""+s.name+"\"? Contacts will not be deleted."))
   await action({action:"delete_segment",id:s.id},"Segment removed.");
 }
 async function handleDuplicate(d:Duplicate,merge:boolean){
  if(merge){
   const keep=window.confirm("Keep \""+d.first_name+"\" and archive \""+d.second_name+"\"? This is only allowed when the second contact has NO linked CRM activity. Linked records will never be silently reassigned.");
   if(!keep)return;
   await action({action:"merge",keepId:d.first_id,mergeId:d.second_id},"Duplicate merged; source archived.");
  }else{
   await action({action:"dismiss_duplicate",firstId:d.first_id,secondId:d.second_id},"Marked as separate contacts.");
  }
 }
 async function exportCsv(){
  if(!total){setError("No contacts match the current filters.");return;}
  if(total>20000){setError("Export is limited to 20,000 contacts at a time. Narrow your filters.");return;}
  setBusy(true);setError("");setMessage("");
  try{
   const columns=["Name","Phone","Email","Company","City","Tags","Source","WhatsApp consent","Notes"];
   const lines=[columns.map(csvCell).join(",")];
   let count=0;
   for(let offset=0;offset<total;offset+=100){
    const qs=new URLSearchParams({action:"list",filters:JSON.stringify(filters),offset:String(offset),limit:"100"});
    const batch=await connectFetch<List>(endpoint+"?"+qs);
    if(!batch.items.length)break;
    for(const c of batch.items)lines.push([c.full_name,c.phone,c.email,c.company,c.city,c.tags.join("; "),c.source,c.consent_status,c.notes].map(csvCell).join(","));
    count+=batch.items.length;
   }
   const blob=new Blob(["\uFEFF"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
   const link=document.createElement("a");const object=URL.createObjectURL(blob);
   link.href=object;link.download="robotronix-contacts-"+new Date().toISOString().slice(0,10)+".csv";link.click();
   setTimeout(()=>URL.revokeObjectURL(object),1000);
   setMessage("Exported "+count+" filtered contacts.");
  }catch(e){setError(getMessage(e));}
  finally{setBusy(false);}
 }
 const pageCount=Math.max(1,Math.ceil(total/50));
 return <section className="cx-manage">
  <header className="cx-manage-header"><div><span>CONTACT OPERATIONS</span><h2>Manage contacts</h2><p>Maintain contact records, segments, consent and duplicate review.</p></div><button type="button" onClick={onClose}>Return to Contacts</button></header>
  <div className="cx-manage-tabs" role="tablist" aria-label="Contact management"><button type="button" aria-selected={active==="directory"} role="tab" onClick={()=>setActive("directory")}>Directory &amp; segments</button><button type="button" aria-selected={active==="duplicates"} role="tab" onClick={()=>setActive("duplicates")}>Duplicate review</button></div>
  {error&&<div className="cx-manage-error" role="alert">{error}</div>}
  {message&&<div className="cx-manage-success" role="status">{message}</div>}
  {active==="directory"&&<>
   <div className="cx-manage-card cx-manage-filters"><div className="cx-manage-card-head"><h3>Find &amp; segment contacts</h3><span>Filters apply to the entire workspace, not just loaded rows.</span></div>
    <div className="cx-manage-filter-grid"><label>Search<input placeholder="Name, phone, email or company" value={draft.search} onChange={e=>changeFilter("search",e.target.value)}/></label>
     <label>City<input placeholder="Any city" value={draft.city} onChange={e=>changeFilter("city",e.target.value)}/></label>
     <label>Tag<input placeholder="e.g. Robotics" value={draft.tag} onChange={e=>changeFilter("tag",e.target.value)}/></label>
     <label>Lead source<input placeholder="Source name" value={draft.source} onChange={e=>changeFilter("source",e.target.value)}/></label>
     <label>WhatsApp consent<select value={draft.consent} onChange={e=>changeFilter("consent",e.target.value as Filters["consent"])}><option value="all">All permission statuses</option><option value="unknown" disabled={editor.consent_status==="opted_out"}>Not verified</option><option value="opted_in">Verified opt-in</option><option value="opted_out">Opted out</option></select></label>
    </div>
    <div className="cx-manage-filter-actions"><button type="button" onClick={()=>applyFilters(draft)}>Apply filters</button><button type="button" onClick={()=>applyFilters(blank)}>Clear</button><button type="button" onClick={()=>void exportCsv()} disabled={busy}>Export filtered CSV</button></div>
    <div className="cx-manage-segment-line"><label>Save current filters<input value={segmentName} maxLength={90} placeholder="e.g. Delhi Robotics enquiries" onChange={e=>setSegmentName(e.target.value)}/></label><button type="button" disabled={busy||!segmentName.trim()} onClick={()=>void saveSegment()}>Save segment</button></div>
    {segments.length>0&&<div className="cx-manage-segments">{segments.map(s=><span key={s.id}><button type="button" onClick={()=>applyFilters({...blank,...s.filters})}>{s.name}</button><button type="button" aria-label={"Delete segment "+s.name} onClick={()=>void removeSegment(s)}>×</button></span>)}</div>}
   </div>
   <div className="cx-manage-card">
    <div className="cx-manage-card-head"><h3>Contact directory</h3><span>{loading?"Loading…":total+" matching contacts"}</span></div>
    {selectedCount>0&&<div className="cx-manage-bulk"><strong>{selectedCount} selected</strong><select aria-label="Bulk operation" value={bulk} onChange={e=>setBulk(e.target.value as typeof bulk)}>
      <option value="add_tag">Add tag</option><option value="remove_tag">Remove tag</option><option value="set_city">Set city</option><option value="opt_out">WhatsApp opt-out</option></select>
     {bulk!=="opt_out"&&<input aria-label="Bulk operation value" placeholder={bulk==="set_city"?"City":"Tag"} value={bulkValue} onChange={e=>setBulkValue(e.target.value)}/>}
     <button type="button" disabled={busy} onClick={()=>void bulkApply()}>Apply to selected</button><button type="button" onClick={()=>setSelected([])}>Clear selection</button></div>}
    <div className="cx-manage-table-scroll"><table className="cx-manage-table"><thead><tr>
     <th><input type="checkbox" aria-label="Select contacts on this page" checked={allVisible} onChange={e=>setSelected(p=>e.target.checked?Array.from(new Set([...p,...contacts.map(c=>c.id)])):p.filter(id=>!contacts.some(c=>c.id===id)))}/></th><th>Contact</th><th>Contact details</th><th>Tags / city</th><th>WhatsApp consent</th><th></th>
    </tr></thead><tbody>{contacts.map(c=><tr key={c.id}>
     <td><input type="checkbox" aria-label={"Select "+c.full_name} checked={selected.includes(c.id)} onChange={e=>setSelected(p=>e.target.checked?[...p,c.id]:p.filter(id=>id!==c.id))}/></td>
     <td><strong>{c.full_name}</strong><small>{c.company||c.source||"Contact"}</small></td>
     <td>{c.phone||"—"}<small>{c.email||""}</small></td>
     <td>{c.tags.slice(0,3).join(", ")||"—"}<small>{c.city||""}</small></td>
     <td><span className={"cx-manage-permission "+c.consent_status}>{c.consent_status==="opted_in"?"Verified opt-in":c.consent_status==="opted_out"?"Opted out":"Not verified"}</span></td>
     <td><button type="button" onClick={()=>openEditor(c)}>Edit ↗</button></td>
    </tr>)}</tbody></table></div>
    {!loading&&contacts.length===0&&<p className="cx-manage-empty">No contacts match these filters. Clear filters to see other records.</p>}
    <footer className="cx-manage-pages"><span>Page {page+1} of {pageCount} · Showing up to 50 per page</span><div><button type="button" disabled={page===0||loading} onClick={()=>{setPage(v=>v-1);setSelected([]);}}>Previous</button><button type="button" disabled={page+1>=pageCount||loading} onClick={()=>{setPage(v=>v+1);setSelected([]);}}>Next</button></div></footer>
   </div>
  </>}
  {active==="duplicates"&&<div className="cx-manage-card"><div className="cx-manage-card-head"><h3>Potential duplicate contacts</h3><span>{duplicates.length} matches · same exact phone/email</span></div>
   <p className="cx-manage-info">A matching number does not always mean the same person. Dismiss false positives, or merge only when the source has no linked activity. Existing admissions and conversations are never silently moved.</p>
   {duplicates.length===0?<p className="cx-manage-empty">No unresolved exact-identifier matches were found among the checked records.</p>:<div className="cx-manage-duplicate-list">{duplicates.map(d=><div key={d.first_id+":"+d.second_id}>
     <div><strong>{d.first_name}</strong><span>and</span><strong>{d.second_name}</strong><small>{d.kind} · {d.matching_value}</small></div>
     <div><button disabled={busy} onClick={()=>void handleDuplicate(d,false)}>Not duplicates</button><button disabled={busy} onClick={()=>void handleDuplicate(d,true)}>Merge into first contact</button></div>
    </div>)}</div>}
   <button type="button" onClick={()=>void loadDuplicates()}>Refresh matches</button>
  </div>}
  {editor&&<div className="cx-manage-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)requestEditorClose();}}>
   <div className="cx-manage-editor" role="dialog" aria-modal="true" aria-labelledby="cx-manage-edit-title" aria-busy={busy}>
    <header><h3 id="cx-manage-edit-title">Edit contact</h3><button type="button" data-escape-close="true" aria-label="Close edit contact" disabled={busy} onClick={requestEditorClose}>×</button></header>
    <div className="cx-manage-editor-content">{error&&<p className="cx-manage-error" role="alert">{error}</p>}<div className="cx-manage-editor-grid">{(["name","phone","email","company","city","notes","tags"] as const).map(key=><label key={key}>{key==="tags"?"Tags (comma separated)":key==="phone"?"Primary phone":key==="name"?"Contact name":key.charAt(0).toUpperCase()+key.slice(1)}
     {key==="notes"?<textarea value={edit[key]} onChange={e=>setEdit(p=>({...p,[key]:e.target.value}))} rows={3}/>:<input value={edit[key]} maxLength={254} onChange={e=>setEdit(p=>({...p,[key]:e.target.value}))}/>}</label>)}</div>
    <p>Changing a phone or email preserves previous identifiers for conversation history. Include the country calling code when updating phone numbers; review duplicates before using a shared number.</p>
    <button className="cx-manage-primary" type="button" disabled={busy||!edit.name.trim()} onClick={()=>void saveDetails()}>Save contact details</button>
    <div className="cx-manage-consent-editor"><h4>WhatsApp marketing permission</h4><p>Importing, finding or purchasing a contact does not establish marketing opt-in.</p>
     <label>Status<select value={consent} onChange={e=>setConsent(e.target.value as Consent)}><option value="unknown">Not verified</option><option value="opted_in">Verified opt-in</option><option value="opted_out">Opted out</option></select></label>
     {consent==="opted_in"&&<label>Evidence of explicit permission<textarea rows={2} placeholder="How and when did this person agree to receive WhatsApp marketing?" value={evidence} onChange={e=>setEvidence(e.target.value)}/></label>}
     <button type="button" disabled={busy||consent==="opted_in"&&evidence.trim().length<12} onClick={()=>void saveConsent()}>Record permission change</button>
    </div></div>
   </div></div>}
 </section>;
}