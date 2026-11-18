import "server-only";
import {platformService} from "@/lib/server/saas/platform-admin";
import {SaaSAccessError,readBearerToken} from "@/lib/server/saas/organization-context";
export const ORG_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function verifiedBrandingActor(authorization:string|null){
 const token=readBearerToken(authorization);
 if(!token)throw new SaaSAccessError(401,"Sign in first");
 const db=platformService();
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user||user.is_anonymous||!user.email_confirmed_at)
  throw new SaaSAccessError(401,"Verified session required");
 return {db,userId:user.id};
}
export async function authorizeBranding(authorization:string|null,organizationId:string){
 if(!ORG_ID.test(organizationId))throw new SaaSAccessError(400,"Invalid organization");
 const {db,userId}=await verifiedBrandingActor(authorization);
 const {data,error}=await db.rpc("saas_branding_detail_v1",{p_actor:userId,p_org:organizationId});
 if(error)throw new SaaSAccessError(503,"Branding authorization unavailable");
 if(!data||!data.organization)throw new SaaSAccessError(403,"Academy Owner or Platform Admin required");
 return {db,userId,organization:data.organization as {id:string;slug:string;display_name:string},branding:data.branding};
}

/** Recheck entitlement and ownership for every logo upload or branding write. */
export async function authorizeBrandingWrite(authorization:string|null,organizationId:string){
 const ctx=await authorizeBranding(authorization,organizationId);
 const {data,error}=await ctx.db.rpc("saas_branding_write_access_v2",{p_actor:ctx.userId,p_org:organizationId});
 if(error)throw new SaaSAccessError(503,"Branding permission unavailable");
 if(data!==true)throw new SaaSAccessError(403,"Custom branding is not enabled for this organization");
 return ctx;
}
