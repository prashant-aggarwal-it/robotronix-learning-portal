import "server-only";
import {createHash,randomBytes} from "node:crypto";
import {platformService} from "@/lib/server/saas/platform-admin";
import {seal} from "@/lib/server/saas/email-secrets";
import {getAuthorizedOrganizations,resolveAuthorizedOrganization,SaaSAccessError} from "@/lib/server/saas/organization-context";
import {roleHasCapability} from "@/lib/server/saas/role-capabilities.mjs";
export const MICROSOFT_SCOPES="openid profile email offline_access User.Read Mail.Send";
export function microsoftConfig(){
 const clientId=process.env.MICROSOFT_EMAIL_CLIENT_ID,clientSecret=process.env.MICROSOFT_EMAIL_CLIENT_SECRET,redirectUri=process.env.MICROSOFT_EMAIL_REDIRECT_URI;
 if(!clientId||!clientSecret||!redirectUri||!redirectUri.startsWith("https://"))throw new SaaSAccessError(503,"Microsoft email integration not configured");
 return {clientId,clientSecret,redirectUri};
}
export const microsoftDigest=(s:string)=>createHash("sha256").update(s).digest("hex");
export async function startMicrosoftEmail(bearer:string,organizationId:string){
 const {userId,organizations}=await getAuthorizedOrganizations(bearer),org=resolveAuthorizedOrganization(organizations,organizationId);
 if(!org||!roleHasCapability(org.role,"academy.settings.manage"))throw new SaaSAccessError(403,"Academy administrator required");
 const config=microsoftConfig(),state=randomBytes(32).toString("base64url"),verifier=randomBytes(32).toString("base64url"),challenge=createHash("sha256").update(verifier).digest("base64url");
 // State prefix segregates Microsoft from Google while preserving the existing one-time state table.
 const {error}=await platformService().schema("saas").from("academy_email_oauth_states").insert({state_hash:microsoftDigest("microsoft:"+state),organization_id:org.id,actor_id:userId,code_verifier_ciphertext:seal(verifier),expires_at:new Date(Date.now()+600000).toISOString()});
 if(error)throw new SaaSAccessError(503,"Unable to initiate Microsoft connection");
 const url=new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
 for(const [key,value] of Object.entries({client_id:config.clientId,response_type:"code",redirect_uri:config.redirectUri,response_mode:"query",scope:MICROSOFT_SCOPES,state,code_challenge:challenge,code_challenge_method:"S256",prompt:"select_account"}))url.searchParams.set(key,value);
 return url.toString();
}
