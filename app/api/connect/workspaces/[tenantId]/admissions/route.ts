import crypto from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {connectFailure,noStore,uuid} from "@/lib/server/connect-auth";
import {portalBridgeAccess} from "@/lib/server/connect-portal-access";

export const dynamic="force-dynamic";
type Context={params:Promise<{tenantId:string}>};

export async function GET(request:NextRequest,{params}:Context){
 const {tenantId}=await params,access=await portalBridgeAccess(request,tenantId);
 if("error" in access)return access.error;
 if(!access.installed)return NextResponse.json({ok:true,items:[]},{headers:noStore});
 const {data,error}=await access.session.admin.rpc("connect_portal_admissions",{
  p_actor_id:access.session.actorId,p_tenant_id:tenantId,p_action:"list",p_data:{}
 });
 if(error)return connectFailure("Admissions handoffs unavailable.",503);
 return NextResponse.json({ok:true,items:data?.items||[]},{headers:noStore});
}

export async function POST(request:NextRequest,{params}:Context){
 const {tenantId}=await params,access=await portalBridgeAccess(request,tenantId,true);
 if("error" in access)return access.error;
 if(!access.installed)return connectFailure("Learning Portal connection is disabled.",409);
 if(Number(request.headers.get("content-length")||0)>8000)return connectFailure("Request too large.",413);
 const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
 if(!body||!(["accept","reconcile","verify","revoke"] as unknown[]).includes(body.action))return connectFailure("Invalid admission action.",400);
 const action=String(body.action),p_data:Record<string,unknown>={};
 let token="";
 if(action==="accept"){
  if(!uuid(body.opportunityId)||!uuid(body.learnerPersonId)||!uuid(body.requestId)||body.consentAttested!==true)
   return connectFailure("Select an admission and learner; record the guardian's acceptance.",400);
  const offer=body.offer as Record<string,unknown>|null;
  if(!offer||typeof offer!=="object"||Array.isArray(offer)||!Number.isFinite(offer.fee)||Number(offer.fee)<0||
   !Number.isInteger(offer.sessions)||Number(offer.sessions)<1||typeof offer.currency!=="string"||!/^[A-Z]{3}$/.test(offer.currency)||
   typeof offer.terms!=="string"||offer.terms.trim().length<3||offer.terms.length>2000)
   return connectFailure("Offer fee, currency, session count and terms are required.",400);
  const snapshot={fee:Number(offer.fee),currency:offer.currency,sessions:Number(offer.sessions),terms:offer.terms.trim()};
  const payloadHash=crypto.createHash("sha256").update(JSON.stringify({opportunityId:body.opportunityId,learnerPersonId:body.learnerPersonId,offer:snapshot})).digest("hex");
  token=crypto.randomBytes(32).toString("base64url");
  Object.assign(p_data,{opportunityId:body.opportunityId,learnerPersonId:body.learnerPersonId,requestId:body.requestId,
   payloadHash,tokenHash:crypto.createHash("sha256").update(token).digest("hex"),offer:snapshot,consentAttested:true});
 }else{
  if(!uuid(body.handoffId))return connectFailure("Select a valid admission handoff.",400);
  p_data.handoffId=body.handoffId;
  if(action==="verify")p_data.evidenceNote=typeof body.evidenceNote==="string"?body.evidenceNote.slice(0,500):"";
 }
 const {data,error}=await access.session.admin.rpc("connect_portal_admissions",{
  p_actor_id:access.session.actorId,p_tenant_id:tenantId,p_action:action,p_data
 });
 if(error){
  if(error.code==="23505")return connectFailure("An active handoff already exists for this admission.",409);
  if(error.code==="42501")return connectFailure("You are not authorized for this admission action.",403);
  if(error.code==="22023"||error.code==="23514")return connectFailure("Admission is not eligible for this action. Check the offer, learner and onboarding status.",409);
  return connectFailure("Admission action could not be completed.",503);
 }
 if(action==="accept"&&data.existing){
  return data.payloadHash!==p_data.payloadHash?connectFailure("Request ID was already used for a different offer.",409):
   NextResponse.json({ok:true,id:data.id,status:data.status,existing:true,inviteUrl:null},{headers:noStore});
 }
 return NextResponse.json({ok:true,...data,...(action==="accept"?{inviteUrl:request.nextUrl.origin+"/onboarding?handoff="+encodeURIComponent(token)}:{})},{headers:noStore});
}
