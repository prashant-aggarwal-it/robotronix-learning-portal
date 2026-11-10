import {NextRequest,NextResponse} from "next/server";
import {taskSession,isTaskSession,taskError,taskDbError,noStore} from "@/lib/server/tasks/auth";

export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 const limitRaw=request.nextUrl.searchParams.get("limit")||"250";
 const offsetRaw=request.nextUrl.searchParams.get("offset")||"0";
 if(!/^\d{1,3}$/.test(limitRaw)||!/^\d{1,5}$/.test(offsetRaw))return taskError("Invalid pagination.",400);
 const limit=Math.min(250,Math.max(1,Number(limitRaw)));
 const offset=Math.min(20000,Number(offsetRaw));
 const {data,error}=await session.db.rpc("task_v2_board_list",{
  p_actor_id:session.userId,p_limit:limit,p_offset:offset
 });
 if(error)return taskDbError(error.code);
 return NextResponse.json({ok:true,items:data||[],limit,offset},{headers:noStore});
}
