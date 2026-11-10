import {NextRequest,NextResponse} from "next/server";
import {taskSession,isTaskSession,taskError,taskDbError,noStore,isUuid} from "@/lib/server/tasks/auth";
import {validateTask} from "@/lib/server/tasks/validation";
import {validateV2} from "@/lib/server/tasks/v2-validation";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
export async function PATCH(request:NextRequest,context:Context){
 const {id}=await context.params;if(!isUuid(id))return taskError("Invalid task ID.",400);
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 if(Number(request.headers.get("content-length")||0)>24000)return taskError("Payload too large.",413);
 const body:unknown=await request.json().catch(()=>null);
 if(!body||typeof body!=="object"||Array.isArray(body))return taskError("Invalid details.",400);
 const raw=body as Record<string,unknown>;
 const standard:Record<string,unknown>={},meta:Record<string,unknown>={};
 for(const [k,v] of Object.entries(raw)){
  if(["title","description","priority","scheduled_date","due_at","reminder_at","recurrence"].includes(k))standard[k]=v;
  else if(["area_id","project_id","important","estimated_minutes","done_definition","resume_note","waiting_for","followup_date"].includes(k))meta[k]=v;
  else if(k==="status"){
   if(!["todo","in_progress","waiting","done"].includes(v as string))return taskError("Invalid status.",400);
  }else return taskError("Unsupported detail field.",400);
 }
 if(!Object.keys(raw).length)return taskError("No details provided.",400);
 if(Object.keys(standard).length){
  const checked=validateTask(standard,true);
  if(!checked.value)return taskError(checked.error||"Invalid standard fields.",400);
 }
 if(Object.keys(meta).length){
  const checked=validateV2("task",meta);
  if(!checked.value)return taskError(checked.error||"Invalid task metadata.",400);
 }
 const {data,error}=await session.db.rpc("task_v2_detail_save",{
  p_actor_id:session.userId,p_task_id:id,p_data:raw
 });
 if(error){
  if(error.code==="P0001"&&/Linked tasks cannot enter Waiting/.test(error.message||""))
   return taskError("CRM or Learning-linked tasks cannot enter Waiting. Use To Do or In Progress.",409);
  if(error.code==="P0001"&&/(Invalid destination|Project does not match area|Invalid area)/.test(error.message||""))
   return taskError("The selected area or project is no longer available.",400);
  return taskDbError(error.code);
 }
 if(!data)return taskError("Task unavailable for editing.",404);
 return NextResponse.json({ok:true,item:data},{headers:noStore});
}
