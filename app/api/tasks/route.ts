import {NextRequest,NextResponse} from "next/server";
import {taskSession,isTaskSession,taskError,taskDbError,noStore} from "@/lib/server/tasks/auth";
import {validateTask} from "@/lib/server/tasks/validation";

export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 const params=request.nextUrl.searchParams;
 const status=params.get("status"),limitRaw=params.get("limit")||"50",offsetRaw=params.get("offset")||"0";
 if(status&&!(["todo","in_progress","done"] as string[]).includes(status))return taskError("Invalid status.",400);
 if(!/^\d{1,3}$/.test(limitRaw)||!/^\d{1,6}$/.test(offsetRaw))return taskError("Invalid pagination.",400);
 const limit=Math.min(100,Math.max(1,Number(limitRaw))),offset=Math.min(100000,Number(offsetRaw));
 const {data,error}=await session.db.rpc("task_list",{p_actor_id:session.userId,p_status:status,p_limit:limit,p_offset:offset});
 if(error)return taskDbError(error.code);
 return NextResponse.json({ok:true,items:data||[],limit,offset},{headers:noStore});
}
export async function POST(request:NextRequest){
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 if(Number(request.headers.get("content-length")||0)>16000)return taskError("Payload too large.",413);
 const input=validateTask(await request.json().catch(()=>null));
 if(!input.value)return taskError(input.error||"Invalid task.",400);
 const {data,error}=await session.db.rpc("task_create",{p_actor_id:session.userId,p_data:input.value});
 if(error)return taskDbError(error.code);
 return NextResponse.json({ok:true,item:data},{status:201,headers:noStore});
}
