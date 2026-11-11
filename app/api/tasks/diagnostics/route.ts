import {NextRequest,NextResponse} from "next/server";
import {taskSession,isTaskSession,taskError,noStore} from "@/lib/server/tasks/auth";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const start=Date.now();const session=await taskSession(request);if(!isTaskSession(session))return session;
 const {data,error}=await session.db.rpc("task_account_metrics",{p_actor_id:session.userId});
 if(error)return taskError("Task diagnostics unavailable.",503);
 return NextResponse.json({ok:true,service:"ready",response_ms:Date.now()-start,counts:data||{}},{headers:noStore});
}
