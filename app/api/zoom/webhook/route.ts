import {logSystemEvent} from "@/lib/server/system-log";
import crypto from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {zoomServiceClient} from "@/lib/server/zoom";
import {reconcileZoomRecording} from "@/lib/server/zoom-recording-reconcile";
export const dynamic="force-dynamic";

function secret(){
 const value=process.env.ZOOM_WEBHOOK_SECRET_TOKEN?.trim();
 if(!value)throw new Error("ZOOM_WEBHOOK_SECRET_TOKEN is not configured.");
 return value;
}
function safeEqual(a:string,b:string){
 const aa=Buffer.from(a),bb=Buffer.from(b);
 return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);
}
function verify(raw:string,request:NextRequest){
 const timestamp=request.headers.get("x-zm-request-timestamp")||"";
 const signature=request.headers.get("x-zm-signature")||"";
 if(!timestamp||!signature)return false;
 const age=Math.abs(Date.now()/1000-Number(timestamp));
 if(!Number.isFinite(age)||age>300)return false;
 const hash=crypto.createHmac("sha256",secret()).update("v0:"+timestamp+":"+raw).digest("hex");
 return safeEqual(signature,"v0="+hash);
}
function eventHash(raw:string){return crypto.createHash("sha256").update(raw).digest("hex");}
function asIso(value:any,fallbackMs?:number){
 if(value){const d=new Date(value);if(!Number.isNaN(d.getTime()))return d.toISOString();}
 return new Date(fallbackMs||Date.now()).toISOString();
}
function participantKey(p:any){return String(p?.participant_uuid||p?.user_id||p?.id||"");}
function participantName(p:any){return String(p?.user_name||p?.user_name_display||p?.name||"").trim();}
function normalise(value:string){return value.toLowerCase().replace(/\s+/g," ").trim();}

async function findMeeting(db:any,object:any){
 const id=String(object?.id||"");
 const uuid=String(object?.uuid||"");
 let q=db.from("zoom_meetings").select("*").limit(1);
 if(uuid)q=q.eq("zoom_meeting_uuid",uuid);
 else if(id)q=q.eq("zoom_meeting_id",id);
 else return null;
 const {data,error}=await q.maybeSingle();
 if(error)throw new Error(error.message);
 if(data)return data;
 if(id&&uuid){
  const retry=await db.from("zoom_meetings").select("*").eq("zoom_meeting_id",id).maybeSingle();
  if(retry.error)throw new Error(retry.error.message);
  return retry.data;
 }
 return null;
}

async function matchIntent(db:any,meetingId:string,name:string){
 const since=new Date(Date.now()-20*60_000).toISOString();
 const {data,error}=await db.from("zoom_join_intents").select("*")
  .eq("zoom_meeting_id",meetingId).is("matched_at",null).gte("requested_at",since)
  .order("requested_at",{ascending:false}).limit(20);
 if(error)throw new Error(error.message);
 const target=normalise(name);
 const rows=(data||[]) as any[];
 // Never assign an unmatched attendee to the most recent join request.
 // Ambiguous duplicate display names cannot establish a reliable identity.
 const matches=target?rows.filter(r=>normalise(String(r.participant_name||""))===target):[];
 return matches.length===1?matches[0]:null;
}

async function handleParticipantJoined(db:any,meeting:any,body:any){
 const p=body?.payload?.object?.participant||{};
 const name=participantName(p)||"Zoom participant";
 const key=participantKey(p);
 const joinedAt=asIso(p?.join_time,body?.event_ts);
 const intent=await matchIntent(db,meeting.id,name);
 const {data:existing}=key?await db.from("zoom_participant_sessions").select("id").eq("zoom_meeting_id",meeting.id).eq("zoom_participant_id",key).is("left_at",null).maybeSingle():{data:null};
 if(!existing){
  const {error}=await db.from("zoom_participant_sessions").insert({
   zoom_meeting_id:meeting.id,zoom_participant_id:key||null,participant_name:name,
   portal_profile_id:intent?.profile_id||null,portal_role:intent?.portal_role||null,joined_at:joinedAt
  });
  if(error)throw new Error(error.message);
 }
 if(intent?.id)await db.from("zoom_join_intents").update({matched_at:new Date().toISOString()}).eq("id",intent.id);
}

async function handleParticipantLeft(db:any,meeting:any,body:any){
 const p=body?.payload?.object?.participant||{};
 const key=participantKey(p),name=participantName(p);
 let query=db.from("zoom_participant_sessions").select("*").eq("zoom_meeting_id",meeting.id).is("left_at",null).order("joined_at",{ascending:false}).limit(1);
 if(key)query=query.eq("zoom_participant_id",key);else if(name)query=query.eq("participant_name",name);
 const {data,error}=await query.maybeSingle();if(error)throw new Error(error.message);if(!data)return;
 const leftAt=asIso(p?.leave_time,body?.event_ts);
 const duration=Math.max(0,Math.round((new Date(leftAt).getTime()-new Date(data.joined_at).getTime())/1000));
 const reason=String(p?.leave_reason||p?.failover||p?.reason||"");
 const {error:updateError}=await db.from("zoom_participant_sessions").update({left_at:leftAt,leave_reason:reason||null,duration_seconds:duration}).eq("id",data.id);
 if(updateError)throw new Error(updateError.message);
}

