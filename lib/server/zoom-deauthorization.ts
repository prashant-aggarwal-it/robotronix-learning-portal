import crypto from "node:crypto";
import type {NextRequest} from "next/server";
import {encryptZoomSecret,zoomClientId,zoomServiceClient} from "@/lib/server/zoom";

/** Zoom Marketplace app_deauthorized. Do not trust the payload until HMAC verification. */
export function verifyZoomDeauthorization(raw:string,request:NextRequest):boolean {
 const timestamp=request.headers.get("x-zm-request-timestamp")||"";
 const signature=request.headers.get("x-zm-signature")||"";
 if(!/^\\d{10}$/.test(timestamp)||!/^v0=[a-f0-9]{64}$/i.test(signature))return false;
 if(Math.abs(Date.now()/1000-Number(timestamp))>300)return false;
 const secret=process.env.ZOOM_WEBHOOK_SECRET_TOKEN?.trim();
 if(!secret)return false;
 const expected="v0="+crypto.createHmac("sha256",secret).update("v0:"+timestamp+":"+raw).digest("hex");
 return crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(signature));
}

/** Idempotently invalidate a single matching Zoom user, without affecting other hosts.
 * Existing learning, billing, and audit records are retained pending applicable retention policy.
 */
export async function processZoomDeauthorization(body:any){
 if(body?.event!=="app_deauthorized")throw new Error("Unexpected Zoom deauthorization event.");
 const p=body?.payload||{};
 const userId=String(p.user_id||"").trim(),accountId=String(p.account_id||"").trim();
 const clientId=String(p.client_id||"").trim();
 if(!userId||!accountId||!clientId||clientId!==zoomClientId())throw new Error("Invalid Zoom deauthorization identity.");
 const db=zoomServiceClient();
 const {data:hosts,error:lookupError}=await db.from("zoom_host_accounts")
  .select("id,status").eq("zoom_user_id",userId).eq("zoom_account_id",accountId);
 if(lookupError)throw new Error("Zoom host deauthorization lookup failed.");
 if(!hosts?.length)return {affected:0};
 // Tokens are non-nullable in existing schemas. Replace with encrypted empty values,
 // expire them, disable the host, and make all credential usage fail closed.
 const cleared=encryptZoomSecret("");
 const {data:updated,error:updateError}=await db.from("zoom_host_accounts")
  .update({status:"disconnected",enabled:false,
   access_token_encrypted:cleared,refresh_token_encrypted:cleared,
   access_token_expires_at:new Date(0).toISOString(),updated_at:new Date().toISOString()})
  .in("id",hosts.map(h=>h.id)).neq("status","disconnected").select("id");
 if(updateError)throw new Error("Zoom host credential invalidation failed.");
 return {affected:updated?.length||0};
}
