"use client";
export function SortableTh({label,column,sortKey,direction,onSort,className}:{label:string;column:string;sortKey:string;direction:'asc'|'desc';onSort:(column:string)=>void;className?:string}){
 const active=sortKey===column;
 return <th className={className} aria-sort={active?(direction==="asc"?"ascending":"descending"):"none"}><button type="button" className={`sortHeader ${active?'active':''}`} onClick={()=>onSort(column)}>{label}<span aria-hidden="true">{active?(direction==='asc'?'↑':'↓'):'↕'}</span></button></th>;
}
