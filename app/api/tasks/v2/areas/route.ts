import {NextRequest,NextResponse} from "next/server";
import {taskSession,isTaskSession,taskError,taskDbError,noStore} from "@/lib/server/tasks/auth";
import {validateV2} from "@/lib/server/tasks/v2-validation";

export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 const {data,error}=await session.db.rpc("task_v2_areas_list",{p_actor_id:session.userId});
 if(error)return taskDbError(error.code);
 return NextResponse.json({ok:true,items:data||[]},{headers:noStore});
}
export async function POST(request:NextRequest){
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 if(Number(request.headers.get("content-length")||0)>8192)return taskError("Payload too large.",413);
 const input=validateV2("area",await request.json().catch(()=>null));
 if(!input.value)return taskError(input.error||"Invalid area.",400);
 const {data,error}=await session.db.rpc("task_v2_area_save",{p_actor_id:session.userId,p_data:input.value});
 if(error)return taskDbError(error.code);
 if(!data)return taskError("Area not found.",404);
 return NextResponse.json({ok:true,item:data},{headers:noStore});
}
