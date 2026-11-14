import "server-only";
import {createClient} from "@supabase/supabase-js";

export type OrganizationAccess={
 id:string;slug:string;displayName:string;role:string;
};

/** Server-only SaaS context. A caller-supplied organization ID is never sufficient authorization. */
export async function getAuthorizedOrganizations(bearer:string):Promise<{userId:string;organizations:OrganizationAccess[]}>{
 if(!bearer)throw new SaaSAccessError(401,"Sign in first");
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new SaaSAccessError(503,"Organization service unavailable");
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await client.auth.getUser(bearer);
 if(authError||!user||user.is_anonymous)throw new SaaSAccessError(401,"Invalid session");
 const {data:rows,error:membershipError}=await client.rpc("saas_authorized_organizations",{p_actor_id:user.id});
 if(membershipError)throw new SaaSAccessError(503,"Organization memberships unavailable");
 const organizations:OrganizationAccess[]=(rows??[]).map(
  (row:{organization_id:string;slug:string;display_name:string;role_key:string})=>({
   id:row.organization_id,slug:row.slug,displayName:row.display_name,role:row.role_key
  })
 );
 return {userId:user.id,organizations};
}

export class SaaSAccessError extends Error {
 constructor(public readonly status:number,message:string){super(message);this.name="SaaSAccessError";}
}

export function resolveAuthorizedOrganization(organizations:OrganizationAccess[],requestedId?:string|null):OrganizationAccess|null{
 if(requestedId){
  const match=organizations.find(o=>o.id===requestedId);
  if(!match)throw new SaaSAccessError(403,"Organization not accessible");
  return match;
 }
 if(organizations.length===1)return organizations[0];
 return null; // Never silently select a tenant when the user has multiple organizations.
}

export function requireModuleAccess(enabled:boolean,organization:OrganizationAccess|null):void{
 if(!organization)throw new SaaSAccessError(403,"Select an authorized organization");
 if(!enabled)throw new SaaSAccessError(403,"Module not enabled for this organization");
}

/** Resolve entitlements only after validating the caller and active membership. */
export async function getAuthorizedModuleEntitlements(
 bearer:string,organizationId:string
):Promise<{organization:OrganizationAccess;modules:Record<string,boolean>}>{
 const {userId,organizations}=await getAuthorizedOrganizations(bearer);
 const organization=resolveAuthorizedOrganization(organizations,organizationId);
 if(!organization)throw new SaaSAccessError(403,"Select an authorized organization");
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new SaaSAccessError(503,"Organization service unavailable");
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await client.rpc("saas_authorized_module_entitlements",{
  p_actor_id:userId,p_organization_id:organization.id
 });
 if(error)throw new SaaSAccessError(503,"Module entitlements unavailable");
 const modules:Record<string,boolean>=Object.create(null);
 for(const row of data??[])modules[row.module_key]=row.enabled===true;
 return {organization,modules};
}
