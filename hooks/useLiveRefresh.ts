"use client";
import {useEffect,useRef} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";

export function useLiveRefresh(tables:string[],refresh:()=>void|Promise<void>,key="default"){
 const refreshRef=useRef(refresh);refreshRef.current=refresh;
 useEffect(()=>{
  let timer:number|undefined;
  const schedule=()=>{if(timer)window.clearTimeout(timer);timer=window.setTimeout(()=>void refreshRef.current(),180)};
  const client=getSupabaseBrowserClient();
  const channel=client?client.channel("live-refresh-"+key+"-"+Math.random().toString(36).slice(2)):null;
  if(channel){
   for(const table of tables)channel.on("postgres_changes",{event:"*",schema:"public",table},schedule);
   channel.subscribe();
  }
  const resume=()=>{if(document.visibilityState==="visible"&&navigator.onLine!==false)schedule()};
  window.addEventListener("focus",resume);window.addEventListener("online",resume);document.addEventListener("visibilitychange",resume);
  return()=>{if(timer)window.clearTimeout(timer);window.removeEventListener("focus",resume);window.removeEventListener("online",resume);document.removeEventListener("visibilitychange",resume);if(client&&channel)void client.removeChannel(channel)};
 },[key,tables.join("|")]);
}
