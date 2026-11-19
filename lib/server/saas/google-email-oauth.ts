import "server-only";
import {createHash,randomBytes} from "node:crypto";
import {platformService} from "@/lib/server/saas/platform-admin";
import {seal} from "@/lib/server/saas/email-secrets";
import {getAuthorizedOrganizations,resolveAuthorizedOrganization,SaaSAccessError} from "@/lib/server/saas/organization-context";
import {roleHasCapability} from "@/lib/server/saas/role-capabilities.mjs";
export const GOOGLE_SCOPE="https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email";
export function googleConfig(){const clientId=process.env.GOOGLE_EMAIL_CLIENT_ID,clientSecret=process.env.GOOGLE_EMAIL_CLIENT_SECRET,redirectUri=process.env.GOOGLE_EMAIL_REDIRECT_URI;if(!clientId||!clientSecret||!redirectUri||!redirectUri.startsWith("https://"))throw new SaaSAccessError(503,"Google email integration not configured");return {clientId,clientSecret,redirectUri};}
export function digest(s:string){return createHash("sha256").update(s).digest("hex");}
export async function startGoogleEmail(bearer:string,organizationId:string){
 const {userId,organizations}=await getAuthorizedOrganizations(bearer);
 const org=resolveAuthorizedOrganization(organizations,organizationId);
 if(!org||!roleHasCapability(org.role,"academy.settings.manage"))throw new SaaSAccessError(403,"Academy administrator required");
 const config=googleConfig(),state=randomBytes(32).toString("base64url"),verifier=randomBytes(32).toString("base64url");
 const challenge=createHash("sha256").update(verifier).digest("base64url");
 const db=platformService();
 const {error}=await db.schema("saas").from("academy_email_oauth_states").insert({state_hash:digest(state),organization_id:org.id,actor_id:userId,code_verifier_ciphertext:seal(verifier),expires_at:new Date(Date.now()+600000).toISOString()});
 if(error)throw new SaaSAccessError(503,"Unable to initiate Google connection");
 const url=new URL("https://accounts.google.com/o/oauth2/v2/auth");
 for(const [k,v] of Object.entries({client_id:config.clientId,redirect_uri:config.redirectUri,response_type:"code",scope:GOOGLE_SCOPE,access_type:"offline",prompt:"consent",state,code_challenge:challenge,code_challenge_method:"S256"}))url.searchParams.set(k,v);
 return url.toString();
}
