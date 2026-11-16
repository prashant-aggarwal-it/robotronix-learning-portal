import {NextRequest,NextResponse} from "next/server";
import {requirePlatformAdmin} from "@/lib/server/saas/platform-admin";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request:NextRequest){
 try{
  const {db,userId}=await requirePlatformAdmin(request.headers.get("authorization"));
  const body=await request.json().catch(()=>null);
  if(!body||typeof body.organizationId!=="string"||!uuid.test(body.organizationId)||
    typeof body.tagline!=="string"||typeof body.logoUrl!=="string"||typeof body.accentColor!=="string"||
    body.tagline.length>180||body.logoUrl.length>600||!/^#[0-9a-fA-F]{6}$/.test(body.accentColor))
   throw new SaaSAccessError(400,"Invalid branding");
  const {data,error}=await db.rpc("saas_platform_configure_first_tenant_v1",{
   p_actor_id:userId,p_organization_id:body.organizationId,p_tagline:body.tagline,
   p_logo_url:body.logoUrl,p_accent_color:body.accentColor
  });
  if(error)throw new SaaSAccessError(error.code==="42501"?403:400,"Branding update rejected");
  return NextResponse.json({ok:true,...data},{headers});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Branding unavailable"},{status:e instanceof SaaSAccessError?e.status:503,headers})}
}
