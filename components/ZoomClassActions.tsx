"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {portalApi} from "@/lib/portal-api-client";
import {getClassReusableZoomLinkV2} from "@/lib/repository";

type Classroom={
 available:boolean;canHost:boolean;canJoin:boolean;withinJoinWindow:boolean;opensAt:string;closesAt:string;
 meeting:null|{id:string;status:string;recordingEnabled:boolean;recordingStatus:string;learnerRecordingVisible:boolean;recordingId?:string|null;lastError?:string|null};
};

export function ZoomClassActions({scheduleEventId,compact=false}:{scheduleEventId:string;compact?:boolean}){
 const[data,setData]=useState<Classroom|null>(null),[error,setError]=useState("");
 const[reusableLink,setReusableLink]=useState("");
 useEffect(()=>{let live=true;portalApi("/api/zoom/classroom/"+encodeURIComponent(scheduleEventId)).then(x=>{if(live)setData(x.classroom)}).catch(e=>{if(live)setError(e instanceof Error?e.message:String(e))});getClassReusableZoomLinkV2(scheduleEventId).then(url=>{if(live)setReusableLink(url)}).catch(()=>{});return()=>{live=false}},[scheduleEventId]);
 async function watch(){if(!data?.meeting?.recordingId)return;const win=window.open("","_blank");try{const x=await portalApi("/api/zoom/recordings/"+data.meeting.recordingId);if(win){win.opener=null;win.location.href=x.recording.streamUrl}else window.location.href=x.recording.streamUrl}catch(e){if(win)win.close();setError(e instanceof Error?e.message:String(e))}}

 if(error)return <small role="status" className="muted">Online classroom unavailable: {error}</small>;
 if(!data)return compact?<span className="softBadge">Checking classroom…</span>:<small className="muted">Checking online classroom…</small>;
 if(!data.available&&reusableLink&&data.canJoin&&!data.meeting?.recordingId){
  return data.withinJoinWindow
   ?<a className={"button "+(compact?"small":"")} href={reusableLink} target="_blank" rel="noopener noreferrer">Join Trainer Zoom Room</a>
   :<small role="status" className="muted">Trainer Zoom room available during the scheduled class window.</small>;
 }
 if(!data.available&&!data.meeting?.recordingId)return <small role="status" className="muted">Zoom meeting not ready yet. The scheduled class is still recorded in the timetable.</small>;
 const disabled=!data.withinJoinWindow;
 return <div className={compact?"row":"row topGap"}>
  {data.available&&data.canHost&&<Link aria-disabled={disabled} className={"button "+(compact?"small ":"")+(disabled?"disabled":"")} href={disabled?"#":"/classroom/"+scheduleEventId+"?mode=host"} onClick={e=>disabled&&e.preventDefault()}>Start Class</Link>}
  {data.available&&data.canJoin&&!data.canHost&&<Link aria-disabled={disabled} className={"button "+(compact?"small ":"")+(disabled?"disabled":"")} href={disabled?"#":"/classroom/"+scheduleEventId+"?mode=participant"} onClick={e=>disabled&&e.preventDefault()}>Join Class</Link>}
  {data.meeting?.recordingId&&<button type="button" className={"button secondary "+(compact?"small":"")} onClick={watch}>Watch Recording</button>}
  {!data.withinJoinWindow&&!compact&&data.available&&<small className="muted">Join access opens shortly before the scheduled class.</small>}
  {data.meeting?.lastError&&!compact&&<small role="alert" className="muted">Zoom setup requires attention: {data.meeting.lastError}</small>}
  {data.meeting?.recordingEnabled&&!compact&&<span className="softBadge">{data.meeting.recordingStatus==="ready"?"Recording ready":"Session recording enabled"}</span>}
 </div>;
}
