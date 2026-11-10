import {NextRequest,NextResponse} from "next/server";
import {taskSession,isTaskSession,taskError,noStore,isUuid} from "@/lib/server/tasks/auth";
export const dynamic="force-dynamic";
export async function PUT(request:NextRequest){
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 if(Number(request.headers.get("content-length")||0)>4096)return taskError("Payload too large.",413);
 const raw:unknown=await request.json().catch(()=>null);
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return taskError("Invalid weekly commitment.",400);
 const d=raw as Record<string,unknown>;
 if(Object.keys(d).length!==2||!Object.hasOwn(d,"area_id")||!Object.hasOwn(d,"target_sessions")
 ||!isUuid(d.area_id)||!Number.isInteger(d.target_sessions)||Number(d.target_sessions)<0||Number(d.target_sessions)>14)
 return taskError("Choose an area and 0–14 weekly sessions.",400);
 const {data,error}=await session.db.rpc("task_v2_commitment_save",{
  p_actor_id:session.userId,p_area_id:d.area_id,p_target:d.target_sessions
 });
 if(error)return taskError(error.code==="P0001"?"Area unavailable.":"Unable to save commitment.",error.code==="P0001"?400:500);
 return NextResponse.json({ok:true,item:data},{headers:noStore});
}
