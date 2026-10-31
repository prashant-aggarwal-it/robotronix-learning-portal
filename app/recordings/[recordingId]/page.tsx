"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {useParams} from "next/navigation";
import {RoleGuard} from "@/components/RoleGuard";
import {portalApi} from "@/lib/portal-api-client";

type Recording={id:string;topic?:string;streamUrl:string;fileType?:string;recordingType?:string;sizeBytes?:number};
export default function RecordingViewer(){
 return <RoleGuard allow={["admin","trainer","parent","student"]}><Player/></RoleGuard>;
}

function Player(){
 const {recordingId}=useParams<{recordingId:string}>();
 const [recording,setRecording]=useState<Recording|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [retrying,setRetrying]=useState(false);
 const [generation,setGeneration]=useState(0);
 const player=useRef<HTMLVideoElement|HTMLAudioElement|null>(null);
 const resumeAt=useRef(0);
 const automaticRetryUsed=useRef(false);
 const active=useRef(true);

 const refresh=useCallback(async(automatic=false)=>{
  if(!automatic)setRetrying(true);
  const time=player.current?.currentTime;
  if(Number.isFinite(time)&&Number(time)>0)resumeAt.current=Number(time);
  try{
   const response=await portalApi("/api/zoom/recordings/"+encodeURIComponent(recordingId));
   if(!active.current)return;
   setRecording(response.recording);
   setGeneration(value=>value+1);
   setError("");
  }catch{
   if(active.current)setError("Unable to obtain secure recording access. Please try again.");
  }finally{if(active.current){setLoading(false);setRetrying(false)}}
 },[recordingId]);

 useEffect(()=>{
  active.current=true;automaticRetryUsed.current=false;resumeAt.current=0;
  void refresh();
  return()=>{active.current=false};
 },[refresh]);

 function onMediaError(){
  if(!automaticRetryUsed.current){
   automaticRetryUsed.current=true;
   void refresh(true);
  }else{
   setError("Recording playback failed. Refresh secure access and try again.");
  }
 }
 function onLoaded(){
  const video=player.current;
  if(!video||resumeAt.current<=0)return;
  try{
   const target=Number.isFinite(video.duration)?Math.min(resumeAt.current,Math.max(0,video.duration-0.5)):resumeAt.current;
   video.currentTime=target;
  }catch{/* Some formats do not allow seeking until enough media is loaded. */}
  resumeAt.current=0;
 }

 const audioOnly=recording?.fileType?.toUpperCase()==="M4A"||recording?.recordingType?.toLowerCase().includes("audio");
 return <main className="dataSection" style={{maxWidth:1100,margin:"32px auto",padding:20}}>
  <section className="panel">
   <div className="panelHeader">
    <div><h1>{recording?.topic||"Secure class recording"}</h1><p>Recording access is checked by Robotronix for every new stream request.</p></div>
    <button className="button secondary" type="button" onClick={()=>{automaticRetryUsed.current=false;void refresh()}} disabled={retrying}>{retrying?"Refreshing…":"Refresh secure access"}</button>
   </div>
   {loading&&!recording&&<p>Preparing recording…</p>}
   {error&&<p className="errorBanner" role="alert">{error}</p>}
   {recording&&(audioOnly
    ?<audio ref={node=>{player.current=node}} key={recording.streamUrl+"-"+generation} src={recording.streamUrl} controls preload="metadata" style={{width:"100%"}} onError={onMediaError} onLoadedMetadata={onLoaded}/>
    :<video ref={node=>{player.current=node}} key={recording.streamUrl} src={recording.streamUrl} controls playsInline preload="metadata" style={{width:"100%",maxHeight:"72vh",background:"#07152c",borderRadius:16}} onError={onMediaError} onLoadedMetadata={onLoaded}/>)}
   <p className="cellSub">If playback stops during a long recording, secure access can be renewed without sharing a Zoom download link.</p>
  </section>
 </main>;
}
