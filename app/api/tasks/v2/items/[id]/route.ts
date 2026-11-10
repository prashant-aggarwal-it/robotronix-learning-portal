import {NextRequest,NextResponse} from "next/server";
import {taskSession,isTaskSession,taskError,taskDbError,noStore,isUuid} from "@/lib/server/tasks/auth";
import {validateV2} from "@/lib/server/tasks/v2-validation";

export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
export async function PATCH(request:NextRequest,context:Context){
 const {id}=await context.params;if(!isUuid(id))return taskError("Invalid task ID.",400);
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 if(Number(request.headers.get("content-length")||0)>8192)return taskError("Payload too large.",413);
 const input=validateV2("task",await request.json().catch(()=>null));
 if(!input.value)return taskError(input.error||"Invalid task details.",400);
 const {data,error}=await session.db.rpc("task_v2_patch",{p_actor_id:session.userId,p_task_id:id,p_data:input.value});
 if(error)return taskDbError(error.code);
 if(!data)return taskError("Task not found.",404);
 return NextResponse.json({ok:true,item:data},{headers:noStore});
}
