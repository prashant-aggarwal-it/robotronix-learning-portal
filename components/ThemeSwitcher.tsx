"use client";
import {useEffect,useState} from "react";

export type PortalTheme = "classic" | "ai-flow";
const STORAGE_KEY="robotronix:portal-theme";
const options:ReadonlyArray<{value:PortalTheme;label:string}>=[
 {value:"classic",label:"Classic"},
 {value:"ai-flow",label:"AI Flow"},
];
function isPortalTheme(value:string|null):value is PortalTheme {
 return value==="classic"||value==="ai-flow";
}
function applyTheme(theme:PortalTheme){
 document.documentElement.dataset.portalTheme=theme;
 document.documentElement.style.colorScheme="light";
}
export function ThemeSwitcher(){
 const[theme,setTheme]=useState<PortalTheme>("ai-flow");
 useEffect(()=>{
  let saved:PortalTheme="ai-flow";
  try{
   const value=window.localStorage.getItem(STORAGE_KEY);
   if(isPortalTheme(value))saved=value;
  }catch{/* Storage may be disabled; theme selection still works this session. */}
  setTheme(saved);
  applyTheme(saved);
 },[]);
 function changeTheme(next:PortalTheme){
  setTheme(next);
  applyTheme(next);
  try{window.localStorage.setItem(STORAGE_KEY,next);}catch{/* Storage is optional. */}
 }
 return <div className="portalThemeControl">
  <label htmlFor="portal-theme-switcher">Appearance</label>
  <select id="portal-theme-switcher" aria-label="Portal appearance theme" value={theme} onChange={event=>changeTheme(event.target.value as PortalTheme)}>
   {options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
  </select>
 </div>;
}
