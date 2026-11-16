import {NextRequest,NextResponse} from "next/server";
import {requirePlatformAdmin} from "@/lib/server/saas/platform-admin";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
export async function GET(request:NextRequest){
 try{
  const {db,userId}=await requirePlatformAdmin(request.headers.get("authorization"));
  const rawPage=request.nextUrl.searchParams.get("page")||"1";
  if(!/^[1-9][0-9]{0,4}$/.test(rawPage))throw new SaaSAccessError(400,"Invalid page");
  const page=Number(rawPage);
  const search=(request.nextUrl.searchParams.get("search")||"").trim();
  if(search.length>80)throw new SaaSAccessError(400,"Search too long");
  const {data,error}=await db.rpc("saas_platform_overview_v1",{p_actor_id:userId,p_limit:20,p_offset:(page-1)*20,p_search:search});
  if(error)throw new SaaSAccessError(error.code==="42501"?403:503,"Platform overview unavailable");
  return NextResponse.json({ok:true,...data,page},{headers});
 }catch(e){
  const status=e instanceof SaaSAccessError?e.status:503;
  return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Platform overview unavailable"},{status,headers});
 }
}
