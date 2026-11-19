import "server-only";
import {platformService} from "@/lib/server/saas/platform-admin";
import {getAuthorizedOrganizations,resolveAuthorizedOrganization,SaaSAccessError} from "@/lib/server/saas/organization-context";
import {roleHasCapability} from "@/lib/server/saas/role-capabilities.mjs";
import {seal,unseal} from "@/lib/server/saas/email-secrets";
import {verifyAcademySmtp,deliverAcademySmtp,validateSmtpSettings,type AcademySmtpSettings} from "@/lib/server/saas/academy-smtp-transport";
export async function authorizeSmtpOwner(bearer:string,organizationId:string){
 const {organizations}=await getAuthorizedOrganizations(bearer);
 const org=resolveAuthorizedOrganization(organizations,organizationId);
 if(!org||!roleHasCapability(org.role,"academy.settings.manage"))throw new SaaSAccessError(403,"Academy owner or admin required");
 return org;
}
export async function connectAcademySmtp(bearer:string,organizationId:string,settings:AcademySmtpSettings){
 await authorizeSmtpOwner(bearer,organizationId);
 validateSmtpSettings(settings);
 // SMTP verify checks authentication and TLS; it does NOT prove permission to use an arbitrary From address.
 // Restrict From to the authenticated mailbox unless a future provider-specific verified-alias workflow exists.
 if(settings.senderEmail.toLowerCase()!==settings.username.toLowerCase())throw new SaaSAccessError(400,"SMTP sender must match the authenticated mailbox");
 try{await verifyAcademySmtp(settings);}catch{throw new SaaSAccessError(422,"SMTP connection or authentication failed");}
 const db=platformService(),now=new Date().toISOString();
 const {data:connection,error}=await db.schema("saas").from("academy_email_connections").upsert({organization_id:organizationId,provider:"smtp",status:"pending",sender_email:settings.senderEmail.toLowerCase(),sender_verified_at:null,credential_reference:null,last_checked_at:now,last_error_code:null,updated_at:now},{onConflict:"organization_id,provider"}).select("id").single();
 if(error||!connection)throw new SaaSAccessError(503,"Unable to save SMTP connection");
 const {error:secretError}=await db.schema("saas").from("academy_email_smtp_credentials").upsert({connection_id:connection.id,host:settings.host,port:settings.port,secure:settings.secure,username:settings.username,encrypted_password:seal(settings.password),updated_at:now},{onConflict:"connection_id"});
 if(secretError)throw new SaaSAccessError(503,"Unable to store encrypted SMTP credentials");
 const {error:activateError}=await db.schema("saas").from("academy_email_connections").update({status:"connected",sender_verified_at:now,credential_reference:"smtp:"+connection.id,last_checked_at:now,updated_at:now}).eq("id",connection.id).eq("organization_id",organizationId);
 if(activateError)throw new SaaSAccessError(503,"Unable to activate SMTP connection");
 return {ok:true,senderEmail:settings.senderEmail};
}
export async function disconnectAcademySmtp(bearer:string,organizationId:string){
 await authorizeSmtpOwner(bearer,organizationId);
 const db=platformService();
 const {data:connection,error}=await db.schema("saas").from("academy_email_connections").select("id").eq("organization_id",organizationId).eq("provider","smtp").maybeSingle();
 if(error)throw new SaaSAccessError(503,"SMTP settings unavailable");
 if(connection){
  const {error:deleteError}=await db.schema("saas").from("academy_email_smtp_credentials").delete().eq("connection_id",connection.id);
  if(deleteError)throw new SaaSAccessError(503,"Unable to delete SMTP credentials");
  const {error:updateError}=await db.schema("saas").from("academy_email_connections").update({status:"disconnected",sender_email:null,sender_verified_at:null,credential_reference:null,updated_at:new Date().toISOString()}).eq("id",connection.id).eq("organization_id",organizationId);
  if(updateError)throw new SaaSAccessError(503,"Unable to disconnect SMTP");
 }
 return {ok:true};
}
export async function sendAcademySmtp(organizationId:string,to:string,subject:string,text:string){
 // Internal adapter only: caller must separately authorize the notification event and recipient.
 const db=platformService();
 const {data:connection,error}=await db.schema("saas").from("academy_email_connections").select("id,sender_email,status,sender_verified_at").eq("organization_id",organizationId).eq("provider","smtp").single();
 if(error||!connection||connection.status!=="connected"||!connection.sender_verified_at||!connection.sender_email)throw new SaaSAccessError(409,"Academy SMTP not connected");
 const {data:credential,error:credError}=await db.schema("saas").from("academy_email_smtp_credentials").select("host,port,secure,username,encrypted_password").eq("connection_id",connection.id).single();
 if(credError||!credential)throw new SaaSAccessError(409,"Academy SMTP credentials unavailable");
 const result=await deliverAcademySmtp({host:credential.host,port:credential.port,secure:credential.secure,username:credential.username,password:unseal(credential.encrypted_password),senderEmail:connection.sender_email},to,subject,text);
 return {...result,connectionId:connection.id};
}
