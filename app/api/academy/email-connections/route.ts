import {NextRequest,NextResponse} from "next/server";
import {academyEmailStatus} from "@/lib/server/saas/academy-email";
import {readBearerToken,SaaSAccessError} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 try{
  const id=request.nextUrl.searchParams.get("organizationId")||"";
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new SaaSAccessError(400,"Invalid academy");
  const status=await academyEmailStatus(readBearerToken(request.headers.get("authorization")),id);
  return NextResponse.json(status,{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){
  const status=error instanceof SaaSAccessError?error.status:503;
  return NextResponse.json({error:error instanceof SaaSAccessError?error.message:"Email settings unavailable"},{status,headers:{"Cache-Control":"no-store"}});
 }
}
