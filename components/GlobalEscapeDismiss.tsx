"use client";
import {useEffect} from "react";

/**
 * Shared modal keyboard behaviour. Escape invokes the dialog's own close
 * action (so dirty/saving guards still apply), Tab remains inside the active
 * dialog, and focus returns to the opener after it closes.
 */
export function GlobalEscapeDismiss(){
 useEffect(()=>{
  const selector='[role="dialog"][aria-modal="true"],dialog[open],[data-escape-dialog="true"]';
  const focusable='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const visible=(el:HTMLElement)=>{
   if(el.getAttribute("aria-hidden")==="true"||el.closest("[inert]"))return false;
   const rect=el.getBoundingClientRect(),style=getComputedStyle(el);
   return rect.width>0&&rect.height>0&&style.display!=="none"&&style.visibility!=="hidden";
  };
  const stackLevel=(el:HTMLElement)=>{
   let z=0,ancestor:HTMLElement|null=el;
   while(ancestor){const layer=getComputedStyle(ancestor).zIndex;
    if(layer!=="auto"&&Number.isFinite(Number(layer)))z=Math.max(z,Number(layer));ancestor=ancestor.parentElement;
   }
   return z;
  };
  const activeDialog=()=>{
   const dialogs=Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(visible);
   return dialogs.map((el,index)=>({el,index,z:stackLevel(el)}))
    .sort((a,b)=>b.z-a.z||b.index-a.index)[0]?.el||null;
  };
  const controls=(dialog:HTMLElement)=>Array.from(dialog.querySelectorAll<HTMLElement>(focusable))
   .filter(el=>visible(el)&&el.getAttribute("aria-disabled")!=="true"&&el.tabIndex>=0);
  const previousFocus=new Map<HTMLElement,HTMLElement|null>();
  let lastDialog:HTMLElement|null=null;
  const sync=()=>{
   const top=activeDialog();
   if(top===lastDialog)return;
   const prior=lastDialog;
   if(prior&&!prior.isConnected){
    const restore=previousFocus.get(prior);previousFocus.delete(prior);
    if(restore?.isConnected&&!top)restore.focus({preventScroll:true});
   }
   if(top){
    if(!previousFocus.has(top))previousFocus.set(top,document.activeElement instanceof HTMLElement?document.activeElement:null);
    if(!top.contains(document.activeElement)){
     const first=top.querySelector<HTMLElement>("[autofocus]")||controls(top)[0]||top;
     if(first===top&&top.tabIndex<0)top.tabIndex=-1;
     first.focus({preventScroll:true});
    }
   }
   lastDialog=top;
  };
  const observer=new MutationObserver(sync);
  observer.observe(document.body,{childList:true,subtree:true});
  // A dialog may already exist if the component mounted during navigation.
  sync();
  function onKeyDown(event:KeyboardEvent){
   if(event.defaultPrevented||event.isComposing)return;
   const top=activeDialog();
   if(!top)return;
   if(event.key==="Tab"){
    const candidates=controls(top);
    if(!candidates.length){event.preventDefault();top.focus({preventScroll:true});return;}
    const first=candidates[0],last=candidates[candidates.length-1],current=document.activeElement;
    if(!top.contains(current)){event.preventDefault();(event.shiftKey?last:first).focus();return;}
    if(event.shiftKey&&current===first){event.preventDefault();last.focus();return;}
    if(!event.shiftKey&&current===last){event.preventDefault();first.focus();return;}
    return;
   }
   if(event.key!=="Escape"||event.target instanceof HTMLSelectElement)return;
   // Native dialogs already support Escape, including cancellation rules.
   if(top instanceof HTMLDialogElement)return;
   const close=top.querySelector<HTMLButtonElement>(
    '[data-escape-close="true"],button[aria-label^="Close"],button[aria-label^="Dismiss"],button[title^="Close"]'
   )||Array.from(top.querySelectorAll<HTMLButtonElement>('button[type="button"]'))
    .find(b=>/^(close|cancel|dismiss)(\s+(profile|dialog|window|details))?$/i.test(b.textContent?.trim()||""));
   if(!close)return;
   event.preventDefault();event.stopPropagation();
   if(close.disabled||close.getAttribute("aria-disabled")==="true"||top.getAttribute("aria-busy")==="true")return;
   close.click();
  }
  document.addEventListener("keydown",onKeyDown,true);
  return()=>{observer.disconnect();document.removeEventListener("keydown",onKeyDown,true);};
 },[]);
 return null;
}
