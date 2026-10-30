"use client";
import type {ReactNode} from "react";

/** Shared, keyboard-accessible controls for searchable grids. Filtering takes place before pagination. */
export function GridSearch({value,onChange,placeholder,ariaLabel}:{value:string;onChange:(value:string)=>void;placeholder:string;ariaLabel?:string}){
 return <div className="toolbarSearch" style={{position:"relative"}}>
  <input className="input" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} aria-label={ariaLabel??placeholder} style={{paddingRight:value?42:undefined}}/>
  {value&&<button type="button" aria-label="Clear search" title="Clear search" onClick={()=>onChange("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",border:0,background:"transparent",cursor:"pointer",fontSize:20,padding:"4px 8px"}}>×</button>}
 </div>;
}
export function GridReset({changed,onReset,children="Reset filters"}:{changed:boolean;onReset:()=>void;children?:ReactNode}){
 return changed?<button type="button" className="button ghost" onClick={onReset} aria-label="Reset grid filters and sorting">{children}</button>:null;
}
