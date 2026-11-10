"use client";
import Link from "next/link";
import {useCallback,useEffect,useState} from "react";
type Request=<T>(url:string,init?:RequestInit)=>Promise<T>;
type Notification={id:string;title:string;kind:string;href:string;created_at:string;read_at:string|null};
export function TaskInboxBell({request}:{request:Request}){
 const [items,setItems]=useState<Notification[]>([]),[open,setOpen]=useState(false);
 const [error,setError]=useState("");
 const load=useCallback(async()=>{try{const r=await request<{items:Notification[]}>("/api/tasks/notifications");setItems(r.items||[]);setError("")}catch(e){setError(e instanceof Error?e.message:"Notifications unavailable.")}},[request]);
 useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),60000);return()=>window.clearInterval(timer)},[load]);
 const read=async(id:string)=>{try{await request("/api/tasks/notifications",{method:"PATCH",body:JSON.stringify({id})});setItems(list=>list.map(n=>n.id===id?{...n,read_at:new Date().toISOString()}:n))}catch(e){setError(e instanceof Error?e.message:"Unable to mark as read.")}};
 const unread=items.filter(i=>!i.read_at).length;
 return <div className="tw-task-inbox"><button className="tw-inbox-trigger" type="button" onClick={()=>setOpen(x=>!x)} aria-expanded={open} aria-label={`${unread} unread task notifications`}>🔔{unread>0&&<b>{unread}</b>}</button>
  {open&&<div className="tw-inbox-popover"><div><strong>Task notifications</strong><button onClick={()=>void load()}>↻</button></div>{error&&<small role="alert">{error}</small>}
   {items.length?items.slice(0,12).map(n=><article key={n.id} className={n.read_at?"read":""}><Link href={n.href} onClick={()=>{setOpen(false);void read(n.id)}}><b>{n.title}</b><small>{new Date(n.created_at).toLocaleString()}</small></Link>{!n.read_at&&<button aria-label="Mark notification as read" onClick={()=>void read(n.id)}>✓</button>}</article>):<p>All caught up. Your notifications will appear here.</p>}
  </div>}</div>;
}
