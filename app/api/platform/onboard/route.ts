import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {readBearerToken,SaaSAccessError} from "@/lib/server/saas/organization-context";
import {platformService,requirePlatformAdmin} from "@/lib/server/saas/platform-admin";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
function fail(e:unknown){return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Onboarding unavailable"},{status:e instanceof SaaSAccessError?e.status:503,headers});}
export async function POST(request:NextRequest){
 try{
  const bearer=readBearerToken(request.headers.get("authorization"));
  if(!bearer)throw new SaaSAccessError(401,"Sign in first");
  const body=await request.json().catch(()=>null);
  if(!body||typeof body.name!=="string"||typeof body.slug!=="string"||
   !["academy","institute","tutor"].includes(body.kind)||
   !Array.isArray(body.modules)||body.modules.length<1||body.modules.length>3||
   !body.modules.every((m:unknown)=>["academy","crm","tasks"].includes(String(m)))||
   typeof body.requestKey!=="string"||!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(body.requestKey))
   throw new SaaSAccessError(400,"Invalid onboarding details");
  const assisted=body.assisted===true;
  const db=platformService();
  const {data:{user},error:authError}=await db.auth.getUser(bearer);
  if(authError||!user||user.is_anonymous||!user.email_confirmed_at)throw new SaaSAccessError(401,"Verified sign-in required");
  let rpcClient;
  let ownerId=user.id;
  if(assisted){
   await requirePlatformAdmin(request.headers.get("authorization"));
   if(typeof body.ownerId!=="string"||!/^[0-9a-f-]{36}$/i.test(body.ownerId))throw new SaaSAccessError(400,"Existing verified owner ID required");
   ownerId=body.ownerId;
   rpcClient=db;
  }else{
   const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
   const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
   if(!url||!key)throw new SaaSAccessError(503,"Public Auth client unavailable");
   rpcClient=createClient(url,key,{global:{headers:{Authorization:"Bearer "+bearer}},auth:{persistSession:false,autoRefreshToken:false}});
  }
  const {data,error}=await rpcClient.rpc("saas_onboard_organization_v1",{
   p_actor_id:user.id,p_owner_id:ownerId,p_name:body.name,p_slug:body.slug,
   p_kind:body.kind,p_modules:body.modules,p_request_key:body.requestKey,p_assisted:assisted
  });
  if(error)throw new SaaSAccessError(error.code==="42501"?403:error.code==="23505"||error.code==="22023"||error.code==="23514"?400:503,error.code==="23505"?"Organization URL already taken":error.code==="23514"?"You already own an organization":error.code==="22023"?"Invalid organization details":"Onboarding unavailable");
  return NextResponse.json({ok:true,...data},{headers});
 }catch(e){return fail(e);}
}
