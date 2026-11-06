import Link from "next/link";

/** Identical application switcher in both products; caller controls visibility. */
export function ApplicationSwitcher({current}:{current:"portal"|"connect"}){
 return <div className="portalWorkspaceSwitch" aria-label="Application switcher">
  <span className="portalWorkspaceSwitchLabel">APPLICATIONS</span>
  {current==="portal"
   ?<span className="portalWorkspaceCurrent" aria-current="page" title="Learning Portal">▦ <span>Learning Portal</span></span>
   :<Link href="/admin" className="portalWorkspaceLink" title="Open Learning Portal">▦ <span>Learning Portal</span></Link>}
  {current==="connect"
   ?<span className="portalWorkspaceCurrent" aria-current="page" title="Connect CRM">◎ <span>Connect CRM</span></span>
   :<Link href="/connect" className="portalWorkspaceLink" title="Open Connect CRM">◎ <span>Connect CRM</span></Link>}
 </div>;
}
