import {NextRequest,NextResponse} from "next/server";
import {authorizeBranding} from "@/lib/server/saas/branding-auth";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
import {detectRasterLogo,MAX_LOGO_BYTES} from "@/lib/theme/logo-file-validation";
export const runtime="nodejs";export const dynamic="force-dynamic";
const BUCKET="tenant-brand-logos";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
export async function POST(request:NextRequest){
 try{
  const organizationId=request.headers.get("x-branding-organization")||"";
  const {db,organization,branding}=await authorizeBranding(request.headers.get("authorization"),organizationId);
  const form=await request.formData();
  const uploaded=form.get("logo");
  if(!(uploaded instanceof File)||uploaded.size===0||uploaded.size>MAX_LOGO_BYTES)
   throw new SaaSAccessError(400,"Select a logo under 3 MB");
  const bytes=new Uint8Array(await uploaded.arrayBuffer()),detected=detectRasterLogo(bytes,uploaded.type);
  if(!detected)throw new SaaSAccessError(400,"Valid PNG, JPEG or WebP required");
  // Immutable versioned asset: failed saves cannot overwrite the live image.
  const path=organization.id+"/logo-"+crypto.randomUUID()+"."+detected.ext;
  const {error}=await db.storage.from(BUCKET).upload(path,bytes,{
    contentType:detected.mime,cacheControl:"60",upsert:true
  });
  if(error)throw new SaaSAccessError(503,"Secure logo upload unavailable");
  // Limit abandoned previews while retaining the currently published asset.
  const {data:existing}=await db.storage.from(BUCKET).list(organization.id,{
   limit:100,sortBy:{column:"created_at",order:"desc"}
  });
  if(existing&&existing.length>3){
   const current=typeof branding?.logoUrl==="string"?branding.logoUrl:"";
   const keep=new Set<string>([path.split("/").at(-1)||""]);
   for(const candidate of existing){
    if(current.endsWith("/"+organization.id+"/"+candidate.name))keep.add(candidate.name);
   }
   for(const candidate of existing){
    if(keep.size>=3)break;
    keep.add(candidate.name);
   }
   const stale=existing.filter(x=>!keep.has(x.name)).map(x=>organization.id+"/"+x.name);
   if(stale.length)await db.storage.from(BUCKET).remove(stale);
  }
  const {data}=db.storage.from(BUCKET).getPublicUrl(path);
  if(!data.publicUrl.startsWith("https://"))throw new Error("Invalid logo location");
  return NextResponse.json({ok:true,logoUrl:data.publicUrl},{headers});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Logo upload unavailable"},{status:e instanceof SaaSAccessError?e.status:503,headers});}
}
