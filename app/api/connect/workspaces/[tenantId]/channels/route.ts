import crypto from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{tenantId:string}>};
export async function GET(req:NextRequest,{params}:Ctx){
 const {tenantId}=await params;if(!uuid(tenantId))return connectFailure("Invalid workspace",400);
 const auth=await connectSession(req);if(!isConnectSession(auth))return auth;
 const result=await invokeConnect<unknown[]>(auth,"connect_list_channels",{p_actor_id:auth.actorId,p_tenant_id:tenantId});
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,channels:result.data||[]},{headers:noStore});
}
export async function POST(req:NextRequest,{params}:Ctx){
 const {tenantId}=await params;if(!uuid(tenantId))return connectFailure("Invalid workspace",400);
 const auth=await connectSession(req);if(!isConnectSession(auth))return auth;
 const body=await req.json().catch(()=>null);
 if(!body||typeof body!=="object"||Array.isArray(body))return connectFailure("Invalid channel request",400);
 const provider=String(body.provider||"");
 const externalId=String(body.externalId||"").trim();
 const name=String(body.name||"").trim();
 if(!["website","email","whatsapp","meta_leads"].includes(provider)
 ||externalId.length<4||externalId.length>200||name.length<2||name.length>100)
  return connectFailure("Check the channel details",400);
 const result=await invokeConnect<string>(auth,"connect_register_channel",{
  p_actor_id:auth.actorId,p_tenant_id:tenantId,p_provider:provider,p_external_id:externalId,p_label:name
 });
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,channelId:result.data,status:"inactive"},{status:201,headers:noStore});
}
export async function PATCH(req:NextRequest,{params}:Ctx){
 const {tenantId}=await params;if(!uuid(tenantId))return connectFailure("Invalid workspace",400);
 const auth=await connectSession(req);if(!isConnectSession(auth))return auth;
 const body=await req.json().catch(()=>null);
 if(!body||!uuid(body.channelId)||!["active","inactive","disabled"].includes(body.status))
  return connectFailure("Invalid channel status update",400);
 // Never allow synthetic demonstration channel records to be enabled as live provider endpoints.
 if(body.status==="active"){
  const channels=await invokeConnect<Array<{id:string;externalId:string}>>(auth,"connect_list_channels",{
   p_actor_id:auth.actorId,p_tenant_id:tenantId
  });
  if(channels.error)return connectRpcFailure(channels.error,channels.code);
  const selected=channels.data?.find(channel=>channel.id===body.channelId);
  if(!selected)return connectFailure("Channel not found in this workspace.",404);
  if(selected.externalId.startsWith("demo-connect-"))
   return connectFailure("Demo channels cannot be activated. Register a real provider channel.",409);
 }
 const result=await invokeConnect<boolean>(auth,"connect_set_channel_status",{
  p_actor_id:auth.actorId,p_tenant_id:tenantId,p_channel_id:body.channelId,p_status:body.status
 });
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,updated:Boolean(result.data)},{headers:noStore});
}
