import {NextRequest,NextResponse} from "next/server";
import {requireAdmin} from "@/lib/server/admin-api";
import {cancelGeneralZoomMeeting,createGeneralZoomMeeting} from "@/lib/server/zoom-classroom";
import {logSystemEvent} from "@/lib/server/system-log";
export const dynamic="force-dynamic";

export async function GET(request:NextRequest){
 const auth=await requireAdmin(request);if("error" in auth)return auth.error;
 const {data,error}=await auth.admin.from("zoom_meetings")
  .select("id,host_account_id,topic,status,scheduled_start,duration_minutes,join_url,passcode,recording_enabled,recording_status,meeting_notes,created_at")
  .eq("purpose","general").order("scheduled_start",{ascending:false}).limit(100);
 if(error){const referenceId=await logSystemEvent({source:"zoom-meetings",action:"list",code:"ZOOM_MEETING_LIST_FAILURE",message:"Zoom meeting list query failed"});return NextResponse.json({ok:false,error:"Unable to load meetings.",referenceId},{status:500});}
 return NextResponse.json({ok:true,meetings:data||[]},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:NextRequest){
 const auth=await requireAdmin(request);if("error" in auth)return auth.error;
 try{
  const body=await request.json().catch(()=>({})) as {
   title?:string;startAt?:string;durationMinutes?:number;hostId?:string;recording?:boolean;notes?:string;
  };
  const title=String(body.title||"").trim();
  if(!title)return NextResponse.json({ok:false,error:"Meeting title is required."},{status:400});
  const meeting=await createGeneralZoomMeeting(auth.admin,{
   title,startAt:body.startAt,durationMinutes:body.durationMinutes,hostId:body.hostId,
   recording:body.recording,notes:body.notes,createdBy:auth.actorId
  });
  return NextResponse.json({ok:true,meeting},{headers:{"Cache-Control":"no-store"}});
 }catch{
  const referenceId=await logSystemEvent({source:"zoom-meetings",action:"create",code:"ZOOM_MEETING_CREATE_FAILURE",message:"Meeting creation failed"});
  return NextResponse.json({ok:false,error:"Unable to create meeting.",referenceId},{status:502});
 }
}

export async function PATCH(request:NextRequest){
 const auth=await requireAdmin(request);if("error" in auth)return auth.error;
 try{
  const body=await request.json().catch(()=>({})) as {id?:string;action?:"cancel"};
  if(!body.id)return NextResponse.json({ok:false,error:"Meeting id is required."},{status:400});
  if(body.action!=="cancel")return NextResponse.json({ok:false,error:"Unsupported meeting action."},{status:400});
  const result=await cancelGeneralZoomMeeting(auth.admin,body.id);
  return NextResponse.json({ok:true,meeting:result});
 }catch{
  const referenceId=await logSystemEvent({source:"zoom-meetings",action:"cancel",code:"ZOOM_MEETING_CANCEL_FAILURE",message:"Meeting cancellation failed"});
  return NextResponse.json({ok:false,error:"Unable to cancel meeting.",referenceId},{status:502});
 }
}
