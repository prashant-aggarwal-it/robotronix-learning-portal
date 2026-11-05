import crypto from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{tenantId:string}>};
export async function GET(req:NextRequest,{params}:Ctx){
 const {tenantId}=await params;
 if(!uuid(tenantId))return connectFailure("Invalid workspace",400);
 const auth=await connectSession(req);if(!isConnectSession(auth))return auth;
 const result=await invokeConnect<unknown[]>(auth,"connect_list_form_keys",{
  p_actor_id:auth.actorId,p_tenant_id:tenantId
 });
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,forms:result.data||[]},{headers:noStore});
}
export async function POST(req:NextRequest,{params}:Ctx){
 const {tenantId}=await params;
 if(!uuid(tenantId))return connectFailure("Invalid workspace",400);
 const auth=await connectSession(req);if(!isConnectSession(auth))return auth;
 const body=await req.json().catch(()=>null);
 const channelId=body?.channelId,label=String(body?.label||"").trim();
 if(!uuid(channelId)||label.length<2||label.length>100)
  return connectFailure("Valid website channel and form label required",400);
 // The browser receives this public form identifier ONCE; only its SHA-256 is retained.
 const key=crypto.randomBytes(32).toString("base64url");
 const hash=crypto.createHash("sha256").update(key).digest("hex");
 const result=await invokeConnect<string>(auth,"connect_create_form_key",{
  p_actor_id:auth.actorId,p_tenant_id:tenantId,p_channel_id:channelId,p_token_hash:hash,p_label:label
 });
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,formId:result.data,formKey:key,
  endpoint:"/api/connect/public/forms/"+key,
  note:"Enable Cloudflare Turnstile on public forms before going live."},{status:201,headers:noStore});
}
export async function DELETE(req:NextRequest,{params}:Ctx){
 const {tenantId}=await params;if(!uuid(tenantId))return connectFailure("Invalid workspace",400);
 const auth=await connectSession(req);if(!isConnectSession(auth))return auth;
 const body=await req.json().catch(()=>null);
 if(!uuid(body?.formId))return connectFailure("Valid form ID required",400);
 const result=await invokeConnect<boolean>(auth,"connect_disable_form_key",{
  p_actor_id:auth.actorId,p_tenant_id:tenantId,p_key_id:body.formId
 });
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,disabled:Boolean(result.data)},{headers:noStore});
}
