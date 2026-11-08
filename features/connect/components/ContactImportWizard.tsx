"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {connectFetch} from "@/features/connect/api/client";

type Field="name"|"phone"|"email"|"company"|"city"|"notes"|"tags"|"sourceReference";
type Mapping=Record<Field,string>;
type Entry={rowNumber:number;name:string;phone:string;email:string;company:string;city:string;notes:string;tags:string[];sourceReference:string};
type Batch={id:string;file_name:string;source_label:string;source_type:string;status:string;created_at:string;processed:number;created:number;existing:number;skipped:number};
const FIELDS:{field:Field;label:string;keys:string[]}[]=[
 {field:"name",label:"Contact / business name",keys:["name","full name","contact name","business name","company name","title"]},
 {field:"phone",label:"Mobile / WhatsApp number",keys:["phone","phone number","mobile","mobile number","whatsapp","whatsapp number","telephone","contact number","phone 1","phone1"]},
 {field:"email",label:"Email",keys:["email","email address","email id","mail"]},
 {field:"company",label:"Organization",keys:["company","organization","organisation","business","school","institute"]},
 {field:"city",label:"City / location",keys:["city","location","area","address","town"]},
 {field:"notes",label:"Notes",keys:["notes","description","remarks","comments"]},
 {field:"tags",label:"Tags (comma separated)",keys:["tags","labels","category","categories"]},
 {field:"sourceReference",label:"Source URL / reference",keys:["website","url","maps url","google maps","source url","source reference"]}
];
const EMPTY=Object.fromEntries(FIELDS.map(x=>[x.field,""])) as Mapping;
const types=[["own","Existing customer database"],["event","Event or exhibition"],["referral","Referral"],["directory","Public business directory / Maps"],["purchased","Purchased contact list"],["other","Other source"]];
function parseCSV(text:string):string[][]{
 const rows:string[][]=[];let row:string[]=[],value="",quote=false;
 const input=text.replace(/^\uFEFF/,"");
 for(let i=0;i<input.length;i++){
  const c=input[i],next=input[i+1];
  if(quote){
   if(c==='"'&&next==='"'){value+='"';i++;}
   else if(c==='"')quote=false;
   else value+=c;
  }else if(c==='"'&&value.trim()==="")quote=true;
  else if(c===","){row.push(value.trim());value="";}
  else if(c==="\n"||c==="\r"){
   if(c==="\r"&&next==="\n")i++;
   row.push(value.trim());if(row.some(x=>x!==""))rows.push(row);
   row=[];value="";
  }else value+=c;
 }
 if(quote)throw Error("Unclosed quoted CSV field. Check the file formatting.");
 row.push(value.trim());if(row.some(x=>x!==""))rows.push(row);
 if(rows.length<2)throw Error("The CSV must contain a header and at least one contact.");
 if(rows.length>5001)throw Error("Import up to 5,000 contacts in one file. Split larger files.");
 if(rows[0].length>80)throw Error("Too many columns. Use a CSV with up to 80 columns.");
 return rows;
}
const clean=(v:string,max:number)=>v.trim().slice(0,max);
const phoneKey=(v:string,country:string)=>{const digits=v.replace(/\D/g,"");return digits.length===10?country+digits:digits;};
function buildRows(rows:string[][],headers:string[],mapping:Mapping,country:string):Entry[]{
 return rows.slice(1).map((columns,index)=>{
  const get=(field:Field)=>{const id=headers.indexOf(mapping[field]);return id>=0?columns[id]||"":"";};
  return {rowNumber:index+2,name:clean(get("name"),150),phone:clean(get("phone"),35),
   email:clean(get("email"),254),company:clean(get("company"),150),city:clean(get("city"),120),
   notes:clean(get("notes"),1000),tags:get("tags").split(/[,;|]/).map(x=>clean(x,50)).filter(Boolean).slice(0,15),
   sourceReference:clean(get("sourceReference"),250)};
 });
}
function rowWarning(row:Entry,country:string){
 const digits=phoneKey(row.phone,country);
 if(!row.phone&&!row.email)return "No phone or email";
 if(row.phone&&(digits.length<7||digits.length>15))return "Invalid phone";
 if(row.email&&!/^[^ @]+@[^ @]+\.[^ @]+$/.test(row.email))return "Invalid email";
 return "";
}
const path=(tenantId:string)=>"/api/connect/workspaces/"+encodeURIComponent(tenantId)+"/contacts/import";
export function ContactImportWizard({tenantId,onClose,onImported}:{
 tenantId:string;onClose:()=>void;onImported:()=>void;
}){
 const [file,setFile]=useState<File|null>(null),[sheet,setSheet]=useState<string[][]>([]);
 const [headers,setHeaders]=useState<string[]>([]),[mapping,setMapping]=useState<Mapping>(EMPTY);
 const [sourceType,setSourceType]=useState("own"),[sourceLabel,setSourceLabel]=useState("");
 const [country,setCountry]=useState("91"),[step,setStep]=useState<"map"|"review"|"results">("map");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[progress,setProgress]=useState(0);
 const [result,setResult]=useState({created:0,existing:0,skipped:0}),[history,setHistory]=useState<Batch[]>([]);
 const [ack,setAck]=useState(false),fileInput=useRef<HTMLInputElement>(null);
 const rows=useMemo(()=>buildRows(sheet,headers,mapping,country),[sheet,headers,mapping,country]);
 const invalid=useMemo(()=>rows.filter(r=>rowWarning(r,country)),[rows,country]);
 const duplicates=useMemo(()=>{
  const seen=new Set<string>();let count=0;
  for(const row of rows){const key=row.phone?phoneKey(row.phone,country):"e:"+row.email.toLowerCase();if(key&&seen.has(key))count++;else seen.add(key);}
  return count;
 },[rows,country]);
 const mappingReady=Boolean(mapping.phone||mapping.email);
 const importReady=mappingReady&&rows.length>0&&Boolean(sourceLabel.trim())&&ack;
 const url=path(tenantId);
 useEffect(()=>{let alive=true;
  void connectFetch<{items:Batch[]}>(url).then(r=>{if(alive)setHistory(r.items||[]);}).catch(()=>{});
  return()=>{alive=false;};
 },[url]);
 async function read(fileToRead:File){
  setError("");setStep("map");setSheet([]);setHeaders([]);setFile(null);setAck(false);
  if(fileToRead.size>6*1024*1024||!/\.csv$/i.test(fileToRead.name)){setError("Select a CSV file smaller than 6 MB.");return;}
  try{
   const data=parseCSV(await fileToRead.text());
   // Make duplicate header names unambiguous for mapping.
   const names=data[0].map((name,index)=>name||"Column "+(index+1));
   const unique=names.map((name,index)=>names.slice(0,index).includes(name)?name+" ("+(index+1)+")":name);
   const guess=Object.fromEntries(FIELDS.map(({field,keys})=>{
    const found=unique.find(h=>keys.includes(h.trim().toLowerCase().replace(/[_-]+/g," ")))||"";
    return [field,found];
   })) as Mapping;
   setHeaders(unique);setSheet([unique,...data.slice(1)]);setMapping(guess);setFile(fileToRead);
   if(!sourceLabel)setSourceLabel(fileToRead.name.replace(/\.csv$/i,"").slice(0,120));
  }catch(err){setError(err instanceof Error?err.message:"Unable to parse CSV.");}
 }
 function downloadTemplate(){
  const csv="Name,Phone,Email,Company,City,Tags,Notes,Website\nAarav Example,9876543210,,Robotronix,Delhi,Robotics;School,Requested a demo,https://example.org\n";
  const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  link.download="robotronix-contact-import-template.csv";link.click();URL.revokeObjectURL(link.href);
 }
 async function importAll(){
  if(!importReady||busy||!file)return;
  setBusy(true);setError("");setProgress(0);
  let batchId="";
  try{
   const started=await connectFetch<{id:string}>(url,{method:"POST",body:JSON.stringify({
    action:"start",fileName:file.name,sourceType,sourceLabel:sourceLabel.trim()
   })});batchId=started.id;
   const summary={created:0,existing:0,skipped:0};
   for(let offset=0;offset<rows.length;offset+=50){
    const chunk=rows.slice(offset,offset+50);
    const response=await connectFetch<{created:number;existing:number;skipped:number}>(url,{method:"POST",body:JSON.stringify({
     action:"chunk",batchId,countryCode:country,rows:chunk
    })});
    summary.created+=response.created||0;summary.existing+=response.existing||0;summary.skipped+=response.skipped||0;
    setProgress(Math.min(rows.length,offset+chunk.length));setResult({...summary});
   }
   await connectFetch(url,{method:"POST",body:JSON.stringify({action:"finish",batchId})});
   setResult(summary);setStep("results");onImported();
   const fresh=await connectFetch<{items:Batch[]}>(url);setHistory(fresh.items||[]);
  }catch(err){
   setError((err instanceof Error?err.message:"Import failed.")+(batchId?" Some rows may already be saved. Check the import history before importing the same file again.":""));
  }finally{setBusy(false);}
 }
 const hasWork=file!==null&&step!=="results";
 const requestClose=()=>{if(busy)return;if(hasWork&&!window.confirm("Close the importer and discard the current mapping?"))return;onClose();};
 return <div className="cx-import-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)requestClose();}}>
  <section role="dialog" aria-modal="true" aria-busy={busy} aria-labelledby="cx-import-title" className="cx-import-modal">
   <header className="cx-import-header"><div><h2 id="cx-import-title">Import contacts</h2><p>CSV upload · map fields · verify · import</p></div>
    <button type="button" data-escape-close="true" aria-label="Close contact importer" disabled={busy} onClick={requestClose}>×</button></header>
   <div className="cx-import-body">
    <div className="cx-import-steps" aria-label="Import progress"><span data-current={step==="map"}>1. Map</span><span data-current={step==="review"}>2. Review</span><span data-current={step==="results"}>3. Results</span></div>
    {error&&<p className="cx-import-error" role="alert">{error}</p>}
    {step==="map"&&<>
     <div className="cx-import-file"><label>Choose CSV file<input ref={fileInput} type="file" accept=".csv,text/csv" disabled={busy} onChange={e=>{const chosen=e.target.files?.[0];if(chosen)void read(chosen);}}/></label>
      <button type="button" onClick={downloadTemplate}>Download example CSV</button></div>
     {file&&<p className="cx-import-file-info">{file.name} · {rows.length} rows detected</p>}
     {headers.length>0&&<><div className="cx-import-map"><h3>Map your columns</h3><p>Names are optional when you have a phone or email. Additional columns remain untouched.</p>
      <div className="cx-import-map-grid">{FIELDS.map(f=><label key={f.field}>{f.label}
       <select value={mapping[f.field]} onChange={e=>setMapping(current=>({...current,[f.field]:e.target.value}))}>
        <option value="">Not imported</option>{headers.map(h=><option key={h} value={h}>{h}</option>)}
       </select></label>)}</div>
     </div><div className="cx-import-source"><label>Where are these contacts from?
       <select value={sourceType} onChange={e=>setSourceType(e.target.value)}>{types.map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
       <label>Source / list name<input maxLength={120} required value={sourceLabel} onChange={e=>setSourceLabel(e.target.value)} placeholder="e.g. School Expo leads — November"/></label>
       <label>Default dialling code (for 10-digit numbers)<input value={country} maxLength={4} inputMode="numeric" onChange={e=>setCountry(e.target.value.replace(/\D/g,""))}/></label>
      </div></>}
     {rows.length>0&&<p className="cx-import-note">Nothing will be saved until you review and confirm. Contacts are not added to broadcasts automatically.</p>}
    </>}
    {step==="review"&&<>
     <div className="cx-import-summary"><span><strong>{rows.length}</strong> rows</span><span><strong>{invalid.length}</strong> invalid</span><span><strong>{duplicates}</strong> possible duplicates in file</span></div>
     <p className="cx-import-note">Existing records are matched by phone/email. Ambiguous matches are skipped for manual review; existing contact details are not overwritten. Duplicate rows from the same file reuse an existing contact.</p>
     <div className="cx-import-preview"><table><thead><tr><th>Row</th><th>Name</th><th>Phone</th><th>Email</th><th>Check</th></tr></thead><tbody>{rows.slice(0,8).map(row=><tr key={row.rowNumber}>
      <td>{row.rowNumber}</td><td>{row.name||"Auto-generated"}</td><td>{row.phone||"—"}</td><td>{row.email||"—"}</td><td>{rowWarning(row,country)||"Ready"}</td>
     </tr>)}</tbody></table></div><p className="cx-import-note">Previewing the first {Math.min(8,rows.length)} rows. Invalid records will be skipped and counted.</p>
     <label className="cx-import-consent"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>
      <span>I confirm I have a lawful basis to store these contact details. I understand that importing phone numbers does <strong>not</strong> establish WhatsApp or marketing consent.</span></label>
    </>}
    {step==="results"&&<><div className="cx-import-results"><span><strong>{result.created}</strong> New contacts</span><span><strong>{result.existing}</strong> Existing matches</span><span><strong>{result.skipped}</strong> Skipped</span></div>
      <p className="cx-import-note">Saved contacts appear in Contacts. Imports do not create enquiries or send messages. Imported records remain ineligible for marketing campaigns without separately verified opt-in.</p>
     </>}
    {busy&&<div className="cx-import-progress" role="status"><progress value={progress} max={rows.length||1}/><span>Processing {progress} of {rows.length} contacts…</span></div>}
    <section className="cx-import-history"><h3>Recent imports</h3>{history.length===0?<p>No previous contact imports.</p>:<div className="cx-import-history-list">{history.slice(0,6).map(b=><div key={b.id}>
     <span><strong>{b.file_name}</strong><small>{b.source_label} · {new Date(b.created_at).toLocaleDateString("en-IN")} · {b.status}</small></span>
     <span>{b.created} new · {b.existing} existing · {b.skipped} skipped</span>
    </div>)}</div>}</section>
   </div>
   <footer className="cx-import-footer">
    <button type="button" disabled={busy} onClick={requestClose}>{step==="results"?"Done":"Cancel"}</button>
    {step==="map"&&<button type="button" className="cx-import-primary" disabled={!mappingReady||!rows.length||!sourceLabel.trim()||country.length<1||country.length>4} onClick={()=>{setError("");setStep("review");}}>Review import →</button>}
    {step==="review"&&<><button type="button" disabled={busy} onClick={()=>setStep("map")}>← Edit mapping</button><button type="button" className="cx-import-primary" disabled={!importReady||busy} onClick={()=>void importAll()}>Import {rows.length} contacts</button></>}
   </footer>
  </section>
 </div>;
}
