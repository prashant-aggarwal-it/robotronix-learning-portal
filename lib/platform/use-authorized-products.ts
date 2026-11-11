"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import type {ProductId} from "@/lib/platform/deployment";

export type AuthorizedProduct={id:ProductId;label:string;href:string};

/** Fail closed. Module installation and account membership are checked by the
 * server; UI state is not a security or subscription authority. */
export function useAuthorizedProducts():readonly AuthorizedProduct[]{
 const [products,setProducts]=useState<AuthorizedProduct[]>([]);
 useEffect(()=>{
  let mounted=true;
  const client=getSupabaseBrowserClient();
  if(!client)return;
  const load=async()=>{
   const {data:{session}}=await client.auth.getSession();
   if(!session){if(mounted)setProducts([]);return;}
   try{
    const response=await fetch("/api/platform/my-products",{
     headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"
    });
    if(!response.ok)throw Error("Access unavailable");
    const payload=await response.json();
    const products:unknown=payload?.products;
    if(!Array.isArray(products))throw Error("Invalid product navigation");
    if(mounted)setProducts(products.filter(x=>
      x&&typeof x==="object"&&["portal","crm","tasks"].includes(x.id)&&
      typeof x.label==="string"&&typeof x.href==="string"&&
      /^\/(?:admin|trainer|parent|student|connect|tasks)$/.test(x.href)
    ));
   }catch{if(mounted)setProducts([]);}
  };
  void load();
  const {data:{subscription}}=client.auth.onAuthStateChange(()=>{
   void Promise.resolve().then(load);
  });
  return()=>{mounted=false;subscription.unsubscribe();};
 },[]);
 return products;
}
