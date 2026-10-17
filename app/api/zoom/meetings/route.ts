import {NextRequest,NextResponse} from "next/server";
import {requireAdmin} from "@/lib/server/admin-api";
import {cancelGeneralZoomMeeting,createGeneralZoomMeeting} from "@/lib/server/zoom-classroom";
export const dynamic="force-dynamic";

export async function GET(request:NextRequest){
 const auth=await requireAdmin(request);if("error" in auth)return auth.error;
 const {data,error}=await auth.admin.from("zoom_meetings")
  .select("id,host_account_id,topic,status,scheduled_start,duration_minutes,join_url,passcode,recording_enabled,recording_status,meeting_notes,created_at")
  .eq("purpose","general").order("scheduled_start",{ascending:false}).limit(100);
 if(error)return NextResponse.json({ok:false,error:error.message},{status:500});
 return NextResponse.json({ok:true,meetings:data||[]},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:NextRequest){
 const auth=await requireAdmin(request);if("error" in auth)return auth.error;
 try{
  const body=await request.json().catch(()=>({})) as {
   title?:string;startAt?:string;durationMinutes?:number;hostId?:string;recording?:boolean;notes?:string;
  };
  const title=String(body.title||"").trim();
  if(!title)throw new Error("Meeting title is required.");
  const meeting=await createGeneralZoomMeeting(auth.admin,{
   title,startAt:body.startAt,durationMinutes:body.durationMinutes,hostId:body.hostId,
   recording:body.recording,notes:body.notes,createdBy:auth.actorId
  });
  return NextResponse.json({ok:true,meeting},{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:400});
 }
}

export async function PATCH(request:NextRequest){
 const auth=await requireAdmin(request);if("error" in auth)return auth.error;
 try{
  const body=await request.json().catch(()=>({})) as {id?:string;action?:"cancel"};
  if(!body.id)throw new Error("Meeting id is required.");
  if(body.action!=="cancel")throw new Error("Unsupported meeting action.");
  const result=await cancelGeneralZoomMeeting(auth.admin,body.id);
  return NextResponse.json({ok:true,meeting:result});
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:400});
 }
}
