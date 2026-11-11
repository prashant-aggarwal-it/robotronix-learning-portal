import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
export async function taskAccountIsActive():Promise<boolean>{
 const client=getSupabaseBrowserClient();if(!client)return false;
 const {data:{session}}=await client.auth.getSession();if(!session)return false;
 const response=await fetch("/api/tasks/onboarding",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});
 if(!response.ok)return false;
 const result=await response.json().catch(()=>({}));
 return result?.account?.status==="active"&&!result?.portalDisabled;
}
