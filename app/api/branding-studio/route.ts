import {NextRequest,NextResponse} from "next/server";
import {authorizeBranding,ORG_ID} from "@/lib/server/saas/branding-auth";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
import {normalizeHexColor} from "@/lib/theme/tokens";
import {generatePalette,validatePublicLogoUrl} from "@/lib/theme/logo-palette";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
function failure(e:unknown){return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:e instanceof Error&&e.message==="Invalid branding"?"Invalid branding":"Branding unavailable"},{status:e instanceof SaaSAccessError?e.status:e instanceof Error&&e.message==="Invalid branding"?400:503,headers});}
export async function GET(request:NextRequest){
 try{
  const organizationId=new URL(request.url).searchParams.get("organizationId")||"";
  const {db,organization}=await authorizeBranding(request.headers.get("authorization"),organizationId);
  const {data,error}=await db.schema("saas").from("organization_settings").select("setting_key,setting_value")
   .eq("organization_id",organizationId).in("setting_key",["tagline","logo_url","accent_color","theme_palette"]);
  if(error)throw new Error("Branding unavailable");
  const values=Object.fromEntries((data||[]).map(x=>[x.setting_key,x.setting_value]));
  return NextResponse.json({ok:true,organization,branding:{
    tagline:typeof values.tagline==="string"?values.tagline:"",
    logoUrl:typeof values.logo_url==="string"?values.logo_url:"",
    accentColor:typeof values.accent_color==="string"?values.accent_color:"#4537a5",
    palette:values.theme_palette&&typeof values.theme_palette==="object"?values.theme_palette:null
  }},{headers});
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
  const {db,userId,platformAdmin,organization}=await authorizeBranding(request.headers.get("authorization"),body.organizationId);
  const palette=generatePalette(primary,secondary,accent);
  if(platformAdmin){
   const {error}=await db.rpc("saas_platform_configure_first_tenant_v1",{
     p_actor_id:userId,p_organization_id:organization.id,p_tagline:body.tagline.trim(),
     p_logo_url:body.logoUrl,p_accent_color:palette.primary
   });
   if(error)throw new SaaSAccessError(error.code==="42501"?403:400,"Branding update rejected");
  }else{
   // Owner authorization is checked against this exact organization before any service-role writes.
   const rows=[
    {organization_id:organization.id,setting_key:"tagline",setting_value:body.tagline.trim()},
    {organization_id:organization.id,setting_key:"logo_url",setting_value:body.logoUrl},
    {organization_id:organization.id,setting_key:"accent_color",setting_value:palette.primary}
   ];
   const {error}=await db.schema("saas").from("organization_settings")
    .upsert(rows,{onConflict:"organization_id,setting_key"});
   if(error)throw new Error("Branding save failed");
  }
  const {error:paletteError}=await db.schema("saas").from("organization_settings").upsert({
   organization_id:organization.id,setting_key:"theme_palette",setting_value:palette
  },{onConflict:"organization_id,setting_key"});
  if(paletteError)throw new Error("Theme save failed");
  return NextResponse.json({ok:true,organizationId:organization.id,slug:organization.slug,branding:{
    tagline:body.tagline.trim(),logoUrl:body.logoUrl,accentColor:palette.primary,palette
  }},{headers});
 }catch(e){return failure(e);}
}
