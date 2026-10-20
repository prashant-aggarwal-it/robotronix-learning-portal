"use client";
import {useEffect,useRef} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";

/**
 * Database changes are invalidation hints, NOT trusted row payloads.
 * All reads go through existing RLS-protected repositories.
 * Focus/online/periodic recovery catches events missed while offline or hidden.
 */
export function useLiveRefresh(tables:string[],refresh:()=>void|Promise<void>,key="default"){
 const refreshRef=useRef(refresh);
 refreshRef.current=refresh;
 const tableKey=[...new Set(tables)].sort().join("|");
 useEffect(()=>{
  let debounce:ReturnType<typeof setTimeout>|undefined;
  let running=false,pending=false,disposed=false;
  let reconnectPending=false;
  let failureCount=0;
  const visible=()=>typeof document!=="undefined"&&document.visibilityState==="visible"&&navigator.onLine;
  const refreshSafely=async()=>{
   if(disposed||!visible())return;
   if(running){pending=true;return;}
   running=true;
   try{
    await refreshRef.current();
    failureCount=0;
   }catch(error){
    failureCount+=1;
    // Log only module/key + safe metadata; don't dump auth or private row payloads.
    console.error("Live view refresh failed",{key,attempts:failureCount,errorName:error instanceof Error?error.name:"Unknown"});
   }finally{
    running=false;
    if(pending&&!disposed){pending=false;schedule();}
   }
  };
  const schedule=()=>{
   if(disposed)return;
   if(debounce)clearTimeout(debounce);
   debounce=setTimeout(()=>{debounce=undefined;void refreshSafely()},250);
  };
  const client=getSupabaseBrowserClient();
  const channel=client?client.channel("live-refresh-"+key+"-"+Math.random().toString(36).slice(2)):null;
  if(channel){
   for(const table of tableKey.split("|").filter(Boolean))
    channel.on("postgres_changes",{event:"*",schema:"public",table},schedule);
   channel.subscribe(status=>{
    if(disposed)return;
    if(status==="SUBSCRIBED"){reconnectPending=false;schedule();}
    else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED"){
     // Supabase retries its channels. A periodic/focus refetch keeps data fresh
     // even when a Realtime subscription never recovers.
     reconnectPending=true;
    }
   });
  }
  const resume=()=>{
   if(visible())schedule();
  };
  // Reconcile every minute even when subscription events are blocked by RLS,
  // filtered out, or missed while the browser was disconnected.
  const interval=setInterval(()=>{if(visible()){if(reconnectPending)reconnectPending=false;schedule();}},60000);
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
