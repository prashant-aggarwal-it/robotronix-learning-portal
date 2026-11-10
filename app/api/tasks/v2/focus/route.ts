import {NextRequest,NextResponse} from "next/server";
import {taskSession,isTaskSession,taskError,taskDbError,noStore,isUuid} from "@/lib/server/tasks/auth";
export const dynamic="force-dynamic";
type Json=Record<string,unknown>;
const keys:Record<string,string[]>={
 start:["task_id","mode","minutes"],pause:["session_id"],resume:["session_id"],
 extend:["session_id","minutes"],finish:["session_id","outcome","resume_note"]
};
export async function GET(request:NextRequest){
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 const {data,error}=await session.db.rpc("task_v2_focus_get",{p_actor_id:session.userId});
 if(error)return taskDbError(error.code);
 return NextResponse.json({ok:true,focus:data},{headers:noStore});
}
export async function POST(request:NextRequest){
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 if(Number(request.headers.get("content-length")||0)>8192)return taskError("Payload too large.",413);
 const raw:unknown=await request.json().catch(()=>null);
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return taskError("Invalid focus action.",400);
 const body=raw as Json, action=body.action;
 if(typeof action!=="string"||!Object.hasOwn(keys,action))return taskError("Invalid focus action.",400);
 const data=Object.fromEntries(Object.entries(body).filter(([k])=>k!=="action"));
 if(Object.keys(data).some(k=>!keys[action].includes(k)))return taskError("Unsupported focus option.",400);
 if(action==="start"){
  if(!isUuid(data.task_id))return taskError("Choose a valid task.",400);
  if(!["timebox","pomodoro","stopwatch","five_minutes"].includes(data.mode as string))return taskError("Invalid focus mode.",400);
  if(!Number.isInteger(data.minutes)||!(Number(data.minutes)>=5&&Number(data.minutes)<=240))return taskError("Choose 5–240 minutes.",400);
 }else{
  if(!isUuid(data.session_id))return taskError("Invalid focus session.",400);
  if(action==="extend"&&(!Number.isInteger(data.minutes)||!(Number(data.minutes)>=5&&Number(data.minutes)<=60)))return taskError("Extension must be 5–60 minutes.",400);
  if(action==="finish"&&(!["completed","parked","stopped"].includes(data.outcome as string)
   ||(data.resume_note!==undefined&&(typeof data.resume_note!=="string"||data.resume_note.length>4000))
   ||(data.outcome==="parked"&&!(typeof data.resume_note==="string"&&data.resume_note.trim()))))
   return taskError("Choose an outcome and add a stopping note when parking.",400);
 }
 const {data:result,error}=await session.db.rpc("task_v2_focus_action",{
  p_actor_id:session.userId,p_action:action,p_data:data
 });
 if(error)return taskError(error.code==="P0001"?error.message:"Focus session could not be updated.",error.code==="P0001"?409:500);
 return NextResponse.json({ok:true,session:result},{headers:noStore});
}
