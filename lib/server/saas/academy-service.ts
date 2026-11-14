import "server-only";
import {createClient} from "@supabase/supabase-js";
import {NextRequest,NextResponse} from "next/server";
import {requireAuthorizedTenantCapability,readBearerToken,SaaSAccessError} from "@/lib/server/saas/organization-context";

export type AcademyKind="students"|"courses"|"trainers"|"enrollments";
export type AcademyAction="list"|"get"|"create"|"update";
export const privateHeaders={"Cache-Control":"private, no-store","Vary":"Authorization, Cookie"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validKind(value:string):value is AcademyKind {
 return ["students","courses","trainers","enrollments"].includes(value);
}
export function invalid(message:string,status=400) {
 return NextResponse.json({ok:false,error:message},{status,headers:privateHeaders});
}
export function failure(error:unknown) {
 if(error instanceof SaaSAccessError)return invalid(error.message,error.status);
 return invalid("Academy operation unavailable",503);
}
export async function executeAcademy(
 request:NextRequest,orgId:string,kind:AcademyKind,action:AcademyAction,recordId?:string,payload:Record<string,unknown>={}
) {
 if(!uuid.test(orgId))return invalid("Valid organizationId required");
 if(recordId&&!uuid.test(recordId))return invalid("Invalid resource ID");
 if(!payload||Array.isArray(payload)||typeof payload!=="object")return invalid("JSON object required");
 try {
  const token=readBearerToken(request.headers.get("authorization"));
  const capability=kind==="students"?"academy.students.manage":kind==="courses"?"academy.courses.manage":kind==="trainers"?"academy.trainers.manage":"academy.enrollments.manage";
  const {userId}=await requireAuthorizedTenantCapability(token,orgId,"academy",capability);
  const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new SaaSAccessError(503,"Academy service unavailable");
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await admin.rpc("saas_academy_v1",{
   p_actor_id:userId,p_organization_id:orgId,p_kind:kind,p_action:action,
   p_record_id:recordId??null,p_data:payload
  });
  if(error){
   if(error.code==="42501")return invalid("Resource not accessible",403);
   if(error.code==="22023"||error.code==="22P02"||error.code==="23514"||error.code==="23502")return invalid("Invalid Academy input",400);
   if(error.code==="23505")return invalid("Resource already exists",409);
   return invalid("Academy operation failed",503);
  }
  return NextResponse.json({ok:true,organizationId:orgId,data},{headers:privateHeaders,status:action==="create"?201:200});
 }catch(error){return failure(error);}
}
