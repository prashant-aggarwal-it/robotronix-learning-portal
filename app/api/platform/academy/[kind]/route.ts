import {NextRequest} from "next/server";
import {executeAcademy,validKind,invalid} from "@/lib/server/saas/academy-service";

export const runtime="nodejs";
export const dynamic="force-dynamic";
type Params={params:Promise<{kind:string}>};
export async function GET(request:NextRequest,{params}:Params){
 const {kind}=await params;
 if(!validKind(kind))return invalid("Unsupported Academy resource",404);
 return executeAcademy(request,request.nextUrl.searchParams.get("organizationId")??"",kind,"list");
}
export async function POST(request:NextRequest,{params}:Params){
 const {kind}=await params;
 if(!validKind(kind))return invalid("Unsupported Academy resource",404);
 if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))return invalid("JSON required",415);
 const body:unknown=await request.json().catch(()=>null);
 if(!body||Array.isArray(body)||typeof body!=="object")return invalid("Invalid JSON payload");
 const {organizationId,...fields}=body as Record<string,unknown>;
 if(typeof organizationId!=="string")return invalid("Valid organizationId required");
 return executeAcademy(request,organizationId,kind,"create",undefined,fields);
}
