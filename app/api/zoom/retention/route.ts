import {NextRequest,NextResponse} from "next/server";
import {zoomApi,zoomServiceClient} from "@/lib/server/zoom";
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
  let deleted=0,failed=0;const failures:Array<{recordingId:string;reason:string}>=[];
  for(const r of data||[]){
   try{
    // Re-read before calling Zoom: an Admin may have just protected or extended the recording.
    const {data:current,error:readError}=await db.from("zoom_recordings").select("status,protected_from_deletion,retain_until").eq("id",r.id).single();
    if(readError)throw new Error(readError.message);
    if(current.status!=="completed"||current.protected_from_deletion||!current.retain_until||new Date(current.retain_until).getTime()>=Date.now())continue;
    const m:any=r.meeting;if(!m?.host_account_id||!m?.zoom_meeting_id)throw new Error("Recording meeting is unavailable.");
    await zoomApi(m.host_account_id,`/meetings/${encodeURIComponent(m.zoom_meeting_id)}/recordings/${encodeURIComponent(r.zoom_recording_file_id)}?action=trash`,{method:"DELETE"});
    const {error:uErr}=await db.from("zoom_recordings").update({status:"deleted",deleted_from_zoom_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",r.id);
    if(uErr)throw new Error(uErr.message);deleted++;
   }catch(cause){failed++;failures.push({recordingId:String(r.id),reason:cause instanceof Error?cause.message:String(cause)});console.error("Zoom retention cleanup failed",r.id,cause)}
  }
  return NextResponse.json({ok:true,checked:(data||[]).length,deleted,failed,failures},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:500,headers:{"Cache-Control":"no-store"}})}
}
