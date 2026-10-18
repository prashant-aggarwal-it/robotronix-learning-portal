"use client";
import {useEffect,useRef} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";

/** Invalidate server-backed views on realtime changes, reconnection and periodic recovery.
 * Realtime is only a hint: RLS may deliberately hide sensitive operational rows.
 * The authenticated API remains the authority for every refresh.
 */
export function useLiveRefresh(tables:string[],refresh:()=>void|Promise<void>,key="default"){
 const refreshRef=useRef(refresh);refreshRef.current=refresh;
 const tableKey=[...new Set(tables)].sort().join("|");
 useEffect(()=>{
  let debounce:ReturnType<typeof setTimeout>|undefined;
  let running=false,pending=false,disposed=false;
  const refreshSafely=async()=>{
   if(disposed||document.visibilityState!=="visible"||!navigator.onLine)return;
   if(running){pending=true;return}
   running=true;
   try{await refreshRef.current()}catch(error){console.error("Live view refresh failed",key,error)}
   finally{running=false;if(pending&&!disposed){pending=false;schedule()}}
  };
  const schedule=()=>{
   if(disposed)return;
   if(debounce)clearTimeout(debounce);
   debounce=setTimeout(()=>{debounce=undefined;void refreshSafely()},250);
  };
  const client=getSupabaseBrowserClient();
  const channel=client?client.channel("live-refresh-"+key+"-"+Math.random().toString(36).slice(2)):null;
  if(channel){
   for(const table of tableKey.split("|").filter(Boolean))channel.on("postgres_changes",{event:"*",schema:"public",table},schedule);
   channel.subscribe(status=>{if(status==="SUBSCRIBED")schedule()});
  }
  const resume=()=>{if(document.visibilityState==="visible"&&navigator.onLine)schedule()};
  const interval=setInterval(resume,60000);
  window.addEventListener("focus",resume);
  window.addEventListener("online",resume);
  document.addEventListener("visibilitychange",resume);
  return()=>{
   disposed=true;
   if(debounce)clearTimeout(debounce);
   clearInterval(interval);
   window.removeEventListener("focus",resume);
   window.removeEventListener("online",resume);
   document.removeEventListener("visibilitychange",resume);
   if(client&&channel)void client.removeChannel(channel);
  };
 },[key,tableKey]);
}
