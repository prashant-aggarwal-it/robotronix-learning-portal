"use client";
import Link from "next/link";
import {navigation,type Section} from "@/features/connect/model";

type Props={section:Section;loading:boolean;canOpenPortal:boolean;onRefresh:()=>void};
export function ConnectTopbar({section,loading,canOpenPortal,onRefresh}:Props){
 return <>
   <header className="cx-topbar">
    <div className="cx-breadcrumb"><span>Connect</span><span aria-hidden="true">/</span><strong>{navigation.find(n=>n.id===section)?.label}</strong></div>
    <div className="cx-top-actions"><span className="cx-sync">{loading?"Refreshing…":"Development workspace"}</span>
     <button className="cx-icon-button" aria-label="Refresh CRM data" title="Refresh data" onClick={onRefresh}>↻</button>
     {canOpenPortal&&<Link href="/admin" className="cx-portal-link">Learning Portal ↗</Link>}
    </div>
   </header>
 </>;
}
