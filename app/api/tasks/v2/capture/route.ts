import {NextRequest,NextResponse} from "next/server";
import {taskSession,isTaskSession,taskError,taskDbError,noStore} from "@/lib/server/tasks/auth";
import {validateTask} from "@/lib/server/tasks/validation";
import {validateV2} from "@/lib/server/tasks/v2-validation";

export const dynamic="force-dynamic";
/** Atomic, title-first task capture. No partially created task if an area or project is invalid. */
export async function POST(request:NextRequest){
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 if(Number(request.headers.get("content-length")||0)>8192)return taskError("Payload too large.",413);
 const raw=await request.json().catch(()=>null);
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return taskError("Provide a task object.",400);
 const input=raw as Record<string,unknown>;
 const allowed=new Set(["title","description","priority","scheduled_date","due_at","category_id",
  "area_id","project_id","important","estimated_minutes"]);
 if(Object.keys(input).some(key=>!allowed.has(key)))return taskError("Unsupported task field.",400);
 const base:Record<string,unknown>={};
 const extra:Record<string,unknown>={};
 for(const [key,value] of Object.entries(input)){
  if(["area_id","project_id","important","estimated_minutes"].includes(key))extra[key]=value;
  else base[key]=value;
 }
 const task=validateTask(base);
 if(!task.value)return taskError(task.error||"Invalid task.",400);
 if(Object.keys(extra).length){
  const metadata=validateV2("task",extra);
  if(!metadata.value)return taskError(metadata.error||"Invalid task details.",400);
 }
 const {data,error}=await session.db.rpc("task_v2_capture",{p_actor_id:session.userId,p_data:{...task.value,...extra}});
 if(error)return taskDbError(error.code);
 if(!data)return taskError("Unable to capture task.",500);
 return NextResponse.json({ok:true,item:data},{status:201,headers:noStore});
}
