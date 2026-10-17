import {NextRequest,NextResponse} from "next/server";
import {requireAdmin} from "@/lib/server/admin-api";
import {safeHost} from "@/lib/server/zoom";
export const dynamic="force-dynamic";

export async function GET(request:NextRequest){
 const auth=await requireAdmin(request);if("error" in auth)return auth.error;
 try{
  const [hostsResult,meetingsResult,recordingsResult]=await Promise.all([
   auth.admin.from("zoom_host_accounts").select("id,label,zoom_user_id,zoom_email,zoom_account_id,status,enabled,priority,recording_enabled,recording_retention_days,learner_recording_default,connected_at,last_sync_at").order("priority",{ascending:true}).order("connected_at",{ascending:true}),
   auth.admin.from("zoom_meetings").select("id,host_account_id,schedule_event_id,topic,status,scheduled_start,duration_minutes,actual_started_at,actual_ended_at,recording_enabled,recording_status,learner_recording_visible,last_error").eq("purpose","class").order("scheduled_start",{ascending:false}).limit(100),
   auth.admin.from("zoom_recordings").select("id,zoom_meeting_id,recording_type,file_type,file_size_bytes,recording_start,recording_end,status,learner_visible,retain_until,protected_from_deletion,deleted_from_zoom_at").order("created_at",{ascending:false}).limit(200)
  ]);
  if(hostsResult.error)throw new Error(hostsResult.error.message);
  if(meetingsResult.error)throw new Error(meetingsResult.error.message);
  if(recordingsResult.error)throw new Error(recordingsResult.error.message);

  const meetings=meetingsResult.data||[];
  const eventIds=meetings.map((m:any)=>m.schedule_event_id).filter(Boolean);
  const meetingIds=meetings.map((m:any)=>m.id);
  const [eventsResult,sessionsResult]=await Promise.all([
   eventIds.length?auth.admin.from("schedule_events").select("id,title,date,start_time,end_time,timezone,trainer_id,student_id,cohort_id,status").in("id",eventIds):Promise.resolve({data:[],error:null}),
   meetingIds.length?auth.admin.from("zoom_participant_sessions").select("zoom_meeting_id,portal_role,participant_name,joined_at,left_at,duration_seconds,leave_reason").in("zoom_meeting_id",meetingIds).order("joined_at",{ascending:true}):Promise.resolve({data:[],error:null})
  ]);
  if(eventsResult.error)throw new Error(eventsResult.error.message);
  if(sessionsResult.error)throw new Error(sessionsResult.error.message);
  const eventMap=new Map((eventsResult.data||[]).map((e:any)=>[e.id,e]));
  const sessionRows=sessionsResult.data||[];
  const recRows=recordingsResult.data||[];

  const rows=meetings.map((m:any)=>{
   const sessions=sessionRows.filter((s:any)=>s.zoom_meeting_id===m.id);
   const recordings=recRows.filter((r:any)=>r.zoom_meeting_id===m.id);
   const trainerSessions=sessions.filter((s:any)=>s.portal_role==="trainer"||s.portal_role==="admin");
   const learnerSessions=sessions.filter((s:any)=>s.portal_role==="student"||s.portal_role==="parent");
   const sum=(items:any[])=>items.reduce((n,x)=>n+Number(x.duration_seconds||0),0);
   return {...m,event:eventMap.get(m.schedule_event_id)||null,
    presence:{trainerConnections:trainerSessions.length,learnerConnections:learnerSessions.length,trainerSeconds:sum(trainerSessions),learnerSeconds:sum(learnerSessions)},
    recordings
   };
  });

  const storageByHost=(hostsResult.data||[]).map((h:any)=>{
   const hostMeetingIds=new Set(meetings.filter((m:any)=>m.host_account_id===h.id).map((m:any)=>m.id));
   const bytes=recRows.filter((r:any)=>hostMeetingIds.has(r.zoom_meeting_id)&&r.status==="completed").reduce((n:number,r:any)=>n+Number(r.file_size_bytes||0),0);
   return {hostId:h.id,bytes};
  });

  return NextResponse.json({ok:true,hosts:(hostsResult.data||[]).map(safeHost),meetings:rows,storageByHost},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:500});}
}
