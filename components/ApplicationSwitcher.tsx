import Link from "next/link";

/** Shared cross-application navigation. Caller decides whether the user may see this control. */
export function ApplicationSwitcher({current}:{current:"portal"|"connect"}){
 if(current==="portal")return <div className="portalWorkspaceSwitch" aria-label="Application switcher">
  <span className="portalWorkspaceSwitchLabel">APPLICATIONS</span>
  <span className="portalWorkspaceCurrent" aria-current="page" title="Learning Portal">▦ <span>Learning Portal</span></span>
  <Link href="/connect" className="portalWorkspaceLink" title="Open Connect CRM">◎ <span>Connect CRM</span></Link>
 </div>;
 return <div className="cx-app-switcher" aria-label="Application switcher">
  <span className="cx-nav-label">APPLICATIONS</span>
  <Link href="/admin" className="cx-app-switch-link">▦ <span>Learning Portal</span></Link>
  <span className="cx-app-switch-current" aria-current="page">◎ <span>Connect CRM</span></span>
 </div>;
}
