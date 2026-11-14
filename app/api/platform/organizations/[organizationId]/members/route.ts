import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getAuthorizedOrganizations,resolveAuthorizedOrganization,readBearerToken,SaaSAccessError} from "@/lib/server/saas/organization-context";
import {roleHasCapability} from "@/lib/server/saas/role-capabilities.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization, Cookie"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(request:NextRequest,context:{params:Promise<{organizationId:string}>}) {
 try {
  const {organizationId}=await context.params;
  if(!uuid.test(organizationId))return NextResponse.json({ok:false,error:"Invalid organization"},{status:400,headers});
  const bearer=readBearerToken(request.headers.get("authorization"));
  const {organizations}=await getAuthorizedOrganizations(bearer);
  const org=resolveAuthorizedOrganization(organizations,organizationId);
  if(!org||!roleHasCapability(org.role,"saas.members.manage"))
   throw new SaaSAccessError(403,"Membership access denied");
  const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new SaaSAccessError(503,"Service unavailable");
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.schema("saas").from("memberships").select("id,user_id,role_key,status,created_at")
   .eq("organization_id",organizationId).order("created_at",{ascending:true});
  if(error)throw new SaaSAccessError(503,"Membership list unavailable");
  return NextResponse.json({ok:true,organizationId,members:data??[]},{headers});
 } catch(error) {
  const status=error instanceof SaaSAccessError?error.status:503;
  return NextResponse.json({ok:false,error:error instanceof SaaSAccessError?error.message:"Service unavailable"},{status,headers});
 }
}
