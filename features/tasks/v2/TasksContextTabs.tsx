"use client";
import Link from "next/link";

type Tab="list"|"inbox"|"board"|"connected"|"focus";
export function TasksContextTabs({active,context,onChoose}:{active:Tab;context:"day"|"all";onChoose?:(tab:"list"|"inbox")=>void}){
 const tabs=context==="day"
  ?[{id:"list" as const,label:"My Day",href:"/tasks"},{id:"focus" as const,label:"Focus & Finish",href:"/tasks/focus"}]
  :[{id:"board" as const,label:"Visual Board",href:"/tasks/board"},{id:"list" as const,label:"List View",href:"/tasks?view=all"},{id:"inbox" as const,label:"Inbox",href:"/tasks?view=inbox"},{id:"connected" as const,label:"Connected Work",href:"/tasks/connected"}];
 return <nav className="mt2-context-tabs" aria-label={context==="day"?"Daily work views":"All task views"}>
  {tabs.map(tab=>onChoose&&(tab.id==="list"||tab.id==="inbox")
   ?<button type="button" key={tab.id} className={active===tab.id?"active":""} aria-current={active===tab.id?"page":undefined} onClick={()=>onChoose(tab.id)}>{tab.label}</button>
   :<Link key={tab.id} className={active===tab.id?"active":""} aria-current={active===tab.id?"page":undefined} href={tab.href}>{tab.label}</Link>)}
 </nav>;
}
