import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
type Context={params:Promise<{tenantId:string}>};
const allowedRead=new Set(["list","segments","duplicates","get"]);
const allowedWrite=new Set(["edit","consent","bulk","save_segment","delete_segment","dismiss_duplicate","merge"]);
export async function GET(request:NextRequest,{params}:Context){
 const {tenantId}=await params;
 if(!uuid(tenantId))return connectFailure("Invalid workspace.",400);
 const auth=await connectSession(request);if(!isConnectSession(auth))return auth;
 const q=request.nextUrl.searchParams;
 const action=q.get("action")||"list";
 if(!allowedRead.has(action))return connectFailure("Invalid contact operation.",400);
 const raw=q.get("filters")||"{}";
 if(raw.length>1500)return connectFailure("Filters are too long.",400);
 let filters:unknown;
 try{filters=JSON.parse(raw);}catch{return connectFailure("Invalid contact filters.",400);}
 if(!filters||typeof filters!=="object"||Array.isArray(filters))return connectFailure("Invalid filters.",400);
 const offset=Number(q.get("offset")||"0");
 if(!Number.isSafeInteger(offset)||offset<0||offset>100000)return connectFailure("Invalid page.",400);
 const personId=q.get("id");
 if(action==="get"&&!uuid(personId))return connectFailure("Invalid contact.",400);
 const result=await invokeConnect<Record<string,unknown>>(auth,
  action==="get"?"connect_contact_management_detail":"connect_manage_contacts",
  action==="get"?{p_actor_id:auth.actorId,p_tenant_id:tenantId,p_person_id:personId}
  :{p_actor_id:auth.actorId,p_tenant_id:tenantId,p_action:action,p_data:{filters,offset,limit:Math.min(100,Math.max(1,Number(q.get("limit")||"50")||50))}}
 );
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,...(result.data||{})},{headers:noStore});
}
export async function POST(request:NextRequest,{params}:Context){
 const {tenantId}=await params;
 if(!uuid(tenantId))return connectFailure("Invalid workspace.",400);
 const auth=await connectSession(request);if(!isConnectSession(auth))return auth;
 if(Number(request.headers.get("content-length")||0)>50000)return connectFailure("Contact request too large.",413);
 const body:unknown=await request.json().catch(()=>null);
 if(!body||typeof body!=="object"||Array.isArray(body))return connectFailure("Invalid contact request.",400);
 const data=body as Record<string,unknown>;
 const action=typeof data.action==="string"?data.action:"";
 if(!allowedWrite.has(action))return connectFailure("Unsupported contact operation.",400);
 if(action==="edit"||action==="consent"){
  if(!uuid(data.id))return connectFailure("Invalid contact.",400);
 }
 if(action==="bulk"&&(!Array.isArray(data.ids)||data.ids.length>100||!data.ids.every(uuid)))
  return connectFailure("Select no more than 100 valid contacts.",400);
 if(action==="delete_segment"&&!uuid(data.id))return connectFailure("Invalid segment.",400);
 if(action==="merge"&&(!uuid(data.keepId)||!uuid(data.mergeId)||data.keepId===data.mergeId))return connectFailure("Choose two valid contacts.",400);
 if(action==="dismiss_duplicate"&&(!uuid(data.firstId)||!uuid(data.secondId)))
  return connectFailure("Invalid duplicate pair.",400);
 const result=await invokeConnect<Record<string,unknown>>(auth,action==="merge"?"connect_merge_contacts":"connect_manage_contacts",
  action==="merge"?{p_actor_id:auth.actorId,p_tenant_id:tenantId,p_keep_id:data.keepId,p_merge_id:data.mergeId}
  :{p_actor_id:auth.actorId,p_tenant_id:tenantId,p_action:action,p_data:data}
 );
 if(result.error){
  if(action==="merge"&&result.error.startsWith("Cannot merge: source contact has connected CRM history"))
   return connectFailure("This duplicate has related enquiries, messages, admissions or other history. Automatic merging is blocked; reconcile its records manually.",409);
  return connectRpcFailure(result.error,result.code);
 }
 return NextResponse.json({ok:true,...(result.data||{})},{headers:noStore});
}