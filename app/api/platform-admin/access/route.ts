import {NextRequest,NextResponse} from "next/server";
import {requirePlatformAdmin} from "@/lib/server/saas/platform-admin";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};

/** Authorization is server-enforced; the response is only a routing hint. */
export async function GET(request:NextRequest){
 try{
  await requirePlatformAdmin(request.headers.get("authorization"));
  return NextResponse.json({ok:true,platformAdmin:true},{headers});
 }catch(e){
  const status=e instanceof SaaSAccessError?e.status:503;
  return NextResponse.json({ok:false,platformAdmin:false},{status,headers});
 }
}
