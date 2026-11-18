import {NextRequest,NextResponse} from "next/server";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
import {readBrandingEntitlement,updateBrandingEntitlement} from "@/lib/server/saas/branding-entitlements";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
function fail(e:unknown){
 const status=e instanceof SaaSAccessError?e.status:503;
 return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Branding entitlement service unavailable"},{status,headers});
}
export async function GET(request:NextRequest){
 try{
  const organizationId=request.nextUrl.searchParams.get("organizationId")||"";
  const entitlement=await readBrandingEntitlement(request.headers.get("authorization"),organizationId);
  return NextResponse.json({ok:true,...entitlement},{headers});
 }catch(e){return fail(e);}
}
export async function POST(request:NextRequest){
 try{
  if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
   return NextResponse.json({ok:false,error:"JSON required"},{status:415,headers});
  const body:unknown=await request.json().catch(()=>null);
  if(!body||typeof body!=="object"||Array.isArray(body))
   throw new SaaSAccessError(400,"Valid branding level required");
  const payload=body as Record<string,unknown>;
  if(typeof payload.organizationId!=="string")
   throw new SaaSAccessError(400,"Valid organizationId required");
  const entitlement=await updateBrandingEntitlement(request.headers.get("authorization"),payload.organizationId,payload.level);
  return NextResponse.json({ok:true,...entitlement},{headers});
 }catch(e){return fail(e);}
}
