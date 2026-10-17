import crypto from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {zonedLocalToUtc} from "@/lib/timezones";
export const dynamic="force-dynamic";

function db(){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!secret)throw new Error("Demo service is not configured.");
 return createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
}
function hash(v:string){return crypto.createHash("sha256").update(v).digest("hex")}
async function lookup(token:string){
 const admin=db();
 const {data,error}=await admin.from("demo_session_participants")
  .select("id,guest_token_expires_at,attendance,engagement,understanding,problem_solving,confidence,explored,strengths,mentor_note,recommended_course_id,recommended_format,recommended_frequency,fit,summary_published_at,parent_rating,parent_feedback,summary_viewed_at,lead:demo_leads(id,child_name,grade,interest,experience_level,status),demo_session:demo_sessions(id,session_type,focus,status,zoom_meeting_id,schedule_event:schedule_events(id,date,start_time,end_time,timezone,title,status),trainer:trainers(id,full_name))")
  .eq("guest_token_hash",hash(token)).maybeSingle();
 if(error)throw new Error(error.message);
 if(!data)return{admin,participant:null};
 if(new Date(data.guest_token_expires_at).getTime()<Date.now())return{admin,participant:null};
 return{admin,participant:data as any};
}
function joinWindow(event:any){
 const start=zonedLocalToUtc(event.date,String(event.start_time).slice(0,5),event.timezone);
 const end=zonedLocalToUtc(event.date,String(event.end_time).slice(0,5),event.timezone);
 const now=Date.now(),opens=start.getTime()-10*60_000,closes=end.getTime()+60*60_000;
 return{enabled:now>=opens&&now<=closes,opensAt:new Date(opens).toISOString(),closesAt:new Date(closes).toISOString(),startAt:start.toISOString(),endAt:end.toISOString()};
}

export async function GET(_request:NextRequest,{params}:{params:Promise<{token:string}>}){
 try{
  const {token}=await params;const {admin,participant}=await lookup(token);
  if(!participant)return NextResponse.json({ok:false,error:"This demo link is invalid or has expired."},{status:404,headers:{"Cache-Control":"no-store"}});
  const session:any=participant.demo_session,event=session.schedule_event,lead:any=participant.lead;
  let meeting:any=null;
  if(session.zoom_meeting_id){
   const {data,error}=await admin.from("zoom_meetings").select("id,join_url,status,scheduled_start,duration_minutes").eq("id",session.zoom_meeting_id).eq("purpose","demo").maybeSingle();
   if(error)throw new Error(error.message);meeting=data;
  }
  let recommendedCourse:any=null;
  if(participant.recommended_course_id){
   const {data}=await admin.from("courses").select("id,title,public_name,outcome_subtitle,description,total_sessions,session_duration").eq("id",participant.recommended_course_id).maybeSingle();
   recommendedCourse=data;
  }
  const window=joinWindow(event);
  if(participant.summary_published_at&&!participant.summary_viewed_at)await admin.from("demo_session_participants").update({summary_viewed_at:new Date().toISOString()}).eq("id",participant.id);
  const state=participant.summary_published_at?"completed":session.status==="cancelled"?"cancelled":"upcoming";
  return NextResponse.json({ok:true,demo:{
   state,participantId:participant.id,childName:lead.child_name,grade:lead.grade,interest:lead.interest,experienceLevel:lead.experience_level,
   sessionType:session.session_type,focus:session.focus,trainerName:session.trainer?.full_name||"Robotronix Mentor",
   date:event.date,startTime:String(event.start_time).slice(0,5),endTime:String(event.end_time).slice(0,5),timezone:event.timezone,
   joinEnabled:window.enabled&&meeting?.status==="scheduled",joinOpensAt:window.opensAt,startAt:window.startAt,endAt:window.endAt,
   joinUrl:window.enabled&&meeting?.status==="scheduled"?meeting.join_url:null,
   attendance:participant.attendance,engagement:participant.engagement,understanding:participant.understanding,
   problemSolving:participant.problem_solving,confidence:participant.confidence,explored:participant.explored,
   strengths:participant.strengths||[],mentorNote:participant.mentor_note,recommendedFormat:participant.recommended_format,
   recommendedFrequency:participant.recommended_frequency,fit:participant.fit,recommendedCourse,parentRating:participant.parent_rating
  }},{headers:{"Cache-Control":"no-store, private"}});
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:400,headers:{"Cache-Control":"no-store"}});
 }
}

export async function POST(request:NextRequest,{params}:{params:Promise<{token:string}>}){
 try{
  const {token}=await params;const {admin,participant}=await lookup(token);
  if(!participant)return NextResponse.json({ok:false,error:"This demo link is invalid or has expired."},{status:404});
  const body=await request.json().catch(()=>({})) as any;
  if(body.action==="feedback"){
   if(!participant.summary_published_at)throw new Error("Feedback opens after the demo summary is ready.");
   const rating=["excellent","good","not_sure"].includes(body.rating)?body.rating:null;if(!rating)throw new Error("Choose a feedback rating.");
   const {error}=await admin.from("demo_session_participants").update({parent_rating:rating,parent_feedback:String(body.feedback||"").trim().slice(0,1000)||null,updated_at:new Date().toISOString()}).eq("id",participant.id);
   if(error)throw new Error(error.message);
   return NextResponse.json({ok:true});
  }
  if(body.action==="reschedule"||body.action==="help"){
   const message=String(body.message||"").trim().slice(0,1000);
   if(body.action==="reschedule"&&!message)throw new Error("Please tell us your preferred alternative time.");
   const {error}=await admin.from("demo_guest_requests").insert({demo_session_participant_id:participant.id,request_type:body.action,message});
   if(error)throw new Error(error.message);
   return NextResponse.json({ok:true});
  }
  throw new Error("Unsupported demo action.");
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:400,headers:{"Cache-Control":"no-store"}});
 }
}
