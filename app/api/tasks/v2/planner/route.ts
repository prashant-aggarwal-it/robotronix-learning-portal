import {NextRequest,NextResponse} from "next/server";
import {taskSession,isTaskSession,taskError,noStore,isUuid} from "@/lib/server/tasks/auth";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 if(Number(request.headers.get("content-length")||0)>8192)return taskError("Payload too large.",413);
 const raw:unknown=await request.json().catch(()=>null);
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return taskError("Invalid planning request.",400);
 const body=raw as Record<string,unknown>;
 if(Object.keys(body).some(k=>!["ids","action","date"].includes(k)))return taskError("Unsupported field.",400);
 if(!Array.isArray(body.ids)||body.ids.length<1||body.ids.length>50
 ||body.ids.some(id=>!isUuid(id))||new Set(body.ids).size!==body.ids.length)
 return taskError("Select between one and fifty distinct tasks.",400);
 if(!["plan","unschedule","someday"].includes(body.action as string))
 return taskError("Invalid planning action.",400);
 if(body.action==="plan"){
  if(typeof body.date!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(body.date)
    ||Number.isNaN(Date.parse(body.date))||new Date(body.date).toISOString().slice(0,10)!==body.date)
   return taskError("Choose a valid planning date.",400);
 }else if(body.date!==undefined&&body.date!==null)return taskError("Date is only for scheduled tasks.",400);
 const {data,error}=await session.db.rpc("task_v2_plan_move",{
  p_actor_id:session.userId,p_task_ids:body.ids,p_action:body.action,p_date:body.action==="plan"?body.date:null
 });
 if(error)return taskError(error.code==="P0001"?error.message:"Unable to reschedule tasks.",error.code==="P0001"?409:500);
 return NextResponse.json({ok:true,items:data||[]},{headers:noStore});
}
