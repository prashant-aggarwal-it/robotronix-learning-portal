import {NextRequest,NextResponse} from "next/server";
import {platformService} from "@/lib/server/saas/platform-admin";
import {microsoftConfig,microsoftDigest} from "@/lib/server/saas/microsoft-email-oauth";
import {seal,unseal} from "@/lib/server/saas/email-secrets";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const redirect=(result:string)=>NextResponse.redirect(new URL("/workspace?emailConnection="+result,process.env.MICROSOFT_EMAIL_APP_ORIGIN||"https://portal.robotronixstemlab.com"));
export async function GET(req:NextRequest){
 try{
  const state=req.nextUrl.searchParams.get("state")||"",code=req.nextUrl.searchParams.get("code")||"";
  if(!/^[a-zA-Z0-9_-]{30,100}$/.test(state)||!code||code.length>4096)return redirect("failed");
  const db=platformService(),config=microsoftConfig();
  const {data:rows,error}=await db.schema("saas").from("academy_email_oauth_states").delete().eq("state_hash",microsoftDigest("microsoft:"+state)).gt("expires_at",new Date().toISOString()).select("organization_id,actor_id,code_verifier_ciphertext");
  if(error||rows?.length!==1)return redirect("failed");
  const row=rows[0];
  const {data:members,error:memberError}=await db.rpc("saas_authorized_organizations",{p_actor_id:row.actor_id});
  if(memberError||!(members||[]).some((m:{organization_id:string;role_key:string})=>m.organization_id===row.organization_id&&["owner","admin"].includes(m.role_key)))return redirect("failed");
  const tokenResponse=await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,redirect_uri:config.redirectUri,grant_type:"authorization_code",code,code_verifier:unseal(row.code_verifier_ciphertext),scope:"offline_access User.Read Mail.Send"}),cache:"no-store"});
  if(!tokenResponse.ok)return redirect("failed");
  const tokens=await tokenResponse.json();
  if(typeof tokens.access_token!=="string"||typeof tokens.refresh_token!=="string")return redirect("failed");
  const meResponse=await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName",{headers:{Authorization:"Bearer "+tokens.access_token},cache:"no-store"});
  if(!meResponse.ok)return redirect("failed");
  const me=await meResponse.json(),sender=me.mail||me.userPrincipalName;
  if(typeof sender!=="string"||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender))return redirect("failed");
  const now=new Date().toISOString();
  const {data:connection,error:connError}=await db.schema("saas").from("academy_email_connections").upsert({organization_id:row.organization_id,provider:"microsoft",status:"pending",sender_email:sender.toLowerCase(),sender_verified_at:null,credential_reference:null,updated_at:now},{onConflict:"organization_id,provider"}).select("id").single();
  if(connError||!connection)return redirect("failed");
  const {error:tokenError}=await db.schema("saas").from("academy_email_microsoft_credentials").upsert({connection_id:connection.id,encrypted_refresh_token:seal(tokens.refresh_token),encrypted_access_token:seal(tokens.access_token),access_expires_at:new Date(Date.now()+Math.max(60,Number(tokens.expires_in)||3600)*1000).toISOString(),updated_at:now},{onConflict:"connection_id"});
  if(tokenError)return redirect("failed");
  const {error:statusError}=await db.schema("saas").from("academy_email_connections").update({status:"connected",sender_verified_at:now,credential_reference:"microsoft:"+connection.id,last_checked_at:now,updated_at:now}).eq("id",connection.id).eq("organization_id",row.organization_id);
  return redirect(statusError?"failed":"connected");
 }catch{return redirect("failed");}
}
