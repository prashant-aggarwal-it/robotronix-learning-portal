"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {parseCsv,TASK_CSV_FIELDS,type ImportRow} from "@/lib/server/tasks/csv";

type Request=<T>(url:string,init?:RequestInit)=>Promise<T>;
type Mapping=Record<string,string>;
export function TaskDataTools({request,onImported}:{request:Request;onImported:()=>Promise<void>}){
 const [rows,setRows]=useState<string[][]>([]),[headers,setHeaders]=useState<string[]>([]),[mapping,setMapping]=useState<Mapping>({});
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const read=async(file:File)=>{setError("");setNotice("");if(file.size>256000){setError("CSV must be smaller than 250 KB.");return}
  try{const data=parseCsv(await file.text());if(data.length<2)throw new Error("CSV must have headers and at least one task.");
   if(data.length>201)throw new Error("Import up to 200 tasks at once.");const cols=data[0].map((h,i)=>h.trim()||`Column ${i+1}`);
   setHeaders(cols);setRows(data.slice(1));setMapping(Object.fromEntries(TASK_CSV_FIELDS.map(key=>[key,cols.find(h=>h.toLowerCase().replace(/\s+/g,"_")===key)||""])));
  }catch(e){setError(e instanceof Error?e.message:"Invalid CSV.");setRows([])}
 };
 const imported=rows.map(row=>Object.fromEntries(TASK_CSV_FIELDS.filter(key=>mapping[key]).map(key=>[key,row[headers.indexOf(mapping[key])]||""])) as ImportRow);
 const validTitles=imported.filter(r=>r.title?.trim()).length;
 const run=async()=>{if(!rows.length||validTitles!==rows.length){setError("Every row needs a title. Review the column mapping.");return}
  if(!window.confirm(`Import ${rows.length} personal tasks? Existing tasks will be preserved.`))return;
  setBusy(true);setError("");try{const r=await request<{imported:number}>("/api/tasks/data",{method:"POST",body:JSON.stringify({rows:imported})});setNotice(`${r.imported} tasks imported successfully.`);setRows([]);setHeaders([]);await onImported()}
  catch(e){setError(e instanceof Error?e.message:"Import failed.")}finally{setBusy(false)}
 };
 const exportData=async(format:"csv"|"json")=>{setBusy(true);setError("");try{const client=getSupabaseBrowserClient();const {data:{session}}=await client!.auth.getSession();if(!session)throw new Error("Sign in again.");
   const res=await fetch(`/api/tasks/data?format=${format}`,{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});if(!res.ok)throw new Error("Export unavailable.");
   const blob=await res.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`my-tasks.${format}`;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
  }catch(e){setError(e instanceof Error?e.message:"Export failed.")}finally{setBusy(false)}
 };
 return <section className="tw-panel tw-data-tools"><span className="tw-overline">YOUR DATA, YOUR WAY</span><h2>Import & export</h2><p>Bring your own tasks or keep a portable copy. Exports include only personal tasks you own, never another member’s shared work.</p>
  <div className="tw-data-export"><button onClick={()=>void exportData("csv")} disabled={busy}>↓ Export CSV</button><button onClick={()=>void exportData("json")} disabled={busy}>↓ Export JSON</button></div>
  <div className="tw-data-drop"><strong>Import tasks from CSV</strong><p>Upload up to 200 tasks (250 KB) with a header row. Map your columns before importing.</p><input type="file" accept=".csv,text/csv" onChange={e=>{const f=e.target.files?.[0];if(f)void read(f);e.target.value=""}}/></div>
  {rows.length>0&&<><div className="tw-mapping"><h3>Match CSV columns</h3><div>{TASK_CSV_FIELDS.map(key=><label key={key}>{key.replaceAll("_"," ")}<select value={mapping[key]||""} onChange={e=>setMapping(prev=>({...prev,[key]:e.target.value}))}><option value="">Skip column</option>{headers.map(h=><option value={h} key={h}>{h}</option>)}</select></label>)}</div></div>
   <div className="tw-import-preview"><b>Preview · {rows.length} tasks</b>{imported.slice(0,4).map((r,i)=><div key={i}><strong>{r.title||"Missing title"}</strong><small>{r.priority||"medium"} · {r.status||"todo"}</small></div>)}</div>
   <button className="tw-import-confirm" disabled={busy||validTitles!==rows.length} onClick={()=>void run()}>{busy?"Importing…":`Import ${rows.length} tasks`}</button></>}
  {error&&<p className="tw-data-error" role="alert">{error}</p>}{notice&&<p className="tw-data-success" role="status">✓ {notice}</p>}
 </section>;
}

export function TaskHealthCard({request}:{request:Request}){
 const [data,setData]=useState<{service:string;response_ms:number;counts:{personal_tasks:number;open_tasks:number;workspaces:number;linked_records:number}}|null>(null);
 const [error,setError]=useState("");
 useEffect(()=>{void request<typeof data>("/api/tasks/diagnostics").then(setData).catch(e=>setError(e instanceof Error?e.message:"Diagnostics unavailable"))},[request]);
 return <section className="tw-panel tw-task-health"><span className="tw-overline">YOUR WORKSPACE HEALTH</span><h2>Account snapshot</h2>{data?<><span className="tw-health-ready">● Task service ready · {data.response_ms} ms</span><div className="tw-health-stats"><span><b>{data.counts.personal_tasks}</b> Personal</span><span><b>{data.counts.open_tasks}</b> Open</span><span><b>{data.counts.workspaces}</b> Teams</span><span><b>{data.counts.linked_records}</b> Linked</span></div></>:<p>{error||"Checking account status…"}</p>}<small>Counts are scoped to your signed-in account. Service health does not expose other organizations.</small></section>;
}
