import {NextRequest,NextResponse} from "next/server";
import {taskSession,isTaskSession,taskError,taskDbError,noStore,isUuid} from "@/lib/server/tasks/auth";
import {validateTask} from "@/lib/server/tasks/validation";

export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
export async function PATCH(request:NextRequest,context:Context){
 const {id}=await context.params;if(!isUuid(id))return taskError("Invalid task ID.",400);
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 if(Number(request.headers.get("content-length")||0)>16000)return taskError("Payload too large.",413);
 const input=validateTask(await request.json().catch(()=>null),true);
 if(!input.value)return taskError(input.error||"Invalid task.",400);
 const {data,error}=await session.db.rpc("task_update",{p_actor_id:session.userId,p_id:id,p_data:input.value});
 if(error)return taskDbError(error.code);
 if(!data)return taskError("Task not found.",404);
 return NextResponse.json({ok:true,item:data},{headers:noStore});
}
export async function DELETE(request:NextRequest,context:Context){
 const {id}=await context.params;if(!isUuid(id))return taskError("Invalid task ID.",400);
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 const {data,error}=await session.db.rpc("task_archive",{p_actor_id:session.userId,p_id:id});
 if(error)return taskDbError(error.code);
 if(!data)return taskError("Task not found.",404);
 return NextResponse.json({ok:true},{headers:noStore});
}
