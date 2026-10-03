"use client";
import {useEffect,useId,useLayoutEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";

const EVENT="robotronix-popover-open";
export function InfoPopover({label,children,warn=false}:{label:string;children:React.ReactNode;warn?:boolean}){
 const[open,setOpen]=useState(false);const[pinned,setPinned]=useState(false);const[pos,setPos]=useState<{left:number;top:number;width:number}>({left:12,top:12,width:320});const[mounted,setMounted]=useState(false);
 const trigger=useRef<HTMLButtonElement>(null);const card=useRef<HTMLSpanElement>(null);const root=useRef<HTMLSpanElement>(null);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);const id=useId();
 const clear=()=>{if(timer.current){clearTimeout(timer.current);timer.current=null}};
 const enter=()=>{clear();setOpen(true);if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent(EVENT,{detail:id}))};
 const leave=()=>{clear();if(!pinned)timer.current=setTimeout(()=>setOpen(false),180)};
 function updatePosition(){
  if(typeof window==="undefined"||!trigger.current)return;
  const r=trigger.current.getBoundingClientRect();const gap=8;const width=Math.min(320,window.innerWidth-24);const height=Math.min(card.current?.getBoundingClientRect().height||260,Math.max(120,window.innerHeight-24));
  let left=r.left; if(left+width>window.innerWidth-12)left=Math.max(12,r.right-width); left=Math.max(12,left);
  let top=r.bottom+gap; if(top+height>window.innerHeight-12)top=Math.max(12,r.top-height-gap);
  setPos({left,top,width});
 }
 function toggle(){clear();const next=!(open&&pinned);setPinned(next);setOpen(next);if(next&&typeof window!=="undefined")window.dispatchEvent(new CustomEvent(EVENT,{detail:id}))}
 useEffect(()=>setMounted(true),[]);
 useLayoutEffect(()=>{if(open)updatePosition()},[open,children]);
 useEffect(()=>{if(!open)return;const reposition=()=>updatePosition();window.addEventListener("scroll",reposition,true);window.addEventListener("resize",reposition);return()=>{window.removeEventListener("scroll",reposition,true);window.removeEventListener("resize",reposition)}},[open]);
 useEffect(()=>{const outside=(e:PointerEvent)=>{const n=e.target as Node;if(!root.current?.contains(n)&&!card.current?.contains(n)){setPinned(false);setOpen(false)}};const key=(e:KeyboardEvent)=>{if(e.key==="Escape"){setPinned(false);setOpen(false)}};const other=(e:Event)=>{const d=(e as CustomEvent).detail;if(d!==id){setPinned(false);setOpen(false)}};document.addEventListener("pointerdown",outside);document.addEventListener("keydown",key);window.addEventListener(EVENT,other);return()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",key);window.removeEventListener(EVENT,other);clear()}},[]);
 const popup=open&&mounted?createPortal(<span ref={card} className="popoverCard fixedPopover" style={pos} role="tooltip" onMouseEnter={enter} onMouseLeave={leave}>{children}</span>,document.body):null;
 return <span ref={root} className="infoPopover" onMouseEnter={enter} onMouseLeave={leave}><button ref={trigger} type="button" className={`popoverTrigger ${warn?"warnTrigger":""}`} aria-expanded={open} onClick={toggle}>{label}</button>{popup}</span>;
}
