import {NextRequest,NextResponse} from "next/server";
import {readBearerToken,SaaSAccessError} from "@/lib/server/saas/organization-context";
import {startMicrosoftEmail} from "@/lib/server/saas/microsoft-email-oauth";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 try{
  const body=await req.json().catch(()=>null);
  if(typeof body?.organizationId!=="string"||!/^[0-9a-f-]{36}$/i.test(body.organizationId))throw new SaaSAccessError(400,"Invalid academy");
  return NextResponse.json({url:await startMicrosoftEmail(readBearerToken(req.headers.get("authorization")),body.organizationId)},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return NextResponse.json({error:e instanceof SaaSAccessError?e.message:"Microsoft authorization unavailable"},{status:e instanceof SaaSAccessError?e.status:503,headers:{"Cache-Control":"no-store"}});}
}
