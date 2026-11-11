import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const auth=await connectSession(request);if(!isConnectSession(auth))return auth;
 const result=await invokeConnect<Array<{tenant_id:string;slug:string;workspace_name:string;tenant_status:string;membership_role:string}>>(auth,"connect_my_workspaces",{p_actor_id:auth.actorId});
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,workspaces:result.data||[]},{headers:noStore});
}
export async function POST(request:NextRequest){
 const auth=await connectSession(request);if(!isConnectSession(auth))return auth;
 const body=await request.json().catch(()=>null);
 if(!body||typeof body!=="object"||Array.isArray(body))return connectFailure("Invalid workspace request.",400);
 const name=typeof body.name==="string"?body.name.trim():"";
 const slug=typeof body.slug==="string"?body.slug.trim().toLowerCase():"";
 if(name.length<2||name.length>120||!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)||slug.length>80)
  return connectFailure("Enter a workspace name (2–120 characters) and a valid slug.",400);
 const result=await invokeConnect<string>(auth,"connect_create_workspace",{p_actor_id:auth.actorId,p_slug:slug,p_name:name});
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,workspaceId:result.data},{status:201,headers:noStore});
}
