import {NextRequest,NextResponse} from "next/server";
import {getAuthorizedOrganizations,resolveAuthorizedOrganization,SaaSAccessError} from "@/lib/server/saas/organization-context";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"private, no-store","Vary":"Authorization, Cookie"};
const cookieName="robotronix_active_org";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bearerFrom(request:NextRequest):string {
 return request.headers.get("authorization")?.match(/^Bearer\s+([^\s]+)$/i)?.[1]??"";
}
function fail(error:unknown) {
 const status=error instanceof SaaSAccessError?error.status:503;
 return NextResponse.json({ok:false,error:error instanceof SaaSAccessError?error.message:"Organization context unavailable"},{status,headers:noStore});
}
function selectedCookieOptions(request:NextRequest) {
 return {httpOnly:true,secure:request.nextUrl.protocol==="https:",sameSite:"strict" as const,path:"/",maxAge:60*60*24*30};
}

/** Discovery always revalidates the selected tenant against the authenticated user. */
export async function GET(request:NextRequest) {
 try {
  const {organizations}=await getAuthorizedOrganizations(bearerFrom(request));
  const requested=request.nextUrl.searchParams.get("organizationId")??request.cookies.get(cookieName)?.value??null;
  const selected=resolveAuthorizedOrganization(organizations,requested);
  return NextResponse.json({ok:true,organizations,selectedOrganizationId:selected?.id??null,
   requiresSelection:organizations.length>1&&!selected},{headers:noStore});
 }catch(error){return fail(error);}
}

/** Persist only a tenant identifier, never a session token, and recheck active membership first. */
export async function POST(request:NextRequest) {
 try {
  if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
   return NextResponse.json({ok:false,error:"JSON required"},{status:415,headers:noStore});
  const body:unknown=await request.json().catch(()=>null);
  const organizationId=body&&typeof body==="object"&&"organizationId" in body
   ?(body as {organizationId:unknown}).organizationId:null;
  if(typeof organizationId!=="string"||!uuid.test(organizationId))
   return NextResponse.json({ok:false,error:"Valid organizationId required"},{status:400,headers:noStore});
  const {organizations}=await getAuthorizedOrganizations(bearerFrom(request));
  const selected=resolveAuthorizedOrganization(organizations,organizationId);
  if(!selected)throw new SaaSAccessError(403,"Organization not accessible");
  const response=NextResponse.json({ok:true,selectedOrganizationId:selected.id},{headers:noStore});
  response.cookies.set(cookieName,selected.id,selectedCookieOptions(request));
  return response;
 }catch(error){return fail(error);}
}

/** Clear the current selection; does not revoke or alter memberships. */
export async function DELETE(request:NextRequest) {
 try {
  await getAuthorizedOrganizations(bearerFrom(request));
  const response=NextResponse.json({ok:true,selectedOrganizationId:null},{headers:noStore});
  response.cookies.set(cookieName,"",{...selectedCookieOptions(request),maxAge:0});
  return response;
 }catch(error){return fail(error);}
}
