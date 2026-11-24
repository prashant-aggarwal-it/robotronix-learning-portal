"use client";
import {BrandingStudio,type BrandingOrganization} from "@/features/branding/BrandingStudio";
export default function PlatformTenantBranding({organizations,initialOrganizationId=""}:{organizations:BrandingOrganization[];initialOrganizationId?:string}){
 return <BrandingStudio organizations={organizations} initialOrganizationId={initialOrganizationId}/>;
}
