/** Phase 5A: pure, browser/server-safe theme validation. No tenant lookup or CSS injection. */
export type TenantTheme = Readonly<{
 primary:string; secondary:string; accent:string;
 primaryHover:string; primarySoft:string; onPrimary:string;
}>;
export const ROBOTRONIX_THEME:TenantTheme=Object.freeze({
 primary:"#6d3cc9",primaryHover:"#4f27a8",primarySoft:"#f3edff",
 secondary:"#e83d8c",accent:"#14b8a6",onPrimary:"#ffffff"
});
export const BRAND_TOKEN_KEYS=Object.freeze({
 primary:"--brand-primary",primaryHover:"--brand-primary-hover",
 primarySoft:"--brand-primary-soft",secondary:"--brand-secondary",
 accent:"--brand-accent",onPrimary:"--brand-on-primary"
} satisfies Record<keyof TenantTheme,string>);
export function normalizeHexColor(value:unknown):string|null{
 if(typeof value!=="string")return null;
 const v=value.trim();
 if(!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v))return null;
 if(v.length===4)return "#"+[...v.slice(1).toLowerCase()].map(c=>c+c).join("");
 return v.toLowerCase();
}
function luminance(hex:string):number{
 const n=normalizeHexColor(hex);
 if(!n)throw new Error("Invalid color");
 const rgb=[1,3,5].map(i=>parseInt(n.slice(i,i+2),16)/255)
  .map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4);
 return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
}
export function contrastRatio(a:string,b:string):number{
 const x=luminance(a),y=luminance(b);
 return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
}
export function hasReadableContrast(foreground:string,background:string,minimum=4.5):boolean{
 try{return contrastRatio(foreground,background)>=minimum;}catch{return false;}
}
export function resolveTenantTheme(input:Partial<Record<keyof TenantTheme,unknown>>|null|undefined):TenantTheme{
 const output={...ROBOTRONIX_THEME};
 if(!input)return output;
 for(const key of Object.keys(ROBOTRONIX_THEME) as (keyof TenantTheme)[]){
  const valid=normalizeHexColor(input[key]);
  if(valid)output[key]=valid;
 }
 // Unsafe combinations should never be emitted as active primary button colors.
 if(!hasReadableContrast(output.onPrimary,output.primary))output.onPrimary=
  contrastRatio("#ffffff",output.primary)>=4.5?"#ffffff":"#000000";
 if(!hasReadableContrast(output.onPrimary,output.primary))output.primary=ROBOTRONIX_THEME.primary;
 return output;
}
export function themeToCssVariables(theme:Partial<Record<keyof TenantTheme,unknown>>|null|undefined):Record<string,string>{
 const validated=resolveTenantTheme(theme);
 return Object.fromEntries((Object.keys(BRAND_TOKEN_KEYS) as (keyof TenantTheme)[])
  .map(key=>[BRAND_TOKEN_KEYS[key],validated[key]]));
}
