import "server-only";
import {platformService,requirePlatformAdmin} from "@/lib/server/saas/platform-admin";
import {verifiedBrandingActor,ORG_ID} from "@/lib/server/saas/branding-auth";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";

export const BRANDING_LEVELS=["standard","custom","white_label"] as const;
export type BrandingLevel=typeof BRANDING_LEVELS[number];
export type BrandingEntitlement={organizationId:string;level:BrandingLevel;isDefault:boolean};
export function isBrandingLevel(value:unknown):value is BrandingLevel{
 return typeof value==="string"&&BRANDING_LEVELS.includes(value as BrandingLevel);
}
export async function readBrandingEntitlement(authorization:string|null,organizationId:string):Promise<BrandingEntitlement>{
 if(!ORG_ID.test(organizationId))throw new SaaSAccessError(400,"Valid organizationId required");
 const {db,userId}=await verifiedBrandingActor(authorization);
 const {data,error}=await db.rpc("saas_branding_tier_read_v1",{p_actor:userId,p_org:organizationId});
 if(error){
  if(error.code==="42501")throw new SaaSAccessError(403,"Organization not accessible");
  throw new SaaSAccessError(503,"Branding entitlement unavailable");
 }
 if(!data||!isBrandingLevel(data.level)||data.organizationId!==organizationId)
  throw new SaaSAccessError(503,"Invalid branding entitlement");
 return {organizationId,level:data.level,isDefault:data.isDefault===true};
}
export async function updateBrandingEntitlement(authorization:string|null,organizationId:string,level:unknown){
 if(!ORG_ID.test(organizationId)||!isBrandingLevel(level))
  throw new SaaSAccessError(400,"Valid organizationId and branding level required");
 const {db,userId}=await requirePlatformAdmin(authorization);
 const {data,error}=await db.rpc("saas_branding_tier_set_v1",{p_actor:userId,p_org:organizationId,p_level:level});
 if(error){
  if(error.code==="42501")throw new SaaSAccessError(403,"Platform Super Admin required");
  if(error.code==="22023")throw new SaaSAccessError(400,"Organization or branding level unavailable");
  throw new SaaSAccessError(503,"Branding entitlement update unavailable");
 }
 if(!data?.ok||data.organizationId!==organizationId||!isBrandingLevel(data.level))
  throw new SaaSAccessError(503,"Branding entitlement update rejected");
 return {organizationId,level:data.level as BrandingLevel,changed:data.changed===true,previous:data.previous as BrandingLevel};
}
