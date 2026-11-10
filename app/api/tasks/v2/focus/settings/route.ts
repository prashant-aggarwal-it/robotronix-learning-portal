import {NextRequest,NextResponse} from "next/server";
import {taskSession,isTaskSession,taskError,noStore} from "@/lib/server/tasks/auth";
export const dynamic="force-dynamic";
export async function PUT(request:NextRequest){
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 if(Number(request.headers.get("content-length")||0)>4096)return taskError("Payload too large.",413);
 const raw:unknown=await request.json().catch(()=>null);
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return taskError("Invalid preferences.",400);
 const data=raw as Record<string,unknown>;
 if(Object.keys(data).length!==3||Object.keys(data).some(k=>!["active_project_limit","daily_focus_minutes","switch_prompt_enabled"].includes(k))
  ||!Number.isInteger(data.active_project_limit)||Number(data.active_project_limit)<1||Number(data.active_project_limit)>10
  ||!Number.isInteger(data.daily_focus_minutes)||Number(data.daily_focus_minutes)<30||Number(data.daily_focus_minutes)>600
  ||typeof data.switch_prompt_enabled!=="boolean")return taskError("Invalid focus settings.",400);
 const {data:result,error}=await session.db.rpc("task_v2_focus_settings_save",{
  p_actor_id:session.userId,p_limit:data.active_project_limit,p_minutes:data.daily_focus_minutes,
  p_switch:data.switch_prompt_enabled
 });
 if(error)return taskError("Unable to save settings.",500);
 return NextResponse.json({ok:true,settings:result},{headers:noStore});
}
