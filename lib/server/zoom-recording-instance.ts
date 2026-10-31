/** Zoom recording APIs require the exact meeting occurrence UUID.
 * UUIDs beginning with "/" or containing "//" must be double URL-encoded.
 * Do not use the numeric meeting ID: that resolves to the latest occurrence.
 */
export function zoomMeetingInstancePath(uuid:string|null|undefined):string{
 const value=String(uuid||"").trim();
 if(!value)return "";
 const encoded=encodeURIComponent(value);
 return value.startsWith("/")||value.includes("//")?encodeURIComponent(encoded):encoded;
}
