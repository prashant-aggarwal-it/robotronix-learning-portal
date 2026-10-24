"use client";
import {useEffect,useState} from "react";
import {useParams} from "next/navigation";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {adminApi} from "@/lib/admin-api-client";

type RecordingView={id:string;topic:string;fileType?:string;recordingType?:string;sizeBytes:number;status:string;retainUntil?:string|null;protected:boolean;learnerVisible:boolean;streamUrl:string};

export default function RecordingPlaybackPage(){
 return <RoleGuard allow={["admin"]}><AppShell role="admin"><Playback/></AppShell></RoleGuard>;
}

function Playback(){
 const {recordingId}=useParams<{recordingId:string}>();
 const[data,setData]=useState<RecordingView|null>(null),[error,setError]=useState("");
 const[playbackError,setPlaybackError]=useState(""),[renewing,setRenewing]=useState(false);
 useEffect(()=>{let active=true;(async()=>{try{const x=await adminApi("/api/zoom/recordings/"+encodeURIComponent(recordingId));if(active)setData(x.recording)}catch(e){if(active)setError(e instanceof Error?e.message:String(e))}})();return()=>{active=false}},[recordingId]);
 async function renewStream(){setRenewing(true);setPlaybackError("");try{const x=await adminApi("/api/zoom/recordings/"+encodeURIComponent(recordingId));setData(x.recording)}catch(e){setPlaybackError("Unable to renew recording access: "+(e instanceof Error?e.message:String(e)))}finally{setRenewing(false)}}
 const file=(data?.fileType||"").toUpperCase();
 return <main className="dataSection">
  <div className="panelHeader"><div><div className="eyebrow">SECURE RECORDING PLAYBACK</div><h2>{data?.topic||"Zoom recording"}</h2><p>The media is streamed through Robotronix after checking your portal access.</p></div><a className="button secondary" href="/admin/zoom">Back to Zoom Classroom</a></div>
  {error&&<p className="errorBanner" role="alert">{error}</p>}
  {!data&&!error&&<div className="emptyState compact">Preparing secure playback…</div>}
  {data&&<section style={{maxWidth:1100}}>
   {file==="M4A"||String(data.recordingType||"").toLowerCase().includes("audio")
    ?<audio key={data.streamUrl} controls preload="metadata" src={data.streamUrl} onError={()=>setPlaybackError("Playback could not load. Try refreshing secure access.")} style={{width:"100%"}}/>
    :<video key={data.streamUrl} controls playsInline preload="metadata" src={data.streamUrl} onError={()=>setPlaybackError("Playback could not load. Try refreshing secure access.")} style={{width:"100%",maxHeight:"72vh",background:"#07152c",borderRadius:18}}/>}
   {playbackError&&<div role="alert" className="errorBanner">{playbackError} <button type="button" className="button secondary smallButton" disabled={renewing} onClick={renewStream}>{renewing?"Refreshing…":"Refresh secure access"}</button></div>}
   <div className="row topGap" style={{flexWrap:"wrap"}}>
    <span className="softBadge">{data.recordingType||data.fileType||"Recording"}</span>
    <span className="cellSub">{(Number(data.sizeBytes||0)/1024/1024).toFixed(1)} MB</span>
    {data.protected&&<span className="softBadge softGreen">Protected</span>}
   </div>
  </section>}
 </main>;
}
