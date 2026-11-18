import {normalizeHexColor,preferredOnPrimary,resolveTenantTheme,type TenantTheme} from "./tokens.ts";
export type SuggestedPalette=Pick<TenantTheme,"primary"|"secondary"|"accent"|"primaryHover"|"primarySoft"|"onPrimary">;
type Sample={r:number;g:number;b:number;a?:number};
const hex=(r:number,g:number,b:number)=>"#"+[r,g,b].map(x=>Math.min(255,Math.max(0,Math.round(x))).toString(16).padStart(2,"0")).join("");
const rgb=(s:string)=>{const v=normalizeHexColor(s);return v?[1,3,5].map(i=>parseInt(v.slice(i,i+2),16)):null};
function mix(a:string,b:string,t:number){const x=rgb(a)!,y=rgb(b)!;return hex(...(x.map((v,i)=>v+(y[i]-v)*t) as [number,number,number]));}
function saturation({r,g,b}:Sample){const mx=Math.max(r,g,b),mn=Math.min(r,g,b);return mx===0?0:(mx-mn)/mx;}
export function generatePalette(primary:string,secondary?:string,accent?:string):SuggestedPalette{
 const p=normalizeHexColor(primary)||"#6d3cc9";
 const s=normalizeHexColor(secondary)||p, a=normalizeHexColor(accent)||s;
 const onPrimary=preferredOnPrimary(p);
 const hover=mix(p,onPrimary==="#ffffff"?"#000000":"#ffffff",0.16);
 return resolveTenantTheme({primary:p,secondary:s,accent:a,primaryHover:hover,primarySoft:mix(p,"#ffffff",0.91),onPrimary});
}
/** Deterministic, logo-agnostic palette extraction.
 * Cluster nearby shades, suppress neutral wordmarks when colorful artwork is
 * present, and keep true monochrome logos neutral rather than inventing hues.
 */
export function paletteFromPixels(pixels:Uint8ClampedArray):SuggestedPalette{
 type Bin={n:number;r:number;g:number;b:number;s:number};
 const bins=new Map<string,Bin>();
 let neutralCount=0,neutralR=0,neutralG=0,neutralB=0;
 for(let i=0;i+3<pixels.length;i+=4){
  const alpha=pixels[i+3]/255;
  if(alpha<0.55)continue;
  const sample:Sample={r:pixels[i],g:pixels[i+1],b:pixels[i+2]};
  const sat=saturation(sample),bright=Math.max(sample.r,sample.g,sample.b);
  if(bright>245&&sat<0.12)continue; // white / light background
  if(sat<0.19){neutralCount++;neutralR+=sample.r;neutralG+=sample.g;neutralB+=sample.b;continue;}
  const key=[sample.r,sample.g,sample.b].map(v=>Math.min(11,Math.floor(v/22))).join(":");
  const bin=bins.get(key)||{n:0,r:0,g:0,b:0,s:0};
  bin.n++;bin.r+=sample.r;bin.g+=sample.g;bin.b+=sample.b;bin.s+=sat;bins.set(key,bin);
 }
 // Group nearby quantized shades before ranking. This prevents a gradient
 // from occupying all three palette slots with almost identical colors.
 const groups:Bin[]=[];
 const distance=(a:Bin,b:Bin)=>Math.sqrt((a.r/a.n-b.r/b.n)**2+(a.g/a.n-b.g/b.n)**2+(a.b/a.n-b.b/b.n)**2);
 for(const bin of [...bins.values()].sort((a,b)=>b.n-a.n)){
  const match=groups.find(g=>distance(g,bin)<48);
  if(match){match.n+=bin.n;match.r+=bin.r;match.g+=bin.g;match.b+=bin.b;match.s+=bin.s;}
  else groups.push({...bin});
 }
 const score=(g:Bin)=>{
  const sat=g.s/g.n;
  const max=Math.max(g.r/g.n,g.g/g.n,g.b/g.n);
  // Frequency is deliberately sublinear so large dark lettering does not
  // automatically dominate a smaller but vivid multicolor mark.
  return Math.sqrt(g.n)*(0.25+sat*1.8)*(0.55+max/510);
 };
 const ranked=groups.sort((a,b)=>score(b)-score(a));
 const vivid=ranked.filter(g=>g.s/g.n>=0.38&&Math.max(g.r/g.n,g.g/g.n,g.b/g.n)>=90);
 const primaryPool=vivid.length?vivid:ranked;
 const primary=primaryPool[0];
 if(!primary){
  const neutral=neutralCount?hex(neutralR/neutralCount,neutralG/neutralCount,neutralB/neutralCount):"#242424";
  return generatePalette(neutral,neutral,neutral);
 }
 // Populate the full palette from distinctive colors first. Dark lettering
 // is not a meaningful accent when the logo already has vivid brand hues.
 // Allow moderately separated gradient endpoints as independent accents.
 const selected=[primary];
 for(const group of vivid){
  if(selected.includes(group))continue;
  if(selected.every(other=>distance(other,group)>=62))selected.push(group);
  if(selected.length===3)break;
 }
 // If the mark is truly muted, pick its other visible colors. For colorful
 // logos with just two hues, repeat one instead of inventing a navy accent.
 if(!vivid.length){
  for(const group of ranked){
   if(selected.includes(group))continue;
   if(selected.every(other=>distance(other,group)>=83))selected.push(group);
   if(selected.length===3)break;
  }
 }
 const colors=selected.map(g=>hex(g.r/g.n,g.g/g.n,g.b/g.n));
 return generatePalette(colors[0],colors[1]||colors[0],colors[2]||colors[1]||colors[0]);
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
 return value.length<=600&&/^https:\/\/[a-zA-Z0-9.-]+(?:\/[a-zA-Z0-9_./%~-]*)?$/.test(value);
}
