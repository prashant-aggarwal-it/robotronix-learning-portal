import {NextRequest,NextResponse} from "next/server";
import {randomBytes,createHash} from "node:crypto";
import {requirePlatformAdmin,platformService} from "@/lib/server/saas/platform-admin";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
import {deliverInvitation,invitationOrigin} from "@/lib/server/saas/invitation-mail";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
const slugRe=/^[a-z0-9]+(-[a-z0-9]+)*$/;
const reserved=new Set(["admin","api","auth","app","apps","connect","login","signup","tasks","portal","student","parent","trainer","onboarding","workspace","www","support","settings","robotronix","platform-admin"]);
const send=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
const error=(e:unknown)=>send({ok:false,error:e instanceof SaaSAccessError?e.message:"Customer onboarding unavailable"},e instanceof SaaSAccessError?e.status:503);
export async function POST(request:NextRequest){
 try{
  const {db,userId}=await requirePlatformAdmin(request.headers.get("authorization"));
  const b=await request.json().catch(()=>null);
  if(!b||typeof b!=="object")throw new SaaSAccessError(400,"Invalid details");
  const email=typeof b.ownerEmail==="string"?b.ownerEmail.trim().toLowerCase():"";
  const name=typeof b.name==="string"?b.name.trim():"";
  const slug=typeof b.slug==="string"?b.slug.trim().toLowerCase():"";
  const kind=typeof b.kind==="string"?b.kind:"";
  const modules=b.modules;
  const action=b.action==="rotate"?"rotate":"create";
  if(action==="rotate"&&(typeof b.id!=="string"||!/^[a-f0-9-]{36}$/i.test(b.id)))throw new SaaSAccessError(400,"Invalid invitation");
  if(action==="create"&&(name.length<2||name.length>160||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||
    slug.length<3||slug.length>63||!slugRe.test(slug)||reserved.has(slug)||
    !["academy","institute","tutor"].includes(kind)||
    !Array.isArray(modules)||modules.length<1||modules.length>3||
    new Set(modules).size!==modules.length||!modules.every((m:unknown)=>["academy","crm","tasks"].includes(String(m)))))
    throw new SaaSAccessError(400,"Check organization name, owner email, slug and modules");
  const origin=invitationOrigin();
  const configured=Boolean(process.env.RESEND_API_KEY&&process.env.INVITATION_FROM_EMAIL);
  const secret=randomBytes(32).toString("hex");
  const {data,error:dbError}=await db.rpc("saas_pending_customer_manage_v1",{
   p_actor:userId,p_action:action,p_data:{
    id:action==="rotate"?b.id:undefined,
    ownerEmail:email,ownerName:typeof b.ownerName==="string"?b.ownerName.trim().slice(0,160):null,
    name,slug,kind,modules,tokenHash:createHash("sha256").update(secret).digest("hex")
   }
  });
  if(dbError)throw new SaaSAccessError(dbError.code==="23505"||dbError.code==="23514"?409:503,
   dbError.code==="23505"?"A pending invitation or organization already uses this URL":dbError.code==="23514"?"Invitation rate limit or rotation cooldown applies":"Unable to create customer invitation");
  const invitationUrl=new URL("/customer-invite?token="+secret,origin).toString();
  // The delivery record is created only after invitation is securely persisted.
  // An unconfigured provider leaves a restricted manual fallback, never a false "sent".
  if(!configured)return send({ok:true,invitation:data,delivery:"not_configured",invitationUrl,
   message:"Email delivery is not configured. Share the secure link manually from Advanced recovery."},201);
  const id=data?.id;
  const {data:queued,error:queueError}=await db.rpc("saas_invitation_delivery_admin_v1",{
   p_actor:userId,p_action:"queue",p_data:{invitationId:id}
  });
  if(queueError)return send({ok:true,invitation:data,delivery:"failed",message:"Invitation created, but delivery could not be queued. Use resend."},201);
  const {error:sendingError}=await db.rpc("saas_invitation_delivery_admin_v1",{
   p_actor:userId,p_action:"sending",p_data:{id:queued.id}
  });
  if(sendingError)return send({ok:true,invitation:data,delivery:"failed",message:"Invitation created, but dispatch could not begin."},201);
  // Fetch authoritative recipient/name/expiry on every dispatch, including rotations.
  const {data:details,error:detailError}=await db.rpc("saas_pending_customer_manage_v1",{p_actor:userId,p_action:"list",p_data:{}});
  const invite=Array.isArray(details)?details.find((x:{id:string})=>x.id===id):undefined;
  if(detailError||!invite)return send({ok:true,invitation:data,delivery:"failed",message:"Invitation created, but recipient lookup failed."},201);
  const delivery=await deliverInvitation({to:invite.owner_email,academy:invite.organization_name,url:invitationUrl,expiresAt:invite.expires_at},queued.id);
  await db.rpc("saas_invitation_delivery_admin_v1",{p_actor:userId,p_action:"result",
   p_data:{id:queued.id,ok:delivery.status==="provider_accepted",messageId:delivery.status==="provider_accepted"?delivery.messageId:null}});
  return send({ok:true,invitation:data,delivery:delivery.status,
   message:delivery.status==="provider_accepted"?"Email provider accepted the invitation.":"Invitation created, but email delivery failed. Use resend or Advanced recovery."},201);
 }catch(e){return error(e)}
}
export async function GET(request:NextRequest){
 try{
  const {db,userId}=await requirePlatformAdmin(request.headers.get("authorization"));
  const {data,error:dbError}=await db.rpc("saas_pending_customer_manage_v1",{p_actor:userId,p_action:"list",p_data:{}});
  if(dbError)throw new SaaSAccessError(503,"Invitations unavailable");
  const {data:deliveries}=await db.rpc("saas_invitation_delivery_admin_v1",{p_actor:userId,p_action:"list",p_data:{}});
  return send({ok:true,invitations:data??[],deliveries:deliveries??[]});
 }catch(e){return error(e)}
}
export async function DELETE(request:NextRequest){
 try{
  const {db,userId}=await requirePlatformAdmin(request.headers.get("authorization"));
  const body=await request.json().catch(()=>null),id=body?.id;
  if(typeof id!=="string"||!/^[a-f0-9-]{36}$/i.test(id))throw new SaaSAccessError(400,"Invalid invitation");
  const {error:dbError}=await db.rpc("saas_pending_customer_manage_v1",{p_actor:userId,p_action:"revoke",p_data:{id}});
  if(dbError)throw new SaaSAccessError(dbError.code==="23514"?409:503,"Unable to revoke");
  return send({ok:true});
 }catch(e){return error(e)}
}
