import "server-only";
import type {SupabaseClient} from "@supabase/supabase-js";
const missing=new Set(["PGRST202","42883"]);
/** Service-only lookup. NULL means this user never joined SaaS (legacy standalone).
 * A revoked SaaS membership produces false, not a legacy bypass.
 * Standalone Academy without the SaaS module remains supported.
 */
export async function verifyZoomTenantScope(
 db:SupabaseClient,actorId:string,kind:"schedule"|"recording",id:string
):Promise<boolean>{
 const fn=kind==="schedule"?"saas_academy_schedule_scope":"saas_academy_recording_scope";
 const args=kind==="schedule"?{p_actor_id:actorId,p_schedule_event_id:id}:
  {p_actor_id:actorId,p_recording_id:id};
 const {data,error}=await db.rpc(fn,args);
 if(!error)return data!==false;
 if(!missing.has(error.code||""))return false;
 // Missing scope RPC only means standalone when the SaaS foundation itself is absent.
 // Never allow a partially installed SaaS schema to fall back to legacy access.
 const {error:foundation}=await db.rpc("saas_authorized_organizations",{p_actor_id:actorId});
 return Boolean(foundation&&missing.has(foundation.code||""));
}
