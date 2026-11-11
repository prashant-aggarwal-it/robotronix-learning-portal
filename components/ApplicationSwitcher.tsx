"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";

type Id="portal"|"crm"|"tasks";
type Product={id:Id;label:string;href:string};
const icon:Record<Id,string>={portal:"▦",crm:"◎",tasks:"✦"};
const legacyCurrent:Record<"portal"|"connect"|"tasks",Id>={portal:"portal",connect:"crm",tasks:"tasks"};

/** Only show authorized applications. No optimistic links: a failed request or
 * a missing product installation never becomes an accidental cross-module link.
 * The current app remains visible in its own header/sidebar without this menu.
 */
export function ApplicationSwitcher({current}:{current:"portal"|"connect"|"tasks"}){
 const [products,setProducts]=useState<Product[]>([]);
 useEffect(()=>{
  let mounted=true;
  const supabase=getSupabaseBrowserClient();
  if(!supabase)return;
  const load=async()=>{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session){if(mounted)setProducts([]);return;}
   try{
    const response=await fetch("/api/platform/my-products",{
     headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"
    });
    if(!response.ok)throw new Error("Product access unavailable");
    const payload=await response.json();
    const products=(payload.products||[]) as Product[];
    if(mounted)setProducts(Array.isArray(products)?products.filter(
      x=>["portal","crm","tasks"].includes(x.id)&&typeof x.href==="string"):[]);
   }catch{if(mounted)setProducts([]);}
  };
  void load();
  const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{
   // Supabase auth can notify while its own lock is held; defer the network call.
   void Promise.resolve().then(load);
  });
  return()=>{mounted=false;subscription.unsubscribe();};
 },[]);
 const selected=legacyCurrent[current];
 // A single installed/authorized product needs no switcher or dead-end navigation.
 if(products.length<2||!products.some(x=>x.id===selected))return null;
 const ordered=[...products].sort((a,b)=>Number(b.id===selected)-Number(a.id===selected));
 return <nav className="portalWorkspaceSwitch" aria-label="Switch application">
  <span className="portalWorkspaceSwitchLabel">YOUR APPLICATIONS</span>
  {ordered.map(product=>product.id===selected?
   <span key={product.id} className="portalWorkspaceCurrent" aria-current="page" title={product.label}>
    {icon[product.id]} <span>{product.label}</span>
   </span>:
   <Link key={product.id} href={product.href} className="portalWorkspaceLink" title={"Open "+product.label}>
    {icon[product.id]} <span>{product.label}</span>
   </Link>)}
 </nav>;
}
