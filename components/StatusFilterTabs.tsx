"use client";
type StatusTab={value:string;label:string;count?:number};
export function StatusFilterTabs<T extends string>({items,value,onChange,label="Filter records"}:{items:ReadonlyArray<{value:T;label:string;count?:number}>;value:T;onChange:(value:T)=>void;label?:string}){
 return <div className="statusFilterTabs" role="group" aria-label={label}>
  {items.map(item=><button type="button" key={item.value} className={value===item.value?"statusFilterTab selected":"statusFilterTab"} aria-pressed={value===item.value} onClick={()=>onChange(item.value)}>
   <span>{item.label}</span>{typeof item.count==="number"&&<span className="statusFilterCount">{item.count}</span>}
  </button>)}
 </div>;
}
