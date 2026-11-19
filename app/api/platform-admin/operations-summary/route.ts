import {NextRequest,NextResponse} from "next/server";
import {requirePlatformAdmin} from "@/lib/server/saas/platform-admin";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
export async function GET(request:NextRequest){
 try{
  const {db}=await requirePlatformAdmin(request.headers.get("authorization"));
  const {data:subscriptions,error:subError}=await db.schema("saas").from("platform_subscriptions")
   .select("organization_id,plan_code,status,started_at,ends_at").order("ends_at",{ascending:true,nullsFirst:false}).limit(1000);
  if(subError)throw new SaaSAccessError(503,"Subscription summary unavailable");
  const {data:invitations,error:inviteError}=await db.schema("saas").from("pending_customer_invitations")
   .select("id,status,expires_at,organization_name").eq("status","pending").order("expires_at",{ascending:true}).limit(500);
  if(inviteError)throw new SaaSAccessError(503,"Customer activation summary unavailable");
  const now=Date.now(),week=now+7*86400000;
  const expiring=(subscriptions||[]).filter(s=>s.status==="trial"&&s.ends_at&&Date.parse(s.ends_at)>=now&&Date.parse(s.ends_at)<=week);
  const expired=(subscriptions||[]).filter(s=>s.status==="trial"&&s.ends_at&&Date.parse(s.ends_at)<now);
  const pending=(invitations||[]).filter(x=>Date.parse(x.expires_at)>=now);
  const expiredInvitations=(invitations||[]).filter(x=>Date.parse(x.expires_at)<now);
  return NextResponse.json({ok:true,subscriptions:subscriptions||[],metrics:{
   expiringTrials:expiring.length,expiredTrials:expired.length,pendingInvitations:pending.length,
   expiredInvitations:expiredInvitations.length,pastDueSubscriptions:(subscriptions||[]).filter(s=>s.status==="past_due").length
  },alerts:[
   ...expiring.map(s=>({type:"trial_expiring",organizationId:s.organization_id,expiresAt:s.ends_at})),
   ...expired.map(s=>({type:"trial_expired",organizationId:s.organization_id,expiresAt:s.ends_at})),
   ...expiredInvitations.map(i=>({type:"invitation_expired",invitationId:i.id,organizationName:i.organization_name,expiresAt:i.expires_at}))
  ].slice(0,30),truncated:subscriptions?.length===1000||invitations?.length===500},{headers});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Operations summary unavailable"},{status:e instanceof SaaSAccessError?e.status:503,headers});}
}
