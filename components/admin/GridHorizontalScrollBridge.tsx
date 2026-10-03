"use client";
import {useEffect} from "react";
/** A single synchronized horizontal scrollbar at the viewport bottom while the native
 * scrollbar for a long admin table is below the fold. It does not affect vertical scrolling. */
export function GridHorizontalScrollBridge(){
 useEffect(()=>{
  const mirror=document.createElement("div");
  mirror.className="gridHorizontalMirror";
  mirror.setAttribute("role","region");
  mirror.tabIndex=0;
  mirror.setAttribute("aria-label","Scroll wide grid horizontally");
  const track=document.createElement("div");track.className="gridHorizontalMirrorTrack";mirror.appendChild(track);
  document.body.appendChild(mirror);
  let active:HTMLElement|null=null;
  let frame=0;
  let syncing=false;
  const hide=()=>{mirror.style.display="none";};
  const onTableScroll=()=>{if(!active||syncing)return;syncing=true;mirror.scrollLeft=active.scrollLeft;syncing=false;};
  const onMirrorScroll=()=>{if(!active||syncing)return;syncing=true;active.scrollLeft=mirror.scrollLeft;syncing=false;};
  mirror.addEventListener("scroll",onMirrorScroll,{passive:true});
  function update(){frame=0;
   const candidates=Array.from(document.querySelectorAll<HTMLElement>(".tableWrap.professionalTable"))
    .filter(el=>{const r=el.getBoundingClientRect();return r.top<window.innerHeight-36&&r.bottom>90&&el.scrollWidth>el.clientWidth+6})
    .sort((a,b)=>{const ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect();return Math.min(rb.bottom,innerHeight)-Math.max(rb.top,0)-(Math.min(ra.bottom,innerHeight)-Math.max(ra.top,0));});
   const next=candidates[0]??null;
   if(active!==next){active?.removeEventListener("scroll",onTableScroll);active=next;active?.addEventListener("scroll",onTableScroll,{passive:true});}
   if(!active){hide();return;}
   const r=active.getBoundingClientRect();
   // When the table's native scrollbar is visible, remove the mirror to avoid duplicates.
   if(r.bottom<=window.innerHeight-16||r.top>=window.innerHeight-36){hide();return;}
   mirror.style.display="block";
   mirror.style.left=`${Math.max(8,r.left)}px`;
   mirror.style.width=`${Math.min(r.width,window.innerWidth-Math.max(8,r.left)-8)}px`;
   track.style.width=`${active.scrollWidth}px`;
   if(!syncing)mirror.scrollLeft=active.scrollLeft;
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update)};
  const observer=new MutationObserver(schedule);
  observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener("scroll",schedule,{passive:true});
  window.addEventListener("resize",schedule,{passive:true});
  schedule();
  return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener("scroll",schedule);window.removeEventListener("resize",schedule);active?.removeEventListener("scroll",onTableScroll);mirror.removeEventListener("scroll",onMirrorScroll);mirror.remove();};
 },[]);
 return null;
}
