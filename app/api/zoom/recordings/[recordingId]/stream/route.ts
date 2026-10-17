import {NextRequest,NextResponse} from "next/server";
import {zoomAuthorizedFetchUrl,zoomServiceClient} from "@/lib/server/zoom";
import {classAccessForProfile} from "@/lib/server/zoom-classroom";
import {readRecordingStreamToken} from "@/lib/server/zoom-recording";
export const dynamic="force-dynamic";

export async function GET(request:NextRequest,{params}:{params:Promise<{recordingId:string}>}){
 try{
  const {recordingId}=await params;const token=request.nextUrl.searchParams.get("token")||"";
  const grant=readRecordingStreamToken(token);if(grant.recordingId!==recordingId)throw new Error("Recording access token does not match this recording.");
  const db=zoomServiceClient();
  const {data:profile,error:profileError}=await db.from("profiles").select("id,role,active,full_name").eq("id",grant.profileId).maybeSingle();
  if(profileError||!profile?.active)return new NextResponse("Recording access is no longer valid.",{status:403});
  const {data:recording,error}=await db.from("zoom_recordings").select("id,zoom_meeting_id,download_url,status,learner_visible,file_type").eq("id",recordingId).maybeSingle();
  if(error||!recording||recording.status!=="completed"||!recording.download_url)return new NextResponse("Recording is unavailable.",{status:404});
  const {data:meeting,error:meetingError}=await db.from("zoom_meetings").select("id,host_account_id,schedule_event_id,purpose,learner_recording_visible").eq("id",recording.zoom_meeting_id).maybeSingle();
  if(meetingError||!meeting)return new NextResponse("Recording meeting is unavailable.",{status:404});
  let allowed=profile.role==="admin";
  if(!allowed&&meeting.purpose==="class"&&meeting.schedule_event_id){
   const access=await classAccessForProfile(db,meeting.schedule_event_id,profile as any);
   if(profile.role==="trainer")allowed=Boolean(access?.canHost);
   else if(recording.learner_visible&&meeting.learner_recording_visible)allowed=Boolean(access?.canJoin);
  }
  if(!allowed)return new NextResponse("You do not have access to this recording.",{status:403});
  const range=request.headers.get("range");
  const upstream=await zoomAuthorizedFetchUrl(meeting.host_account_id,recording.download_url,{headers:range?{Range:range}:{}});  
  if(!upstream.ok&&upstream.status!==206)return new NextResponse("Unable to stream this Zoom recording.",{status:upstream.status||502});
  const headers=new Headers();
  for(const key of ["content-type","content-length","content-range","accept-ranges","etag","last-modified"]){const value=upstream.headers.get(key);if(value)headers.set(key,value);}
  headers.set("Cache-Control","private, no-store");
  headers.set("Content-Disposition","inline");
  return new NextResponse(upstream.body,{status:upstream.status,headers});
 }catch(error){return new NextResponse(error instanceof Error?error.message:String(error),{status:403,headers:{"Cache-Control":"no-store"}});}
}
