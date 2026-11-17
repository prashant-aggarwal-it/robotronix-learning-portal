"use client";
import {BrandingStudio,type BrandingOrganization} from "@/features/branding/BrandingStudio";
export default function PlatformTenantBranding({organizations}:{organizations:BrandingOrganization[]}){
 return <BrandingStudio organizations={organizations}/>;
}