async function handleRecording(db:any,meeting:any,body:any){
 const object=body?.payload?.object||{};
 const files=Array.isArray(object.recording_files)?object.recording_files:[];
 for(const file of files)await reconcileZoomRecording(db,meeting,file,object);
 await db.from("zoom_meetings").update({recording_status:files.length?"ready":"failed",updated_at:new Date().toISOString()}).eq("id",meeting.id);
}

export async function POST(request:NextRequest){
 let raw="";
 let stage="decode";
 try{
  raw=await request.text();
  const body=JSON.parse(raw||"{}");
  if(body.event==="endpoint.url_validation"){
   const plain=String(body?.payload?.plainToken||"");
   if(!plain)throw new Error("Zoom validation token missing.");
   const encrypted=crypto.createHmac("sha256",secret()).update(plain).digest("hex");
   return NextResponse.json({plainToken:plain,encryptedToken:encrypted});
  }
  stage="signature";
  if(!verify(raw,request))return NextResponse.json({ok:false,error:"Invalid Zoom webhook signature."},{status:401});
  stage="claim";

  const db=zoomServiceClient();
  const hash=eventHash(raw);
  const {error:claimError}=await db.from("zoom_webhook_events").insert({event_hash:hash,event_type:String(body.event||"unknown"),attempt_count:1});
  if(claimError&&String(claimError.code)!=="23505")throw new Error(claimError.message);
  if(claimError&&String(claimError.code)==="23505"){
   const {data:existing,error:existingError}=await db.from("zoom_webhook_events").select("processed_at,processing_error,attempt_count").eq("event_hash",hash).maybeSingle();
   if(existingError)throw new Error(existingError.message);
   if(existing?.processed_at&&!existing.processing_error)return NextResponse.json({ok:true,duplicate:true});
   const {error:retryError}=await db.from("zoom_webhook_events").update({
    processed_at:null,processing_error:null,attempt_count:Number(existing?.attempt_count||0)+1
   }).eq("event_hash",hash);
   if(retryError)throw new Error(retryError.message);
  }

  try{
   stage="dispatch";
   const meeting=await findMeeting(db,body?.payload?.object||{});
   if(meeting){
    if(body.event==="meeting.started"){
     await db.from("zoom_meetings").update({status:"started",actual_started_at:asIso(body?.payload?.object?.start_time,body.event_ts),updated_at:new Date().toISOString()}).eq("id",meeting.id);
    }else if(body.event==="meeting.ended"){
     await db.from("zoom_meetings").update({status:"ended",actual_ended_at:asIso(body?.payload?.object?.end_time,body.event_ts),updated_at:new Date().toISOString()}).eq("id",meeting.id);
    }else if(body.event==="meeting.participant_joined"){
     await handleParticipantJoined(db,meeting,body);
    }else if(body.event==="meeting.participant_left"){
     await handleParticipantLeft(db,meeting,body);
    }else if(body.event==="recording.completed"){
     await handleRecording(db,meeting,body);
    }else if(body.event==="recording.deleted"){
     const files=Array.isArray(body?.payload?.object?.recording_files)?body.payload.object.recording_files:[];
     const fileIds=files.map((f:any)=>String(f?.id||f?.recording_id||"")).filter(Boolean);
     if(fileIds.length){
      const {error:deletedError}=await db.from("zoom_recordings").update({
       status:"deleted",deleted_from_zoom_at:new Date().toISOString(),updated_at:new Date().toISOString()
      }).eq("zoom_meeting_id",meeting.id).in("zoom_recording_file_id",fileIds);
      if(deletedError)throw new Error("Recording deletion webhook status update failed.");
     }else{
      await logSystemEvent({source:"zoom-webhook",action:"recording-deleted",level:"warning",code:"ZOOM_DELETION_FILE_IDS_MISSING",message:"Zoom deletion webhook omitted recording file identifiers; reconcile manually"});
     }
     // Do not mark every file deleted when Zoom only reports one file.
     const {data:remaining,error:remainingError}=await db.from("zoom_recordings").select("id").eq("zoom_meeting_id",meeting.id).eq("status","completed").limit(1);
     if(remainingError)throw new Error("Unable to verify remaining Zoom recordings.");
     if(!remaining?.length&&fileIds.length){
      const {error:meetingError}=await db.from("zoom_meetings").update({recording_status:"deleted",updated_at:new Date().toISOString()}).eq("id",meeting.id);
      if(meetingError)throw new Error("Unable to update deleted meeting recording status.");
     }
    }
   }
   stage="mark-processed";
   const {error:doneError}=await db.from("zoom_webhook_events").update({processed_at:new Date().toISOString(),processing_error:null}).eq("event_hash",hash);
   if(doneError)throw new Error("Unable to mark Zoom webhook processed.");
  }catch{
   await db.from("zoom_webhook_events").update({processed_at:null,processing_error:"ZOOM_WEBHOOK_"+stage.toUpperCase().replace(/-/g,"_")}).eq("event_hash",hash);
   throw new Error("Zoom webhook processing failed.");
  }
  return NextResponse.json({ok:true});
 }catch{
  const referenceId=await logSystemEvent({source:"zoom-webhook",action:"webhook-processing",code:"ZOOM_WEBHOOK_"+stage.toUpperCase().replace(/-/g,"_"),message:"Zoom webhook processing failed"});
  console.error("[zoom-webhook] processing failed",{stage,referenceId});
  return NextResponse.json({ok:false,error:"Webhook processing failed",referenceId},{status:stage==="decode"||stage==="signature"?400:500});
 }
}
