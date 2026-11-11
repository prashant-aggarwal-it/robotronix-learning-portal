import crypto from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {NextResponse} from "next/server";

// Shared by verified inbound adapters. Credentials remain on the server only.
export function ingestionClient(){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!secret)throw new Error("Connect ingestion backend is not configured");
 return createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
}
export function acceptedEvent(data:unknown){
 return NextResponse.json({ok:true,result:data},{headers:{"Cache-Control":"no-store"}});
}
export function intakeError(message:string,status:number){
 return NextResponse.json({ok:false,error:message},{status,headers:{"Cache-Control":"no-store"}});
}
export function checkHmacSha256(raw:string,provided:string|null,secret:string){
 if(!provided||!secret||!/^sha256=[0-9a-f]{64}$/i.test(provided))return false;
 const expected="sha256="+crypto.createHmac("sha256",secret).update(raw,"utf8").digest("hex");
 const a=Buffer.from(expected,"utf8"),b=Buffer.from(provided.toLowerCase(),"utf8");
 return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
export function equalSecret(a:string|null,b:string|undefined){
 if(!a||!b)return false;
 const x=Buffer.from(a),y=Buffer.from(b);
 return x.length===y.length&&crypto.timingSafeEqual(x,y);
}
export async function readRawLimited(request:Request,maxBytes=65536):Promise<string|null>{
 if(Number(request.headers.get("content-length")||0)>maxBytes)return null;
 const reader=request.body?.getReader();
 if(!reader)return "";
 const chunks:Uint8Array[]=[];let total=0;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   total+=value.byteLength;
   if(total>maxBytes){await reader.cancel();return null;}
   chunks.push(value);
  }
  return Buffer.concat(chunks.map(c=>Buffer.from(c))).toString("utf8");
 }finally{reader.releaseLock();}
}
export function safeString(input:unknown,max=250){
 return typeof input==="string"?input.trim().slice(0,max):"";
}
export function eventIdentity(value:unknown){const v=safeString(value,250);return v.length>=3?v:null;}
export async function invokeIngest(fn:"connect_ingest_channel"|"connect_ingest_website"|"connect_ingest_whatsapp_message"|"connect_ingest_whatsapp_status"|"connect_sync_whatsapp_app_contact"|"connect_import_whatsapp_history_thread"|"connect_revise_whatsapp_message"|"connect_queue_whatsapp_history"|"connect_ingest_social_message"|"connect_enrich_inbound_email"|"connect_ingest_email_thread",args:Record<string,unknown>){
 const db=ingestionClient();
 const {data,error}=await db.rpc(fn,args);
 if(error)throw new Error("Connect ingestion failed: "+error.code);
 return data;
}
// Standard Webhooks/Svix signature format used by Resend inbound emails.
export function verifySvix(raw:string,headers:Headers,secret:string){
 const id=headers.get("svix-id"),ts=headers.get("svix-timestamp"),sig=headers.get("svix-signature");
 if(!id||!ts||!sig||!/^[0-9]+$/.test(ts)||!secret.startsWith("whsec_"))return false;
 const epoch=Number(ts);
 if(!Number.isSafeInteger(epoch)||Math.abs(Math.floor(Date.now()/1000)-epoch)>300)return false;
 let key:Buffer;
 try{key=Buffer.from(secret.slice(6),"base64");}catch{return false;}
 if(key.length<16)return false;
 const computed=crypto.createHmac("sha256",key).update(id+"."+ts+"."+raw).digest();
 for(const pair of sig.split(" ")){
  if(!pair.startsWith("v1,"))continue;
  const actual=Buffer.from(pair.slice(3),"base64");
  if(actual.length===computed.length&&crypto.timingSafeEqual(actual,computed))return true;
 }
 return false;
}
