import {NextRequest,NextResponse} from "next/server";
import {taskSession,isTaskSession,taskError,taskDbError,noStore,isUuid} from "@/lib/server/tasks/auth";

export const dynamic="force-dynamic";
const modules=new Set(["connect","learning"]);
const resources:Record<string,Set<string>>={connect:new Set(["crm_task","crm_person","crm_opportunity"]),learning:new Set(["schedule_event"])};

export async function GET(request:NextRequest){
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 const module=request.nextUrl.searchParams.get("module"),tenant=request.nextUrl.searchParams.get("tenant_id");
 if(module&&!modules.has(module))return taskError("Invalid module.",400);
 if(tenant&&!isUuid(tenant))return taskError("Invalid workspace.",400);
 const {data,error}=await session.db.rpc("task_module_links_list",{p_actor_id:session.userId,p_module:module||null,p_tenant_id:tenant||null});
 if(error)return taskDbError(error.code);
 return NextResponse.json({ok:true,items:data||[]},{headers:noStore});
}

export async function POST(request:NextRequest){
 const session=await taskSession(request);if(!isTaskSession(session))return session;
 if(Number(request.headers.get("content-length")||0)>4096)return taskError("Payload too large.",413);
 const input:unknown=await request.json().catch(()=>null);
 if(!input||typeof input!=="object"||Array.isArray(input))return taskError("Invalid module link.",400);
 const {module,resource,resource_id,tenant_id}=input as Record<string,unknown>;
 if(typeof module!=="string"||!modules.has(module)||typeof resource!=="string"||!resources[module].has(resource)||!isUuid(resource_id)
  ||(module==="connect"&&!isUuid(tenant_id))||(module==="learning"&&tenant_id!==null&&tenant_id!==undefined))return taskError("Invalid module link.",400);
 const {data,error}=await session.db.rpc("task_module_link",{p_actor_id:session.userId,p_module:module,p_resource:resource,p_resource_id:resource_id,p_tenant_id:module==="connect"?tenant_id:null});
 if(error)return error.code==="42501"?taskError("This record is unavailable to your account.",403):taskDbError(error.code);
 return NextResponse.json({ok:true,item:data},{status:data?.created?201:200,headers:noStore});
}
