import "server-only";
import {createClient} from "@supabase/supabase-js";
import {NextRequest} from "next/server";
import {getAuthorizedOrganizations,readBearerToken,requireAuthorizedTenantCapability,SaaSAccessError} from "./organization-context";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Authorized org for SaaS users; returns null for a genuine standalone legacy Admin.
 * Revoked SaaS accounts cannot fall back to global legacy privileges.
 */
export async function requireLegacyAcademyAdminOrg(request:NextRequest):Promise<string|null>{
 const bearer=readBearerToken(request.headers.get("authorization"));
 const {userId,organizations}=await getAuthorizedOrganizations(bearer);
 if(!organizations.length){
  const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new SaaSAccessError(503,"Organization service unavailable");
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.rpc("saas_actor_ever_member",{p_actor_id:userId});
  if(error)throw new SaaSAccessError(503,"Organization history unavailable");
  if(data)throw new SaaSAccessError(403,"Organization membership revoked");
  return null;
 }
 const orgId=request.headers.get("x-organization-id")??"";
 if(!uuid.test(orgId))throw new SaaSAccessError(403,"Select an authorized organization");
 await requireAuthorizedTenantCapability(bearer,orgId,"academy","academy.students.manage");
 return orgId;
}
