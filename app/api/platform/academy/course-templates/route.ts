import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {readBearerToken,requireAuthorizedTenantRole,SaaSAccessError} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization, Cookie"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(request:NextRequest){
 try{
  const organizationId=request.nextUrl.searchParams.get("organizationId")??"";
  if(!uuid.test(organizationId))return NextResponse.json({ok:false,error:"Valid organizationId required"},{status:400,headers});
  const {userId}=await requireAuthorizedTenantRole(readBearerToken(request.headers.get("authorization")),
   organizationId,"academy",["owner","admin"]);
  const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new SaaSAccessError(503,"Academy service unavailable");
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.rpc("saas_academy_available_templates",{
   p_actor_id:userId,p_organization_id:organizationId
  });
  if(error)return NextResponse.json({ok:false,error:"Shared catalog unavailable"},{status:503,headers});
  return NextResponse.json({ok:true,organizationId,templates:Array.isArray(data)?data:[]},{headers});
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof SaaSAccessError?error.message:"Academy service unavailable"},
   {status:error instanceof SaaSAccessError?error.status:503,headers});
 }
}
