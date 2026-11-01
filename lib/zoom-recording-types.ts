/** Keep non-video Zoom artifacts in storage, not the video playback library. */
export function isPlayableZoomVideo(recording:{file_type?:string|null;file_extension?:string|null}):boolean{
 const type=String(recording.file_type||"").trim().toUpperCase();
 const extension=String(recording.file_extension||"").trim().replace(/^\./,"").toUpperCase();
 return type==="MP4"||(type===""&&extension==="MP4");
}
