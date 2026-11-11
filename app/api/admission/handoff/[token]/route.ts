import {checkServerCapability,checkServerModule} from "@/lib/platform/server-access";
import crypto from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {connectSession,isConnectSession} from "@/lib/server/connect-auth";
import {zoomServiceClient} from "@/lib/server/zoom";

export const dynamic="force-dynamic";
type Context={params:Promise<{token:string}>};
const headers={"Cache-Control":"no-store, private"};
function tokenHash(raw:string){return crypto.createHash("sha256").update(raw).digest("hex");}

export async function GET(_request:NextRequest,{params}:Context){
 const gate=checkServerCapability("crmPortal");
 if(!gate.ok)return NextResponse.json({ok:false,error:gate.message},{status:gate.status,headers});
 const {token}=await params;
 if(!/^[A-Za-z0-9_-]{40,64}$/.test(token))return NextResponse.json({ok:false,error:"Invalid invitation."},{status:404,headers});
 const {data,error}=await zoomServiceClient().rpc("portal_admission_handoff_token",{p_token_hash:tokenHash(token),p_action:"preview"});
 if(error||!data)return NextResponse.json({ok:false,error:"This onboarding invitation has expired or is no longer available."},{status:404,headers});
 return NextResponse.json({ok:true,prefill:data},{headers});
}

export async function POST(request:NextRequest,{params}:Context){
 const gate=checkServerCapability("crmPortal");
 if(!gate.ok)return NextResponse.json({ok:false,error:gate.message},{status:gate.status,headers});
 const {token}=await params;
 if(!/^[A-Za-z0-9_-]{40,64}$/.test(token))return NextResponse.json({ok:false,error:"Invalid invitation."},{status:404,headers});
 const session=await connectSession(request);if(!isConnectSession(session))return session;
 const body=await request.json().catch(()=>null) as {onboardingSubmissionId?:string}|null;
 if(!body?.onboardingSubmissionId||!/^[0-9a-f-]{36}$/i.test(body.onboardingSubmissionId))
  return NextResponse.json({ok:false,error:"Onboarding submission is required."},{status:400,headers});
 const {data,error}=await session.admin.rpc("portal_admission_handoff_token",{
  p_token_hash:tokenHash(token),p_action:"bind",p_user_id:session.actorId,p_submission_id:body.onboardingSubmissionId,
  p_confirmed_email:session.actorEmailVerified?session.actorEmail:null
 });
 if(error)return NextResponse.json({ok:false,error:"Unable to link this invitation. Check your signed-in guardian account and onboarding details."},{status:409,headers});
 return NextResponse.json({ok:true,status:data.status},{headers});
}
