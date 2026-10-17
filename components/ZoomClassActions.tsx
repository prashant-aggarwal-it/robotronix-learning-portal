"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {portalApi} from "@/lib/portal-api-client";

type Classroom={
 available:boolean;canHost:boolean;canJoin:boolean;withinJoinWindow:boolean;opensAt:string;closesAt:string;
 meeting:null|{id:string;status:string;recordingEnabled:boolean;recordingStatus:string;learnerRecordingVisible:boolean;lastError?:string|null};
};

export function ZoomClassActions({scheduleEventId,compact=false}:{scheduleEventId:string;compact?:boolean}){
 const[data,setData]=useState<Classroom|null>(null),[error,setError]=useState("");
 useEffect(()=>{let live=true;portalApi("/api/zoom/classroom/"+encodeURIComponent(scheduleEventId)).then(x=>{if(live)setData(x.classroom)}).catch(e=>{if(live)setError(e instanceof Error?e.message:String(e))});return()=>{live=false}},[scheduleEventId]);
 if(error)return compact?null:<small className="muted">Online classroom unavailable: {error}</small>;
 if(!data)return compact?<span className="softBadge">Checking classroom…</span>:<small className="muted">Checking online classroom…</small>;
 if(!data.available)return compact?null:<small className="muted">Online classroom has not been provisioned yet.</small>;
 const disabled=!data.withinJoinWindow;
 return <div className={compact?"row":"row topGap"}>
  {data.canHost&&<Link aria-disabled={disabled} className={`button ${compact?"small":""} ${disabled?"disabled":""}`} href={disabled?"#":`/classroom/${scheduleEventId}?mode=host`} onClick={e=>disabled&&e.preventDefault()}>Start Class</Link>}
  {data.canJoin&&!data.canHost&&<Link aria-disabled={disabled} className={`button ${compact?"small":""} ${disabled?"disabled":""}`} href={disabled?"#":`/classroom/${scheduleEventId}?mode=participant`} onClick={e=>disabled&&e.preventDefault()}>Join Class</Link>}
  {!data.withinJoinWindow&&!compact&&<small className="muted">Join access opens shortly before the scheduled class.</small>}
  {data.meeting?.recordingEnabled&&!compact&&<span className="softBadge">Session recording enabled</span>}
 </div>;
}
