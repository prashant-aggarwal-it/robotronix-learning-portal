"use client";
import Link from "next/link";
import {type ReactNode} from "react";
type Section="day"|"inbox"|"all"|"planner"|"board"|"focus"|"connected"|"settings";
type Props={section:Section;inboxCount?:number;onDashboardView?:(view:"day"|"inbox"|"all")=>void};
const links:{id:Section;label:string;href:string;icon:string}[]=[
 {id:"day",label:"My Day",href:"/tasks",icon:"✦"},
 {id:"inbox",label:"Inbox",href:"/tasks?view=inbox",icon:"▤"},
 {id:"all",label:"All Tasks",href:"/tasks?view=all",icon:"☷"},
 {id:"planner",label:"Weekly Planner",href:"/tasks/planner",icon:"▦"},
 {id:"board",label:"Visual Board",href:"/tasks/board",icon:"▥"},
 {id:"focus",label:"Focus & Finish",href:"/tasks/focus",icon:"◷"},
 {id:"connected",label:"Connected Work",href:"/tasks/connected",icon:"◇"},
 {id:"settings",label:"Settings & Data",href:"/tasks/settings",icon:"⚙"}
];
export function TasksPrimaryNav({section,inboxCount,onDashboardView}:Props){
 const render=(item:typeof links[number]):ReactNode=>{
  const active=section===item.id;
  const children=<><span className="mt2-nav-emoji" aria-hidden="true">{item.icon}</span><span>{item.label}</span>{item.id==="inbox"&&typeof inboxCount==="number"&&<span className="mt2-nav-count">{inboxCount}</span>}</>;
  const className=active?"is-active":"";
  if(onDashboardView&&(item.id==="day"||item.id==="inbox"||item.id==="all")){
   return <button type="button" key={item.id} className={className} aria-current={active?"page":undefined} onClick={()=>onDashboardView(item.id as "day"|"inbox"|"all")}>{children}</button>;
  }
  return <Link key={item.id} className={className} aria-current={active?"page":undefined} href={item.href}>{children}</Link>;
 };
 return <nav className="mt2-primary-nav" aria-label="My Tasks">
  <span className="mt2-nav-stage">DO</span>{links.slice(0,3).map(render)}
  <span className="mt2-nav-stage">PLAN & TRACK</span>{links.slice(3,6).map(render)}
  <span className="mt2-nav-stage">COLLABORATE</span>{render(links[6])}
  <span className="mt2-nav-stage">PREFERENCES</span>{render(links[7])}
 </nav>;
}
