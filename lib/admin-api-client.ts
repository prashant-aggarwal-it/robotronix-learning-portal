"use client";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";

export async function adminApi(path:string,init?:RequestInit){
 const db=getSupabaseBrowserClient();
 if(!db)throw new Error("Admin session is not available yet.");
 const {data:{session},error:sessionError}=await db.auth.getSession();
 if(sessionError)throw new Error("Unable to read the current Admin session. Please retry.");
 const token=session?.access_token;
 if(!token)throw new Error("Your Admin session is still loading or has expired. Please sign in again.");
 const response=await fetch(path,{...init,cache:"no-store",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`,...(init?.headers||{})}});
 const json=await response.json().catch(()=>({}));
 if(!response.ok||json.ok===false)throw new Error(json.error||"Request failed.");
 return json;
}
