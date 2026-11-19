import {NextRequest,NextResponse} from "next/server";
import {platformService} from "@/lib/server/saas/platform-admin";
import {googleConfig,digest} from "@/lib/server/saas/google-email-oauth";
import {seal,unseal} from "@/lib/server/saas/email-secrets";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const safeError=()=>NextResponse.redirect(new URL("/workspace?emailConnection=failed",process.env.GOOGLE_EMAIL_APP_ORIGIN||"https://portal.robotronixstemlab.com"));
export async function GET(req:NextRequest){
 try{
  const state=req.nextUrl.searchParams.get("state")||"",code=req.nextUrl.searchParams.get("code")||"";
  if(!/^[a-zA-Z0-9_-]{30,100}$/.test(state)||!code||code.length>4096)return safeError();
  const db=platformService(),config=googleConfig();
  // DELETE ... RETURNING consumes the state atomically: replay cannot re-use the authorization.
  const {data:rows,error}=await db.schema("saas").from("academy_email_oauth_states").delete().eq("state_hash",digest(state)).gt("expires_at",new Date().toISOString()).select("organization_id,actor_id,code_verifier_ciphertext");
  if(error||!rows||rows.length!==1)return safeError();
  const row=rows[0];
  // Recheck owner/admin membership at callback time, not only at OAuth start.
  const {data:members,error:memberError}=await db.rpc("saas_authorized_organizations",{p_actor_id:row.actor_id});
  const authorized=!memberError&&(members||[]).some((m:{organization_id:string;role_key:string})=>m.organization_id===row.organization_id&&["owner","admin"].includes(m.role_key));
  if(!authorized)return safeError();
  const tokenResponse=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,redirect_uri:config.redirectUri,grant_type:"authorization_code",code,code_verifier:unseal(row.code_verifier_ciphertext)}),cache:"no-store"});
  if(!tokenResponse.ok)return safeError();
  const tokens=await tokenResponse.json();
  if(typeof tokens.access_token!=="string"||typeof tokens.refresh_token!=="string")return safeError();
  const profileResponse=await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{Authorization:"Bearer "+tokens.access_token},cache:"no-store"});
  if(!profileResponse.ok)return safeError();
  const profile=await profileResponse.json();
  if(typeof profile.email!=="string"||profile.email_verified!==true||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email))return safeError();
  const {data:connection,error:upsertError}=await db.schema("saas").from("academy_email_connections").upsert({organization_id:row.organization_id,provider:"google",status:"pending",sender_email:profile.email,sender_verified_at:null,credential_reference:null,last_error_code:null,updated_at:new Date().toISOString()},{onConflict:"organization_id,provider"}).select("id").single();
  if(upsertError||!connection)return safeError();
  const {error:credentialError}=await db.schema("saas").from("academy_email_oauth_credentials").upsert({connection_id:connection.id,encrypted_refresh_token:seal(tokens.refresh_token),encrypted_access_token:seal(tokens.access_token),access_expires_at:new Date(Date.now()+Math.max(60,Number(tokens.expires_in)||3600)*1000).toISOString(),updated_at:new Date().toISOString()},{onConflict:"connection_id"});
  if(credentialError)return safeError();
  const {error:statusError}=await db.schema("saas").from("academy_email_connections").update({status:"connected",sender_verified_at:new Date().toISOString(),credential_reference:"oauth:"+connection.id,last_checked_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",connection.id).eq("organization_id",row.organization_id);
  if(statusError)return safeError();
  return NextResponse.redirect(new URL("/workspace?emailConnection=connected",process.env.GOOGLE_EMAIL_APP_ORIGIN||"https://portal.robotronixstemlab.com"));
 }catch{return safeError();}
}
