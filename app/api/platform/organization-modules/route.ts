import {NextRequest,NextResponse} from "next/server";
import {getAuthorizedModuleEntitlements,SaaSAccessError} from "@/lib/server/saas/organization-context";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
export async function GET(request:NextRequest){
 try{
  const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"").trim()??"";
  const organizationId=request.nextUrl.searchParams.get("organizationId")??"";
  if(!organizationId)return NextResponse.json({ok:false,error:"organizationId required"},{status:400,headers});
  const result=await getAuthorizedModuleEntitlements(token,organizationId);
  return NextResponse.json({ok:true,organizationId:result.organization.id,modules:result.modules},{headers});
 }catch(error){
  const status=error instanceof SaaSAccessError?error.status:503;
  return NextResponse.json({ok:false,error:error instanceof SaaSAccessError?error.message:"Entitlements unavailable"},{status,headers});
 }
}
