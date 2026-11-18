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
  // Both RPCs independently verify active membership / Platform Admin against the same actor.
  const [{data,error},{data:tier,error:tierError}]=await Promise.all([
   db.rpc("saas_branding_view_v1",{p_actor:userId,p_org:id}),
   db.rpc("saas_branding_tier_read_v1",{p_actor:userId,p_org:id})
  ]);
  if(tierError?.code==="42501")throw new SaaSAccessError(403,"Organization is not accessible");
  if(tierError||!tier||tier.organizationId!==id||!["standard","custom","white_label"].includes(tier.level))
   throw new SaaSAccessError(503,"Branding entitlement unavailable");
  if(error)throw new SaaSAccessError(503,"Tenant branding unavailable");
  if(!data)throw new SaaSAccessError(403,"Organization is not accessible");
  const branding=parseTenantBranding({...data,level:tier.level});
  if(!branding)throw new SaaSAccessError(503,"Invalid organization branding");
  return NextResponse.json({ok:true,branding},{headers});
 }catch(e){
  const status=e instanceof SaaSAccessError?e.status:503;
  return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Branding unavailable"},{status,headers});
 }
}
