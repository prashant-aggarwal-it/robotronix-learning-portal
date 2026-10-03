import type { ReactNode } from "react";
export function KpiCard({ label, value, detail, tone="purple", icon }: {label:string;value:string|number;detail?:string;tone?:"purple"|"teal"|"amber"|"rose"|"slate";icon?:ReactNode}){
  return <div className={`kpiCard tone-${tone}`}>
    <div className="kpiTop"><span>{label}</span>{icon && <span className="kpiIcon">{icon}</span>}</div>
    <div className="kpiValue">{value}</div>
    {detail && <div className="kpiDetail">{detail}</div>}
  </div>
}
