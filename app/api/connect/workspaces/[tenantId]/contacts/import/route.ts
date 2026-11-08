import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";

export const dynamic="force-dynamic";
type Ctx={params:Promise<{tenantId:string}>};
export async function GET(request:NextRequest,{params}:Ctx){
 const {tenantId}=await params;
 if(!uuid(tenantId))return connectFailure("Invalid workspace.",400);
 const auth=await connectSession(request);if(!isConnectSession(auth))return auth;
 const result=await invokeConnect<{items:unknown[]}>(auth,"connect_contacts_import",{
  p_actor_id:auth.actorId,p_tenant_id:tenantId,p_action:"history",p_data:{}
 });
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,items:result.data?.items??[]},{headers:noStore});
}
export async function POST(request:NextRequest,{params}:Ctx){
 const {tenantId}=await params;
 if(!uuid(tenantId))return connectFailure("Invalid workspace.",400);
 const auth=await connectSession(request);if(!isConnectSession(auth))return auth;
 const length=Number(request.headers.get("content-length")||"0");
 if(length>95000)return connectFailure("Import batch is too large.",413);
 const body:unknown=await request.json().catch(()=>null);
 if(!body||typeof body!=="object"||Array.isArray(body))return connectFailure("Invalid import request.",400);
 const data=body as Record<string,unknown>;
 if(!["start","chunk","finish"].includes(String(data.action)))return connectFailure("Unsupported import operation.",400);
 if(data.action==="chunk"){
  if(!uuid(data.batchId)||!Array.isArray(data.rows)||!data.rows.length||data.rows.length>50)
   return connectFailure("Invalid import chunk.",400);
  if(JSON.stringify(data.rows).length>78000)return connectFailure("Import chunk exceeds permitted size.",413);
 }
 if(data.action==="finish"&&!uuid(data.batchId))return connectFailure("Invalid batch reference.",400);
 if(data.action==="start"&&(
  typeof data.fileName!=="string"||typeof data.sourceLabel!=="string"||typeof data.sourceType!=="string"
 ))return connectFailure("Invalid source details.",400);
 const result=await invokeConnect<Record<string,unknown>>(auth,"connect_contacts_import",{
  p_actor_id:auth.actorId,p_tenant_id:tenantId,p_action:data.action as string,p_data:data
 });
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,...(result.data||{})},{headers:noStore});
}
