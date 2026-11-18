"use client";
import {useState} from "react";
import {useTenantBranding} from "./TenantBrandingProvider";
export function TenantIdentity({fallback="Robotronix",className=""}:{fallback?:string;className?:string}){
 const {branding,loading}=useTenantBranding();
 const [failed,setFailed]=useState("");
 if(loading)return <span className={"tenantIdentityLoading "+className} role="status" aria-label="Loading organization identity"/>;
 if(branding?.level==="standard")return <img src="/brand/robotronix-horizontal.png" alt={fallback} className={"tenantIdentityLogo "+className}/>;
 if(branding?.logoUrl&&failed!==branding.logoUrl)
  return <img src={branding.logoUrl} alt={branding.name} title={branding.name} className={"tenantIdentityLogo "+className} onError={()=>setFailed(branding.logoUrl)}/>;
 if(branding)return <span className="tenantIdentityText" title={branding.tagline||branding.name}>{branding.name}</span>;
 return <img src="/brand/robotronix-horizontal.png" alt={fallback} className={"tenantIdentityLogo "+className}/>;
}
