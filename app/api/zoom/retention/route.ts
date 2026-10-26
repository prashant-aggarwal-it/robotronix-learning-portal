import {NextRequest,NextResponse} from "next/server";
import {zoomApi,zoomServiceClient} from "@/lib/server/zoom";
import {logSystemEvent} from "@/lib/server/system-log";
export const dynamic="force-dynamic";

function authorised(request:NextRequest){
 const expected=process.env.INTERNAL_CRON_SECRET?.trim();
 const supplied=request.headers.get("x-robotronix-cron-secret")?.trim();
 return Boolean(expected&&supplied&&expected===supplied);
}

export async function POST(request:NextRequest){
 if(!authorised(request))return NextResponse.json({ok:false,error:"Unauthorized."},{status:401});
 try{
  const db=zoomServiceClient(),now=new Date().toISOString();
  const {data,error}=await db.from("zoom_recordings")
   .select("id,zoom_meeting_id,zoom_recording_file_id,retain_until,protected_from_deletion,status,meeting:zoom_meetings(host_account_id,zoom_meeting_id)")
   .eq("status","completed").eq("protected_from_deletion",false).lt("retain_until",now).limit(100);
  if(error)throw new Error(error.message);
  let deleted=0,failed=0;const failures:Array<{recordingId:string;reason:string}>=[];let firstReference:string|undefined;
  for(const r of data||[]){
   try{
    const {data:current,error:readError}=await db.from("zoom_recordings").select("status,protected_from_deletion,retain_until").eq("id",r.id).single();
    if(readError)throw new Error(readError.message);
    if(current.status!=="completed"||current.protected_from_deletion||!current.retain_until||new Date(current.retain_until).getTime()>=Date.now())continue;
    const m:any=r.meeting;if(!m?.host_account_id||!m?.zoom_meeting_id)throw new Error("Recording meeting is unavailable.");
    await zoomApi(m.host_account_id,`/meetings/${encodeURIComponent(m.zoom_meeting_id)}/recordings/${encodeURIComponent(r.zoom_recording_file_id)}?action=trash`,{method:"DELETE"});
    const {error:uErr}=await db.from("zoom_recordings").update({status:"deleted",deleted_from_zoom_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",r.id);
    if(uErr)throw new Error(uErr.message);deleted++;
   }catch{
    failed++;
    const reference=await logSystemEvent({source:"zoom-retention",action:"delete-recording",level:"error",code:"RETENTION_RECORDING_FAILED",message:"An expired recording could not be moved to Zoom trash."});
    firstReference??=reference;
    failures.push({recordingId:String(r.id),reason:"Recording cleanup failed. Reference: "+reference});
   }
  }
  if(deleted>0)await logSystemEvent({source:"zoom-retention",action:"cleanup",level:"info",message:"Expired Zoom recording cleanup moved "+deleted+" file(s) to trash."});
  return NextResponse.json({ok:failed===0,checked:(data||[]).length,deleted,failed,reference:firstReference,failures},{status:failed?207:200,headers:{"Cache-Control":"no-store"}});
 }catch{
  const reference=await logSystemEvent({source:"zoom-retention",action:"cleanup",level:"error",code:"RETENTION_JOB_FAILED",message:"Zoom recording retention job failed."});
  return NextResponse.json({ok:false,error:"Recording cleanup failed.",reference},{status:500,headers:{"Cache-Control":"no-store"}});
 }
}
