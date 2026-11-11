import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession,connectFailure,connectRpcFailure,invokeConnect,noStore,uuid} from "@/lib/server/connect-auth";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{tenantId:string}>};
type Member={member_id:string;member_user_id:string;member_role:string;member_status:string};
export async function GET(request:NextRequest,{params}:Ctx){
 const {tenantId}=await params;
 if(!uuid(tenantId))return connectFailure("Invalid institute",400);
 const auth=await connectSession(request);
 if(!isConnectSession(auth))return auth;
 const result=await invokeConnect<Member[]>(auth,"connect_workspace_members",{
  p_actor_id:auth.actorId,p_tenant_id:tenantId
 });
 if(result.error)return connectRpcFailure(result.error,result.code);
 const active=(result.data||[]).filter(m=>m.member_status==="active"&&m.member_role!=="viewer").slice(0,100);
 const assignees=await Promise.all(active.map(async m=>{
  let label=m.member_role+" · "+m.member_user_id.slice(0,8);
  try{
   const {data,error}=await auth.admin.auth.admin.getUserById(m.member_user_id);
   if(!error&&data?.user){
    const metadata=data.user.user_metadata||{};
    const display=typeof metadata.full_name==="string"&&metadata.full_name.trim()?metadata.full_name.trim():data.user.email;
    if(display)label=display;
   }
  }catch{ /* fallback is non-sensitive member identifier */ }
  return {id:m.member_id,label,role:m.member_role};
 }));
 return NextResponse.json({ok:true,assignees},{headers:noStore});
}
