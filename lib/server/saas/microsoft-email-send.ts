import "server-only";
import {platformService} from "@/lib/server/saas/platform-admin";
import {unseal,seal} from "@/lib/server/saas/email-secrets";
import {microsoftConfig} from "@/lib/server/saas/microsoft-email-oauth";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
const email=/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;
export async function sendAcademyMicrosoft(organizationId:string,to:string,subject:string,text:string){
 if(!email.test(to)||!subject||subject.length>240||/[\r\n]/.test(subject)||!text||text.length>100000)throw new SaaSAccessError(400,"Invalid message");
 const db=platformService();
 const {data:connection,error}=await db.schema("saas").from("academy_email_connections").select("id,status,sender_email,sender_verified_at").eq("organization_id",organizationId).eq("provider","microsoft").single();
 if(error||connection?.status!=="connected"||!connection.sender_verified_at||!connection.sender_email)throw new SaaSAccessError(409,"Academy Microsoft email not connected");
 const {data:credential,error:credError}=await db.schema("saas").from("academy_email_microsoft_credentials").select("encrypted_refresh_token,encrypted_access_token,access_expires_at").eq("connection_id",connection.id).single();
 if(credError||!credential)throw new SaaSAccessError(409,"Microsoft credentials unavailable");
 let access=credential.encrypted_access_token?unseal(credential.encrypted_access_token):"";
 if(!access||!credential.access_expires_at||Date.parse(credential.access_expires_at)<Date.now()+120000){
  const cfg=microsoftConfig();
  const response=await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:cfg.clientId,client_secret:cfg.clientSecret,grant_type:"refresh_token",refresh_token:unseal(credential.encrypted_refresh_token),scope:"offline_access User.Read Mail.Send"}),cache:"no-store"});
  if(!response.ok)throw new SaaSAccessError(503,"Microsoft authorization expired or revoked");
  const tokens=await response.json();if(typeof tokens.access_token!=="string")throw new SaaSAccessError(503,"Microsoft refresh failed");
  access=tokens.access_token;
  const update:Record<string,unknown>={encrypted_access_token:seal(access),access_expires_at:new Date(Date.now()+Math.max(60,Number(tokens.expires_in)||3600)*1000).toISOString(),updated_at:new Date().toISOString()};
  if(typeof tokens.refresh_token==="string")update.encrypted_refresh_token=seal(tokens.refresh_token);
  const {error:saveError}=await db.schema("saas").from("academy_email_microsoft_credentials").update(update).eq("connection_id",connection.id);
  if(saveError)throw new SaaSAccessError(503,"Unable to save refreshed Microsoft authorization");
 }
 const response=await fetch("https://graph.microsoft.com/v1.0/me/sendMail",{method:"POST",headers:{Authorization:"Bearer "+access,"content-type":"application/json"},body:JSON.stringify({message:{subject,body:{contentType:"Text",content:text},toRecipients:[{emailAddress:{address:to}}]},saveToSentItems:true}),cache:"no-store"});
 if(!response.ok)throw new SaaSAccessError(503,"Microsoft Graph did not accept message");
 return {provider:"microsoft",messageId:null,connectionId:connection.id};
}
