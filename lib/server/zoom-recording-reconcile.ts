import type {SupabaseClient} from "@supabase/supabase-js";
import {encryptZoomSecret} from "@/lib/server/zoom";

// The provider owns media metadata. Robotronix owns retention, protection,
// learner visibility and deletion decisions. Provider sync must not reset them.
export async function reconcileZoomRecording(
 db:SupabaseClient, meeting:any, file:any, source:any
){
 const fileId=String(file.id||file.recording_id||"");
 if(!fileId)return false;
 const start=file.recording_start?new Date(file.recording_start):null;
 const end=file.recording_end?new Date(file.recording_end):null;
 const base=end&&Number.isFinite(end.getTime())?end:start&&Number.isFinite(start.getTime())?start:new Date();
 const days=Math.max(1,Math.min(3650,Number(meeting.recording_retention_days)||60));
 const passcode=String(source?.password||source?.recording_play_passcode||"");
 const row={
  zoom_meeting_id:meeting.id,zoom_recording_file_id:fileId,
  recording_type:String(file.recording_type||""),file_type:String(file.file_type||""),
  file_extension:String(file.file_extension||""),file_size_bytes:Number(file.file_size||0),
  recording_start:start&&Number.isFinite(start.getTime())?start.toISOString():null,
  recording_end:end&&Number.isFinite(end.getTime())?end.toISOString():null,
  play_url:String(file.play_url||source?.share_url||""),
  download_url:String(file.download_url||""),
  share_passcode_encrypted:passcode?encryptZoomSecret(passcode):null,
  status:"completed",learner_visible:Boolean(meeting.learner_recording_visible),
  retain_until:new Date(base.getTime()+days*86400000).toISOString(),
  updated_at:new Date().toISOString()
 };
 // ignoreDuplicates makes repeated notifications/reconciliations harmless:
 // no existing lifecycle or admin-controlled field can be overwritten.
 const {error}=await db.from("zoom_recordings").upsert(row,{
  onConflict:"zoom_recording_file_id",ignoreDuplicates:true
 });
 if(error)throw new Error(error.message);
 return true;
}
