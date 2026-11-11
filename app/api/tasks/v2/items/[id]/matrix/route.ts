import {NextRequest,NextResponse} from "next/server";
import {taskSession,isTaskSession,taskError,noStore,isUuid} from "@/lib/server/tasks/auth";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{id:string}>};
export async function PATCH(request:NextRequest,context:Ctx){
 const {id}=await context.params;if(!isUuid(id))return taskError("Invalid task ID.",400);
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 if(Number(request.headers.get("content-length")||0)>1024)return taskError("Payload too large.",413);
 const raw:unknown=await request.json().catch(()=>null);
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return taskError("Invalid priority matrix.",400);
 const data=raw as Record<string,unknown>;
 if(Object.keys(data).length!==2||typeof data.important!=="boolean"||typeof data.urgent!=="boolean")
 return taskError("Choose important and urgent values.",400);
 const {data:result,error}=await session.db.rpc("task_v2_matrix_set",{
  p_actor_id:session.userId,p_task_id:id,p_important:data.important,p_urgent:data.urgent
 });
 if(error)return taskError("Unable to update priority matrix.",500);
 if(!result)return taskError("Task unavailable for editing.",404);
 return NextResponse.json({ok:true,item:result},{headers:noStore});
}
