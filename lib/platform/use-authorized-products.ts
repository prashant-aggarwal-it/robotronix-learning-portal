"use client";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import type {ProductId} from "@/lib/platform/deployment";

export type AuthorizedProduct={id:ProductId;label:string;href:string};

/** Fail closed. Product installation and account membership are checked by the
 * server. This navigation never becomes the business authorization authority. */
export function useAuthorizedProducts():readonly AuthorizedProduct[]{
 const [products,setProducts]=useState<AuthorizedProduct[]>([]);
 useEffect(()=>{
  let mounted=true,sequence=0;
  const client=getSupabaseBrowserClient();
  if(!client)return;
  const load=async(token:string|null|undefined)=>{
   const generation=++sequence;
   if(!token){if(mounted)setProducts([]);return;}
   try{
    const response=await fetch("/api/platform/my-products",{
     headers:{Authorization:"Bearer "+token},cache:"no-store"
    });
    if(!response.ok)throw Error("Access unavailable");
    const payload=await response.json();
    const entries:unknown=payload?.products;
    if(!Array.isArray(entries))throw Error("Invalid product navigation");
    const verified=entries.filter(x=>
      x&&typeof x==="object"&&["portal","crm","tasks"].includes(x.id)&&
      typeof x.label==="string"&&typeof x.href==="string"&&
      /^\/(?:admin|trainer|parent|student|connect|tasks)$/.test(x.href)
    ) as AuthorizedProduct[];
    if(mounted&&generation===sequence)setProducts(verified);
   }catch{if(mounted&&generation===sequence)setProducts([]);}
  };
  void client.auth.getSession().then(({data})=>load(data.session?.access_token));
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{
   // Do not call getSession inside Supabase's auth state callback.
   void load(session?.access_token);
  });
  return()=>{mounted=false;sequence++;subscription.unsubscribe();};
 },[]);
 return products;
}
