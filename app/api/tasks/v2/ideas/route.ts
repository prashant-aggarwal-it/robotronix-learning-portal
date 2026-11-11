import {NextRequest,NextResponse} from "next/server";
import {taskSession,isTaskSession,taskError,noStore,isUuid} from "@/lib/server/tasks/auth";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 if(Number(request.headers.get("content-length")||0)>4096)return taskError("Payload too large.",413);
 const raw:unknown=await request.json().catch(()=>null);
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return taskError("Invalid idea.",400);
 const body=raw as Record<string,unknown>;
 const action=body.action;
 if(!["capture","convert","dismiss"].includes(action as string))return taskError("Invalid idea action.",400);
 const allowed=action==="capture"?["action","title","source_task_id"]:["action","idea_id"];
 if(Object.keys(body).some(k=>!allowed.includes(k)))return taskError("Unsupported idea field.",400);
 if(action==="capture"&&(!(typeof body.title==="string"&&body.title.trim().length>=1&&body.title.trim().length<=300)
  ||(body.source_task_id!==null&&body.source_task_id!==undefined&&!isUuid(body.source_task_id))))
  return taskError("Enter a short idea (up to 300 characters).",400);
 if(action!=="capture"&&!isUuid(body.idea_id))return taskError("Invalid idea.",400);
 const {data,error}=await session.db.rpc("task_v2_idea_action",{
  p_actor_id:session.userId,p_action:action,p_data:Object.fromEntries(Object.entries(body).filter(([k])=>k!=="action"))
 });
 if(error)return taskError(error.code==="P0001"?error.message:"Unable to save idea.",error.code==="P0001"?400:500);
 if(!data)return taskError("Idea not found.",404);
 return NextResponse.json({ok:true,item:data},{headers:noStore});
}
