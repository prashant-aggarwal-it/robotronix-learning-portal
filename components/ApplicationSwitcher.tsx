import Link from "next/link";

/** Shared application switcher: current application is listed first. */
export function ApplicationSwitcher({current}:{current:"portal"|"connect"}){
 const portal=current==="portal"
  ?<span className="portalWorkspaceCurrent" aria-current="page" title="Learning Portal">▦ <span>Learning Portal</span></span>
  :<Link href="/admin" className="portalWorkspaceLink" title="Open Learning Portal">▦ <span>Learning Portal</span></Link>;
 const connect=current==="connect"
  ?<span className="portalWorkspaceCurrent" aria-current="page" title="Connect CRM">◎ <span>Connect CRM</span></span>
  :<Link href="/connect" className="portalWorkspaceLink" title="Open Connect CRM">◎ <span>Connect CRM</span></Link>;
 return <div className="portalWorkspaceSwitch" aria-label="Application switcher">
  <span className="portalWorkspaceSwitchLabel">APPLICATIONS</span>
  {current==="connect"?<>{connect}{portal}</>:<>{portal}{connect}</>}
 </div>;
}
