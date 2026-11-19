import {NextRequest,NextResponse} from "next/server";
import {startGoogleEmail} from "@/lib/server/saas/google-email-oauth";
import {readBearerToken,SaaSAccessError} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 try{
  const body=await req.json().catch(()=>null);
  if(!body||typeof body.organizationId!=="string"||!/^[0-9a-f-]{36}$/i.test(body.organizationId))throw new SaaSAccessError(400,"Invalid academy");
  const url=await startGoogleEmail(readBearerToken(req.headers.get("authorization")),body.organizationId);
  return NextResponse.json({url},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return NextResponse.json({error:e instanceof SaaSAccessError?e.message:"Google authorization unavailable"},{status:e instanceof SaaSAccessError?e.status:503,headers:{"Cache-Control":"no-store"}})}
}
