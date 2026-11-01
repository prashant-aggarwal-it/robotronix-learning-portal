import {encryptZoomSecret,zoomClientId,zoomServiceClient} from "@/lib/server/zoom";

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
