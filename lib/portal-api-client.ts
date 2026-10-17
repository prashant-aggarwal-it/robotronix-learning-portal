"use client";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";

export async function portalApi(path:string,init?:RequestInit){
 const db=getSupabaseBrowserClient();
 if(!db)throw new Error("Robotronix session is not available yet.");
 const {data:{session},error}=await db.auth.getSession();
 if(error||!session?.access_token)throw new Error("Your Robotronix session has expired. Please sign in again.");
 const response=await fetch(path,{...init,cache:"no-store",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`,...(init?.headers||{})}});
 const json=await response.json().catch(()=>({}));
 if(!response.ok||json.ok===false)throw new Error(json.error||"Request failed.");
 return json;
}
