import {NextRequest,NextResponse} from "next/server";
import {requirePlatformAdmin} from "@/lib/server/saas/platform-admin";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
export async function GET(request:NextRequest){
 try{
  const {db}=await requirePlatformAdmin(request.headers.get("authorization"));
  const emailParam=request.nextUrl.searchParams.get("email");
  if(emailParam!==null){
   const email=emailParam.trim().toLowerCase();
   if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new SaaSAccessError(400,"Invalid email");
   // Use bounded server-only Auth search, never expose the account directory.
   let userId:string|null=null;
   let exhausted=false;
   for(let page=1;page<=10;page++){
    const {data,error}=await db.auth.admin.listUsers({page,perPage:100});
    if(error)throw new SaaSAccessError(503,"Verified account lookup unavailable");
    const found=data.users.find(u=>u.email?.toLowerCase()===email&&!!u.email_confirmed_at&&!u.is_anonymous);
    if(found){userId=found.id;break;}
    if(data.users.length<100){exhausted=true;break;}
   }
   // A negative result after scanning the configured bound is not evidence that an account does not exist.
   return NextResponse.json({ok:true,verifiedUserId:userId,lookupLimited:userId===null&&!exhausted},{headers});
  }
  const {data:admins,error:adminError}=await db.schema("saas").from("platform_administrators")
   .select("user_id,role_key,active,created_at").order("created_at",{ascending:false}).limit(100);
  if(adminError)throw new SaaSAccessError(503,"Administrator directory unavailable");
  const {data:audit,error:auditError}=await db.schema("saas").from("platform_admin_audit")
   .select("id,actor_user_id,subject_user_id,action,occurred_at").order("occurred_at",{ascending:false}).limit(50);
  if(auditError)throw new SaaSAccessError(503,"Administrator audit unavailable");
  return NextResponse.json({ok:true,administrators:admins||[],audit:audit||[],truncated:(admins?.length??0)===100},{headers});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Platform administration unavailable"},{status:e instanceof SaaSAccessError?e.status:503,headers});}
}
