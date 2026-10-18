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
  let deleted=0,failed=0;
  for(const r of data||[]){
   try{
    const m:any=r.meeting;if(!m?.host_account_id||!m?.zoom_meeting_id)throw new Error("Recording meeting is unavailable.");
    await zoomApi(m.host_account_id,`/meetings/${encodeURIComponent(m.zoom_meeting_id)}/recordings/${encodeURIComponent(r.zoom_recording_file_id)}?action=trash`,{method:"DELETE"});
    const {error:uErr}=await db.from("zoom_recordings").update({status:"deleted",deleted_from_zoom_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",r.id);
    if(uErr)throw new Error(uErr.message);deleted++;
   }catch{failed++}
  }
  return NextResponse.json({ok:true,checked:(data||[]).length,deleted,failed},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:500,headers:{"Cache-Control":"no-store"}})}
}
