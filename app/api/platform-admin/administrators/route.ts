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
  const {data,error}=await db.rpc("saas_platform_monitor_read_v1",{p_kind:"administrators",p_organization_id:null});
  if(error){console.error("platform administrator RPC",error.code);throw new SaaSAccessError(503,"Administrator directory unavailable");}
  const administrators=Array.isArray(data?.administrators)?data.administrators:[];
  // Enrich only the administrator records from the privileged RPC, never the general Auth directory.
  // Failed identity lookups must not hide the administrators or grant/revoke eligibility.
  const enriched=await Promise.all(administrators.slice(0,50).map(async(a:{user_id?:string;[key:string]:unknown})=>{
   if(typeof a.user_id!=="string")return {...a,email:null,display_name:null};
   try{
    const {data:account,error:accountError}=await db.auth.admin.getUserById(a.user_id);
    if(accountError||!account.user)return {...a,email:null,display_name:null};
    const user=account.user;
    const fullName=user.user_metadata?.full_name||user.user_metadata?.name||null;
    return {...a,email:typeof user.email==="string"?user.email:null,
     display_name:typeof fullName==="string"?fullName.slice(0,160):null};
   }catch{return {...a,email:null,display_name:null};}
  }));
  return NextResponse.json({ok:true,administrators:enriched,
   audit:Array.isArray(data?.audit)?data.audit:[],truncated:!!data?.truncated||administrators.length>50},{headers});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Platform administration unavailable"},{status:e instanceof SaaSAccessError?e.status:503,headers});}
}
