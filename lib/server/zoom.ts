import crypto from "node:crypto";
import {createClient,type SupabaseClient} from "@supabase/supabase-js";

const ZOOM_API="https://api.zoom.us/v2";
const ZOOM_OAUTH="https://zoom.us/oauth/token";

export type ZoomHostSafe={id:string;label:string;zoomUserId:string;zoomEmail:string;zoomAccountId:string|null;status:string;enabled:boolean;priority:number;recordingEnabled:boolean;recordingRetentionDays:number;learnerRecordingDefault:boolean;connectedAt:string;lastSyncAt:string|null};

type ZoomHostRow={
 id:string;label:string;zoom_user_id:string;zoom_email:string;zoom_account_id:string|null;status:string;
 access_token_encrypted:string;refresh_token_encrypted:string;access_token_expires_at:string;
 connected_at:string;last_sync_at:string|null;
};

function required(name:string){const value=process.env[name]?.trim();if(!value)throw new Error(`${name} is not configured.`);return value;}
export function zoomClientId(){return required("ZOOM_CLIENT_ID")}
export function zoomClientSecret(){return required("ZOOM_CLIENT_SECRET")}
export function zoomRedirectUri(){return required("ZOOM_REDIRECT_URI")}
function stateSecret(){return process.env.ZOOM_OAUTH_STATE_SECRET?.trim()||zoomClientSecret()}
function encryptionKey(){
 const raw=required("ZOOM_TOKEN_ENCRYPTION_KEY");
 if(!/^[0-9a-f]{64}$/i.test(raw))throw new Error("ZOOM_TOKEN_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes).");
 return Buffer.from(raw,"hex");
}
function b64url(input:Buffer|string){return Buffer.from(input).toString("base64url")}
function constantEqual(a:string,b:string){const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)}

export function createZoomState(actorId:string,label:string){
 const payload=b64url(JSON.stringify({actorId,label:label.slice(0,80),exp:Date.now()+10*60_000,nonce:crypto.randomBytes(16).toString("hex")}));
 const sig=crypto.createHmac("sha256",stateSecret()).update(payload).digest("base64url");
 return `${payload}.${sig}`;
}
export function readZoomState(state:string){
 const [payload,sig]=state.split(".");if(!payload||!sig)throw new Error("Invalid Zoom OAuth state.");
 const expected=crypto.createHmac("sha256",stateSecret()).update(payload).digest("base64url");
 if(!constantEqual(sig,expected))throw new Error("Zoom OAuth state signature is invalid.");
 const parsed=JSON.parse(Buffer.from(payload,"base64url").toString("utf8")) as {actorId:string;label:string;exp:number;nonce:string};
 if(!parsed.actorId||!parsed.exp||parsed.exp<Date.now())throw new Error("Zoom OAuth state expired. Start the connection again.");
 return parsed;
}

export function encryptZoomSecret(value:string){
 const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv("aes-256-gcm",encryptionKey(),iv);
 const encrypted=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);const tag=cipher.getAuthTag();
 return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}
export function decryptZoomSecret(value:string){
 const [version,ivRaw,tagRaw,dataRaw]=value.split(".");if(version!=="v1"||!ivRaw||!tagRaw||!dataRaw)throw new Error("Stored Zoom token format is invalid.");
 const decipher=crypto.createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(ivRaw,"base64url"));
 decipher.setAuthTag(Buffer.from(tagRaw,"base64url"));
 return Buffer.concat([decipher.update(Buffer.from(dataRaw,"base64url")),decipher.final()]).toString("utf8");
}

