import {NextRequest,NextResponse} from "next/server";
import {taskSession,isTaskSession,taskError,taskDbError,noStore,isUuid} from "@/lib/server/tasks/auth";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
export async function POST(request:NextRequest,context:Context){
 const {id}=await context.params;
 if(!isUuid(id))return taskError("Invalid task ID.",400);
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 if(Number(request.headers.get("content-length")||0)>4096)return taskError("Payload too large.",413);
 const body:unknown=await request.json().catch(()=>null);
 if(!body||Array.isArray(body)||typeof body!=="object")return taskError("Invalid board move.",400);
 const data=body as Record<string,unknown>;
 if(Object.keys(data).some(k=>!["status","group_by","group_id","position"].includes(k)))return taskError("Unsupported board move field.",400);
 if(!["todo","in_progress","waiting","done"].includes(data.status as string))return taskError("Invalid status.",400);
 const groupBy=data.group_by??"status";
 if(!["status","area","project"].includes(groupBy as string))return taskError("Invalid board grouping.",400);
 if(data.group_id!==undefined&&data.group_id!==null&&!isUuid(data.group_id))return taskError("Invalid destination.",400);
 if(typeof data.position!=="number"||!Number.isSafeInteger(data.position)||data.position<0||data.position>10000)return taskError("Invalid card position.",400);
 const {data:result,error}=await session.db.rpc("task_v2_board_move",{
  p_actor_id:session.userId,p_task_id:id,p_status:data.status,
  p_group_by:groupBy,p_group_id:data.group_id??null,p_position:data.position
 });
 if(error)return taskDbError(error.code);
 if(!result)return taskError("Task unavailable for editing.",404);
 return NextResponse.json({ok:true,item:result},{headers:noStore});
}
