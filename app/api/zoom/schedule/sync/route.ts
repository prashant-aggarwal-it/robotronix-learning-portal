import {NextRequest,NextResponse} from "next/server";
import {requireAdmin} from "@/lib/server/admin-api";
import {cancelZoomForScheduleEvent,syncZoomForScheduleEvent} from "@/lib/server/zoom-classroom";
export const dynamic="force-dynamic";

export async function POST(request:NextRequest){
 const auth=await requireAdmin(request);if("error" in auth)return auth.error;
 try{
  const body=await request.json().catch(()=>({})) as {scheduleEventId?:string;action?:"sync"|"delete"};
  if(!body.scheduleEventId)throw new Error("Schedule event id is required.");
  const result=body.action==="delete"
    ?await cancelZoomForScheduleEvent(auth.admin,body.scheduleEventId,{removeLocal:true})
    :await syncZoomForScheduleEvent(auth.admin,body.scheduleEventId,auth.actorId);
  return NextResponse.json({ok:true,...result},{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:400});
 }
}
