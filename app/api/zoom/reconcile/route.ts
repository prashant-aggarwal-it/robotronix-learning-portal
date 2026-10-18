import {NextRequest,NextResponse} from "next/server";
import {requireAdmin} from "@/lib/server/admin-api";
import {zoomApi} from "@/lib/server/zoom";
import {reconcileZoomRecording} from "@/lib/server/zoom-recording-reconcile";
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
       for(const file of files){
        if(await reconcileZoomRecording(auth.admin,meeting,file,rec))recordingsSynced++;
       }
       updates.recording_status="ready";
       if(meeting.status==="scheduled"||meeting.status==="started"){
        const expectedEnd=new Date(meeting.scheduled_start).getTime()+Number(meeting.duration_minutes||60)*60000;
        if(Date.now()>expectedEnd)updates.status="ended";
       }
      }
     }catch(recordingError){errors++;console.error("Zoom recording reconciliation failed",meeting.id,recordingError);}
    }
    const {error:uErr}=await auth.admin.from("zoom_meetings").update(updates).eq("id",meeting.id);if(uErr)throw new Error(uErr.message);
    meetingsSynced++;
   }catch{errors++}
  }
  return NextResponse.json({ok:true,meetingsSynced,recordingsSynced,errors},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:500,headers:{"Cache-Control":"no-store"}});}
}
