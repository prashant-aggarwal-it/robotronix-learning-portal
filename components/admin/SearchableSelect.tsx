"use client";
import {useEffect,useMemo,useState} from "react";
export type SearchableItem={value:string;label:string;meta?:string};
export function SearchableSelect({items,value,onChange,placeholder="Search…",disabled=false}:{items:SearchableItem[];value:string;onChange:(value:string)=>void;placeholder?:string;disabled?:boolean}){
 const selected=items.find(i=>i.value===value);const[query,setQuery]=useState(selected?.label??"");const[open,setOpen]=useState(false);
 useEffect(()=>{setQuery(selected?.label??"")},[value,selected?.label]);
 const shown=useMemo(()=>{const q=query.trim().toLowerCase();const rows=!q||selected?.label===query?items:items.filter(i=>`${i.label} ${i.meta??""}`.toLowerCase().includes(q));return rows.slice(0,80)},[items,query,selected?.label]);
 return <div className={`searchableSelect ${disabled?'disabled':''}`}><input className="input" disabled={disabled} value={query} placeholder={placeholder} onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setOpen(true);if(!e.target.value)onChange("")}} onBlur={()=>setTimeout(()=>setOpen(false),120)}/><span className="searchableSelectIcon">⌄</span>{open&&!disabled&&<div className="searchableSelectMenu">{shown.length?shown.map(i=><button type="button" className={i.value===value?"selected":""} key={i.value} onMouseDown={e=>e.preventDefault()} onClick={()=>{onChange(i.value);setQuery(i.label);setOpen(false)}}><span>{i.label}</span>{i.meta&&<small>{i.meta}</small>}</button>):<div className="searchableSelectEmpty">No matching option.</div>}</div>}</div>;
}
