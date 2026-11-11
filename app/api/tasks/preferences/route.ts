import {NextRequest,NextResponse} from "next/server";
import {taskSession,isTaskSession,taskError,taskDbError,noStore} from "@/lib/server/tasks/auth";

export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 const {data,error}=await session.db.rpc("task_preferences_get",{p_actor_id:session.userId});
 if(error)return taskDbError(error.code);
 return NextResponse.json({ok:true,item:data},{headers:noStore});
}
export async function PATCH(request:NextRequest){
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 const input:unknown=await request.json().catch(()=>null);
 if(!input||typeof input!=="object"||Array.isArray(input))return taskError("Invalid preferences.",400);
 const p=input as Record<string,unknown>;
 if(Object.keys(p).some(k=>!["timezone","week_starts_on"].includes(k))||typeof p.timezone!=="string"||p.timezone.length>80||typeof p.week_starts_on!=="number"||![0,1,2,3,4,5,6].includes(p.week_starts_on))return taskError("Invalid preferences.",400);
 try{new Intl.DateTimeFormat("en-US",{timeZone:p.timezone})}catch{return taskError("Invalid timezone.",400)}
 const {data,error}=await session.db.rpc("task_preferences_save",{p_actor_id:session.userId,p_timezone:p.timezone,p_week_start:p.week_starts_on});
 if(error)return taskDbError(error.code);
 return NextResponse.json({ok:true,item:data},{headers:noStore});
}
