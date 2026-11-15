import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getAuthorizedOrganizations,readBearerToken,resolveAuthorizedOrganization,SaaSAccessError} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
function fail(e:unknown){return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Membership service unavailable"},{status:e instanceof SaaSAccessError?e.status:503,headers});}
function admin(){const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new SaaSAccessError(503,"Membership service unavailable");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
async function authorize(request:NextRequest,orgId:string){
 const {userId,organizations}=await getAuthorizedOrganizations(readBearerToken(request.headers.get("authorization")));
 const org=resolveAuthorizedOrganization(organizations,orgId);
 if(!org||!["owner","admin"].includes(org.role))throw new SaaSAccessError(403,"Organization admin required");
 return {userId,org};
}
export async function GET(request:NextRequest){
 try{
  const {org}=await authorize(request,request.nextUrl.searchParams.get("organizationId")||"");
  const db=admin();
  const {data,error}=await db.schema("saas").from("memberships")
   .select("id,user_id,role_key,status,created_at").eq("organization_id",org.id).order("created_at",{ascending:true});
  if(error)throw new SaaSAccessError(503,"Members unavailable");
  const members=await Promise.all((data??[]).map(async m=>{
   const {data:user}=await db.auth.admin.getUserById(m.user_id);
   return {...m,email:user?.user?.email||null};
  }));
  return NextResponse.json({ok:true,members},{headers});
 }catch(e){return fail(e);}
}
export async function PATCH(request:NextRequest){
 try{
  const body=await request.json().catch(()=>null);
  const {userId,org}=await authorize(request,body?.organizationId??"");
  if(typeof body?.membershipId!=="string"||!["owner","admin","staff","trainer","member"].includes(body?.role)||!["active","suspended","removed"].includes(body?.status))
   throw new SaaSAccessError(400,"Invalid role or membership status");
  const {data,error}=await admin().rpc("saas_manage_membership_v1",{p_actor_id:userId,p_organization_id:org.id,p_membership_id:body.membershipId,p_role_key:body.role,p_status:body.status});
  if(error||data!==true)throw new SaaSAccessError(error?.code==="42501"?403:400,"Membership change rejected");
  return NextResponse.json({ok:true},{headers});
 }catch(e){return fail(e);}
}