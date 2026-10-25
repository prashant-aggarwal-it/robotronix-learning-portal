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
 const raw=await response.text();
 let json:Record<string,any>={};try{json=raw?JSON.parse(raw):{}}catch{}
 if(!response.ok||json.ok===false){
  const reason=typeof json.error==="string"&&json.error.trim()?json.error:response.status===504||response.status===502?"The server did not finish processing this request. Try again; existing Zoom meetings will be skipped.":response.status===401?"Your Admin session expired. Sign in again.":response.status===403?"Administrator access is required.":`Request failed (HTTP ${response.status}). Check server logs if this continues.`;
  throw new Error(reason);
 }
 return json;
}
