import {NextRequest,NextResponse} from "next/server";
import {getAuthorizedOrganizations,resolveAuthorizedOrganization,SaaSAccessError} from "@/lib/server/saas/organization-context";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"no-store"};

/** Opt-in organization discovery; does not alter legacy Portal, CRM or Tasks authorization. */
export async function GET(request:NextRequest){
 try {
  const token=request.headers.get("authorization")?.match(/^Bearer\s+([^\s]+)$/i)?.[1]??"";
  const {organizations}=await getAuthorizedOrganizations(token);
  const selected=resolveAuthorizedOrganization(organizations,request.nextUrl.searchParams.get("organizationId"));
  return NextResponse.json({ok:true,organizations,selectedOrganizationId:selected?.id??null,
   requiresSelection:organizations.length>1&&!selected},{headers:noStore});
 }catch(error){
  const status=error instanceof SaaSAccessError?error.status:503;
  return NextResponse.json({ok:false,error:error instanceof SaaSAccessError?error.message:"Organization context unavailable"},
   {status,headers:noStore});
 }
}
