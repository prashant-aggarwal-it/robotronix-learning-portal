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
  const [crm,tasks]=await Promise.all([
   modules.crm===true?db.schema("saas").from("legacy_tenant_links").select("crm_tenant_id").eq("organization_id",organization.id).limit(2):Promise.resolve(null),
   modules.tasks===true?db.schema("saas").from("workspace_links").select("workspace_id").eq("organization_id",organization.id).limit(2):Promise.resolve(null)
  ]);
  if(crm?.error||tasks?.error)throw new SaaSAccessError(503,"Organization mappings unavailable");
  const crmRows=crm?.data??[],taskRows=tasks?.data??[];
  const [crmAccess,taskAccess]=await Promise.all([
   modules.crm===true&&crmRows.length===1?db.rpc("connect_my_workspaces",{p_actor_id:userId}):Promise.resolve(null),
   modules.tasks===true&&taskRows.length>0?db.schema("tasks").from("workspace_members").select("workspace_id,role").eq("user_id",userId).in("workspace_id",taskRows.map(row=>row.workspace_id)):Promise.resolve(null)
  ]);
  if(crmAccess?.error||taskAccess?.error)throw new SaaSAccessError(503,"Module workspace membership unavailable");
  const permittedCrm=crmRows.length===1&&(crmAccess?.data??[]).some((row:{tenant_id:string;tenant_status:string})=>row.tenant_id===crmRows[0].crm_tenant_id&&row.tenant_status==="active");
  const allowedTasks=(taskAccess?.data??[]).filter((row:{workspace_id:string})=>taskRows.some(link=>link.workspace_id===row.workspace_id));
  const links={
   crm:{enabled:modules.crm===true,status:modules.crm!==true?"disabled":crmRows.length===0?"unmapped":crmRows.length>1?"ambiguous":permittedCrm?"ready":"access_denied",tenantId:permittedCrm?crmRows[0].crm_tenant_id:null},
   tasks:{enabled:modules.tasks===true,status:modules.tasks!==true?"disabled":taskRows.length===0?"unmapped":allowedTasks.length>0?"ready":"access_denied",workspaces:allowedTasks.map((row:{workspace_id:string;role:string})=>({id:row.workspace_id,role:row.role}))}
  };
  return NextResponse.json({ok:true,organizationId:organization.id,
   links,
   note:"Links include only mapped module workspaces where this user has module membership. All business operations must independently authorize the selected resource."
  },{headers});
 }catch(error){
  const status=error instanceof SaaSAccessError?error.status:503;
  return NextResponse.json({ok:false,error:error instanceof SaaSAccessError?error.message:"Organization mapping unavailable"},{status,headers});
 }
}
