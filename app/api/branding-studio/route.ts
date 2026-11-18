import {NextRequest,NextResponse} from "next/server";
import {authorizeBranding,authorizeBrandingWrite,ORG_ID} from "@/lib/server/saas/branding-auth";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
import {normalizeHexColor} from "@/lib/theme/tokens";
import {generatePalette,validatePublicLogoUrl} from "@/lib/theme/logo-palette";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
function failure(e:unknown){const status=e instanceof SaaSAccessError?e.status:503;return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Branding unavailable"},{status,headers});}
export async function GET(request:NextRequest){
 try{
  const organizationId=new URL(request.url).searchParams.get("organizationId")||"";
  const ctx=await authorizeBranding(request.headers.get("authorization"),organizationId);
  const {data:canEdit,error:accessError}=await ctx.db.rpc("saas_branding_write_access_v2",{p_actor:ctx.userId,p_org:organizationId});
  if(accessError)throw new SaaSAccessError(503,"Branding permission unavailable");
  const {organization,branding}=ctx;
  return NextResponse.json({ok:true,organization,branding,canEdit:canEdit===true},{headers});
 }catch(e){return failure(e);}
}
export async function POST(request:NextRequest){
 try{
  const body=await request.json().catch(()=>null);
  if(!body||!ORG_ID.test(body.organizationId||"")||typeof body.tagline!=="string"||body.tagline.trim().length>180||
   typeof body.logoUrl!=="string"||!validatePublicLogoUrl(body.logoUrl)||typeof body.primary!=="string"||
   typeof body.secondary!=="string"||typeof body.accent!=="string")
   throw new SaaSAccessError(400,"Invalid branding");
  const primary=normalizeHexColor(body.primary),secondary=normalizeHexColor(body.secondary),accent=normalizeHexColor(body.accent);
  if(!primary||!secondary||!accent)throw new SaaSAccessError(400,"Invalid palette colors");
  const {db,userId,organization}=await authorizeBrandingWrite(request.headers.get("authorization"),body.organizationId);
  const palette=generatePalette(primary,secondary,accent);
  const {data,error}=await db.rpc("saas_branding_save_v1",{
   p_actor:userId,p_org:organization.id,p_tagline:body.tagline.trim(),p_logo:body.logoUrl,
   p_primary:palette.primary,p_secondary:palette.secondary,p_accent:palette.accent,
   p_hover:palette.primaryHover,p_soft:palette.primarySoft,p_foreground:palette.onPrimary
  });
  if(error||!data?.ok)throw new SaaSAccessError(error?.code==="42501"?403:503,"Branding save rejected");
  return NextResponse.json({ok:true,organizationId:organization.id,slug:organization.slug,branding:{
   tagline:body.tagline.trim(),logoUrl:body.logoUrl,accentColor:palette.primary,palette
  }},{headers});
 }catch(e){return failure(e);}
}
