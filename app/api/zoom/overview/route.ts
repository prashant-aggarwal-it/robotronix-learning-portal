import {NextRequest,NextResponse} from "next/server";
import {requireAdmin} from "@/lib/server/admin-api";
import {safeHost} from "@/lib/server/zoom";
export const dynamic="force-dynamic";

function presenceSummary(items:any[],scheduledStart:string,durationMinutes:number,status:string,actualEndedAt?:string|null){
 const trainer=items.filter(s=>s.portal_role==="trainer"||s.portal_role==="admin");
 const learner=items.filter(s=>s.portal_role==="student"||s.portal_role==="parent");
 const sum=(rows:any[])=>rows.reduce((n,x)=>n+Number(x.duration_seconds||0),0);
 const first=(rows:any[])=>rows.length?rows.map(x=>x.joined_at).filter(Boolean).sort()[0]||null:null;
 const last=(rows:any[])=>rows.length?rows.map(x=>x.left_at||x.joined_at).filter(Boolean).sort().at(-1)||null:null;
 const scheduled=new Date(scheduledStart).getTime();
 const trainerFirst=first(trainer),learnerFirst=first(learner);
 const trainerLate=trainerFirst?new Date(trainerFirst).getTime()>scheduled+5*60_000:false;
 const learnerLate=learnerFirst?new Date(learnerFirst).getTime()>scheduled+10*60_000:false;
 const expectedEnd=scheduled+Number(durationMinutes||60)*60_000;
 const earlyEnd=actualEndedAt?new Date(actualEndedAt).getTime()<expectedEnd-10*60_000:false;
 const ended=status==="ended"||status==="cancelled";
 return {
  trainerConnections:trainer.length,learnerConnections:learner.length,trainerSeconds:sum(trainer),learnerSeconds:sum(learner),
  trainerFirstJoin:trainerFirst,trainerLastLeave:last(trainer),learnerFirstJoin:learnerFirst,learnerLastLeave:last(learner),
  trainerSignal:ended&&!trainer.length?"no_show":trainerLate?"late":trainer.length>1?"reconnected":trainer.length?"present":"waiting",
  learnerSignal:ended&&!learner.length?"no_show":learnerLate?"late":learner.length>1?"reconnected":learner.length?"present":"waiting",
  earlyEnd
 };
}

export async function GET(request:NextRequest){
 const auth=await requireAdmin(request);if("error" in auth)return auth.error;
 try{
  const [hostsResult,meetingsResult,recordingsResult]=await Promise.all([
   auth.admin.from("zoom_host_accounts").select("id,label,zoom_user_id,zoom_email,zoom_account_id,status,enabled,priority,recording_enabled,recording_retention_days,learner_recording_default,connected_at,last_sync_at").order("priority",{ascending:true}).order("connected_at",{ascending:true}),
   auth.admin.from("zoom_meetings").select("id,host_account_id,schedule_event_id,purpose,topic,status,scheduled_start,duration_minutes,actual_started_at,actual_ended_at,recording_enabled,recording_status,learner_recording_visible,last_error,join_url,passcode,meeting_notes,external_invite_enabled,created_at").in("purpose",["class","general"]).order("scheduled_start",{ascending:false}).limit(200),
   auth.admin.from("zoom_recordings").select("id,zoom_meeting_id,recording_type,file_type,file_extension,file_size_bytes,recording_start,recording_end,status,learner_visible,retain_until,protected_from_deletion,deleted_from_zoom_at,created_at").order("created_at",{ascending:false}).limit(300)
  ]);
  if(hostsResult.error)throw new Error(hostsResult.error.message);
  if(meetingsResult.error)throw new Error(meetingsResult.error.message);
  if(recordingsResult.error)throw new Error(recordingsResult.error.message);

  const meetings=meetingsResult.data||[],hosts=hostsResult.data||[];
  const eventIds=meetings.map((m:any)=>m.schedule_event_id).filter(Boolean),meetingIds=meetings.map((m:any)=>m.id);
  const [eventsResult,sessionsResult]=await Promise.all([
   eventIds.length?auth.admin.from("schedule_events").select("id,title,date,start_time,end_time,timezone,trainer_id,student_id,cohort_id,status").in("id",eventIds):Promise.resolve({data:[],error:null}),
   meetingIds.length?auth.admin.from("zoom_participant_sessions").select("zoom_meeting_id,portal_role,participant_name,joined_at,left_at,duration_seconds,leave_reason").in("zoom_meeting_id",meetingIds).order("joined_at",{ascending:true}):Promise.resolve({data:[],error:null})
  ]);
  if(eventsResult.error)throw new Error(eventsResult.error.message);
  if(sessionsResult.error)throw new Error(sessionsResult.error.message);
  const eventMap=new Map((eventsResult.data||[]).map((e:any)=>[e.id,e]));
  const hostMap=new Map(hosts.map((h:any)=>[h.id,{label:h.label,email:h.zoom_email}]));
  const sessionRows=sessionsResult.data||[],recRows=recordingsResult.data||[];

  const rows=meetings.map((m:any)=>{
   const sessions=sessionRows.filter((s:any)=>s.zoom_meeting_id===m.id);
   const recordings=recRows.filter((r:any)=>r.zoom_meeting_id===m.id);
   return {...m,event:eventMap.get(m.schedule_event_id)||null,host:hostMap.get(m.host_account_id)||null,
    presence:presenceSummary(sessions,m.scheduled_start,m.duration_minutes,m.status,m.actual_ended_at),recordings};
  });

  const storageByHost=hosts.map((h:any)=>{
   const ids=new Set(meetings.filter((m:any)=>m.host_account_id===h.id).map((m:any)=>m.id));
   const bytes=recRows.filter((r:any)=>ids.has(r.zoom_meeting_id)&&r.status==="completed").reduce((n:number,r:any)=>n+Number(r.file_size_bytes||0),0);
   return {hostId:h.id,bytes};
  });

  return NextResponse.json({ok:true,hosts:hosts.map(safeHost),meetings:rows,recordings:recRows,storageByHost},
   {headers:{"Cache-Control":"no-store"}});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:500});}
}
