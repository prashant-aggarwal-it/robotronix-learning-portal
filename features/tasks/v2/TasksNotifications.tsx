"use client";
import Link from "next/link";
import {useCallback,useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Notice={id:string;title:string;kind:string;href:string;created_at:string;read_at:string|null};
export function TasksNotifications(){
 const [items,setItems]=useState<Notice[]>([]);
 const [open,setOpen]=useState(false);
 const [error,setError]=useState("");
 const load=useCallback(async()=>{
  try{
   const client=getSupabaseBrowserClient();if(!client)return;
   const {data:{session}}=await client.auth.getSession();if(!session)return;
   const res=await fetch("/api/tasks/notifications",{cache:"no-store",headers:{Authorization:"Bearer "+session.access_token}});
   const body=await res.json().catch(()=>({}));
   if(!res.ok)throw new Error(body.error||"Notifications unavailable.");
   setItems(body.items||[]);setError("");
  }catch(e){setError(e instanceof Error?e.message:"Notifications unavailable.");}
 },[]);
 useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),60000);return()=>window.clearInterval(timer)},[load]);
 const markRead=async(id:string)=>{
  try{
   const client=getSupabaseBrowserClient();if(!client)return;
   const {data:{session}}=await client.auth.getSession();if(!session)return;
   const res=await fetch("/api/tasks/notifications",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({id})});
   if(!res.ok)throw new Error("Could not mark notification as read.");
   setItems(list=>list.map(n=>n.id===id?{...n,read_at:new Date().toISOString()}:n));
  }catch(e){setError(e instanceof Error?e.message:"Could not mark notification as read.");}
 };
 const unread=items.filter(x=>!x.read_at).length;
 return <div className="mt2-notifications">
  <button type="button" aria-label={"Task notifications, "+unread+" unread"} aria-expanded={open}
   onClick={()=>setOpen(x=>!x)} className="mt2-notify-trigger">🔔{unread>0&&<span>{unread}</span>}</button>
  {open&&<div className="mt2-notify-popover">
   <div className="mt2-notify-heading"><strong>Notifications</strong><button type="button" onClick={()=>void load()}>Refresh</button><button aria-label="Close notifications" type="button" onClick={()=>setOpen(false)}>✕</button></div>
   {error&&<p role="alert" className="mt2-notify-error">{error}</p>}
   {items.length?items.slice(0,20).map(n=><article key={n.id} className={n.read_at?"read":""}>
    <Link href={n.href.startsWith("/tasks/")||n.href==="/tasks"?n.href:"/tasks"} onClick={()=>{setOpen(false);void markRead(n.id)}}><b>{n.title}</b><small>{new Date(n.created_at).toLocaleString()}</small></Link>
    {!n.read_at&&<button aria-label={"Mark as read: "+n.title} onClick={()=>void markRead(n.id)} type="button">✓</button>}
   </article>):<p className="mt2-empty">You're all caught up.</p>}
  </div>}
 </div>;
}
