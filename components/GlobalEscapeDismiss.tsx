"use client";
import {useEffect} from "react";

/**
 * One Escape policy across the Learning Portal and Connect CRM.
 * Close only the uppermost visible modal/dialog by using its existing close
 * action. Never unmount a dialog directly or bypass a disabled Save/Close state.
 */
export function GlobalEscapeDismiss(){
 useEffect(()=>{
  function onKeyDown(event:KeyboardEvent){
   if(event.key!=="Escape"||event.defaultPrevented||event.isComposing)return;
   // Native selects handle Escape themselves while their option list is open.
   if(event.target instanceof HTMLSelectElement)return;

   const dialogs=Array.from(document.querySelectorAll<HTMLElement>(
    '[role="dialog"][aria-modal="true"],dialog[open],[data-escape-dialog="true"]'
   )).filter(el=>{
    if(el.getAttribute("aria-hidden")==="true"||el.closest('[inert]'))return false;
    const rect=el.getBoundingClientRect(),style=getComputedStyle(el);
    return rect.width>0&&rect.height>0&&style.display!=="none"&&style.visibility!=="hidden";
   });
   if(dialogs.length===0)return;
   // Most portals append the latest dialog at the end of the DOM. Honour
   // explicit stacking context when available (e.g. a nested editor).
   const z=(el:HTMLElement)=>{
    let score=0;let current:HTMLElement|null=el;
    while(current){const v=getComputedStyle(current).zIndex;if(v!=="auto"&&Number.isFinite(Number(v)))score=Math.max(score,Number(v));current=current.parentElement;}
    return score;
   };
   const top=dialogs.map((el,index)=>({el,index,z:z(el)}))
    .sort((a,b)=>b.z-a.z||b.index-a.index)[0].el;
   // Native <dialog> already implements Escape/cancel correctly.
   if(top instanceof HTMLDialogElement)return;

   const close=top.querySelector<HTMLButtonElement>(
    '[data-escape-close="true"],button[aria-label^="Close"],button[aria-label^="Dismiss"],button[title^="Close"]'
   )||Array.from(top.querySelectorAll<HTMLButtonElement>('button[type="button"]'))
    .find(button=>/^(close|cancel|dismiss)(\s+(profile|dialog|window|details))?$/i.test(button.textContent?.trim()||""));
   if(!close)return;
   // Respect pending saves and any component-specific confirmation dialogs.
   event.preventDefault();
   event.stopPropagation();
   if(close.disabled||close.getAttribute("aria-disabled")==="true"||top.getAttribute("aria-busy")==="true")return;
   close.click();
  }
  document.addEventListener("keydown",onKeyDown);
  return()=>document.removeEventListener("keydown",onKeyDown);
 },[]);
 return null;
}
