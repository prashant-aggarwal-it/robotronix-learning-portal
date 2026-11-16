import {NextRequest,NextResponse} from "next/server";
import {requirePlatformAdmin} from "@/lib/server/saas/platform-admin";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
export async function GET(request:NextRequest){
 try{
  const {db}=await requirePlatformAdmin(request.headers.get("authorization"));
  const page=Math.max(1,Math.min(100000,Number(request.nextUrl.searchParams.get("page")||1)||1));
  const search=(request.nextUrl.searchParams.get("search")||"").trim().slice(0,80);
  let query=db.from("organizations").schema("saas").select("id,slug,display_name,status,created_at",{count:"exact"}).order("created_at",{ascending:false}).range((page-1)*20,page*20-1);
  if(search)query=query.ilike("display_name","%"+search.replace(/[%_,()]/g,"")+"%");
  const {data,error,count}=await query;
  if(error)throw new SaaSAccessError(503,"Organizations unavailable");
  const {count:trialCount,error:trialError}=await db.schema("saas").from("platform_subscriptions").select("id",{head:true,count:"exact"}).eq("status","trial");
  if(trialError)throw new SaaSAccessError(503,"Subscription metrics unavailable");
  const {count:activeCount,error:activeError}=await db.schema("saas").from("platform_subscriptions").select("id",{head:true,count:"exact"}).eq("status","active");
  if(activeError)throw new SaaSAccessError(503,"Subscription metrics unavailable");
  const {count:orgCount,error:orgError}=await db.schema("saas").from("organizations").select("id",{head:true,count:"exact"});
  if(orgError)throw new SaaSAccessError(503,"Organization metrics unavailable");
  return NextResponse.json({ok:true,organizations:data||[],page,total:count??0,metrics:{organizations:orgCount??0,trials:trialCount??0,activeSubscriptions:activeCount??0}},{headers});
 }catch(e){
  const status=e instanceof SaaSAccessError?e.status:503;
  return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Platform overview unavailable"},{status,headers});
 }
}
