import {ROBOTRONIX_THEME,resolveTenantTheme,themeToCssVariables,type TenantTheme} from "./tokens";
export type TenantBranding=Readonly<{
 organizationId:string;slug:string;name:string;tagline:string;logoUrl:string;theme:TenantTheme;
}>;
export function parseTenantBranding(value:unknown):TenantBranding|null {
 if(!value||typeof value!=="object")return null;
 const payload=value as Record<string,unknown>;
 const org=payload.organization as Record<string,unknown>|undefined;
 const brand=payload.branding as Record<string,unknown>|undefined;
 if(!org||!brand||typeof org.id!=="string"||typeof org.displayName!=="string")return null;
 const raw=brand.palette && typeof brand.palette==="object" ? brand.palette as Partial<TenantTheme> : {primary:brand.accentColor};
 const logo=typeof brand.logoUrl==="string"&&/^https:\/\/[^\s<>"]{1,590}$/.test(brand.logoUrl)?brand.logoUrl:"";
 return {organizationId:org.id,slug:typeof org.slug==="string"?org.slug:"",
 name:org.displayName,tagline:typeof brand.tagline==="string"?brand.tagline.slice(0,180):"",
 logoUrl:logo,theme:resolveTenantTheme(raw)};
}
export const defaultTenantTheme=ROBOTRONIX_THEME;
export function tenantStyle(branding:TenantBranding|null):Record<string,string>{
 return themeToCssVariables(branding?.theme||null);
}
