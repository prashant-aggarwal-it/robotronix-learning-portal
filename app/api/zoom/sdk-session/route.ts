import {NextRequest,NextResponse} from "next/server";
import {requirePortalUser} from "@/lib/server/portal-api";
import {createMeetingSdkJwt,zoomApi} from "@/lib/server/zoom";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){
 const auth=await requirePortalUser(request,["admin","trainer","parent","student"]);if("error" in auth)return auth.error;
 try{
  const body=await request.json().catch(()=>({})) as {meetingId?:string;mode?:"host"|"participant"};if(!body.meetingId)throw new Error("Meeting id required.");
  const mode=body.mode==="host"?"host":"participant";if(mode==="host"&&!(["admin","trainer"].includes(auth.profile.role)))return NextResponse.json({ok:false,error:"Only Admin or Trainer can start the POC classroom."},{status:403});
  const {data,error}=await auth.admin.from("zoom_meetings").select("id,host_account_id,zoom_meeting_id,passcode,purpose,status").eq("id",body.meetingId).maybeSingle();if(error)throw new Error(error.message);if(!data||data.purpose!=="poc")throw new Error("POC meeting not found.");if(data.status==="cancelled")throw new Error("This test meeting has been cancelled.");
  const role:0|1=mode==="host"?1:0;let zak="";if(role===1){const token=await zoomApi(data.host_account_id,"/users/me/token?type=zak");zak=String(token.token||"");if(!zak)throw new Error("Zoom did not return a host ZAK token.");}
  return NextResponse.json({ok:true,session:{meetingNumber:String(data.zoom_meeting_id),password:String(data.passcode||""),signature:createMeetingSdkJwt(String(data.zoom_meeting_id),role),zak,userName:String(auth.profile.full_name||auth.user.email||"Robotronix User"),role}});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:400});}
}
