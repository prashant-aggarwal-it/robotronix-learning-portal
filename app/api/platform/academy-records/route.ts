import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireAuthorizedTenantRole,readBearerToken,SaaSAccessError} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization, Cookie"};
const kinds=["students","trainers","courses","enrollments"] as const;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(error:unknown){return NextResponse.json({ok:false,error:error instanceof SaaSAccessError?error.message:"Academy operation unavailable"},{status:error instanceof SaaSAccessError?error.status:503,headers});}
function db(){const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new SaaSAccessError(503,"Academy unavailable");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
async function operation(request:NextRequest,org:string,kind:string,action:string,recordId:string|null,data:Record<string,unknown>={}){
 if(!uuid.test(org)||!kinds.includes(kind as typeof kinds[number])||!["list","get","create","update"].includes(action))
   throw new SaaSAccessError(400,"Invalid Academy request");
 if((action==="get"||action==="update")&&(!recordId||!uuid.test(recordId)))
   throw new SaaSAccessError(400,"Valid record ID required");
 const user=await requireAuthorizedTenantRole(readBearerToken(request.headers.get("authorization")),org,"academy",["owner","admin"]);
 const {data:result,error}=await db().rpc("saas_academy_v1",{
  p_actor_id:user.userId,p_organization_id:user.organization.id,
  p_kind:kind,p_action:action,p_record_id:recordId,p_data:data
 });
 if(error)throw new SaaSAccessError(error.code==="42501"?403:error.code==="23505"?409:error.code==="22023"?400:503,
   error.code==="23505"?"Record conflicts with an existing record":error.code==="42501"?"Not authorized for this Academy":error.code==="22023"?"Invalid record details":"Academy operation failed");
 return NextResponse.json({ok:true,data:result},{headers,status:action==="create"?201:200});
}
export async function GET(request:NextRequest){
 try{const q=request.nextUrl.searchParams;return await operation(request,q.get("organizationId")||"",q.get("kind")||"",q.get("recordId")?"get":"list",q.get("recordId"),{});}
 catch(e){return fail(e);}
}
export async function POST(request:NextRequest){
 try{
  if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
   throw new SaaSAccessError(415,"JSON required");
  const input=await request.text();
  if(input.length>15000)throw new SaaSAccessError(413,"Request too large");
  const body=JSON.parse(input) as {organizationId?:unknown;kind?:unknown;action?:unknown;recordId?:unknown;data?:unknown};
  if(!body||typeof body!=="object"||Array.isArray(body)||!["create","update"].includes(String(body.action)))
   throw new SaaSAccessError(400,"Invalid action");
  const data=body.data;
  if(!data||typeof data!=="object"||Array.isArray(data))throw new SaaSAccessError(400,"Invalid record details");
  return await operation(request,String(body.organizationId||""),String(body.kind||""),String(body.action),
   typeof body.recordId==="string"?body.recordId:null,data as Record<string,unknown>);
 }catch(e){return fail(e);}
}
