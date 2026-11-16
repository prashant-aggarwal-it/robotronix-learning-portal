import "server-only";
import {createClient} from "@supabase/supabase-js";
import {SaaSAccessError,readBearerToken} from "@/lib/server/saas/organization-context";

export function platformService(){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new SaaSAccessError(503,"Platform service unavailable");
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function requirePlatformAdmin(authorization:string|null){
 const bearer=readBearerToken(authorization);
 if(!bearer)throw new SaaSAccessError(401,"Sign in first");
 const db=platformService();
 const {data:{user},error}=await db.auth.getUser(bearer);
 if(error||!user||user.is_anonymous||!user.email_confirmed_at)throw new SaaSAccessError(401,"Verified session required");
 const {data:allowed,error:permissionError}=await db.rpc("saas_is_platform_admin_v1",{p_actor_id:user.id});
 if(permissionError)throw new SaaSAccessError(503,"Platform authorization unavailable");
 if(allowed!==true)throw new SaaSAccessError(403,"Platform administrator required");
 return {db,userId:user.id};
}
