"use client";
import Link from "next/link";
import {navigation,type Section} from "@/features/connect/model";
import {SuiteContextLink} from "@/components/SuiteContextLink";

type Props={section:Section;loading:boolean;canOpenPortal:boolean;onRefresh:()=>void};
export function ConnectTopbar({section,loading,canOpenPortal,onRefresh}:Props){
 return <>
   <header className="cx-topbar">
    <div className="cx-breadcrumb"><SuiteContextLink module="crm"/><span aria-hidden="true">/</span><strong>{navigation.find(n=>n.id===section)?.label}</strong></div>
    <div className="cx-top-actions"><span className="cx-sync">{loading?"Refreshing…":"CRM workspace"}</span>
     <button className="cx-icon-button" aria-label="Refresh CRM data" title="Refresh data" onClick={onRefresh}>↻</button>
     {canOpenPortal&&<Link href="/admin" className="cx-portal-link">Learning Portal ↗</Link>}
    </div>
   </header>
 </>;
}
