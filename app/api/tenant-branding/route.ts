import {NextRequest,NextResponse} from "next/server";
import {verifiedBrandingActor,ORG_ID} from "@/lib/server/saas/branding-auth";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
import {parseTenantBranding} from "@/lib/theme/tenant-runtime";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization, Cookie"};
export async function GET(request:NextRequest){
 try{
  const id=request.nextUrl.searchParams.get("organizationId")||"";
  if(!ORG_ID.test(id))throw new SaaSAccessError(400,"Valid organization required");
  const {db,userId}=await verifiedBrandingActor(request.headers.get("authorization"));
  const {data,error}=await db.rpc("saas_branding_view_v1",{p_actor:userId,p_org:id});
  if(error)throw new SaaSAccessError(503,"Tenant branding unavailable");
  if(!data)throw new SaaSAccessError(403,"Organization is not accessible");
  const branding=parseTenantBranding(data);
  if(!branding)throw new SaaSAccessError(503,"Invalid organization branding");
  return NextResponse.json({ok:true,branding},{headers});
 }catch(e){
  const status=e instanceof SaaSAccessError?e.status:503;
  return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Branding unavailable"},{status,headers});
 }
}
