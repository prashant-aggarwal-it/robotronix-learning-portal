/** Server-safe raster logo identification (magic bytes, size and basic structure). */
export const MAX_LOGO_BYTES=3*1024*1024;
export type RasterLogo={ext:"png"|"jpg"|"webp";mime:"image/png"|"image/jpeg"|"image/webp"};
function ascii(bytes:Uint8Array,at:number,len:number){return String.fromCharCode(...bytes.subarray(at,at+len));}
const pngHeader=[137,80,78,71,13,10,26,10];
export function detectRasterLogo(bytes:Uint8Array,declaredMime:string):RasterLogo|null{
 if(bytes.length<24||bytes.length>MAX_LOGO_BYTES)return null;
 const matches=(header:number[])=>header.every((b,i)=>bytes[i]===b);
 if(matches(pngHeader)&&declaredMime==="image/png"){
  if(ascii(bytes,12,4)!=="IHDR"||bytes.length<33)return null;
  const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const width=dv.getUint32(16),height=dv.getUint32(20);
  if(width<1||height<1||width>10000||height>10000||width*height>64_000_000)return null;
  return {ext:"png",mime:"image/png"};
 }
 if(matches([255,216,255])&&declaredMime==="image/jpeg"){
  if(bytes.length<64||bytes[bytes.length-2]!==255||bytes[bytes.length-1]!==217)return null;
  return {ext:"jpg",mime:"image/jpeg"};
 }
 if(ascii(bytes,0,4)==="RIFF"&&ascii(bytes,8,4)==="WEBP"&&declaredMime==="image/webp"){
  const size=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(4,true);
  if(size<12||size+8>bytes.length)return null;
  return {ext:"webp",mime:"image/webp"};
 }
 return null;
}
