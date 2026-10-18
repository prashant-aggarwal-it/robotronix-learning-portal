import {NextRequest,NextResponse} from "next/server";
import {requirePortalUser} from "@/lib/server/portal-api";
export const dynamic="force-dynamic";

async function trainerIdFor(auth:any){
 if(auth.profile.role==="admin")return null;
 const {data,error}=await auth.admin.from("trainers").select("id").eq("profile_id",auth.profile.id).maybeSingle();
 if(error)throw new Error(error.message);
 if(!data?.id)throw new Error("Trainer profile not found.");
 return data.id as string;
}

export async function GET(request:NextRequest){
 const auth=await requirePortalUser(request,["trainer","admin"]);if("error" in auth)return auth.error;
 try{
  const trainerId=await trainerIdFor(auth);
  let q=auth.admin.from("demo_sessions")
   .select("id,session_type,focus,status,zoom_meeting_id,created_at,schedule_event:schedule_events(id,date,start_time,end_time,timezone,title,status),trainer:trainers(id,full_name),participants:demo_session_participants(id,attendance,engagement,understanding,problem_solving,confidence,explored,strengths,mentor_note,recommended_course_id,recommended_format,recommended_frequency,fit,summary_published_at,lead:demo_leads(id,child_name,grade,interest,experience_level,status))")
   .order("created_at",{ascending:false}).limit(100);
  if(trainerId)q=q.eq("trainer_id",trainerId);
  const {data,error}=await q;if(error)throw new Error(error.message);
  const {data:courses,error:cErr}=await auth.admin.from("courses").select("id,title,public_name,status").eq("status","active").order("title");
  if(cErr)throw new Error(cErr.message);
  return NextResponse.json({ok:true,sessions:data||[],courses:courses||[]},{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:400});
 }
}

export async function POST(request:NextRequest){
 const auth=await requirePortalUser(request,["trainer","admin"]);if("error" in auth)return auth.error;
 try{
  const body=await request.json().catch(()=>({})) as any;
  const participantId=String(body.participantId||"");if(!participantId)throw new Error("Demo participant is required.");
  const trainerId=await trainerIdFor(auth);
  const {data:participant,error:pErr}=await auth.admin.from("demo_session_participants")
   .select("id,demo_session_id,lead_id,demo_session:demo_sessions(id,trainer_id,status)")
   .eq("id",participantId).maybeSingle();
  if(pErr)throw new Error(pErr.message);if(!participant)throw new Error("Demo participant not found.");
  const session:any=participant.demo_session;if(trainerId&&session?.trainer_id!==trainerId)return NextResponse.json({ok:false,error:"This demo is not assigned to you."},{status:403});

  const attendance=["attended","no_show","cancelled"].includes(body.attendance)?body.attendance:"attended";
  const update:any={attendance,updated_at:new Date().toISOString()};
  if(attendance==="attended"){
   if(!["low","good","excellent"].includes(body.engagement))throw new Error("Select engagement.");
   if(!["developing","good","strong"].includes(body.understanding))throw new Error("Select understanding.");
   update.engagement=body.engagement;update.understanding=body.understanding;
   update.problem_solving=["developing","good","strong"].includes(body.problemSolving)?body.problemSolving:null;
   update.confidence=["low","comfortable","high"].includes(body.confidence)?body.confidence:null;
   update.explored=String(body.explored||"").trim().slice(0,500)||null;
   update.strengths=Array.isArray(body.strengths)?body.strengths.map((x:any)=>String(x).trim()).filter(Boolean).slice(0,5):[];
   update.mentor_note=String(body.mentorNote||"").trim().slice(0,1200)||null;
   update.recommended_course_id=body.recommendedCourseId||null;
   update.recommended_format=["one_to_one","small_group"].includes(body.recommendedFormat)?body.recommendedFormat:null;
   update.recommended_frequency=String(body.recommendedFrequency||"").trim().slice(0,120)||null;
   update.fit=["strong","possible","not_now"].includes(body.fit)?body.fit:null;
   update.summary_published_at=new Date().toISOString();
  }else{
   update.summary_published_at=null;
  }
  const {error:uErr}=await auth.admin.from("demo_session_participants").update(update).eq("id",participantId);if(uErr)throw new Error(uErr.message);
  await auth.admin.from("demo_leads").update({status:attendance==="attended"?"demo_completed":"follow_up",updated_at:new Date().toISOString()}).eq("id",participant.lead_id);

  const {data:all,error:aErr}=await auth.admin.from("demo_session_participants").select("attendance").eq("demo_session_id",participant.demo_session_id);
  if(aErr)throw new Error(aErr.message);
  if((all||[]).length&&(all||[]).every((x:any)=>x.attendance!=="scheduled")){
   const rows=all||[];const anyAttended=rows.some((x:any)=>x.attendance==="attended");const allNoShow=rows.every((x:any)=>x.attendance==="no_show");
   const sessionStatus=anyAttended?"completed":allNoShow?"no_show":"cancelled";
   await auth.admin.from("demo_sessions").update({status:sessionStatus,completed_at:anyAttended?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq("id",participant.demo_session_id);
   const {data:s}=await auth.admin.from("demo_sessions").select("schedule_event_id").eq("id",participant.demo_session_id).maybeSingle();
   if(s?.schedule_event_id)await auth.admin.from("schedule_events").update({status:anyAttended?"conducted":"cancelled",updated_at:new Date().toISOString()}).eq("id",s.schedule_event_id);
  }
  return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:400});
 }
}
