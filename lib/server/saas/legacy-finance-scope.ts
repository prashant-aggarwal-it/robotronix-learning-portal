import "server-only";
import {createClient} from "@supabase/supabase-js";
import {NextRequest} from "next/server";
import {getAuthorizedOrganizations,requireAuthorizedTenantRole,readBearerToken,SaaSAccessError} from "./organization-context";
export type AcademyLegacyFinanceScope={organizationId:string;packageIds:string[];invoiceIds:string[]}|null;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Legacy standalone users retain their existing authorization; SaaS users need BOTH
 * active Academy organization admin membership and record-scoped service queries.
 */
export async function requireLegacyFinanceScope(request:NextRequest):Promise<AcademyLegacyFinanceScope>{
 const bearer=readBearerToken(request.headers.get("authorization"));
 const {userId,organizations}=await getAuthorizedOrganizations(bearer);
 if(!organizations.length){
  const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new SaaSAccessError(503,"Academy finance access unavailable");
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:everMember,error}=await db.rpc("saas_actor_ever_member",{p_actor_id:userId});
  if(error)throw new SaaSAccessError(503,"Academy membership history unavailable");
  if(everMember)throw new SaaSAccessError(403,"No active Academy organization membership");
  return null;
 }
 const organizationId=request.headers.get("x-organization-id")||"";
 if(!uuid.test(organizationId))throw new SaaSAccessError(403,"Select an Academy organization");
 await requireAuthorizedTenantRole(bearer,organizationId,"academy",["owner","admin"]);
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new SaaSAccessError(503,"Academy finance service unavailable");
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await db.rpc("saas_academy_finance_scope",{
  p_actor_id:userId,p_organization_id:organizationId
 });
 if(error||!data||!Array.isArray(data.packageIds)||!Array.isArray(data.invoiceIds))
  throw new SaaSAccessError(503,"Academy finance organization mapping unavailable");
 return {organizationId,packageIds:data.packageIds,invoiceIds:data.invoiceIds};
}
export function financeScopeError(error:unknown):{message:string;status:number}{
 return error instanceof SaaSAccessError?{message:error.message,status:error.status}:
  {message:"Academy finance access could not be verified",status:503};
}
