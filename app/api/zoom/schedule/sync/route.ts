import {NextRequest,NextResponse} from "next/server";
import {requireAdmin} from "@/lib/server/admin-api";
import {cancelZoomForScheduleEvent,syncZoomForScheduleEvent} from "@/lib/server/zoom-classroom";
export const dynamic="force-dynamic";

export async function POST(request:NextRequest){
 const auth=await requireAdmin(request);if("error" in auth)return auth.error;
 try{
  const body=await request.json().catch(()=>({})) as {scheduleEventId?:string;action?:"sync"|"delete"|"reserve"};
  if(typeof body.scheduleEventId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.scheduleEventId)){
   return NextResponse.json({ok:false,error:"Invalid class event ID"},{status:400,headers:{"Cache-Control":"no-store"}});
  }
  if(body.action!==undefined&&body.action!=="sync"&&body.action!=="delete"&&body.action!=="reserve"){
   return NextResponse.json({ok:false,error:"Unsupported Zoom action"},{status:400,headers:{"Cache-Control":"no-store"}});
  }
  if(body.action==="reserve"){
   const {data,error}=await auth.admin.rpc("reserve_zoom_host_for_class",{p_event_id:body.scheduleEventId});
   if(error)throw new Error("Unable to refresh the Zoom host reservation.");
   return NextResponse.json({ok:true,action:data},{headers:{"Cache-Control":"no-store"}});
  }
  const result=body.action==="delete"
    ?await cancelZoomForScheduleEvent(auth.admin,body.scheduleEventId,{removeLocal:true})
    :await syncZoomForScheduleEvent(auth.admin,body.scheduleEventId,auth.actorId);
  return NextResponse.json({ok:true,...result},{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  console.error("Zoom class sync failed",error instanceof Error?error.name:"UnknownError");
  return NextResponse.json({ok:false,error:"Unable to update Zoom classroom"},{status:400,headers:{"Cache-Control":"no-store"}});
 }
}
