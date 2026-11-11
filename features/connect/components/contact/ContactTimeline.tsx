"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {connectFetch} from "@/features/connect/api/client";

export type TimelineEvent={id:string;kind:"enquiry"|"activity"|"admission"|"stage"|"task"|"appointment"|"message";title:string;detail:string;at:string;status:string|null};
type Cursor={at:string;key:string};
type Page={ok:true;items:TimelineEvent[];nextCursor:Cursor|null};
const options=[{value:"all",label:"All activity"},{value:"enquiry",label:"Enquiries"},{value:"activity",label:"Notes & calls"},{value:"stage",label:"Stage changes"},{value:"task",label:"Follow-ups"},{value:"appointment",label:"Appointments"},{value:"message",label:"Messages"},{value:"admission",label:"Admissions"}] as const;
function timestamp(value:string){const dt=new Date(value);return Number.isNaN(dt.getTime())?"Date unavailable":dt.toLocaleString("en-IN",{day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"});}
function glyph(kind:TimelineEvent["kind"]){return {enquiry:"◎",activity:"✎",admission:"▥",stage:"↗",task:"☑",appointment:"▦",message:"✉"}[kind];}
export function ContactTimeline({tenantId,personId,refreshKey}:{tenantId:string;personId:string;refreshKey:number}){
 const [items,setItems]=useState<TimelineEvent[]>([]);
 const [nextCursor,setNextCursor]=useState<Cursor|null>(null);
 const [filter,setFilter]=useState("all");
 const [loading,setLoading]=useState(true);
 const [loadingMore,setLoadingMore]=useState(false);
 const [error,setError]=useState("");
 const generation=useRef(0);
 const fetchPage=useCallback(async(cursor:Cursor|null,append:boolean)=>{
  const id=++generation.current;
  if(append)setLoadingMore(true);else{setLoading(true);setItems([]);setNextCursor(null);}
  setError("");
  try{
   const q=new URLSearchParams();
   if(cursor){q.set("beforeAt",cursor.at);q.set("beforeKey",cursor.key);}
   const r=await connectFetch<Page>("/api/connect/workspaces/"+tenantId+"/contacts/"+personId+"/timeline?"+q);
   if(generation.current!==id)return;
   setItems(current=>append?[...current,...r.items.filter(item=>!current.some(previous=>previous.id===item.id))]:r.items);
   setNextCursor(r.nextCursor);
  }catch(e){
   if(generation.current===id)setError(e instanceof Error?e.message:"Unable to load contact activity.");
  }finally{
   if(generation.current===id){setLoading(false);setLoadingMore(false);}
  }
 },[tenantId,personId]);
 useEffect(()=>{setFilter("all");void fetchPage(null,false);return()=>{generation.current++;};},[fetchPage,refreshKey]);
 const shown=items.filter(x=>filter==="all"||x.kind===filter);
 return <section className="cx-contact-timeline">
  <div className="cx-contact-timeline-toolbar"><div><h3>Contact activity</h3><p>Enquiries, conversations, stage changes, notes and scheduled work—newest first.</p></div>
   <button type="button" className="cx-secondary" disabled={loading||loadingMore} onClick={()=>void fetchPage(null,false)}>Refresh</button>
  </div>
  <label className="cx-timeline-filter">Show <select aria-label="Filter contact activity" value={filter} onChange={e=>setFilter(e.target.value)}>
   {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
  </select></label>
  {error&&<div className="cx-alert" role="alert">{error} <button type="button" onClick={()=>void fetchPage(null,false)}>Retry</button></div>}
  {loading?<p className="cx-insight-empty" role="status">Loading contact history…</p>:
   shown.length===0?<p className="cx-insight-empty">{items.length?"No matching events in the loaded history. Load older activity to look further back.":"No activity has been recorded for this contact yet."}</p>:
   <ol className="cx-timeline-events">{shown.map(item=><li key={item.id} className={"cx-timeline-entry cx-timeline-"+item.kind}>
    <span className="cx-timeline-glyph" aria-hidden="true">{glyph(item.kind)}</span>
    <div className="cx-timeline-entry-main"><div className="cx-timeline-title"><strong>{item.title}</strong><time dateTime={item.at}>{timestamp(item.at)}</time></div>
     {item.detail&&<p>{item.detail}</p>}{item.status&&<span className="cx-pill">{item.status.replaceAll("_"," ")}</span>}
    </div>
   </li>)}</ol>}
  {nextCursor&&!loading&&<button type="button" className="cx-timeline-more" disabled={loadingMore} onClick={()=>void fetchPage(nextCursor,true)}>{loadingMore?"Loading…":"Load older activity"}</button>}
  <p className="cx-timeline-note">History includes recorded events only. Filters apply to loaded events; use “Load older activity” for earlier records.</p>
 </section>;
}
