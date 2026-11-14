import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {getAuthorizedModuleEntitlements,readBearerToken,SaaSAccessError} from "@/lib/server/saas/organization-context";

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
  const {organization,modules}=await getAuthorizedModuleEntitlements(bearer,organizationId);
  const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new SaaSAccessError(503,"Organization service unavailable");
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const [crm,tasks]=await Promise.all([
   modules.crm===true?db.schema("saas").from("legacy_tenant_links").select("crm_tenant_id").eq("organization_id",organization.id).limit(2):Promise.resolve(null),
   modules.tasks===true?db.schema("saas").from("workspace_links").select("workspace_id").eq("organization_id",organization.id).limit(2):Promise.resolve(null)
  ]);
  if(crm?.error||tasks?.error)throw new SaaSAccessError(503,"Organization mappings unavailable");
  const crmRows=crm?.data??[],taskRows=tasks?.data??[];
  return NextResponse.json({ok:true,organizationId:organization.id,
   links:{
    crm:{enabled:modules.crm===true,status:modules.crm!==true?"disabled":crmRows.length===1?"linked":crmRows.length===0?"unmapped":"ambiguous"},
    tasks:{enabled:modules.tasks===true,status:modules.tasks!==true?"disabled":taskRows.length>0?"linked":"unmapped",linkedWorkspaceCount:taskRows.length}
   },
   note:"Mapping presence does not authorize access to CRM tenants or Tasks workspaces. Revalidate module-specific membership before any operation."
  },{headers});
 }catch(error){
  const status=error instanceof SaaSAccessError?error.status:503;
  return NextResponse.json({ok:false,error:error instanceof SaaSAccessError?error.message:"Organization mapping unavailable"},{status,headers});
 }
}
