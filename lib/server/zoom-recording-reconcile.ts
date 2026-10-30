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
 // Refresh provider-owned metadata for an existing completed recording.
 // Never overwrite Robotronix lifecycle, protection, visibility, retention or
 // deleted state; stale URLs otherwise remain unusable indefinitely.
 const {data:existing,error:lookupError}=await db.from("zoom_recordings")
  .select("id,status").eq("zoom_recording_file_id",fileId).maybeSingle();
 if(lookupError)throw new Error(lookupError.message);
 if(existing){
  if(existing.status!=="completed")return false;
  const providerUpdate={
   ...(row.download_url?{download_url:row.download_url}:{}),
   ...(row.play_url?{play_url:row.play_url}:{}),
   recording_type:row.recording_type,file_type:row.file_type,
   file_extension:row.file_extension,file_size_bytes:row.file_size_bytes,
   recording_start:row.recording_start,recording_end:row.recording_end,
   updated_at:row.updated_at
  };
  const {error:updateError}=await db.from("zoom_recordings").update(providerUpdate)
   .eq("id",existing.id).eq("status","completed");
  if(updateError)throw new Error(updateError.message);
  return true;
 }
 // Concurrent webhooks can both observe a missing file. Ignore only the insert
 // race; later reconciliation updates its provider metadata without altering
 // administrator-controlled policy fields.
 const {error}=await db.from("zoom_recordings").upsert(row,{
  onConflict:"zoom_recording_file_id",ignoreDuplicates:true
 });
 if(error)throw new Error(error.message);
 return true;
}
