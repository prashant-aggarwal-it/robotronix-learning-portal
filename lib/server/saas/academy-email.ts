import "server-only";
import {roleHasCapability} from "@/lib/server/saas/role-capabilities.mjs";
import {platformService} from "@/lib/server/saas/platform-admin";
import {getAuthorizedOrganizations,resolveAuthorizedOrganization,SaaSAccessError} from "@/lib/server/saas/organization-context";
export type AcademyEmailProvider="google"|"microsoft"|"smtp";
export type AcademyEmailConnection={provider:AcademyEmailProvider;status:string;sender_email:string|null;sender_verified_at:string|null;last_checked_at:string|null;last_error_code:string|null};
export async function academyEmailStatus(bearer:string,organizationId:string){
 const {organizations}=await getAuthorizedOrganizations(bearer);
 const organization=resolveAuthorizedOrganization(organizations,organizationId);
 if(!organization)throw new SaaSAccessError(403,"Select an authorized academy");
 if(!roleHasCapability(organization.role,"academy.settings.manage"))throw new SaaSAccessError(403,"Academy email settings require owner or admin access");
 const {data,error}=await platformService().schema("saas").from("academy_email_connections")
  .select("provider,status,sender_email,sender_verified_at,last_checked_at,last_error_code")
  .eq("organization_id",organization.id);
 if(error)throw new SaaSAccessError(503,"Academy email settings unavailable");
 return {organization:{id:organization.id,displayName:organization.displayName},connections:(data??[]) as AcademyEmailConnection[],
  emailSendingEnabled:(data??[]).some(row=>row.status==="connected"&&row.sender_verified_at!==null)};
}
/** Fail closed: never use platform Hostinger SMTP for academy mail. */
export async function requireAcademyEmailConnection(bearer:string,organizationId:string){
 const status=await academyEmailStatus(bearer,organizationId);
 if(!status.emailSendingEnabled)throw new SaaSAccessError(409,"Connect and verify your academy email account before sending");
 return status;
}
