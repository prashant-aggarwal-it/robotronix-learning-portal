"use client";
import Link from "next/link";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import type {ConnectWorkspace} from "@/features/connect/api/client";
import {initials,shortLabel,type Section} from "@/features/connect/model";

type NavItem={id:Section;label:string;icon:string};
type Props={showMobileNav:boolean;onToggleMobile:()=>void;canOpenPortal:boolean;tenantId:string;tenantRole:string;workspaces:ConnectWorkspace[];accountEmail:string;section:Section;visibleNavigation:NavItem[];onWorkspaceChange:(value:string)=>void;onSectionChange:(value:Section)=>void};

export function ConnectSidebar({showMobileNav,onToggleMobile,canOpenPortal,tenantId,tenantRole,workspaces,accountEmail,section,visibleNavigation,onWorkspaceChange,onSectionChange}:Props){
 return <>
  <button className="cx-mobile-menu" onClick={onToggleMobile} aria-label="Toggle navigation">☰</button>
  <aside className={"cx-sidebar "+(showMobileNav?"cx-mobile-open":"")}>
   <div className="cx-logo"><span className="cx-logo-mark">C</span><span>Robotronix <b>Connect</b></span></div>
   {canOpenPortal&&<div className="cx-app-switcher" aria-label="Application switcher">
    <span className="cx-nav-label">APPLICATIONS</span>
    <Link href="/admin" className="cx-app-switch-link">▦ <span>Learning Portal</span></Link>
    <span className="cx-app-switch-current" aria-current="page">◎ <span>Connect CRM</span></span>
   </div>}
   <div className="cx-workspace-picker">
    <span>INSTITUTE WORKSPACE</span>
    <select aria-label="Choose institute" value={tenantId} onChange={e=>onWorkspaceChange(e.target.value)}>
     {workspaces.map(w=><option key={w.tenant_id} value={w.tenant_id}>{w.workspace_name}</option>)}
    </select>
    <small>{shortLabel(tenantRole||"member")} access</small>
   </div>
   <nav aria-label="Connect navigation" className="cx-navigation">
    <span className="cx-nav-label">WORKSPACE</span>
    {visibleNavigation.map(n=><button key={n.id} className={"cx-nav-item "+(section===n.id?"active":"")} onClick={()=>onSectionChange(n.id)}><span aria-hidden="true">{n.icon}</span>{n.label}</button>)}
   </nav>
   <div className="cx-sidebar-footer"><div className="cx-persona">{initials(accountEmail)}</div>
    <div className="cx-sidebar-account"><strong>{accountEmail.split("@")[0]}</strong><small>{accountEmail}</small></div>
    <button title="Sign out" aria-label="Sign out" className="cx-signout" onClick={()=>void getSupabaseBrowserClient()?.auth.signOut()}>↪</button>
   </div>
  </aside>
 </>;
}
