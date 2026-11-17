import {NextRequest,NextResponse} from "next/server";
import {verifiedBrandingActor} from "@/lib/server/saas/branding-auth";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
 try{
  const {db,userId}=await verifiedBrandingActor(request.headers.get("authorization"));
  const {data,error}=await db.rpc("saas_branding_owner_organizations_v1",{p_actor:userId});
  if(error)throw new SaaSAccessError(503,"Owner organizations unavailable");
  return NextResponse.json({ok:true,organizations:Array.isArray(data)?data:[]},{headers});
 }catch(e){
  return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Owner organizations unavailable"},
   {status:e instanceof SaaSAccessError?e.status:503,headers});
 }
}
