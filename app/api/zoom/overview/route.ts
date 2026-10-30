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

  // Show unprovisioned classes as well as created meetings. Future classes should
  // be in the reservation ledger long before their Zoom meeting exists.
  const today=new Date(),from=new Date(today.getTime()-24*60*60_000).toISOString().slice(0,10);
  const through=new Date(today.getTime()+7*24*60*60_000).toISOString().slice(0,10);
  const [futureResult,reservationResult,offlineEnrollments,offlineCohorts]=await Promise.all([
   auth.admin.from("schedule_events").select("id,title,date,start_time,timezone,enrollment_id,cohort_id,delivery_mode,status")
    .eq("event_type","class").in("status",["scheduled","tentative","makeup"])
    .gte("date",from).lte("date",through).order("date",{ascending:true}).order("start_time",{ascending:true}).limit(1000),
   auth.admin.from("zoom_class_host_reservations").select("schedule_event_id,host_account_id,allocation_status")
    .gte("starts_at",new Date(today.getTime()-24*60*60_000).toISOString())
    .lte("starts_at",new Date(today.getTime()+8*24*60*60_000).toISOString()).limit(1500),
   auth.admin.from("enrollments").select("id").eq("delivery_channel","offline"),
   auth.admin.from("cohorts").select("id").eq("delivery_channel","offline")
  ]);
  if(futureResult.error||reservationResult.error||offlineEnrollments.error||offlineCohorts.error)
   throw new Error("Zoom classroom readiness ledger unavailable.");
  const offlineEnrollmentIds=new Set((offlineEnrollments.data||[]).map(x=>x.id));
  const offlineCohortIds=new Set((offlineCohorts.data||[]).map(x=>x.id));
  const reservationMap=new Map((reservationResult.data||[]).map(r=>[r.schedule_event_id,r]));
  const existingMap=new Map(meetings.filter((m:any)=>m.purpose==="class").map((m:any)=>[m.schedule_event_id,m]));
  const upcomingReadiness=(futureResult.data||[]).filter(e=>e.delivery_mode!=="offline"
    &&(!e.enrollment_id||!offlineEnrollmentIds.has(e.enrollment_id))
    &&(!e.cohort_id||!offlineCohortIds.has(e.cohort_id)))
    .map(e=>{
     const reserve:any=reservationMap.get(e.id),meeting:any=existingMap.get(e.id);
     return {id:e.id,title:e.title,date:e.date,startTime:e.start_time,timezone:e.timezone,
      hostReserved:reserve?.allocation_status==="reserved"&&hosts.some((h:any)=>h.id===reserve.host_account_id&&h.status==="connected"&&h.enabled===true),
      hasZoomRoom:Boolean(meeting?.join_url&&meeting?.status!=="cancelled"&&meeting?.status!=="error"),
      needsAttention:reserve?.allocation_status!=="reserved"||Boolean(meeting?.status==="error"||meeting?.last_error)};
    });
  const readinessSummary={scheduled:upcomingReadiness.length,capacityConflicts:upcomingReadiness.filter(x=>!x.hostReserved).length,
   waitingForJit:upcomingReadiness.filter(x=>x.hostReserved&&!x.hasZoomRoom).length,
   ready:upcomingReadiness.filter(x=>x.hasZoomRoom).length};
  return NextResponse.json({ok:true,hosts:hosts.map(safeHost),meetings:rows,recordings:recRows,storageByHost,readinessSummary,readinessIssues:upcomingReadiness.filter(x=>x.needsAttention).slice(0,30)},
   {headers:{"Cache-Control":"no-store"}});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:500});}
}
