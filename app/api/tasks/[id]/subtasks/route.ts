import {NextRequest,NextResponse} from "next/server";
import {taskSession,isTaskSession,taskError,taskDbError,noStore,isUuid} from "@/lib/server/tasks/auth";

type Context={params:Promise<{id:string}>};
export const dynamic="force-dynamic";
export async function GET(request:NextRequest,context:Context){
 const {id}=await context.params;if(!isUuid(id))return taskError("Invalid task.",400);
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 const {data,error}=await session.db.rpc("task_subtasks_list",{p_actor_id:session.userId,p_task_id:id});
 if(error)return taskDbError(error.code);
 return NextResponse.json({ok:true,items:data||[]},{headers:noStore});
}
export async function POST(request:NextRequest,context:Context){
 const {id}=await context.params;if(!isUuid(id))return taskError("Invalid task.",400);
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 const body:unknown=await request.json().catch(()=>null);
 if(!body||typeof body!=="object"||Array.isArray(body))return taskError("Invalid subtask.",400);
 const v=body as Record<string,unknown>;
 if(Object.keys(v).some(k=>!["id","title","done"].includes(k))||typeof v.title!=="string"||!v.title.trim()||v.title.length>240||
  (v.id!==undefined&&!isUuid(v.id))||(v.done!==undefined&&typeof v.done!=="boolean"))return taskError("Invalid subtask.",400);
 const {data,error}=await session.db.rpc("task_subtask_save",{p_actor_id:session.userId,p_task_id:id,p_id:v.id||null,p_title:v.title.trim(),p_done:v.done||false});
 if(error)return taskDbError(error.code);
 if(!data)return taskError("Task not found.",404);
 return NextResponse.json({ok:true,item:data},{headers:noStore});
}
export async function DELETE(request:NextRequest,context:Context){
 const {id}=await context.params;if(!isUuid(id))return taskError("Invalid task.",400);
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 const subtaskId=request.nextUrl.searchParams.get("id");if(!isUuid(subtaskId))return taskError("Invalid subtask.",400);
 const {data,error}=await session.db.rpc("task_subtask_delete",{p_actor_id:session.userId,p_task_id:id,p_id:subtaskId});
 if(error)return taskDbError(error.code);
 if(!data)return taskError("Subtask not found.",404);
 return NextResponse.json({ok:true},{headers:noStore});
}
