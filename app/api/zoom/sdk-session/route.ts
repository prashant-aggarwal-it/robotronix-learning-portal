import {NextRequest,NextResponse} from "next/server";
import {requirePortalUser} from "@/lib/server/portal-api";
import {createMeetingSdkJwt,zoomApi} from "@/lib/server/zoom";
import {classAccessForProfile,classJoinWindow} from "@/lib/server/zoom-classroom";
export const dynamic="force-dynamic";

export async function POST(request:NextRequest){
 const auth=await requirePortalUser(request,["admin","trainer","parent","student"]);if("error" in auth)return auth.error;
 try{
  const body=await request.json().catch(()=>({})) as {meetingId?:string;scheduleEventId?:string;mode?:"host"|"participant"};
  const mode=body.mode==="host"?"host":"participant";
  let meeting:any=null;
  let scheduleEventId=body.scheduleEventId||"";

  if(scheduleEventId){
   const access=await classAccessForProfile(auth.admin,scheduleEventId,auth.profile);
   if(!access?.canJoin)return NextResponse.json({ok:false,error:"You do not have access to this classroom."},{status:403});
   if(mode==="host"&&!access.canHost)return NextResponse.json({ok:false,error:"Only the assigned Trainer or Admin can start this classroom."},{status:403});
   const window=classJoinWindow(access.event,auth.profile.role);
   if(!window.allowed&&auth.profile.role!=="admin")return NextResponse.json({ok:false,error:"Classroom access opens shortly before the scheduled class and closes after the class window."},{status:403});
   const {data,error}=await auth.admin.from("zoom_meetings")
    .select("id,host_account_id,zoom_meeting_id,passcode,purpose,status,schedule_event_id")
    .eq("schedule_event_id",scheduleEventId).eq("purpose","class").maybeSingle();
   if(error)throw new Error(error.message);meeting=data;
  }else if(body.meetingId){
   const {data,error}=await auth.admin.from("zoom_meetings")
    .select("id,host_account_id,zoom_meeting_id,passcode,purpose,status,schedule_event_id")
    .eq("id",body.meetingId).maybeSingle();
   if(error)throw new Error(error.message);meeting=data;
   if(!meeting||meeting.purpose!=="poc")throw new Error("POC meeting not found.");
   if(mode==="host"&&!["admin","trainer"].includes(auth.profile.role))return NextResponse.json({ok:false,error:"Only Admin or Trainer can start the POC classroom."},{status:403});
  }else throw new Error("Meeting or schedule event id is required.");

  if(!meeting)throw new Error("Zoom classroom has not been provisioned for this class yet.");
  if(["cancelled","error"].includes(meeting.status))throw new Error("This Zoom classroom is not available.");

  const role:0|1=mode==="host"?1:0;
  let zak="";
  if(role===1){
   const token=await zoomApi(meeting.host_account_id,"/users/me/zak");
   zak=String(token.token||"");
   if(!zak)throw new Error("Zoom did not return a host ZAK token.");
  }

  const userName=String(auth.profile.full_name||auth.user.email||"Robotronix User");
  if(meeting.purpose==="class"){
   await auth.admin.from("zoom_join_intents").insert({
    zoom_meeting_id:meeting.id,profile_id:auth.profile.id,portal_role:auth.profile.role,
    participant_name:userName,requested_at:new Date().toISOString()
   });
  }

  return NextResponse.json({ok:true,session:{
   meetingNumber:String(meeting.zoom_meeting_id),password:String(meeting.passcode||""),
   signature:createMeetingSdkJwt(String(meeting.zoom_meeting_id),role),zak,userName,role,
   leaveUrl:scheduleEventId?"/"+auth.profile.role:"/admin/zoom-test"
  }},{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:400});
 }
}
