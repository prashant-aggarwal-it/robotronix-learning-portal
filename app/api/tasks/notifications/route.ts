import {NextRequest,NextResponse} from "next/server";
import {taskSession,isTaskSession,taskError,noStore,isUuid} from "@/lib/server/tasks/auth";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 const {data,error}=await session.db.rpc("task_notifications_list",{p_actor_id:session.userId,p_limit:30});
 if(error)return taskError("Notifications unavailable.",503);
 return NextResponse.json({ok:true,items:data||[]},{headers:noStore});
}
export async function PATCH(request:NextRequest){
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 const raw:unknown=await request.json().catch(()=>null);
 const id=raw&&typeof raw==="object"&&!Array.isArray(raw)?(raw as Record<string,unknown>).id:null;
 if(!isUuid(id))return taskError("Invalid notification.",400);
 const {data,error}=await session.db.rpc("task_notification_read",{p_actor_id:session.userId,p_id:id});
 if(error)return taskError("Unable to update notification.",500);
 if(!data)return taskError("Notification not found.",404);
 return NextResponse.json({ok:true},{headers:noStore});
}
