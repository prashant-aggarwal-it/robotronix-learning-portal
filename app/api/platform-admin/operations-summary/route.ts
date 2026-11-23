import {NextRequest,NextResponse} from "next/server";
import {requirePlatformAdmin} from "@/lib/server/saas/platform-admin";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
type Sub={organization_id:string;organization_name:string|null;plan_code:string;status:string;started_at:string|null;ends_at:string|null};
type Inv={id:string;status:string;expires_at:string;organization_name:string};
export async function GET(request:NextRequest){
 try{
  const {db}=await requirePlatformAdmin(request.headers.get("authorization"));
  const {data,error}=await db.rpc("saas_platform_monitor_read_v1",{p_kind:"operations",p_organization_id:null});
  if(error){console.error("platform operations RPC",error.code);throw new SaaSAccessError(503,"Operations summary unavailable");}
  const subscriptions=(data?.subscriptions||[]) as Sub[],invitations=(data?.invitations||[]) as Inv[];
  const now=Date.now(),week=now+7*86400000;
  const expiring=subscriptions.filter(s=>s.status==="trial"&&s.ends_at&&Date.parse(s.ends_at)>=now&&Date.parse(s.ends_at)<=week);
  const expired=subscriptions.filter(s=>s.status==="trial"&&s.ends_at&&Date.parse(s.ends_at)<now);
  const pending=invitations.filter(x=>Date.parse(x.expires_at)>=now);
  const expiredInvitations=invitations.filter(x=>Date.parse(x.expires_at)<now);
  return NextResponse.json({ok:true,subscriptions,metrics:{
   expiringTrials:expiring.length,expiredTrials:expired.length,pendingInvitations:pending.length,
   expiredInvitations:expiredInvitations.length,pastDueSubscriptions:subscriptions.filter(s=>s.status==="past_due").length
  },alerts:[
   ...expired.map(s=>({type:"trial_expired",organizationId:s.organization_id,organizationName:s.organization_name,expiresAt:s.ends_at})),
   ...pending.map(i=>({type:"owner_activation_pending",invitationId:i.id,organizationName:i.organization_name,expiresAt:i.expires_at})),
   ...expiring.map(s=>({type:"trial_expiring",organizationId:s.organization_id,organizationName:s.organization_name,expiresAt:s.ends_at})),
   ...expiredInvitations.map(i=>({type:"invitation_expired",invitationId:i.id,organizationName:i.organization_name,expiresAt:i.expires_at}))
  ].slice(0,30),truncated:!!data?.truncated||!!data?.invitationTruncated},{headers});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Operations summary unavailable"},{status:e instanceof SaaSAccessError?e.status:503,headers});}
}
