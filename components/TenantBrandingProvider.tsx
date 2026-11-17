"use client";
import {createContext,useContext,useEffect,useRef,useState,type CSSProperties,type ReactNode} from "react";
import {usePathname} from "next/navigation";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {tenantStyle,type TenantBranding} from "@/lib/theme/tenant-runtime";
import "@/app/tenant-branding.css";

type TenantContext={branding:TenantBranding|null;loading:boolean;reload:()=>void};
const Context=createContext<TenantContext>({branding:null,loading:false,reload:()=>{}});
export const useTenantBranding=()=>useContext(Context);
const corporatePath=(p:string)=>p.startsWith("/platform-admin")||p.startsWith("/login")||p.startsWith("/signup")||p.startsWith("/qa-");
export function TenantBrandingProvider({children}:{children:ReactNode}){
 const path=usePathname()||"/";
 const corporate=corporatePath(path);
 const [branding,setBranding]=useState<TenantBranding|null>(null);
 const [loading,setLoading]=useState(true);
 const generation=useRef(0);
 const [reloadCount,setReloadCount]=useState(0);
 useEffect(()=>{
  const client=getSupabaseBrowserClient();
  let live=true;
  const run=async()=>{
   const current=++generation.current;
   setBranding(null);
   if(!client){setLoading(false);return}
   setLoading(true);
   try{
    const {data:{session}}=await client.auth.getSession();
    if(!session)throw Error("No session");
    const authorization={Authorization:"Bearer "+session.access_token};
    const discovery=await fetch("/api/platform/organizations",{headers:authorization,cache:"no-store"});
    const selected=await discovery.json();
    if(!discovery.ok||!selected.ok||!selected.selectedOrganizationId)throw Error("No authorized selected organization");
    const response=await fetch("/api/tenant-branding?organizationId="+encodeURIComponent(selected.selectedOrganizationId),{headers:authorization,cache:"no-store"});
    const result=await response.json();
    if(!response.ok||!result.ok)throw Error("Branding unavailable");
    if(live&&current===generation.current)setBranding(result.branding as TenantBranding);
   }catch{if(live&&current===generation.current)setBranding(null)}
   finally{if(live&&current===generation.current)setLoading(false)}
  };
  void run();
  const {data:{subscription}}=client?.auth.onAuthStateChange(()=>{setReloadCount(n=>n+1)})||{data:{subscription:null}};
  return ()=>{live=false;generation.current++;subscription?.unsubscribe()};
 },[reloadCount]);
 useEffect(()=>{
  const refresh=()=>setReloadCount(n=>n+1);
  window.addEventListener("robotronix:branding-saved",refresh);
  window.addEventListener("robotronix:organization-changed",refresh);
  return ()=>{window.removeEventListener("robotronix:branding-saved",refresh);window.removeEventListener("robotronix:organization-changed",refresh)};
 },[]);
 const shown=corporate?null:branding;
 return <Context.Provider value={{branding:shown,loading,reload:()=>setReloadCount(n=>n+1)}}>
  <div className={shown?"tenantThemeScope":"tenantThemeDefault"} data-tenant-id={shown?.organizationId||undefined} style={shown?tenantStyle(shown) as CSSProperties:undefined}>{children}</div>
 </Context.Provider>;
}
