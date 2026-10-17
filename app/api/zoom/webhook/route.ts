import crypto from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {encryptZoomSecret,zoomServiceClient} from "@/lib/server/zoom";
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
 return rows.find(r=>normalise(String(r.participant_name||""))===target)||rows[0]||null;
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
 const retainDays=Number(meeting.recording_retention_days||60);
 const retainUntil=new Date(Date.now()+retainDays*86400000).toISOString();
 const passcode=String(object.recording_play_passcode||"");
 for(const file of files){
  const fileId=String(file.id||file.recording_id||"");if(!fileId)continue;
  const row={
   zoom_meeting_id:meeting.id,zoom_recording_file_id:fileId,
   recording_type:String(file.recording_type||""),file_type:String(file.file_type||""),
   file_extension:String(file.file_extension||""),file_size_bytes:Number(file.file_size||0),
   recording_start:file.recording_start?asIso(file.recording_start):null,
   recording_end:file.recording_end?asIso(file.recording_end):null,
   play_url:String(file.play_url||object.share_url||""),download_url:String(file.download_url||""),
   share_passcode_encrypted:passcode?encryptZoomSecret(passcode):null,status:"completed",
   learner_visible:Boolean(meeting.learner_recording_visible),retain_until:retainUntil,updated_at:new Date().toISOString()
  };
  const {error}=await db.from("zoom_recordings").upsert(row,{onConflict:"zoom_recording_file_id"});if(error)throw new Error(error.message);
 }
 await db.from("zoom_meetings").update({recording_status:files.length?"ready":"failed",updated_at:new Date().toISOString()}).eq("id",meeting.id);
}

export async function POST(request:NextRequest){
 let raw="";
 try{
  raw=await request.text();
  const body=JSON.parse(raw||"{}");
  if(body.event==="endpoint.url_validation"){
   const plain=String(body?.payload?.plainToken||"");
   if(!plain)throw new Error("Zoom validation token missing.");
   const encrypted=crypto.createHmac("sha256",secret()).update(plain).digest("hex");
   return NextResponse.json({plainToken:plain,encryptedToken:encrypted});
  }
  if(!verify(raw,request))return NextResponse.json({ok:false,error:"Invalid Zoom webhook signature."},{status:401});

  const db=zoomServiceClient();
  const hash=eventHash(raw);
  const {error:claimError}=await db.from("zoom_webhook_events").insert({event_hash:hash,event_type:String(body.event||"unknown")});
  if(claimError&&String(claimError.code)!=="23505")throw new Error(claimError.message);
  if(claimError&&String(claimError.code)==="23505")return NextResponse.json({ok:true,duplicate:true});

  try{
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
     await db.from("zoom_recordings").update({status:"deleted",deleted_from_zoom_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("zoom_meeting_id",meeting.id);
     await db.from("zoom_meetings").update({recording_status:"deleted",updated_at:new Date().toISOString()}).eq("id",meeting.id);
    }
   }
   await db.from("zoom_webhook_events").update({processed_at:new Date().toISOString(),processing_error:null}).eq("event_hash",hash);
  }catch(error){
   await db.from("zoom_webhook_events").update({processed_at:new Date().toISOString(),processing_error:error instanceof Error?error.message:String(error)}).eq("event_hash",hash);
   throw error;
  }
  return NextResponse.json({ok:true});
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:400});
 }
}
