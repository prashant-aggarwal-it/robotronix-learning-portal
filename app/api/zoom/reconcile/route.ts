import {NextRequest,NextResponse} from "next/server";
import {requireAdmin} from "@/lib/server/admin-api";
import {encryptZoomSecret,zoomApi} from "@/lib/server/zoom";
export const dynamic="force-dynamic";

function iso(value:any){if(!value)return null;const d=new Date(value);return Number.isNaN(d.getTime())?null:d.toISOString()}

export async function POST(request:NextRequest){
 const auth=await requireAdmin(request);if("error" in auth)return auth.error;
 try{
  const cutoff=new Date(Date.now()-30*86400000).toISOString();
  const {data:meetings,error}=await auth.admin.from("zoom_meetings")
   .select("id,host_account_id,zoom_meeting_id,zoom_meeting_uuid,status,scheduled_start,duration_minutes,recording_enabled,recording_retention_days,learner_recording_visible")
   .gte("scheduled_start",cutoff).order("scheduled_start",{ascending:false}).limit(120);
  if(error)throw new Error(error.message);
  let meetingsSynced=0,recordingsSynced=0,errors=0;
  for(const meeting of meetings||[]){
   try{
    let remote:any=null;
    try{remote=await zoomApi(meeting.host_account_id,"/meetings/"+encodeURIComponent(meeting.zoom_meeting_id));}catch{}
    const updates:any={updated_at:new Date().toISOString()};
    if(remote?.status==="started"){
     updates.status="started";
     if(!remote.start_time){}else updates.actual_started_at=iso(remote.start_time);
    }
    if(remote?.start_time)updates.scheduled_start=iso(remote.start_time);
    if(remote?.duration)updates.duration_minutes=Number(remote.duration);
    if(remote?.join_url)updates.join_url=String(remote.join_url);
    if(remote?.password)updates.passcode=String(remote.password);

    if(meeting.recording_enabled){
     try{
      const rec:any=await zoomApi(meeting.host_account_id,"/meetings/"+encodeURIComponent(meeting.zoom_meeting_id)+"/recordings");
      const files=Array.isArray(rec?.recording_files)?rec.recording_files:[];
      if(files.length){
       const retainDays=Number(meeting.recording_retention_days||60);
       const retainUntil=new Date(Date.now()+retainDays*86400000).toISOString();
       const passcode=String(rec?.password||rec?.recording_play_passcode||"");
       for(const file of files){
        const fileId=String(file.id||file.recording_id||"");if(!fileId)continue;
        const row={zoom_meeting_id:meeting.id,zoom_recording_file_id:fileId,recording_type:String(file.recording_type||""),file_type:String(file.file_type||""),file_extension:String(file.file_extension||""),file_size_bytes:Number(file.file_size||0),recording_start:iso(file.recording_start),recording_end:iso(file.recording_end),play_url:String(file.play_url||rec.share_url||""),download_url:String(file.download_url||""),share_passcode_encrypted:passcode?encryptZoomSecret(passcode):null,status:"completed",learner_visible:Boolean(meeting.learner_recording_visible),retain_until:retainUntil,updated_at:new Date().toISOString()};
        const {error:rErr}=await auth.admin.from("zoom_recordings").upsert(row,{onConflict:"zoom_recording_file_id"});if(rErr)throw new Error(rErr.message);
        recordingsSynced++;
       }
       updates.recording_status="ready";
       if(meeting.status==="scheduled"||meeting.status==="started"){
        const expectedEnd=new Date(meeting.scheduled_start).getTime()+Number(meeting.duration_minutes||60)*60000;
        if(Date.now()>expectedEnd)updates.status="ended";
       }
      }
     }catch{}
    }
    const {error:uErr}=await auth.admin.from("zoom_meetings").update(updates).eq("id",meeting.id);if(uErr)throw new Error(uErr.message);
    meetingsSynced++;
   }catch{errors++}
  }
  return NextResponse.json({ok:true,meetingsSynced,recordingsSynced,errors},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:500,headers:{"Cache-Control":"no-store"}});}
}
