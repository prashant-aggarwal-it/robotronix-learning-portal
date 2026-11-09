import {NextRequest,NextResponse} from "next/server";
import {taskSession,isTaskSession,taskError,taskDbError,noStore} from "@/lib/server/tasks/auth";

export const dynamic="force-dynamic";
const colors=new Set(["slate","blue","green","amber","red","purple"]);
export async function GET(request:NextRequest){
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 const {data,error}=await session.db.rpc("task_categories_list",{p_actor_id:session.userId});
 if(error)return taskDbError(error.code);
 return NextResponse.json({ok:true,items:data||[]},{headers:noStore});
}
export async function POST(request:NextRequest){
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 if(Number(request.headers.get("content-length")||0)>2000)return taskError("Payload too large.",413);
 const body:unknown=await request.json().catch(()=>null);
 if(!body||typeof body!=="object"||Array.isArray(body))return taskError("Invalid category.",400);
 const input=body as Record<string,unknown>;
 if(Object.keys(input).some(k=>!["name","color","icon"].includes(k)))return taskError("Unsupported category field.",400);
 if(typeof input.name!=="string"||!input.name.trim()||input.name.trim().length>80)return taskError("Category name must contain 1–80 characters.",400);
 if(input.color!==undefined&&(typeof input.color!=="string"||!colors.has(input.color)))return taskError("Invalid colour.",400);
 if(input.icon!==undefined&&(typeof input.icon!=="string"||!input.icon.trim()||input.icon.length>40))return taskError("Invalid icon.",400);
 const {data,error}=await session.db.rpc("task_category_create",{
  p_actor_id:session.userId,p_name:input.name.trim(),p_color:input.color||"slate",p_icon:input.icon||"folder"
 });
 if(error)return taskDbError(error.code);
 return NextResponse.json({ok:true,item:data},{status:201,headers:noStore});
}
