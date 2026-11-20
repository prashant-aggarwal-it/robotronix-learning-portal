import {NextRequest,NextResponse} from "next/server";
import {requirePlatformAdmin} from "@/lib/server/saas/platform-admin";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function handler(req:NextRequest,action:"list"|"mutate"){
 try {
  const {db,userId}=await requirePlatformAdmin(req.headers.get("authorization"));
  let payload:{action?:string;id?:string;fingerprint?:string;title?:string;category?:string;severity?:string}={};
  if(action==="mutate"){
   const raw=await req.text();if(raw.length>2000)throw new SaaSAccessError(400,"Payload too large");
   try{payload=JSON.parse(raw);}catch{throw new SaaSAccessError(400,"Invalid JSON");}
   if(!payload||!["create","acknowledge","resolve"].includes(payload.action||""))throw new SaaSAccessError(400,"Invalid action");
   if(payload.action!=="create"&&(!payload.id||!uuid.test(payload.id)))throw new SaaSAccessError(400,"Invalid incident ID");
  }
  const {data,error}=await db.rpc("saas_platform_incidents_v1",{
   p_actor:userId,p_action:action==="list"?"list":payload.action!,
   p_id:payload.id||null,p_fingerprint:payload.fingerprint||null,p_title:payload.title||null,
   p_category:payload.category||null,p_severity:payload.severity||null
  });
  if(error){console.error("Platform incidents RPC",error.code);throw new SaaSAccessError(error.code==="42501"?403:error.code==="22023"?400:503,"Incident operation unavailable");}
  return NextResponse.json({ok:true,...data},{headers});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Incident monitoring unavailable"},{headers,status:e instanceof SaaSAccessError?e.status:503});}
}
export async function GET(req:NextRequest){return handler(req,"list");}
export async function POST(req:NextRequest){return handler(req,"mutate");}
