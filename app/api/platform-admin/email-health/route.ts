import {NextRequest,NextResponse} from "next/server";
import {requirePlatformAdmin} from "@/lib/server/saas/platform-admin";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(request:NextRequest){
 try{
  const {db}=await requirePlatformAdmin(request.headers.get("authorization"));
  const organizationId=request.nextUrl.searchParams.get("organizationId");
  if(organizationId&&!uuid.test(organizationId))throw new SaaSAccessError(400,"Invalid organization");
  // Server-only service-role RPC: no public exposure of saas tables.
  const {data,error}=await db.rpc("saas_platform_monitor_read_v1",{p_kind:"email_health",p_organization_id:organizationId||null});
  if(error){console.error("platform email health RPC",error.code);throw new SaaSAccessError(503,"Delivery health unavailable");}
  return NextResponse.json({ok:true,...data},{headers});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Email health unavailable"},{status:e instanceof SaaSAccessError?e.status:503,headers});}
}
