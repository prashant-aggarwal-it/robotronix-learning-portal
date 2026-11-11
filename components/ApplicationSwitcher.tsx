"use client";
import Link from "next/link";
import {useAuthorizedProducts} from "@/lib/platform/use-authorized-products";
import type {ProductId} from "@/lib/platform/deployment";

const icons:Record<ProductId,string>={portal:"▦",crm:"◎",tasks:"✦"};
const currentId:Record<"portal"|"connect"|"tasks",ProductId>={portal:"portal",connect:"crm",tasks:"tasks"};

/** Only shows installed products that the signed-in user can open. */
export function ApplicationSwitcher({current}:{current:"portal"|"connect"|"tasks"}){
 const products=useAuthorizedProducts();
 const selected=currentId[current];
 if(products.length<2||!products.some(product=>product.id===selected))return null;
 const ordered=[...products].sort((a,b)=>Number(b.id===selected)-Number(a.id===selected));
 return <nav className="portalWorkspaceSwitch" aria-label="Switch application">
  <span className="portalWorkspaceSwitchLabel">YOUR APPLICATIONS</span>
  {ordered.map(product=>product.id===selected?
   <span key={product.id} className="portalWorkspaceCurrent" aria-current="page" title={product.label}>
    {icons[product.id]} <span>{product.label}</span>
   </span>:
   <Link key={product.id} href={product.href} className="portalWorkspaceLink" title={"Open "+product.label}>
    {icons[product.id]} <span>{product.label}</span>
   </Link>)}
 </nav>;
}
