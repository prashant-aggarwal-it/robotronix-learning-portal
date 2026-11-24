import {NextRequest,NextResponse} from "next/server";
import {requirePlatformAdmin} from "@/lib/server/saas/platform-admin";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
/** Full-platform preview, independent of directory page, search and pagination. */
export async function GET(request:NextRequest){
 try {
  const {db,userId}=await requirePlatformAdmin(request.headers.get("authorization"));
  const {data,error}=await db.rpc("saas_platform_customer_preview_v1",{p_actor_id:userId});
  if(error)throw new SaaSAccessError(error.code==="42501"?403:503,"Customer preview unavailable");
  return NextResponse.json({ok:true,organizations:Array.isArray(data)?data:[]},{headers});
 }catch(e){
  const status=e instanceof SaaSAccessError?e.status:503;
  return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Customer preview unavailable"},{status,headers});
 }
}
