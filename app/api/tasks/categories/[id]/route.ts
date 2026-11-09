import {NextRequest,NextResponse} from "next/server";
import {taskSession,isTaskSession,taskError,taskDbError,noStore,isUuid} from "@/lib/server/tasks/auth";
type Context={params:Promise<{id:string}>};
const colors=new Set(["slate","blue","green","amber","red","purple"]);
export async function PATCH(request:NextRequest,context:Context){
 const {id}=await context.params;if(!isUuid(id))return taskError("Invalid category.",400);
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 const v:unknown=await request.json().catch(()=>null);if(!v||typeof v!=="object"||Array.isArray(v))return taskError("Invalid category.",400);
 const p=v as Record<string,unknown>;
 if(Object.keys(p).some(k=>!["name","color"].includes(k))||typeof p.name!=="string"||!p.name.trim()||p.name.length>80||typeof p.color!=="string"||!colors.has(p.color))return taskError("Invalid category.",400);
 const {data,error}=await session.db.rpc("task_category_update",{p_actor_id:session.userId,p_id:id,p_name:p.name.trim(),p_color:p.color});
 if(error)return taskDbError(error.code);if(!data)return taskError("Category not found.",404);
 return NextResponse.json({ok:true,item:data},{headers:noStore});
}
export async function DELETE(request:NextRequest,context:Context){
 const {id}=await context.params;if(!isUuid(id))return taskError("Invalid category.",400);
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 const {data,error}=await session.db.rpc("task_category_archive",{p_actor_id:session.userId,p_id:id});
 if(error)return taskDbError(error.code);if(!data)return taskError("Category not found.",404);
 return NextResponse.json({ok:true},{headers:noStore});
}
