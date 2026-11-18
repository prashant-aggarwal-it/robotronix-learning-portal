"use client";
import {createContext,useContext,useEffect,useRef,useState,type CSSProperties,type ReactNode} from "react";
import {usePathname} from "next/navigation";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {tenantStyle,type TenantBranding} from "@/lib/theme/tenant-runtime";
import "@/app/tenant-branding.css";

type TenantContext={branding:TenantBranding|null;loading:boolean;reload:()=>void};
type Snapshot={branding:TenantBranding;linkedCrmTenant:string|null;linkedTaskWorkspaces:string[];context:"crm"|"tasks"|"suite"|"academy"};
const Context=createContext<TenantContext>({branding:null,loading:false,reload:()=>{}});
export const useTenantBranding=()=>useContext(Context);

const corporatePath=(p:string)=>p.startsWith("/platform-admin")||
 p.startsWith("/login")||p.startsWith("/signup")||p.startsWith("/qa-")||
 (p.startsWith("/tasks")&&!p.startsWith("/tasks/connected"));
const isCrmPath=(p:string)=>p==="/connect"||p.startsWith("/connect/");
const isSharedTasksPath=(p:string)=>p==="/tasks/connected"||p.startsWith("/tasks/connected/");

/** Tenant identity is a presentation concern, never a grant of module access. */
export function TenantBrandingProvider({children}:{children:ReactNode}){
 const path=usePathname()||"/";
 const corporate=corporatePath(path);
 const crm=isCrmPath(path);
 const sharedTasks=isSharedTasksPath(path);
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [activeCrmTenant,setActiveCrmTenant]=useState("");
 const [activeTasksWorkspace,setActiveTasksWorkspace]=useState("");
 const [loading,setLoading]=useState(true);
 const [revision,setRevision]=useState(0);
 const generation=useRef(0);

 useEffect(()=>{
  const onRefresh=()=>{generation.current++;setSnapshot(null);setRevision(x=>x+1)};
  const onCrmTenant=(event:Event)=>{
   const id=(event as CustomEvent<{tenantId?:string}>).detail?.tenantId;
   setActiveCrmTenant(typeof id==="string"?id:"");
  };
  window.addEventListener("robotronix:branding-saved",onRefresh);
  window.addEventListener("robotronix:organization-changed",onRefresh);
  const onStorage=(event:StorageEvent)=>{
   // Auth session/organization changes in other tabs invalidate the previous identity.
   if(event.key?.includes("auth-token")||event.key==="robotronix_active_org")onRefresh();
  };
  window.addEventListener("storage",onStorage);
  const onTasksWorkspace=(event:Event)=>{
   const id=(event as CustomEvent<{workspaceId?:string}>).detail?.workspaceId;
   setActiveTasksWorkspace(typeof id==="string"?id:"");
  };
  window.addEventListener("robotronix:crm-tenant-selected",onCrmTenant);
  window.addEventListener("robotronix:tasks-workspace-selected",onTasksWorkspace);
  return ()=>{
   window.removeEventListener("robotronix:branding-saved",onRefresh);
   window.removeEventListener("robotronix:organization-changed",onRefresh);
   window.removeEventListener("robotronix:crm-tenant-selected",onCrmTenant);
   window.removeEventListener("robotronix:tasks-workspace-selected",onTasksWorkspace);
   window.removeEventListener("storage",onStorage);
  };
 },[]);

 useEffect(()=>{
  const client=getSupabaseBrowserClient();
  const controller=new AbortController();
  const current=++generation.current;
  setSnapshot(null);
  if(corporate||!client){setLoading(false);return ()=>controller.abort();}
  setLoading(true);
  const load=async()=>{
   try{
    const {data:{session}}=await client.auth.getSession();
    if(!session?.access_token)throw Error("Session unavailable");
    const headers={Authorization:"Bearer "+session.access_token};
    const discovery=await fetch("/api/platform/organizations",{headers,cache:"no-store",signal:controller.signal});
    const selected=await discovery.json();
    const orgId=selected?.selectedOrganizationId;
    if(!discovery.ok||!selected.ok||typeof orgId!=="string"||!orgId)throw Error("No active authorized organization");
    const suffix="?organizationId="+encodeURIComponent(orgId);
    const calls=[
     fetch("/api/tenant-branding"+suffix,{headers,cache:"no-store",signal:controller.signal}),
     fetch("/api/platform/organization-modules"+suffix,{headers,cache:"no-store",signal:controller.signal}),
     ...((crm||sharedTasks)?[fetch("/api/platform/organization-links"+suffix,{headers,cache:"no-store",signal:controller.signal})]:[])
    ];
    const responses=await Promise.all(calls);
    const [theme,access,links]=await Promise.all(responses.map(async response=>{
     const data=await response.json();
     if(!response.ok||!data?.ok)throw Error("Organization presentation context unavailable");
     return data;
    }));
    if(theme.branding?.organizationId!==orgId)throw Error("Mismatched organization");
    // Members may see approved branding only for an enabled module.
    if(crm ? access.modules?.crm!==true : sharedTasks ? access.modules?.tasks!==true : path.startsWith("/suite")?false:access.modules?.academy!==true)
     throw Error("Module not enabled");
    const mapped=crm&&links?.links?.crm?.status==="ready"&&typeof links.links.crm.tenantId==="string"
     ?links.links.crm.tenantId:null;
    const linkedTaskWorkspaces=sharedTasks&&links?.links?.tasks?.status==="ready"&&Array.isArray(links.links.tasks.workspaces)
     ?links.links.tasks.workspaces.filter((w:{id?:unknown})=>typeof w?.id==="string").map((w:{id:string})=>w.id):[];
    if(!controller.signal.aborted&&current===generation.current)
     setSnapshot({branding:theme.branding as TenantBranding,linkedCrmTenant:mapped,linkedTaskWorkspaces,
      context:crm?"crm":sharedTasks?"tasks":path.startsWith("/suite")?"suite":"academy"});
   }catch{
    if(!controller.signal.aborted&&current===generation.current)setSnapshot(null);
   }finally{
    if(!controller.signal.aborted&&current===generation.current)setLoading(false);
   }
  };
  void load();
  const {data:{subscription}}=client.auth.onAuthStateChange(event=>{
   if(event==="SIGNED_IN"||event==="SIGNED_OUT"||event==="USER_UPDATED")setRevision(x=>x+1);
  });
  return ()=>{controller.abort();generation.current++;subscription.unsubscribe()};
 },[revision,corporate,crm,sharedTasks,path.startsWith("/suite")]);

 // CRM branding must correspond to the actual CRM-authorized workspace, not
 // just the last Suite organization selected in a cookie.
 const currentContext=crm?"crm":sharedTasks?"tasks":path.startsWith("/suite")?"suite":"academy";
 const shown=corporate||!snapshot||snapshot.context!==currentContext ? null :
  crm && (!snapshot.linkedCrmTenant||snapshot.linkedCrmTenant!==activeCrmTenant) ? null :
  sharedTasks && (!activeTasksWorkspace||!snapshot.linkedTaskWorkspaces.includes(activeTasksWorkspace)) ? null :
  snapshot.branding;
 return <Context.Provider value={{branding:shown,loading,reload:()=>setRevision(x=>x+1)}}>
  <div className={shown?"tenantThemeScope":"tenantThemeDefault"}
   data-tenant-id={shown?.organizationId||undefined}
   style={shown?tenantStyle(shown) as CSSProperties:undefined}>{children}</div>
 </Context.Provider>;
}
