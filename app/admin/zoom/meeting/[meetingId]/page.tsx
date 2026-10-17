"use client";
import {useEffect,useRef,useState} from "react";
import {useParams} from "next/navigation";
import {RoleGuard} from "@/components/RoleGuard";
import {portalApi} from "@/lib/portal-api-client";

type SdkSession={meetingNumber:string;password:string;signature:string;zak:string;userName:string;role:0|1;leaveUrl:string};

export default function AdminZoomMeetingPage(){
 return <RoleGuard allow={["admin"]}><MeetingRoom/></RoleGuard>;
}

function MeetingRoom(){
 const {meetingId}=useParams<{meetingId:string}>();
 const iframe=useRef<HTMLIFrameElement>(null);
 const[status,setStatus]=useState("Preparing secure Robotronix meeting…"),[error,setError]=useState("");

 useEffect(()=>{let cancelled=false;async function run(){try{
  const json=await portalApi("/api/zoom/sdk-session",{method:"POST",body:JSON.stringify({meetingId,mode:"host"})});
  if(cancelled)return;const details=json.session as SdkSession;
  const send=()=>iframe.current?.contentWindow?.postMessage({type:"ROBOTRONIX_ZOOM_JOIN",payload:details},window.location.origin);
  if(iframe.current?.contentDocument?.readyState==="complete")send();else iframe.current?.addEventListener("load",send,{once:true});
  setStatus("Starting meeting as Admin…");
 }catch(e){if(!cancelled)setError(e instanceof Error?e.message:String(e))}}run();return()=>{cancelled=true}},[meetingId]);

 useEffect(()=>{const handler=(event:MessageEvent)=>{if(event.origin!==window.location.origin||event.source!==iframe.current?.contentWindow)return;
  if(event.data?.type==="ROBOTRONIX_ZOOM_STATUS")setStatus(String(event.data.message||"Meeting ready"));
  if(event.data?.type==="ROBOTRONIX_ZOOM_ERROR")setError(String(event.data.message||"Meeting failed"));
 };window.addEventListener("message",handler);return()=>window.removeEventListener("message",handler)},[]);

 return <main style={{height:"100vh",display:"flex",flexDirection:"column",background:"#07152c",color:"white"}}>
  <div style={{padding:"10px 16px",display:"flex",justifyContent:"space-between",gap:16,alignItems:"center"}}>
   <b>Robotronix™ Meeting · Admin Host</b><span>{error?"Error: "+error:status}</span>
  </div>
  <div style={{padding:"8px 16px",background:"#102341",fontSize:13}}>External guests join using the invitation link you share. Recording follows the meeting policy shown in Zoom Classroom.</div>
  {error?<div style={{padding:24,background:"white",color:"#8b1d1d",margin:16,borderRadius:12}}>{error}<div style={{marginTop:12}}><a href="/admin/zoom">Return to Zoom Classroom</a></div></div>
  :<iframe ref={iframe} title="Robotronix Zoom Meeting" src="/zoom-poc-frame.html" allow="camera; microphone; display-capture; autoplay; fullscreen" style={{flex:1,width:"100%",border:0,background:"#111"}}/>}
 </main>;
}
