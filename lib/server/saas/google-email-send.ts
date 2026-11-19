import "server-only";
import {platformService} from "@/lib/server/saas/platform-admin";
import {unseal,seal} from "@/lib/server/saas/email-secrets";
import {googleConfig} from "@/lib/server/saas/google-email-oauth";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
const emailRe=/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;
function mime(from:string,to:string,subject:string,text:string){
 if(!emailRe.test(from)||!emailRe.test(to)||/[\r\n]/.test(subject)||subject.length>240||text.length>100000)throw new SaaSAccessError(400,"Invalid message");
 const encoded="=?UTF-8?B?"+Buffer.from(subject).toString("base64")+"?=";
 return Buffer.from(["From: "+from,"To: "+to,"Subject: "+encoded,"MIME-Version: 1.0","Content-Type: text/plain; charset=UTF-8","Content-Transfer-Encoding: base64","",Buffer.from(text).toString("base64")].join("\r\n")).toString("base64url");
}
export async function sendAcademyGmail(organizationId:string,to:string,subject:string,text:string){
 // Server-internal only. Caller must independently authorize the academy event and recipient.
 const db=platformService();
 const {data:connection,error}=await db.schema("saas").from("academy_email_connections").select("id,status,sender_email,sender_verified_at").eq("organization_id",organizationId).eq("provider","google").single();
 if(error||!connection||connection.status!=="connected"||!connection.sender_verified_at||!connection.sender_email)throw new SaaSAccessError(409,"Academy Gmail not connected");
 const {data:credential,error:credError}=await db.schema("saas").from("academy_email_oauth_credentials").select("encrypted_refresh_token,encrypted_access_token,access_expires_at").eq("connection_id",connection.id).single();
 if(credError||!credential)throw new SaaSAccessError(409,"Academy Gmail authorization unavailable");
 let access=credential.encrypted_access_token?unseal(credential.encrypted_access_token):"";
 if(!access||!credential.access_expires_at||Date.parse(credential.access_expires_at)<Date.now()+120000){
  const cfg=googleConfig();
  const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:cfg.clientId,client_secret:cfg.clientSecret,grant_type:"refresh_token",refresh_token:unseal(credential.encrypted_refresh_token)}),cache:"no-store"});
  if(!response.ok)throw new SaaSAccessError(503,"Academy Gmail authorization expired or revoked");
  const refreshed=await response.json();if(typeof refreshed.access_token!=="string")throw new SaaSAccessError(503,"Google token refresh failed");
  access=refreshed.access_token;
  const update:Record<string,unknown>={encrypted_access_token:seal(access),access_expires_at:new Date(Date.now()+Math.max(60,Number(refreshed.expires_in)||3600)*1000).toISOString(),updated_at:new Date().toISOString()};
  if(typeof refreshed.refresh_token==="string")update.encrypted_refresh_token=seal(refreshed.refresh_token);
  const {error:saveError}=await db.schema("saas").from("academy_email_oauth_credentials").update(update).eq("connection_id",connection.id);
  if(saveError)throw new SaaSAccessError(503,"Unable to persist refreshed Gmail authorization");
 }
 const response=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",{method:"POST",headers:{Authorization:"Bearer "+access,"content-type":"application/json"},body:JSON.stringify({raw:mime(connection.sender_email,to,subject,text)}),cache:"no-store"});
 if(!response.ok)throw new SaaSAccessError(503,"Gmail did not accept academy email");
 const result=await response.json();if(typeof result.id!=="string")throw new SaaSAccessError(503,"Gmail response missing message ID");
 return {provider:"google",messageId:result.id,connectionId:connection.id};
}
