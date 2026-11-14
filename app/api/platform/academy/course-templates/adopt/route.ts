import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {readBearerToken,requireAuthorizedTenantRole,SaaSAccessError} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization, Cookie"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request:NextRequest){
 try{
  const raw:unknown=await request.json().catch(()=>null);
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return NextResponse.json({ok:false,error:"JSON object required"},{status:400,headers});
  const {organizationId,templateId,slug,code}=raw as Record<string,unknown>;
  if(typeof organizationId!=="string"||!uuid.test(organizationId)
  ||typeof templateId!=="string"||!uuid.test(templateId)
  ||typeof slug!=="string"||!(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))||slug.length>100
  ||typeof code!=="string"||!(/^[A-Z0-9-]{3,80}$/.test(code)))
   return NextResponse.json({ok:false,error:"Invalid course template request"},{status:400,headers});
  const token=readBearerToken(request.headers.get("authorization"));
  const {userId}=await requireAuthorizedTenantRole(token,organizationId,"academy",["owner","admin"]);
  const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new SaaSAccessError(503,"Academy service unavailable");
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.rpc("saas_academy_clone_course_template",{
   p_actor_id:userId,p_organization_id:organizationId,p_template_id:templateId,p_slug:slug,p_code:code
  });
  if(error)return NextResponse.json({ok:false,error:error.code==="42501"?"Course template not accessible":
    error.code==="23505"?"Course slug or code already exists":"Course template adoption failed"},
    {status:error.code==="42501"?403:error.code==="23505"?409:503,headers});
  return NextResponse.json({ok:true,organizationId,courseId:data},{status:201,headers});
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof SaaSAccessError?error.message:"Academy service unavailable"},
   {status:error instanceof SaaSAccessError?error.status:503,headers});
 }
}
