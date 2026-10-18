"use client";
import {Suspense,useEffect,useRef,useState} from "react";
import {useParams,useSearchParams} from "next/navigation";
import {RoleGuard} from "@/components/RoleGuard";
import {portalApi} from "@/lib/portal-api-client";

type SdkSession={meetingNumber:string;password:string;signature:string;zak:string;userName:string;role:0|1;leaveUrl:string};
export default function ClassroomPage(){return <RoleGuard allow={["admin","trainer","parent","student"]}><Suspense fallback={<p>Preparing classroom…</p>}><Classroom/></Suspense></RoleGuard>}
function Classroom(){
 const {scheduleEventId}=useParams<{scheduleEventId:string}>();const params=useSearchParams();
 const mode=params.get("mode")==="host"?"host":"participant";const iframe=useRef<HTMLIFrameElement>(null);
 const[status,setStatus]=useState("Preparing secure Robotronix classroom…"),[error,setError]=useState("");
 useEffect(()=>{let cancelled=false;async function run(){try{
  const json=await portalApi("/api/zoom/sdk-session",{method:"POST",body:JSON.stringify({scheduleEventId,mode})});
  if(cancelled)return;const details=json.session as SdkSession;
  const send=()=>iframe.current?.contentWindow?.postMessage({type:"ROBOTRONIX_ZOOM_JOIN",payload:details},window.location.origin);
  if(iframe.current?.contentDocument?.readyState==="complete")send();else iframe.current?.addEventListener("load",send,{once:true});
  setStatus(mode==="host"?"Starting classroom as trainer…":"Joining classroom…");
 }catch(e){if(!cancelled)setError(e instanceof Error?e.message:String(e))}}run();return()=>{cancelled=true}},[scheduleEventId,mode]);
 useEffect(()=>{const handler=(event:MessageEvent)=>{if(event.origin!==window.location.origin||event.source!==iframe.current?.contentWindow)return;
  if(event.data?.type==="ROBOTRONIX_ZOOM_STATUS")setStatus(String(event.data.message||"Zoom classroom ready"));
  if(event.data?.type==="ROBOTRONIX_ZOOM_ERROR")setError(String(event.data.message||"Zoom classroom failed"));
 };window.addEventListener("message",handler);return()=>window.removeEventListener("message",handler)},[]);
 return <main style={{height:"100vh",display:"flex",flexDirection:"column",background:"#07152c",color:"white"}}>
  <div style={{padding:"10px 16px",display:"flex",justifyContent:"space-between",gap:16,alignItems:"center"}}><b>Robotronix™ Classroom · {mode==="host"?"Trainer":"Learner"}</b><span>{error?"Error: "+error:status}</span></div>
  <div style={{padding:"8px 16px",background:"#102341",fontSize:13}}>This class may be recorded for learning support, service quality and operational review. Access is restricted to authorized Robotronix users.</div>
  {error?<div style={{padding:24,background:"white",color:"#8b1d1d",margin:16,borderRadius:12}}>{error}<div style={{marginTop:12}}><a href={mode==="host"?"/trainer/classes":"/"}>Return to portal</a></div></div>
  :<iframe ref={iframe} title="Robotronix Zoom Classroom" src="/zoom-poc-frame.html" allow="camera; microphone; display-capture; autoplay; fullscreen" style={{flex:1,width:"100%",border:0,background:"#111"}}/>}
 </main>;
}
