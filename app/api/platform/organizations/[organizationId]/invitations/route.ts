import crypto from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getAuthorizedOrganizations,readBearerToken,resolveAuthorizedOrganization,SaaSAccessError} from "@/lib/server/saas/organization-context";
import {roleHasCapability} from "@/lib/server/saas/role-capabilities.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization, Cookie"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request:NextRequest,context:{params:Promise<{organizationId:string}>}) {
 try {
  const {organizationId}=await context.params;
  if(!uuid.test(organizationId))return NextResponse.json({ok:false,error:"Invalid organization"},{status:400,headers});
  if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))return NextResponse.json({ok:false,error:"JSON required"},{status:415,headers});
  const body:unknown=await request.json().catch(()=>null);
  if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({ok:false,error:"Invalid invitation"},{status:400,headers});
  const {email,role}=body as {email?:unknown;role?:unknown};
  if(typeof email!=="string"||email.trim().length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())||
    typeof role!=="string"||!["owner","admin","staff","trainer","member"].includes(role))
   return NextResponse.json({ok:false,error:"Valid email and role required"},{status:400,headers});
  const bearer=readBearerToken(request.headers.get("authorization"));
  const {userId,organizations}=await getAuthorizedOrganizations(bearer);
  const org=resolveAuthorizedOrganization(organizations,organizationId);
  if(!org||!roleHasCapability(org.role,"saas.members.manage"))throw new SaaSAccessError(403,"Invitation not authorized");
  const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!secret)throw new SaaSAccessError(503,"Service unavailable");
  const token=crypto.randomBytes(32).toString("base64url");
  const tokenSha256=crypto.createHash("sha256").update(token).digest("hex");
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.rpc("saas_create_invitation_v1",{
   p_actor_id:userId,p_organization_id:organizationId,p_email:email.trim().toLowerCase(),
   p_role_key:role,p_token_sha256:tokenSha256
  });
  if(error)return NextResponse.json({ok:false,error:error.code==="42501"?"Invitation not authorized":error.code==="22023"?"Invalid invitation":"Invitation service unavailable"},{status:error.code==="42501"?403:error.code==="22023"?400:503,headers});
  return NextResponse.json({ok:true,invitationId:data,acceptToken:token,delivery:"manual_secure_share",expiresInDays:7},{status:201,headers});
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof SaaSAccessError?error.message:"Invitation service unavailable"},{status:error instanceof SaaSAccessError?error.status:503,headers});
 }
}
