import crypto from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {requireAdmin} from "@/lib/server/admin-api";
import {zoomApi} from "@/lib/server/zoom";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){
 const auth=await requireAdmin(request);if("error" in auth)return auth.error;
 try{
  const body=await request.json().catch(()=>({})) as {hostId?:string};if(!body.hostId)throw new Error("Choose a connected Zoom host first.");
  const start=new Date(Date.now()+5*60_000).toISOString();
  const created=await zoomApi(body.hostId,"/users/me/meetings",{method:"POST",body:JSON.stringify({topic:"Robotronix Classroom · POC",type:2,start_time:start,duration:30,timezone:"Asia/Kolkata",agenda:"Robotronix embedded classroom proof of concept",settings:{host_video:true,participant_video:true,join_before_host:true,waiting_room:false,mute_upon_entry:false,audio:"both",auto_recording:"none"}})});
  const localId=crypto.randomUUID();const {error}=await auth.admin.from("zoom_meetings").insert({id:localId,host_account_id:body.hostId,purpose:"poc",zoom_meeting_id:String(created.id),zoom_meeting_uuid:created.uuid?String(created.uuid):null,topic:String(created.topic||"Robotronix Classroom · POC"),passcode:String(created.password||created.encrypted_password||""),join_url:created.join_url?String(created.join_url):null,status:"scheduled",scheduled_start:start,duration_minutes:30,created_by:auth.actorId});if(error)throw new Error(error.message);
  return NextResponse.json({ok:true,meeting:{id:localId,topic:created.topic,scheduledStart:start,zoomMeetingId:String(created.id)}});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:400});}
}
export async function DELETE(request:NextRequest){
 const auth=await requireAdmin(request);if("error" in auth)return auth.error;
 try{const id=request.nextUrl.searchParams.get("id");if(!id)throw new Error("Meeting id required.");const {data,error}=await auth.admin.from("zoom_meetings").select("id,host_account_id,zoom_meeting_id,purpose").eq("id",id).maybeSingle();if(error)throw new Error(error.message);if(!data||data.purpose!=="poc")throw new Error("POC meeting not found.");await zoomApi(data.host_account_id,`/meetings/${encodeURIComponent(data.zoom_meeting_id)}`,{method:"DELETE"});await auth.admin.from("zoom_meetings").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",id);return NextResponse.json({ok:true});}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:400});}
}
