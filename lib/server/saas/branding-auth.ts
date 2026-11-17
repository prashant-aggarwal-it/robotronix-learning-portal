import "server-only";
import {platformService} from "@/lib/server/saas/platform-admin";
import {SaaSAccessError,readBearerToken} from "@/lib/server/saas/organization-context";
export const ORG_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function authorizeBranding(authorization:string|null,organizationId:string){
 if(!ORG_ID.test(organizationId))throw new SaaSAccessError(400,"Invalid organization");
 const token=readBearerToken(authorization);
 if(!token)throw new SaaSAccessError(401,"Sign in first");
 const db=platformService();
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user||user.is_anonymous||!user.email_confirmed_at)throw new SaaSAccessError(401,"Verified session required");
 const {data:isPlatformAdmin,error:roleError}=await db.rpc("saas_is_platform_admin_v1",{p_actor_id:user.id});
 if(roleError)throw new SaaSAccessError(503,"Authorization unavailable");
 const {data:org,error:orgError}=await db.from("organizations").select("id,slug,status").eq("id",organizationId).maybeSingle();
 // The organizations table lives in the private saas schema.
 const {data:organization,error:lookupError}=orgError?await db.schema("saas").from("organizations").select("id,slug,status").eq("id",organizationId).maybeSingle():{data:org,error:null};
 if(lookupError||!organization||organization.status!=="active")throw new SaaSAccessError(404,"Active organization not found");
 if(isPlatformAdmin===true)return {db,userId:user.id,platformAdmin:true,organization};
 const {data:membership,error:membershipError}=await db.schema("saas").from("memberships")
  .select("role_key").eq("organization_id",organizationId).eq("user_id",user.id).eq("role_key","owner").eq("status","active").maybeSingle();
 if(membershipError||!membership)throw new SaaSAccessError(403,"Academy Owner required");
 const {data:entitlement,error:entitlementError}=await db.schema("saas").from("module_entitlements")
  .select("enabled").eq("organization_id",organizationId).eq("module_key","academy").eq("enabled",true).maybeSingle();
 if(entitlementError||!entitlement)throw new SaaSAccessError(403,"Academy entitlement required");
 return {db,userId:user.id,platformAdmin:false,organization};
}
