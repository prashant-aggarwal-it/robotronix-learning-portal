import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getAuthorizedOrganizations,getAuthorizedModuleEntitlements,readBearerToken,SaaSAccessError} from "@/lib/server/saas/organization-context";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization, Cookie"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Read-only linkage readiness; does NOT grant CRM/Tasks workspace access.
 * Consumers must also call the module's own membership-checked endpoints.
 */
export async function GET(request:NextRequest){
 try{
  const organizationId=request.nextUrl.searchParams.get("organizationId")??"";
  if(!uuid.test(organizationId))throw new SaaSAccessError(400,"Valid organizationId required");
  const bearer=readBearerToken(request.headers.get("authorization"));
  const [{userId},{organization,modules}]=await Promise.all([getAuthorizedOrganizations(bearer),getAuthorizedModuleEntitlements(bearer,organizationId)]);
  const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new SaaSAccessError(503,"Organization service unavailable");
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  // One privileged service-only RPC avoids exposing private schemas via PostgREST.
  // It independently validates active SaaS, CRM and Tasks membership.
  const {data:links,error:linkError}=await db.rpc("saas_resolve_module_links",{
   p_actor_id:userId,p_organization_id:organization.id
  });
  if(linkError||!links||typeof links!=="object")
   throw new SaaSAccessError(503,"Module workspace mapping unavailable");
  if(modules.crm!==true&&links.crm?.status!=="disabled")
   throw new SaaSAccessError(503,"Module entitlement mismatch");
  if(modules.tasks!==true&&links.tasks?.status!=="disabled")
   throw new SaaSAccessError(503,"Module entitlement mismatch");
  return NextResponse.json({ok:true,organizationId:organization.id,
   links,
   note:"Links include only mapped module workspaces where this user has module membership. All business operations must independently authorize the selected resource."
  },{headers});
 }catch(error){
  const status=error instanceof SaaSAccessError?error.status:503;
  return NextResponse.json({ok:false,error:error instanceof SaaSAccessError?error.message:"Organization mapping unavailable"},{status,headers});
 }
}
