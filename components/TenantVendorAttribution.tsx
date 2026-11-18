"use client";
import {useTenantBranding} from "./TenantBrandingProvider";
import {showVendorAttribution} from "@/lib/theme/tenant-runtime";
/** Product attribution, not a legal disclosure. Level is from authenticated tenant resolver. */
export function TenantVendorAttribution({className=""}:{className?:string}){
 const {branding,loading}=useTenantBranding();
 if(loading||!showVendorAttribution(branding?.level))return null;
 return <span className={"tenantVendorAttribution "+className}>Powered by Robotronix</span>;
}
