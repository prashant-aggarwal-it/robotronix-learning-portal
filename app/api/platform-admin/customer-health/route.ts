import {NextRequest,NextResponse} from "next/server";
import {requirePlatformAdmin} from "@/lib/server/saas/platform-admin";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
export async function GET(req:NextRequest){
 try {
  const {db}=await requirePlatformAdmin(req.headers.get("authorization"));
  const {data,error}=await db.rpc("saas_platform_customer_health_v1");
  if(error){console.error("Platform customer health RPC",error.code);throw new SaaSAccessError(503,"Customer and integration health unavailable");}
  if(!data||typeof data!=="object")throw new SaaSAccessError(503,"Customer and integration health unavailable");
  return NextResponse.json({ok:true,...data},{headers});
 } catch(e){
  return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Health unavailable"},{status:e instanceof SaaSAccessError?e.status:503,headers});
 }
}
