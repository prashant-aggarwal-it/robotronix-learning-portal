import {NextRequest,NextResponse} from "next/server";
import {readBearerToken,SaaSAccessError} from "@/lib/server/saas/organization-context";
import {connectAcademySmtp,disconnectAcademySmtp} from "@/lib/server/saas/academy-smtp";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
export async function POST(req:NextRequest){
 try{
  const body=await req.json().catch(()=>null);
  if(!body||typeof body.organizationId!=="string"||!/^[0-9a-f-]{36}$/i.test(body.organizationId)||typeof body.host!=="string"||typeof body.username!=="string"||typeof body.password!=="string"||typeof body.senderEmail!=="string"||typeof body.secure!=="boolean"||!Number.isInteger(body.port))throw new SaaSAccessError(400,"Invalid SMTP configuration");
  const result=await connectAcademySmtp(readBearerToken(req.headers.get("authorization")),body.organizationId,{host:body.host,port:body.port,secure:body.secure,username:body.username,password:body.password,senderEmail:body.senderEmail});
  return response(result);
 }catch(e){return response({error:e instanceof SaaSAccessError?e.message:"Unable to connect SMTP"},e instanceof SaaSAccessError?e.status:503);}
}
export async function DELETE(req:NextRequest){
 try{
  const body=await req.json().catch(()=>null);
  if(typeof body?.organizationId!=="string"||!/^[0-9a-f-]{36}$/i.test(body.organizationId))throw new SaaSAccessError(400,"Invalid academy");
  return response(await disconnectAcademySmtp(readBearerToken(req.headers.get("authorization")),body.organizationId));
 }catch(e){return response({error:e instanceof SaaSAccessError?e.message:"Unable to disconnect SMTP"},e instanceof SaaSAccessError?e.status:503);}
}
