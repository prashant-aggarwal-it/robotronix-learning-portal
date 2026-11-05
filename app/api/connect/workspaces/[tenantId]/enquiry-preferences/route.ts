import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{tenantId:string}>};
async function handle(req:NextRequest,ctx:Ctx,write:boolean){
 const {tenantId}=await ctx.params;if(!uuid(tenantId))return connectFailure("Invalid institute",400);
 const session=await connectSession(req);if(!isConnectSession(session))return session;
 let action="read",data:Record<string,unknown>={};
 if(write){
  const raw:unknown=await req.json().catch(()=>null);
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||JSON.stringify(raw).length>2000)
   return connectFailure("Invalid request",400);
  const body=raw as Record<string,unknown>;
  if(!["set_mode","add_category","rename_category","set_category_active","classify_inquiry"].includes(String(body.action)))
   return connectFailure("Unknown action",400);
  if(!body.data||typeof body.data!=="object"||Array.isArray(body.data))return connectFailure("Invalid data",400);
  action=String(body.action);data=body.data as Record<string,unknown>;
  if(["rename_category","set_category_active"].includes(action)&&!uuid(data.id))return connectFailure("Invalid category",400);
  if(action==="classify_inquiry"&&(!uuid(data.inquiryId)||!uuid(data.categoryId)))return connectFailure("Invalid enquiry/category",400);
 }
 const result=await invokeConnect<{mode:string;categories:Array<{id:string;label:string;active:boolean;sortOrder:number}>}>(session,"connect_enquiry_preferences",{
  p_actor_id:session.actorId,p_tenant_id:tenantId,p_action:action,p_data:data
 });
 if(result.error)return connectRpcFailure(result.error,result.code);
 return NextResponse.json({ok:true,preferences:result.data},{headers:noStore});
}
export async function GET(req:NextRequest,ctx:Ctx){return handle(req,ctx,false);}
export async function PATCH(req:NextRequest,ctx:Ctx){return handle(req,ctx,true);}
