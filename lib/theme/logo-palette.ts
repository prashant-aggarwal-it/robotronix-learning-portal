import {contrastRatio,normalizeHexColor,resolveTenantTheme,type TenantTheme} from "./tokens";
export type SuggestedPalette=Pick<TenantTheme,"primary"|"secondary"|"accent"|"primaryHover"|"primarySoft"|"onPrimary">;
type Sample={r:number;g:number;b:number;a?:number};
const hex=(r:number,g:number,b:number)=>"#"+[r,g,b].map(x=>Math.min(255,Math.max(0,Math.round(x))).toString(16).padStart(2,"0")).join("");
const rgb=(s:string)=>{const v=normalizeHexColor(s);return v?[1,3,5].map(i=>parseInt(v.slice(i,i+2),16)):null};
function mix(a:string,b:string,t:number){const x=rgb(a)!,y=rgb(b)!;return hex(...(x.map((v,i)=>v+(y[i]-v)*t) as [number,number,number]));}
function saturation({r,g,b}:Sample){const mx=Math.max(r,g,b),mn=Math.min(r,g,b);return mx===0?0:(mx-mn)/mx;}
export function generatePalette(primary:string,secondary?:string,accent?:string):SuggestedPalette{
 const p=normalizeHexColor(primary)||"#6d3cc9";
 const s=normalizeHexColor(secondary)||p, a=normalizeHexColor(accent)||s;
 const onPrimary=contrastRatio("#ffffff",p)>=4.5?"#ffffff":"#000000";
 const hover=mix(p,onPrimary==="#ffffff"?"#000000":"#ffffff",0.16);
 return resolveTenantTheme({primary:p,secondary:s,accent:a,primaryHover:hover,primarySoft:mix(p,"#ffffff",0.91),onPrimary});
}
/** Deterministic color histogram; excludes transparent/near-white and neutral backdrops. */
export function paletteFromPixels(pixels:Uint8ClampedArray):SuggestedPalette{
 const bins=new Map<string,{n:number;r:number;g:number;b:number;s:number}>();
 for(let i=0;i+3<pixels.length;i+=4){
  const sample:Sample={r:pixels[i],g:pixels[i+1],b:pixels[i+2],a:pixels[i+3]};
  if((sample.a||0)<150)continue;
  const sat=saturation(sample),brightness=(sample.r+sample.g+sample.b)/3;
  if(brightness>237&&sat<0.12)continue;
  if(brightness<25&&sat<0.12)continue;
  if(sat<0.14)continue;
  const key=[sample.r,sample.g,sample.b].map(v=>Math.min(7,Math.floor(v/32))).join(":");
  const bin=bins.get(key)||{n:0,r:0,g:0,b:0,s:0};
  bin.n++;bin.r+=sample.r;bin.g+=sample.g;bin.b+=sample.b;bin.s+=sat;bins.set(key,bin);
 }
 const candidates=[...bins.values()].sort((a,b)=>b.n*(0.6+b.s/b.n)-a.n*(0.6+a.s/a.n))
  .map(b=>hex(b.r/b.n,b.g/b.n,b.b/b.n));
 const unique:string[]=[];
 for(const c of candidates){if(unique.every(prev=>{const a=rgb(prev)!,b=rgb(c)!;return a.reduce((sum,v,i)=>sum+(v-b[i])**2,0)>5000;}))unique.push(c);if(unique.length>=3)break;}
 return generatePalette(unique[0]||"#6d3cc9",unique[1]||"#e83d8c",unique[2]||"#14b8a6");
}
export async function detectLogoPalette(file:Blob):Promise<SuggestedPalette>{
 if(!["image/png","image/jpeg","image/webp"].includes(file.type))throw new Error("Upload PNG, JPEG or WebP");
 if(file.size>3*1024*1024)throw new Error("Logo must be below 3 MB");
 const image=await createImageBitmap(file);
 try{
  const canvas=document.createElement("canvas"),scale=Math.min(1,140/Math.max(image.width,image.height));
  canvas.width=Math.max(1,Math.floor(image.width*scale));canvas.height=Math.max(1,Math.floor(image.height*scale));
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  if(!ctx)throw new Error("Image processing unavailable");
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  return paletteFromPixels(ctx.getImageData(0,0,canvas.width,canvas.height).data);
 }finally{image.close();}
}
export function validatePublicLogoUrl(value:string):boolean{
 if(!value)return true;
 try{const url=new URL(value);return url.protocol==="https:"&&!!url.hostname&&!url.username&&!url.password&&value.length<=600;}catch{return false;}
}