export function zoomServiceClient(){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error("Server-side Supabase configuration is missing.");
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

export function zoomAuthorizationUrl(actorId:string,label:string){
 const u=new URL("https://zoom.us/oauth/authorize");
 u.searchParams.set("response_type","code");u.searchParams.set("client_id",zoomClientId());u.searchParams.set("redirect_uri",zoomRedirectUri());u.searchParams.set("state",createZoomState(actorId,label));
 return u.toString();
}

async function tokenRequest(params:URLSearchParams){
 const auth=Buffer.from(`${zoomClientId()}:${zoomClientSecret()}`).toString("base64");
 const response=await fetch(ZOOM_OAUTH,{method:"POST",headers:{Authorization:`Basic ${auth}`,"Content-Type":"application/x-www-form-urlencoded"},body:params.toString(),cache:"no-store"});
 const json=await response.json().catch(()=>({})) as any;
 if(!response.ok)throw new Error(json?.reason||json?.message||`Zoom OAuth token request failed (${response.status}).`);
 return json as {access_token:string;refresh_token:string;expires_in:number;scope?:string};
}
export async function exchangeZoomCode(code:string){return tokenRequest(new URLSearchParams({grant_type:"authorization_code",code,redirect_uri:zoomRedirectUri()}))}

async function refreshHostToken(db:SupabaseClient,row:ZoomHostRow){
 const token=await tokenRequest(new URLSearchParams({grant_type:"refresh_token",refresh_token:decryptZoomSecret(row.refresh_token_encrypted)}));
 const updates={access_token_encrypted:encryptZoomSecret(token.access_token),refresh_token_encrypted:encryptZoomSecret(token.refresh_token),access_token_expires_at:new Date(Date.now()+Math.max(60,token.expires_in-60)*1000).toISOString(),last_sync_at:new Date().toISOString(),status:"connected"};
 const {error}=await db.from("zoom_host_accounts").update(updates).eq("id",row.id);if(error)throw new Error(error.message);
 return{...row,...updates};
}
async function getHostRow(db:SupabaseClient,hostId:string){
 const {data,error}=await db.from("zoom_host_accounts").select("*").eq("id",hostId).maybeSingle();if(error)throw new Error(error.message);if(!data)throw new Error("Zoom host account not found.");return data as ZoomHostRow;
}
async function activeHost(db:SupabaseClient,hostId:string){
 let row=await getHostRow(db,hostId);if(row.status!=="connected")throw new Error("Zoom host is not connected.");
 if(new Date(row.access_token_expires_at).getTime()<=Date.now()+60_000)row=await refreshHostToken(db,row);
 return row;
}

export async function zoomApi(hostId:string,path:string,init:RequestInit={}){
 const db=zoomServiceClient();let row=await activeHost(db,hostId);
 const request=async(token:string)=>fetch(`${ZOOM_API}${path}`,{...init,cache:"no-store",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json",...(init.headers||{})}});
 let response=await request(decryptZoomSecret(row.access_token_encrypted));
 if(response.status===401){row=await refreshHostToken(db,row);response=await request(decryptZoomSecret(row.access_token_encrypted));}
 const json=await response.json().catch(()=>({})) as any;
 if(!response.ok)throw new Error(json?.message||json?.reason||`Zoom API request failed (${response.status}).`);
 await db.from("zoom_host_accounts").update({last_sync_at:new Date().toISOString()}).eq("id",hostId);
 return json;
}

export function safeHost(row:any):ZoomHostSafe{return{id:row.id,label:row.label,zoomUserId:row.zoom_user_id,zoomEmail:row.zoom_email,zoomAccountId:row.zoom_account_id,status:row.status,enabled:row.enabled!==false,priority:Number(row.priority??100),recordingEnabled:row.recording_enabled!==false,recordingRetentionDays:Number(row.recording_retention_days??60),learnerRecordingDefault:Boolean(row.learner_recording_default),connectedAt:row.connected_at,lastSyncAt:row.last_sync_at}}

export function createMeetingSdkJwt(meetingNumber:string,role:0|1){
 const now=Math.floor(Date.now()/1000)-30,exp=now+60*60*2;
 const header=b64url(JSON.stringify({alg:"HS256",typ:"JWT"}));
 const payload=b64url(JSON.stringify({appKey:zoomClientId(),mn:String(meetingNumber),role,iat:now,exp,tokenExp:exp,video_webrtc_mode:1}));
 const unsigned=`${header}.${payload}`;const signature=crypto.createHmac("sha256",zoomClientSecret()).update(unsigned).digest("base64url");
 return `${unsigned}.${signature}`;
}


export async function zoomAuthorizedFetchUrl(hostId:string,url:string,init:RequestInit={}){
 const db=zoomServiceClient();let row=await activeHost(db,hostId);
 const request=async(token:string)=>{
  const target=new URL(url);
  // Zoom cloud-recording download URLs accept the OAuth token as a query value.
  // Keeping the bearer header as well covers direct API responses, while the
  // query token survives Zoom's redirect to the signed media URL.
  if(!target.searchParams.has("access_token"))target.searchParams.set("access_token",token);
  return fetch(target.toString(),{...init,cache:"no-store",redirect:"follow",headers:{Authorization:`Bearer ${token}`,...(init.headers||{})}});
 };
 let response=await request(decryptZoomSecret(row.access_token_encrypted));
 if(response.status===401){row=await refreshHostToken(db,row);response=await request(decryptZoomSecret(row.access_token_encrypted));}
 await db.from("zoom_host_accounts").update({last_sync_at:new Date().toISOString()}).eq("id",hostId);
 return response;
}
