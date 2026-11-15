import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {randomBytes,createHash} from "node:crypto";
import {getAuthorizedOrganizations,readBearerToken,resolveAuthorizedOrganization,SaaSAccessError} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
function failure(e:unknown){const status=e instanceof SaaSAccessError?e.status:503;return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Invitation service unavailable"},{status,headers});}
function adminClient(){const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new SaaSAccessError(503,"Invitation service unavailable");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
export async function POST(request:NextRequest){
 try{
  const token=readBearerToken(request.headers.get("authorization"));
  const {userId,organizations}=await getAuthorizedOrganizations(token);
  const body=await request.json().catch(()=>null);
  const organizationId=typeof body?.organizationId==="string"?body.organizationId:"";
  const email=typeof body?.email==="string"?body.email.trim().toLowerCase():"";
  const role=typeof body?.role==="string"?body.role:"";
  const org=resolveAuthorizedOrganization(organizations,organizationId);
  if(!org)throw new SaaSAccessError(403,"Select your organization");
  if(!["owner","admin"].includes(org.role)||org.role==="admin"&&["owner","admin"].includes(role))
   throw new SaaSAccessError(403,"You cannot invite this role");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!["admin","staff","trainer","member"].includes(role))
   throw new SaaSAccessError(400,"Invalid invitation details");
  const secret=randomBytes(32).toString("hex");
  const hash=createHash("sha256").update(secret).digest("hex");
  const db=adminClient();
  const {error}=await db.rpc("saas_create_invitation_v1",{p_actor_id:userId,p_organization_id:org.id,p_email:email,p_role_key:role,p_token_sha256:hash});
  if(error)throw new SaaSAccessError(error.code==="42501"?403:400,"Unable to create invitation");
  const invitationUrl=new URL("/invite?token="+encodeURIComponent(secret),request.nextUrl.origin).toString();
  return NextResponse.json({ok:true,invitationUrl,delivery:"Copy and securely share this invitation link with the intended recipient. Automatic email delivery is not configured."},{status:201,headers});
 }catch(e){return failure(e);}
}