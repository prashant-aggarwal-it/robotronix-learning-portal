"use client";
import Link from "next/link";
import {TasksQuickAdd} from "./TasksQuickAdd";
type Section="day"|"inbox"|"all"|"planner"|"board"|"focus"|"connected"|"settings";
type Props={section:Section;inboxCount?:number;onDashboardView?:(view:"day"|"inbox"|"all")=>void};
const links:{id:Section;label:string;href:string;icon:string}[]=[
 {id:"day",label:"My Day",href:"/tasks",icon:"✦"},
 {id:"all",label:"All Tasks",href:"/tasks?view=all",icon:"☷"},
 {id:"planner",label:"Planner",href:"/tasks/planner",icon:"▦"}
];
export function TasksPrimaryNav({section,inboxCount,onDashboardView}:Props){
 const selected=section==="board"||section==="inbox"||section==="connected"?"all":section==="focus"?"day":section;
 const render=(item:typeof links[number])=>{
  const active=selected===item.id;
  const children=<><span className="mt2-nav-emoji" aria-hidden="true">{item.icon}</span><span>{item.label}</span>{item.id==="all"&&typeof inboxCount==="number"&&inboxCount>0&&<span className="mt2-nav-count" title="Inbox tasks">{inboxCount}</span>}</>;
  const className=active?"is-active":"";
  if(onDashboardView&&(item.id==="day"||item.id==="all")){
   return <button type="button" key={item.id} className={className} aria-current={active?"page":undefined} onClick={()=>onDashboardView(item.id as "day"|"all")}>{children}</button>;
  }
  return <Link key={item.id} className={className} aria-current={active?"page":undefined} href={item.href}>{children}</Link>;
 };
 return <nav className="mt2-primary-nav" aria-label="My Tasks">
  <TasksQuickAdd/>
  {links.map(render)}
  <div className="mt2-nav-secondary"><Link className={section==="settings"?"is-active":""} href="/tasks/settings"><span className="mt2-nav-emoji" aria-hidden="true">⚙</span>Settings</Link></div>
 </nav>;
}
