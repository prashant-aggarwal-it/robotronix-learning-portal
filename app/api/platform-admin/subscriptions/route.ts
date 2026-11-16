import {NextRequest,NextResponse} from "next/server";
import {requirePlatformAdmin} from "@/lib/server/saas/platform-admin";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(e:unknown){return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Subscription unavailable"},{status:e instanceof SaaSAccessError?e.status:503,headers})}
export async function GET(request:NextRequest){
 try{
  const {db,userId}=await requirePlatformAdmin(request.headers.get("authorization"));
  const organizationId=request.nextUrl.searchParams.get("organizationId")||"";
  if(!uuid.test(organizationId))throw new SaaSAccessError(400,"Invalid organization");
  const {data,error}=await db.rpc("saas_platform_subscription_overview_v1",{p_actor_id:userId,p_organization_id:organizationId});
  if(error)throw new SaaSAccessError(error.code==="42501"?403:503,"Subscription unavailable");
  return NextResponse.json({ok:true,...data},{headers});
 }catch(e){return fail(e)}
}
export async function POST(request:NextRequest){
 try{
  const {db,userId}=await requirePlatformAdmin(request.headers.get("authorization"));
  const body=await request.json().catch(()=>null);
  if(!body||!uuid.test(body.organizationId||"")||typeof body.action!=="string")throw new SaaSAccessError(400,"Invalid subscription operation");
  const actions=["extend_trial","activate","mark_past_due","suspend","cancel","resume","set_module"];
  if(!actions.includes(body.action))throw new SaaSAccessError(400,"Unsupported operation");
  if(body.action==="set_module"&&(!["academy","crm","tasks"].includes(body.moduleKey)||typeof body.enabled!=="boolean"))
   throw new SaaSAccessError(400,"Invalid module");
  const needsEnd=body.action==="extend_trial"||body.action==="activate";
  const endAt=needsEnd&&typeof body.endAt==="string"?new Date(body.endAt):null;
  if(needsEnd&&(!endAt||!Number.isFinite(endAt.getTime())||endAt.getTime()<=Date.now()))
   throw new SaaSAccessError(400,"Choose a future end date");
  if(body.action==="activate"&&(typeof body.planCode!=="string"||!/^[a-z][a-z0-9_]{1,39}$/.test(body.planCode)||body.planCode==="trial"))
   throw new SaaSAccessError(400,"Invalid plan");
  const {data,error}=await db.rpc("saas_platform_subscription_manage_v1",{
   p_actor_id:userId,p_organization_id:body.organizationId,p_action:body.action,
   p_plan_code:body.action==="activate"?body.planCode:null,p_end_at:endAt?.toISOString()??null,
   p_module_key:body.action==="set_module"?body.moduleKey:null,
   p_enabled:body.action==="set_module"?body.enabled:null
  });
  if(error)throw new SaaSAccessError(error.code==="42501"?403:400,"Subscription operation rejected");
  return NextResponse.json({ok:true,result:data},{headers});
 }catch(e){return fail(e)}
}
