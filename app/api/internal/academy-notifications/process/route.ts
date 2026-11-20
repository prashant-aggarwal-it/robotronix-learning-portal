import {NextRequest,NextResponse} from "next/server";
import {discoverAcademyEmailEvents} from "@/lib/server/saas/academy-email-event-discovery";
import {processAcademyNotifications} from "@/lib/server/saas/academy-notifications";
import {platformService} from "@/lib/server/saas/platform-admin";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
async function heartbeat(event:"started"|"success"|"failed",discovered?:number,processed?:number){
 try{
  const {error}=await platformService().rpc("saas_platform_worker_heartbeat_v1",{
   p_event:event,p_discovered:discovered??null,p_processed:processed??null,p_error:event==="failed"?"worker_failed":null
  });
  if(error)console.error("Academy worker heartbeat unavailable",error.code);
 }catch{console.error("Academy worker heartbeat unavailable");}
}
export async function POST(req:NextRequest){
 const expected=process.env.ACADEMY_NOTIFICATION_WORKER_SECRET;
 if(!expected||expected.length<32||req.headers.get("authorization")!=="Bearer "+expected)
  return NextResponse.json({error:"Unauthorized"},{status:401,headers});
 await heartbeat("started");
 try{
  const discovered=await discoverAcademyEmailEvents(10);
  const processed=await processAcademyNotifications(10);
  await heartbeat("success",discovered.length,processed.length);
  return NextResponse.json({ok:true,discovered:discovered.length,processed:processed.length,results:processed},{headers});
 }catch{
  await heartbeat("failed");
  return NextResponse.json({error:"Notification worker failed"},{status:503,headers});
 }
}
