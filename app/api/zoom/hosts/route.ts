import {NextRequest,NextResponse} from "next/server";
import {requireAdmin} from "@/lib/server/admin-api";
import {safeHost} from "@/lib/server/zoom";
export const dynamic="force-dynamic";

export async function GET(request:NextRequest){
 const auth=await requireAdmin(request);if("error" in auth)return auth.error;
 const {data,error}=await auth.admin.from("zoom_host_accounts")
  .select("id,label,zoom_user_id,zoom_email,zoom_account_id,status,enabled,priority,recording_enabled,recording_retention_days,learner_recording_default,connected_at,last_sync_at")
  .order("priority",{ascending:true}).order("connected_at",{ascending:true});
 if(error)return NextResponse.json({ok:false,error:error.message},{status:500});
 return NextResponse.json({ok:true,hosts:(data||[]).map(safeHost)},{headers:{"Cache-Control":"no-store"}});
}

export async function PATCH(request:NextRequest){
 const auth=await requireAdmin(request);if("error" in auth)return auth.error;
 try{
  const body=await request.json().catch(()=>({})) as {id?:string;label?:string;enabled?:boolean;priority?:number;recordingEnabled?:boolean;recordingRetentionDays?:number;learnerRecordingDefault?:boolean};
  if(!body.id)throw new Error("Zoom host id is required.");
  const patch:any={updated_at:new Date().toISOString()};
  if(body.label!==undefined)patch.label=String(body.label).trim().slice(0,80)||"Zoom Host";
  if(body.enabled!==undefined)patch.enabled=Boolean(body.enabled);
  if(body.priority!==undefined)patch.priority=Math.max(1,Math.min(9999,Number(body.priority)||100));
  if(body.recordingEnabled!==undefined)patch.recording_enabled=Boolean(body.recordingEnabled);
  if(body.recordingRetentionDays!==undefined)patch.recording_retention_days=Math.max(1,Math.min(3650,Number(body.recordingRetentionDays)||60));
  if(body.learnerRecordingDefault!==undefined)patch.learner_recording_default=Boolean(body.learnerRecordingDefault);
  const {data,error}=await auth.admin.from("zoom_host_accounts").update(patch).eq("id",body.id)
   .select("id,label,zoom_user_id,zoom_email,zoom_account_id,status,enabled,priority,recording_enabled,recording_retention_days,learner_recording_default,connected_at,last_sync_at").single();
  if(error)throw new Error(error.message);
  return NextResponse.json({ok:true,host:safeHost(data)});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:400});}
}
